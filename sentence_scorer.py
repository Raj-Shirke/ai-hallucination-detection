import spacy
import json
import time
import ollama
from sentence_transformers import CrossEncoder

nlp = spacy.load("en_core_web_sm")
nli = CrossEncoder("cross-encoder/nli-deberta-v3-xsmall")
ENTAILMENT_IDX = 1
EXTRACT_MODEL = "llama3.2:3b"


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
        response = ollama.generate(
            model=EXTRACT_MODEL,
            prompt=prompt,
            options={"temperature": 0.0},
        )["response"]

        json_start = response.find("[")
        json_end = response.rfind("]") + 1
        claims = json.loads(response[json_start:json_end])

        claims = [c for c in claims if len(str(c).split()) >= 3]
        if len(claims) > 0:
            return [str(c) for c in claims]
        return [sentence]

    except Exception as e:
        print(f"  (extraction failed, using full sentence as fallback: {e})")
        return [sentence]


def hallucination_score(sentence, samples):
    pairs = [(sample, sentence) for sample in samples]
    scores = nli.predict(pairs, apply_softmax=True)
    entailment_scores = scores[:, ENTAILMENT_IDX]
    max_entailment = float(entailment_scores.max())
    return round(1.0 - max_entailment, 3)


def score_response(main_response, samples):
    sentences = split_sentences(main_response)
    scored = []

    for i, sent in enumerate(sentences):
        print(f"Scoring sentence {i+1}/{len(sentences)}...")
        atomic_claims = extract_atomic_claims(sent)
        highest_score = 0.0

        for claim in atomic_claims:
            score = hallucination_score(claim, samples)
            if score > highest_score:
                highest_score = score

        scored.append({
            "sentence": sent,
            "hallucination_score": highest_score,
            "atomic_claims": atomic_claims,
        })

    return scored


if __name__ == "__main__":
    main_response = (
        "Marie Curie was born in 1867 in Warsaw, Poland. "
        "She won the Nobel Prize in Physics in 1903. "
        "She was the first person to fly solo across the Atlantic Ocean."
    )

    samples = [
        "Marie Curie was born in 1867 in Warsaw. She won the Nobel Prize in Physics in 1903 and Chemistry in 1911.",
        "Marie Curie, born 1867 in Poland, was a physicist and chemist who won two Nobel Prizes.",
        "Born in 1867, Marie Curie discovered radioactivity and won Nobel Prizes in Physics and Chemistry.",
    ]

    start = time.time()
    results = score_response(main_response, samples)
    print(f"\nTotal scoring time: {time.time() - start:.1f}s")

    print("\n=== SENTENCE-LEVEL HALLUCINATION SCORES ===")
    for r in results:
        flag = "⚠️  LIKELY HALLUCINATED" if r["hallucination_score"] > 0.5 else "✅ supported"
        print(f"\n[{r['hallucination_score']}] {flag}")
        print(f"  \"{r['sentence']}\"")
        if len(r["atomic_claims"]) > 1:
            print("    --- Atomic Breakdown ---")
            for claim in r["atomic_claims"]:
                print(f"    - {claim}")