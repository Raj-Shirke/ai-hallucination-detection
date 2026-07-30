from sentence_transformers import CrossEncoder

nli = CrossEncoder("cross-encoder/nli-deberta-v3-xsmall")

# Reverted back to your correct original mapping
label_mapping = ["contradiction", "entailment", "neutral"]

def check_contradiction(sentence, supporting_text):
    scores = nli.predict([(supporting_text, sentence)], apply_softmax=True)
    label = label_mapping[scores.argmax(axis=1)[0]]
    return {"label": label, "probabilities": dict(zip(label_mapping, scores[0]))}

print("Test 1 (expect CONTRADICTION):")
print(check_contradiction("Marie Curie was born in 1867.", "Marie Curie was born in 1875."))

print("\nTest 2 (expect ENTAILMENT):")
print(check_contradiction("Marie Curie won a Nobel Prize.", "Marie Curie won the Nobel Prize in Physics in 1903."))

print("\nTest 3 (expect NEUTRAL):")
print(check_contradiction("Marie Curie enjoyed painting.", "Marie Curie discovered radium and polonium."))