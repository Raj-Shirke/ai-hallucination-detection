import { useState, useRef, useEffect } from "react";

export default function App() {
  const [prompt, setPrompt] = useState(
    "The Eiffel Tower was completed in 1889 and is located in Madrid, Spain.",
  );
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [selectedModel, setSelectedModel] = useState("llama3.2:3b");
  const [darkMode, setDarkMode] = useState(false); // Dark Mode State

  const fileInputRef = useRef(null);

  // Sync dark mode state with document root
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to extract text from file.");
      }

      const data = await response.json();
      setPrompt(data.extracted_text);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUploading(false);
      event.target.value = null;
    }
  };

  const analyzeTextStream = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setSelectedIdx(null);
    setStatusMessage("Connecting to streaming pipeline...");

    setResult({
      latency: 0,
      sentence_analysis: [],
    });

    try {
      const response = await fetch("http://127.0.0.1:8000/api/analyze/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, samples: 3, model: selectedModel }),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.replace("data: ", "").trim();
          if (!jsonStr) continue;

          try {
            const parsed = JSON.parse(jsonStr);

            if (parsed.type === "status") {
              setStatusMessage(parsed.message);
            } else if (parsed.type === "sentence") {
              setResult((prev) => ({
                ...prev,
                sentence_analysis: [...prev.sentence_analysis, parsed.data],
              }));
            } else if (parsed.type === "done") {
              setResult((prev) => ({
                ...prev,
                latency: parsed.latency,
              }));
              setStatusMessage("");
            }
          } catch (e) {
            console.error("Failed to parse SSE payload", e);
          }
        }
      }
    } catch (err) {
      setError(err.message || "Stream connection failed");
    } finally {
      setLoading(false);
    }
  };

  const exportAuditLog = () => {
    if (!result || !result.sentence_analysis.length) return;

    let content = `# AuditEngine Analysis Report\n\n`;
    content += `**Target Prompt:**\n> ${prompt.replace(/\n/g, "\n> ")}\n\n`;
    content += `### Metrics\n`;
    content += `- **Model:** ${selectedModel}\n`;
    content += `- **Latency:** ${result.latency}s\n`;
    content += `- **Flagged Claims:** ${result.sentence_analysis.filter((s) => s.flagged).length} / ${result.sentence_analysis.length}\n`;
    content += `- **Overall Rate:** ${((result.sentence_analysis.filter((s) => s.flagged).length / result.sentence_analysis.length) * 100).toFixed(0)}%\n\n`;
    content += `---\n\n## Sentence Dissection\n\n`;

    result.sentence_analysis.forEach((item, idx) => {
      content += `### ${idx + 1}. ${item.flagged ? "⚠️ FLAGGED (Potential Hallucination)" : "✅ VERIFIED"}\n`;
      content += `**Text:** ${item.sentence}\n\n`;
      content += `**NLI Score:** \`${item.score.toFixed(3)}\`\n\n`;

      if (item.atomic_claims && item.atomic_claims.length > 0) {
        content += `**Extracted Claims:**\n`;
        item.atomic_claims.forEach((claim) => {
          content += `- ${claim}\n`;
        });
        content += `\n`;
      }
      content += `---\n\n`;
    });

    const blob = new Blob([content], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `AuditEngine_${selectedModel}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalEvaluated = result?.sentence_analysis?.length || 0;
  const flaggedCount = result
    ? result.sentence_analysis.filter((s) => s.flagged).length
    : 0;

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans antialiased transition-colors duration-200">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-colors duration-200">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-3 text-sm">
            <span className="font-semibold tracking-tight text-zinc-900 dark:text-white">
              AuditEngine
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">/</span>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={loading}
              className="bg-transparent text-zinc-600 dark:text-zinc-400 font-mono text-xs outline-none cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
            >
              <option value="llama3.2:3b">llama3.2:3b</option>
              <option value="mistral">mistral</option>
              <option value="phi3">phi3</option>
            </select>
          </div>
          <div className="flex items-center space-x-4 font-mono text-xs text-zinc-500 dark:text-zinc-400">
            <div className="flex items-center space-x-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="hidden sm:inline">SSE Pipeline Ready</span>
            </div>
            <span className="text-zinc-200 dark:text-zinc-800">|</span>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-1 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
              aria-label="Toggle dark mode"
            >
              {darkMode ? (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 shadow-sm transition-colors duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Target Prompt
                </span>

                <div className="flex items-center space-x-4">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".txt,.pdf,.docx"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current.click()}
                    disabled={isUploading || loading}
                    className="flex items-center space-x-1.5 text-xs font-mono text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors disabled:opacity-50"
                  >
                    {isUploading ? (
                      <span className="animate-pulse">Extracting...</span>
                    ) : (
                      <>
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                          />
                        </svg>
                        <span>Upload File</span>
                      </>
                    )}
                  </button>
                  <span className="text-zinc-200 dark:text-zinc-800">|</span>
                  <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500">
                    k = 3
                  </span>
                </div>
              </div>

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={loading}
                placeholder="Type text or upload a PDF/DOCX to extract..."
                rows={7}
                className="w-full mt-3 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 bg-transparent border-0 outline-none resize-none leading-relaxed font-normal"
              />

              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
                <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500">
                  {prompt.split(/\s+/).filter(Boolean).length} words
                </span>
                <button
                  onClick={analyzeTextStream}
                  disabled={loading || !prompt.trim()}
                  className={`inline-flex items-center justify-center px-4 py-2 text-xs font-medium rounded-md tracking-tight transition-colors ${
                    loading || !prompt.trim()
                      ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed border border-zinc-200 dark:border-zinc-700"
                      : "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-[0.99]"
                  }`}
                >
                  {loading ? (
                    <span className="flex items-center space-x-2">
                      <span className="inline-block w-3 h-3 border-2 border-zinc-400 dark:border-zinc-500 border-t-transparent dark:border-t-transparent rounded-full animate-spin"></span>
                      <span>Streaming...</span>
                    </span>
                  ) : (
                    "Run Live Audit"
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-md p-3 text-xs text-rose-700 dark:text-rose-400 font-mono">
                Error: {error}
              </div>
            )}

            {result && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 grid grid-cols-3 divide-x divide-zinc-100 dark:divide-zinc-800/80 text-center shadow-sm transition-colors duration-200">
                <div>
                  <div className="text-[11px] font-mono uppercase text-zinc-400 dark:text-zinc-500">
                    Flagged
                  </div>
                  <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">
                    {flaggedCount}
                    <span className="text-xs text-zinc-400 dark:text-zinc-500 font-normal">
                      /{totalEvaluated}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-mono uppercase text-zinc-400 dark:text-zinc-500">
                    Rate
                  </div>
                  <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">
                    {totalEvaluated > 0
                      ? `${((flaggedCount / totalEvaluated) * 100).toFixed(0)}%`
                      : "0%"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-mono uppercase text-zinc-400 dark:text-zinc-500">
                    Latency
                  </div>
                  <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">
                    {result.latency > 0 ? `${result.latency}s` : "..."}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm overflow-hidden transition-colors duration-200">
              <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50 transition-colors">
                <div className="flex items-center space-x-4">
                  <span className="text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-semibold">
                    Live Dissection
                  </span>
                  {statusMessage && (
                    <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 animate-pulse">
                      {statusMessage}
                    </span>
                  )}
                </div>

                {totalEvaluated > 0 && !loading && (
                  <button
                    onClick={exportAuditLog}
                    className="flex items-center space-x-1.5 text-xs font-mono text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 rounded transition-all active:scale-95 shadow-sm"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    <span>Export .MD</span>
                  </button>
                )}
              </div>

              {!result && !loading && (
                <div className="py-20 text-center">
                  <p className="text-xs font-mono text-zinc-400 dark:text-zinc-500">
                    Awaiting execution pipeline...
                  </p>
                </div>
              )}

              {result && (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50 transition-colors">
                  {result.sentence_analysis.map((item, idx) => {
                    const isSelected = selectedIdx === idx;
                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedIdx(isSelected ? null : idx)}
                        className={`p-4 transition-colors cursor-pointer animate-fadeIn ${
                          isSelected
                            ? "bg-zinc-50 dark:bg-zinc-800/30"
                            : "hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <p
                            className={`text-sm leading-relaxed ${
                              item.flagged
                                ? "text-zinc-900 dark:text-zinc-100 font-medium"
                                : "text-zinc-600 dark:text-zinc-400"
                            }`}
                          >
                            <span
                              className={`mr-2.5 inline-block w-1.5 h-1.5 rounded-full ${
                                item.flagged
                                  ? "bg-amber-500"
                                  : "bg-zinc-300 dark:bg-zinc-600"
                              }`}
                            ></span>
                            {item.sentence}
                          </p>
                          <div className="flex items-center space-x-2 flex-shrink-0">
                            <span
                              className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                                item.flagged
                                  ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-500 border-amber-200 dark:border-amber-900"
                                  : "bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
                              }`}
                            >
                              {item.score.toFixed(3)}
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="mt-4 pt-3 border-t border-zinc-200/60 dark:border-zinc-700/60 pl-4 space-y-2">
                            <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                              Extracted Atomic Claims (
                              {item.atomic_claims.length})
                            </div>
                            <div className="space-y-1.5">
                              {item.atomic_claims.map((claim, cIdx) => (
                                <div
                                  key={cIdx}
                                  className="text-xs text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-2.5 py-1.5 font-mono flex items-center justify-between"
                                >
                                  <span>{claim}</span>
                                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase">
                                    eval
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
