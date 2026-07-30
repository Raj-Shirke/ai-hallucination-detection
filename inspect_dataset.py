from datasets import load_dataset

print("Loading WikiBio hallucination dataset...")
dataset = load_dataset("potsawee/wiki_bio_gpt3_hallucination", split="evaluation")

print(f"\nDataset size: {len(dataset)} passages")
print(f"\nColumns available: {dataset[0].keys()}")

example = dataset[0]
print(f"\n--- Example passage ---")
print(f"gpt3_text (first 300 chars): {example['gpt3_text'][:300]}")
print(f"\nNumber of sentences: {len(example['gpt3_sentences'])}")
print(f"First 3 sentences: {example['gpt3_sentences'][:3]}")
print(f"\nAnnotation labels (first 5): {example['annotation'][:5]}")
print(f"\nNumber of sample passages per entry: {len(example['gpt3_text_samples'])}")
print(f"First sample (first 200 chars): {example['gpt3_text_samples'][0][:200]}")