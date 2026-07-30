import time
from datasets import load_dataset
from sklearn.metrics import average_precision_score
from pipeline import prepare_premises, hallucination_score, clean_markdown

N_PASSAGES = 30
N_SAMPLES_PER_PASSAGE = 20


def label_to_binary(label):
    return 0 if label == "accurate" else 1


def run_evaluation():
    print("Loading dataset...")
    dataset = load_dataset("potsawee/wiki_bio_gpt3_hallucination", split="evaluation")
    dataset = dataset.select(range(min(N_PASSAGES, len(dataset))))

    all_scores = []
    all_labels = []

    start = time.time()
    for i, passage in enumerate(dataset):
        sentences = passage["gpt3_sentences"]
        annotations = passage["annotation"]
        samples = [clean_markdown(s) for s in passage["gpt3_text_samples"][:N_SAMPLES_PER_PASSAGE]]

        premises, premise_embeddings = prepare_premises(samples)

        for sent, label in zip(sentences, annotations):
            sent_clean = clean_markdown(sent)
            score = hallucination_score(sent_clean, premises, premise_embeddings)
            all_scores.append(score)
            all_labels.append(label_to_binary(label))

        print(f"  passage {i+1}/{len(dataset)} scored ({len(sentences)} sentences)")

    elapsed = time.time() - start
    print(f"\nTotal sentences evaluated: {len(all_scores)}")
    print(f"Total time: {elapsed:.1f}s ({elapsed/len(dataset):.2f}s per passage)")

    auc_pr = average_precision_score(all_labels, all_scores)
    print(f"\n=== RESULT (NLI + embedding combined scorer) ===")
    print(f"AUC-PR: {auc_pr:.4f}")
    print(f"Baseline: {sum(all_labels)/len(all_labels):.4f}")


if __name__ == "__main__":
    run_evaluation()