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
DEFAULT_MODEL = "llama3.2:3b"


def clean_markdown(text):
    text = re.sub(r"\*\*(.*?)\*\*", "", text)
    text = re.sub(r"\*(.*?)\*", r"\1", text)
    text = re.sub(r"#+\s*", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def generate_samples(prompt, model=DEFAULT_MODEL, n_samples=3):
    main_response = ollama.generate(
        model=model, prompt=prompt, options={"temperature": 0.1}
    )["response"]

    samples = []
    for i in range(n_samples):
        s = ollama.generate(
            model=model, prompt=prompt, options={"temperature": 0.9}
        )["response"]
        samples.append(s)

    return main_response, samples


def split_sentences(text):
    doc = nlp(text)
    return [sent.text.strip() for sent in doc.sents if sent.text.strip()]


def extract_atomic_claims(sentence, model=DEFAULT_MODEL):
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
            model=model,
            prompt=prompt,
            format="json",
            options={"temperature": 0.0, "num_predict": 256},
        )["response"]

        claims = json.loads(response)

        if isinstance(claims, dict):
            for value in claims.values():
                if isinstance(value, list):
                    claims = value
                    break

        if isinstance(claims, list):
            claims = [c for c in claims if len(str(c).split()) >= 3]
            return [str(c) for c in claims] if claims else [sentence]
        return [sentence]

    except Exception:
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


def detect_hallucinations_stream(prompt, model=DEFAULT_MODEL, n_samples=3):
    start_time = time.time()
    yield {"type": "status", "message": f"Sampling distributions via {model}..."}

    main_response, samples = generate_samples(prompt, model=model, n_samples=n_samples)
    main_response_clean = clean_markdown(main_response)
    samples_clean = [clean_markdown(s) for s in samples]

    yield {"type": "status", "message": "Encoding cross-attention premises..."}
    premises, premise_embeddings = prepare_premises(samples_clean)

    sentences = split_sentences(main_response_clean)
    yield {
        "type": "init",
        "total_sentences": len(sentences),
        "original_response": main_response_clean,
    }

    for i, sent in enumerate(sentences):
        yield {
            "type": "status",
            "message": f"Auditing sentence {i + 1} of {len(sentences)}...",
        }
        claims = extract_atomic_claims(sent, model=model)
        score = max(
            hallucination_score(c, premises, premise_embeddings) for c in claims
        )

        sentence_payload = {
            "sentence": sent,
            "score": score,
            "flagged": score > 0.5,
            "atomic_claims": claims,
        }
        yield {"type": "sentence", "data": sentence_payload}

    elapsed = round(time.time() - start_time, 2)
    yield {"type": "done", "latency": elapsed}