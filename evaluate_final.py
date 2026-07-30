import time
import csv
from datasets import load_dataset
from sentence_transformers import CrossEncoder
from sklearn.metrics import average_precision_score, precision_recall_curve
import matplotlib.pyplot as plt

nli = CrossEncoder("cross-encoder/nli-deberta-v3-xsmall")
ENTAILMENT_IDX = 1

N_SAMPLES_PER_PASSAGE = 20  # use all available samples for the final number


def hallucination_score(sentence, samples):
    pairs = [(sample, sentence) for sample in samples]
    scores = nli.predict(pairs, apply_softmax=True)
    entailment_scores = scores[:, ENTAILMENT_IDX]
    return round(1.0 - float(entailment_scores.max()), 3)


def label_to_binary(label):
    return 0 if label == "accurate" else 1


def run_evaluation():
    print("Loading full dataset (238 passages)...")
    dataset = load_dataset("potsawee/wiki_bio_gpt3_hallucination", split="evaluation")

    all_scores, all_labels, rows = [], [], []

    start = time.time()
    for i, passage in enumerate(dataset):
        sentences = passage["gpt3_sentences"]
        annotations = passage["annotation"]
        samples = passage["gpt3_text_samples"][:N_SAMPLES_PER_PASSAGE]

        for sent, label in zip(sentences, annotations):
            score = hallucination_score(sent, samples)
            binary_label = label_to_binary(label)

            all_scores.append(score)
            all_labels.append(binary_label)
            rows.append({
                "passage_id": i,
                "sentence": sent,
                "true_label": label,
                "binary_label": binary_label,
                "predicted_score": score,
                "predicted_flag": score > 0.5,
            })

        elapsed_so_far = time.time() - start
        avg_per_passage = elapsed_so_far / (i + 1)
        remaining = avg_per_passage * (len(dataset) - i - 1)
        print(f"  passage {i+1}/{len(dataset)} | elapsed {elapsed_so_far:.0f}s | est. remaining {remaining:.0f}s")

    total_time = time.time() - start

    # Save raw per-sentence results for error analysis in your report
    with open("evaluation_results.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    print("\nSaved per-sentence results to evaluation_results.csv")

    auc_pr = average_precision_score(all_labels, all_scores)
    baseline = sum(all_labels) / len(all_labels)

    print(f"\n=== FINAL RESULT ===")
    print(f"Passages evaluated: {len(dataset)}")
    print(f"Total sentences: {len(all_scores)}")
    print(f"Total time: {total_time:.1f}s")
    print(f"AUC-PR: {auc_pr:.4f}")
    print(f"Baseline: {baseline:.4f}")
    print(f"Improvement over baseline: +{auc_pr - baseline:.4f}")

    # Save a PR curve plot for your report
    precision, recall, _ = precision_recall_curve(all_labels, all_scores)
    plt.figure(figsize=(6, 5))
    plt.plot(recall, precision, label=f"Your detector (AUC-PR={auc_pr:.3f})")
    plt.axhline(y=baseline, linestyle="--", color="gray", label=f"Random baseline ({baseline:.3f})")
    plt.xlabel("Recall")
    plt.ylabel("Precision")
    plt.title("Precision-Recall Curve: Hallucination Detection on WikiBio")
    plt.legend()
    plt.tight_layout()
    plt.savefig("pr_curve.png", dpi=150)
    print("Saved PR curve plot to pr_curve.png")


if __name__ == "__main__":
    run_evaluation()