import ollama

def generate_samples(prompt, model="llama3.2:3b", n_samples=5):
    """
    Generates one 'main' low-temperature response (the one we'll fact-check)
    and N high-temperature samples (used as the consistency check).
    """
    main_response = ollama.generate(
        model=model,
        prompt=prompt,
        options={"temperature": 0.1}
    )["response"]

    samples = []
    for i in range(n_samples):
        sample = ollama.generate(
            model=model,
            prompt=prompt,
            options={"temperature": 0.9}
        )["response"]
        samples.append(sample)
        print(f"Sample {i+1} generated.")

    return main_response, samples


if __name__ == "__main__":
    # Pick a question likely to trigger hallucination on a small 3B model —
    # obscure facts work well as a test case
    prompt = "Tell me about the life and achievements of the scientist Marie Curie."

    main, samples = generate_samples(prompt, n_samples=3)  # start small, 3 not 5

    print("\n=== MAIN RESPONSE ===")
    print(main)

    print("\n=== SAMPLES ===")
    for i, s in enumerate(samples):
        print(f"\n--- Sample {i+1} ---")
        print(s)