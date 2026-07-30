from sentence_transformers import CrossEncoder

nli = CrossEncoder("cross-encoder/nli-deberta-v3-xsmall")
tokenizer = nli.tokenizer

# Simulate a long sample, similar in length to your Einstein output
long_sample = "Albert Einstein was born on March 14, 1879. " * 80  # ~600+ words
short_sentence = "Einstein was born in 1879."

encoded = tokenizer(long_sample, short_sentence, truncation=True)
print(f"Max model length: {tokenizer.model_max_length}")
print(f"Tokens in this pair after truncation: {len(encoded['input_ids'])}")

encoded_no_trunc = tokenizer(long_sample, short_sentence, truncation=False)
print(f"Tokens WITHOUT truncation: {len(encoded_no_trunc['input_ids'])}")