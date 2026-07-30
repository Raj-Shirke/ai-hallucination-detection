import ollama
import spacy
from sentence_transformers import SentenceTransformer

print("1. Testing Ollama...")
response = ollama.generate(model="llama3.2:3b", prompt="Say hello in 5 words.")
print("Ollama says:", response["response"])

print("\n2. Testing spaCy...")
nlp = spacy.load("en_core_web_sm")
doc = nlp("This is a test sentence. Here is another one.")
print("Sentences found:", [sent.text for sent in doc.sents])

print("\n3. Testing sentence-transformers...")
model = SentenceTransformer("all-MiniLM-L6-v2")
embedding = model.encode("Hello world")
print("Embedding shape:", embedding.shape)

print("\n All systems working.")