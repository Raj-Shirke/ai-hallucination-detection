import re
import spacy
import json
import time
import ollama
from sentence_transformers import CrossEncoder, SentenceTransformer, util

nlp = spacy.load("en_core_web_sm")
nli = CrossEncoder("cross-encoder/nli-deberta-v3-xsmall")
embedder = SentenceTransformer("all-MiniLM-L6-v2")
ENTAILMENT_IDX = 1
MODEL = "llama3.2:3b"


def clean_markdown(text):
    text = re.sub(r"\*\*(.*?)\*\*", "", text)
    text = re.sub(r"\*(.*?)\*", r"\1", text)
    text = re.sub(r"#+\s*", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def generate_samples(prompt, n_samples=3, progress_callback=None):
    if progress_callback:
        progress_callback(0.05, "Generating main response...")

    main_response = ollama.generate(
        model=MODEL, prompt=prompt, options={"temperature": 0.1}
    )["response"]

    samples = []
    for i in range(n_samples):
        if progress_callback:
            frac = 0.1 + 0.35 * (i / n_samples)
            progress_callback(frac, f"Generating comparison sample {i+1}/{n_samples}...")

        s = ollama.generate(
            model=MODEL, prompt=prompt, options={"temperature": 0.9}
        )["response"]
        samples.append(s)
        print(f"  sample {i+1}/{n_samples} generated")

    return main_response, samples


def split_sentences(text):
    doc = nlp(text)
    return [sent.text.strip() for sent in doc.sents if sent.text.strip()]


def extract_atomic_claims(sentence):
    if len(sentence.split()) < 6:
        return [sentence]

    prompt = f"""Break a sentence into atomic factual claims. Each claim must be a complete, standalone statement — never a single word or fragment.

Example:
Sentence: "Albert Einstein was born in 1879 in Ulm, Germany."
JSON array: ["Albert Einstein was born in 1879.", "Albert Einstein was born in Ulm.", "Albert Einstein was born in Germany."]

Now do the same for this sentence:
Sentence: "{sentence}"
JSON array:"""

    try:
        # UPDATED: Enforce JSON format and limit token output to prevent freezing
        response = ollama.generate(
            model=MODEL, 
            prompt=prompt, 
            format="json",
            options={
                "temperature": 0.0,
                "num_predict": 256
            }
        )["response"]

        # Directly parse the enforced JSON
        claims = json.loads(response)

        # Handle cases where Ollama wraps the array in a dictionary object
        if isinstance(claims, dict):
            for value in claims.values():
                if isinstance(value, list):
                    claims = value
                    break

        if isinstance(claims, list):
            claims = [c for c in claims if len(str(c).split()) >= 3]
            return [str(c) for c in claims] if claims else [sentence]
        else:
            return [sentence]

    except Exception as e:
        print(f"    (extraction failed, using full sentence as fallback: {e})")
        return [sentence]


def prepare_premises(samples):
    all_premises = []
    for sample in samples:
        all_premises.extend(split_sentences(sample))

    if not all_premises:
        return [], None

    premise_embeddings = embedder.encode(all_premises, convert_to_tensor=True)
    return all_premises, premise_embeddings


def hallucination_score(sentence, premises, premise_embeddings):
    if not premises:
        return 1.0

    pairs = [(premise, sentence) for premise in premises]
    nli_scores = nli.predict(pairs, apply_softmax=True)
    max_entailment = float(nli_scores[:, ENTAILMENT_IDX].max())
    nli_unsupported = 1.0 - max_entailment

    sent_emb = embedder.encode(sentence, convert_to_tensor=True)
    max_similarity = float(util.cos_sim(sent_emb, premise_embeddings).max())
    embedding_unsupported = 1.0 - max_similarity

    combined = (nli_unsupported + embedding_unsupported) / 2
    return round(combined, 3)


def detect_hallucinations(prompt, n_samples=3, progress_callback=None):
    print(f"Generating main response + {n_samples} samples for:\n  \"{prompt}\"\n")
    main_response, samples = generate_samples(prompt, n_samples, progress_callback)

    main_response_clean = clean_markdown(main_response)
    samples_clean = [clean_markdown(s) for s in samples]

    if progress_callback:
        progress_callback(0.45, "Preparing comparison data...")
    premises, premise_embeddings = prepare_premises(samples_clean)

    sentences = split_sentences(main_response_clean)
    print(f"\nScoring {len(sentences)} sentences...\n")

    results = []
    for i, sent in enumerate(sentences):
        if progress_callback:
            frac = 0.5 + 0.5 * (i / max(len(sentences), 1))
            progress_callback(frac, f"Checking sentence {i+1}/{len(sentences)}...")

        print(f"  sentence {i+1}/{len(sentences)}...")
        atomic_claims = extract_atomic_claims(sent)
        highest_score = max(
            hallucination_score(c, premises, premise_embeddings) for c in atomic_claims
        )
        results.append({
            "sentence": sent,
            "score": highest_score,
            "flagged": highest_score > 0.5,
            "atomic_claims": atomic_claims,
        })

    if progress_callback:
        progress_callback(1.0, "Done")

    return main_response_clean, results


def print_report(main_response, results):
    print("\n" + "=" * 60)
    print("FULL RESPONSE:")
    print(main_response)
    print("=" * 60)
    print("SENTENCE-LEVEL REPORT:\n")
    for r in results:
        tag = "⚠️  FLAGGED" if r["flagged"] else "✅ ok"
        print(f"[{r['score']:.3f}] {tag}")
        print(f"   {r['sentence']}")
        if len(r["atomic_claims"]) > 1:
            for c in r["atomic_claims"]:
                print(f"      - {c}")
        print()


if __name__ == "__main__":
    # UPDATED: Changed to a single sentence prompt to test system stability without overloading RAM
    prompt = "The Eiffel Tower was completed in 1889 and is located in Madrid, Spain."

    start = time.time()
    main_response, results = detect_hallucinations(prompt, n_samples=3)
    print(f"\nTotal time: {time.time() - start:.1f}s")

    print_report(main_response, results)