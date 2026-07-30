import ollama
import json
import time

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

    print("  → sending request to Ollama...")
    start = time.time()

    response = ollama.generate(
        model="llama3.2:3b",
        prompt=prompt,
        options={"temperature": 0.0},
    )["response"]

    elapsed = time.time() - start
    print(f"  → got response in {elapsed:.1f} seconds")
    print(f"  → raw output: {response}")

    try:
        json_start = response.find("[")
        json_end = response.rfind("]") + 1
        claims = json.loads(response[json_start:json_end])
        # Safety check: reject claims that are suspiciously short (single words) —
        # a sign the model fell back to word-splitting despite the example
        claims = [c for c in claims if len(str(c).split()) >= 3]
        if len(claims) > 0:
            return [str(c) for c in claims]
        return [sentence]
    except Exception as e:
        print(f"  (parsing failed: {e})")
        return [sentence]


if __name__ == "__main__":
    test_sentence = "Marie Curie was born in 1867 in Warsaw, Poland."
    print(f"Testing extraction on: \"{test_sentence}\"\n")

    result = extract_atomic_claims(test_sentence)

    print("\n=== RESULT ===")
    for claim in result:
        print(f"  - {claim}")