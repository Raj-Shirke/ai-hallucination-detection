import pandas as pd

df = pd.read_csv("evaluation_results.csv")

# False negatives: truly hallucinated, but your detector scored it low
false_negatives = df[(df["binary_label"] == 1) & (df["predicted_flag"] == False)]
print("=== FALSE NEGATIVES (missed hallucinations) ===")
print(false_negatives[["sentence", "true_label", "predicted_score"]].head(10).to_string())

# False positives: actually accurate, but your detector flagged it
false_positives = df[(df["binary_label"] == 0) & (df["predicted_flag"] == True)]
print("\n=== FALSE POSITIVES (wrongly flagged) ===")
print(false_positives[["sentence", "true_label", "predicted_score"]].head(10).to_string())