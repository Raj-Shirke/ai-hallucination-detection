# AuditEngine: Localized, Privacy-First LLM Hallucination Detection System

> An enterprise-grade, edge-computing architecture designed to audit Large Language Model (LLM) outputs in real-time, ensuring 100% data privacy and factual ground truth without relying on costly or privacy-violating commercial cloud APIs.

---

## 🚀 Key Features & Architecture

* **Air-Gapped Local Execution:** Runs completely offline on consumer-grade hardware (optimized for a 4.0 GB VRAM GPU envelope) using quantized models via Ollama.
* **Non-Blocking Streaming Pipeline:** Decouples backend processing using asynchronous **Server-Sent Events (SSE)** to stream real-time verification telemetry directly to the React UI.
* **Dynamic Consensus Sampling (k=3):** Generates reference ground truth on the fly by querying local models with controlled stochastic sampling (T=0.3).
* **Dual-Metric NLI Scoring:** Combines `DeBERTa-v3` cross-encoder entailment and `MiniLM` cosine similarity to compute a robust **Composite Hallucination Score (CHS)**.
* **Atomic Claim Decomposition:** Automatically parses complex responses into single-fact atomic claims using spaCy and JSON compilers for granular verification.

---

## 🛠️ Tech Stack

* **Backend:** Python, FastAPI, Uvicorn, spaCy, PyTorch (CUDA), Hugging Face Transformers
* **AI / LLM Runtime:** Ollama (`llama.cpp`), Llama 3.2 (3B), Phi-3 Mini (3.8B), Mistral (7B) with 4-bit GGUF quantization
* **Frontend:** React, Vite, Tailwind CSS, Server-Sent Events (SSE)
* **DevOps & Version Control:** Git, GitHub, Docker, Windows 11 (WSL / PowerShell)

---

## 📊 Performance Metrics & Benchmarks

* **Optimal Throughput:** Llama 3.2 (3B) completes a 200-word text audit in **80 seconds** within **2.0 GB VRAM**.
* **The Verbosity Paradox:** Empirically proved that models with concise instruction-following (`Mistral 7B` at 105s) outperform larger parameter models in cross-encoder latency overhead.
* **Discriminative Robustness:** Accurately distinguishes benign modifications (`CHS = 0.12` for synonym swaps) from factual fabrications (`CHS > 0.88` for contradictions).

---

## ⚙️ Getting Started & Local Installation

### 1. Clone the Repository
```bash
git clone https://github.com/Raj-Shirke/ai-hallucination-detection.git
cd ai-hallucination-detection

```

### 2. Start the Local LLM (Ollama)

Ensure [Ollama](https://ollama.com/) is installed and running with your target model:

```bash
ollama run llama3.2

```

### 3. Setup & Run the Backend

```python
# Create and activate virtual environment
python -m venv venv
# On Windows PowerShell:
.\venv\Scripts\Activate

# Install dependencies and start FastAPI server
pip install -r requirements.txt
uvicorn app:app --reload --port 8000

```

### 4. Setup & Run the Frontend

```bash
cd frontend
npm install
npm run dev

```

Open `http://localhost:5173` in your browser to access the AuditEngine dashboard.

---

## 💡 Project Workflow

1. **Ingestion:** Raw text or documents are uploaded.
2. **Segmentation:** spaCy splits text into clean sentence boundaries.
3. **Decomposition:** Sentences are broken into atomic claims.
4. **Sampling:** k=3 stochastic reference baselines are generated locally.
5. **Scoring:** Dual-metric NLI evaluation computes the Composite Hallucination Score (CHS).
6. **Telemetry:** Results stream instantly to the React UI via SSE.

---

## 👤 Author

* **Raj Anil Shirke**
* MCA Student & Developer
* [GitHub Profile]([https://www.google.com/search?q=https://github.com/Raj-Shirke](https://github.com/Raj-Shirke))

```

```
