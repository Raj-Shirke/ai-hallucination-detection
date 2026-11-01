import React, { useState, useRef, useEffect } from "react";

const SECTIONS = [
  { id: "home", label: "OVERVIEW", code: "01" },
  { id: "audit", label: "LIVE AUDIT", code: "02" },
  { id: "tech", label: "ARCHITECTURE", code: "03" },
  { id: "howto", label: "PROTOCOL", code: "04" },
  { id: "future", label: "HORIZONS", code: "05" },
  { id: "about", label: "ARCHITECTS", code: "06" },
];

// Math Helpers for Butter-Smooth Camera Splines
const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

export default function App() {
  const [activeIdx, setActiveIdx] = useState(0);

  // --- AuditEngine Core States ---
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

  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const stageRefs = useRef([]);
  const progressFillRef = useRef(null);

  // Physics Engine Refs (Zero React re-render overhead!)
  const targetScrollRef = useRef(0);
  const currentScrollRef = useRef(0);
  const activeIdxRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0, smoothX: 0, smoothY: 0 });

  const scrollToSection = (index) => {
    const maxScroll =
      document.documentElement.scrollHeight - window.innerHeight;
    const targetY = (index / (SECTIONS.length - 1)) * maxScroll;
    window.scrollTo({ top: targetY, behavior: "smooth" });
  };

  // --- Track Native Scroll & Mouse Parallax ---
  useEffect(() => {
    const handleScroll = () => {
      const maxScroll = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const raw = (window.scrollY / maxScroll) * (SECTIONS.length - 1);
      targetScrollRef.current = clamp(raw, 0, SECTIONS.length - 1);
    };

    const handleMouseMove = (e) => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  // --- Unified 60FPS Direct-DOM & 3D Canvas Engine ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // True Isometric 3D Cube Renderer with Smooth Rotation & Panel Seams
    const draw3DMonolith = (cx, cy, size, angleY, alpha, hasCutout) => {
      if (alpha <= 0.005 || size <= 2) return;
      ctx.save();
      ctx.globalAlpha = clamp(alpha, 0, 1);

      // Keep rotation angle strictly within [0.22, 1.35] radians so both faces stay visible and never snap
      const a = 0.62 + Math.sin(angleY) * 0.22;
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);

      const wL = size * cosA * 1.15;
      const wR = size * sinA * 1.15;
      const h = size * 1.18;
      const roofTilt = size * 0.28;

      // Ambient Volumetric Blue Halo
      const halo = ctx.createRadialGradient(
        cx,
        cy,
        size * 0.15,
        cx,
        cy,
        size * 2.5,
      );
      halo.addColorStop(0, "rgba(25, 145, 255, 0.36)");
      halo.addColorStop(0.45, "rgba(12, 85, 215, 0.12)");
      halo.addColorStop(1, "rgba(4, 12, 35, 0)");
      ctx.fillStyle = halo;
      ctx.fillRect(cx - size * 2.5, cy - size * 2.5, size * 5, size * 5);

      // 1. Top Roof Face
      ctx.beginPath();
      ctx.moveTo(cx + (wR - wL) * 0.5, cy - h / 2 - roofTilt);
      ctx.lineTo(cx + wR, cy - h / 2);
      ctx.lineTo(cx, cy - h / 2 + roofTilt);
      ctx.lineTo(cx - wL, cy - h / 2);
      ctx.closePath();
      const topGrad = ctx.createLinearGradient(
        cx - wL,
        cy - h / 2 - roofTilt,
        cx + wR,
        cy - h / 2 + roofTilt,
      );
      topGrad.addColorStop(0, "#4bb8ff");
      topGrad.addColorStop(1, "#1b7cf5");
      ctx.fillStyle = topGrad;
      ctx.fill();

      // 2. Left Face (Primary Lit Face)
      ctx.beginPath();
      ctx.moveTo(cx - wL, cy - h / 2);
      ctx.lineTo(cx, cy - h / 2 + roofTilt);
      ctx.lineTo(cx, cy + h / 2 + roofTilt);
      ctx.lineTo(cx - wL, cy + h / 2);
      ctx.closePath();
      const leftGrad = ctx.createLinearGradient(
        cx - wL,
        cy - h / 2,
        cx,
        cy + h / 2,
      );
      leftGrad.addColorStop(0, "#2492ff");
      leftGrad.addColorStop(0.55, "#1266db");
      leftGrad.addColorStop(1, "#08358a");
      ctx.fillStyle = leftGrad;
      ctx.fill();

      // Hubtown Signature Recessed Triangle Cutout on Left Face
      if (hasCutout) {
        ctx.beginPath();
        ctx.moveTo(cx - wL * 0.78, cy - h * 0.22);
        ctx.lineTo(cx - wL * 0.16, cy - h * 0.12);
        ctx.lineTo(cx - wL * 0.16, cy + h * 0.38);
        ctx.closePath();
        const cutGrad = ctx.createLinearGradient(
          cx - wL * 0.78,
          cy - h * 0.22,
          cx - wL * 0.16,
          cy + h * 0.38,
        );
        cutGrad.addColorStop(0, "#041b52");
        cutGrad.addColorStop(1, "#0a3b96");
        ctx.fillStyle = cutGrad;
        ctx.fill();
        ctx.strokeStyle = "rgba(105, 198, 255, 0.75)";
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

      // 3. Right Face (Deep Shaded Architectural Face)
      ctx.beginPath();
      ctx.moveTo(cx, cy - h / 2 + roofTilt);
      ctx.lineTo(cx + wR, cy - h / 2);
      ctx.lineTo(cx + wR, cy + h / 2);
      ctx.lineTo(cx, cy + h / 2 + roofTilt);
      ctx.closePath();
      const rightGrad = ctx.createLinearGradient(
        cx,
        cy - h / 2,
        cx + wR,
        cy + h / 2,
      );
      rightGrad.addColorStop(0, "#1268df");
      rightGrad.addColorStop(0.6, "#0c4cb3");
      rightGrad.addColorStop(1, "#052366");
      ctx.fillStyle = rightGrad;
      ctx.fill();

      // Subtle Architectural Panel Seams
      ctx.strokeStyle = "rgba(135, 210, 255, 0.22)";
      ctx.lineWidth = 0.8;
      for (let i = 1; i <= 3; i++) {
        const yOff = -h / 2 + (h / 4) * i;
        ctx.beginPath();
        ctx.moveTo(cx - wL, cy + yOff);
        ctx.lineTo(cx, cy + yOff + roofTilt);
        ctx.lineTo(cx + wR, cy + yOff);
        ctx.stroke();
      }

      // Specular Center Ridge Highlight
      ctx.beginPath();
      ctx.moveTo(cx, cy - h / 2 + roofTilt);
      ctx.lineTo(cx, cy + h / 2 + roofTilt);
      ctx.strokeStyle = "rgba(165, 225, 255, 0.55)";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Glowing Window Square on Right Face
      ctx.fillStyle = "rgba(95, 200, 255, 0.5)";
      ctx.fillRect(cx + wR * 0.48, cy - h * 0.08, size * 0.11, size * 0.12);

      ctx.restore();
    };

    // Bioluminescent Spores
    const spores = Array.from({ length: 120 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 2 + 0.6,
      vy: Math.random() * 0.00035 + 0.0001,
      phase: Math.random() * Math.PI * 2,
    }));

    const render = (now) => {
      const time = now * 0.001;

      // 1. Exponential Decay Lerp for Silky-Smooth Scroll & Mouse Parallax
      currentScrollRef.current +=
        (targetScrollRef.current - currentScrollRef.current) * 0.085;
      mouseRef.current.smoothX +=
        (mouseRef.current.x - mouseRef.current.smoothX) * 0.06;
      mouseRef.current.smoothY +=
        (mouseRef.current.y - mouseRef.current.smoothY) * 0.06;

      const s = currentScrollRef.current;
      const mx = mouseRef.current.smoothX * 18;
      const my = mouseRef.current.smoothY * 12;

      // Only update React state when active section integer changes!
      const nearestIdx = Math.round(s);
      if (nearestIdx !== activeIdxRef.current) {
        activeIdxRef.current = nearestIdx;
        setActiveIdx(nearestIdx);
      }

      // Update Sidebar Progress Bar Directly via DOM Ref
      if (progressFillRef.current) {
        const pct = clamp((s / (SECTIONS.length - 1)) * 100, 0, 100);
        progressFillRef.current.style.height = `${pct}%`;
      }

      // 2. Direct-DOM GPU Stage Transforms (Zero React Re-render Lag)
      stageRefs.current.forEach((el, idx) => {
        if (!el) return;
        const dist = s - idx;
        const absDist = Math.abs(dist);

        // Smooth bell-curve visibility window
        const opacity = clamp(1 - Math.pow(absDist * 1.15, 1.6), 0, 1);
        const translateY = dist * -85;
        const scale = 1 - clamp(absDist * 0.055, 0, 0.12);
        const blur = clamp((absDist - 0.15) * 7, 0, 10);

        el.style.opacity = opacity.toFixed(3);
        el.style.transform = `translate3d(0, ${translateY.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
        el.style.filter = blur > 0.2 ? `blur(${blur.toFixed(1)}px)` : "none";
        el.style.pointerEvents = absDist < 0.42 ? "auto" : "none";
        el.style.visibility = opacity <= 0.01 ? "hidden" : "visible";
      });

      // ===================================================================
      // 3. UNIFIED CONTINUOUS 3D WORLD RENDERING
      // ===================================================================
      ctx.clearRect(0, 0, width, height);

      // Deep Midnight Sky Gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, "#030714");
      skyGrad.addColorStop(0.52, "#071432");
      skyGrad.addColorStop(1, "#02040b");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // Continuous Camera Spline Weights
      const heroPhase = 1 - smoothstep(0.2, 1.6, s); // 1.0 at s=0, smoothly 0.0 by s=1.6
      const ribbonPhase =
        smoothstep(0.3, 1.2, s) * (1 - smoothstep(2.2, 3.4, s)); // Peaks across s=1..2.5
      const valleyPhase = smoothstep(1.8, 3.1, s); // Rises from s=1.8 and stays through s=5.0

      // Continuous Horizon Y position
      const horizonY =
        lerp(height * 0.62, height * 0.42, smoothstep(0, 3.0, s)) + my * 0.4;

      // Distant Mountain Silhouette (Continuously morphs across all 6 stages)
      ctx.beginPath();
      ctx.moveTo(0, horizonY - height * 0.16);
      ctx.bezierCurveTo(
        width * 0.28 - mx,
        horizonY - height * (0.24 - valleyPhase * 0.08),
        width * 0.62 + mx,
        horizonY - height * (0.08 + ribbonPhase * 0.18),
        width,
        horizonY - height * 0.19,
      );
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      const mtnGrad = ctx.createLinearGradient(
        0,
        horizonY - height * 0.25,
        0,
        height,
      );
      mtnGrad.addColorStop(0, "#050d22");
      mtnGrad.addColorStop(0.6, "#030713");
      mtnGrad.addColorStop(1, "#010308");
      ctx.fillStyle = mtnGrad;
      ctx.fill();

      // --- SCENE ELEMENT A: Primary Hero Monolith (Smoothly recedes into valley as you scroll) ---
      const mainCubeX =
        lerp(width * 0.5, width * 0.28, smoothstep(0.4, 3.0, s)) - mx * 0.8;
      const mainCubeY =
        lerp(height * 0.37, height * 0.38, smoothstep(0, 3.0, s)) -
        ribbonPhase * 35 +
        my * 0.5;
      const mainCubeSize =
        Math.min(width, height) * lerp(0.195, 0.105, smoothstep(0.3, 2.8, s));
      const mainCubeAlpha = clamp(heroPhase + valleyPhase * 0.95, 0.22, 1);

      draw3DMonolith(
        mainCubeX,
        mainCubeY,
        mainCubeSize,
        s * 0.9 + time * 0.25,
        mainCubeAlpha,
        heroPhase > 0.35,
      );

      // --- SCENE ELEMENT B: Twin Blue Slopes & Water Reflections (Stage 0 -> Stage 1.5) ---
      if (heroPhase > 0.01) {
        ctx.save();
        ctx.globalAlpha = heroPhase;

        // Left Illuminated Slope
        ctx.beginPath();
        ctx.moveTo(0, height * 0.43 + my * 0.3);
        ctx.quadraticCurveTo(
          width * 0.13,
          height * 0.5,
          width * 0.29,
          horizonY,
        );
        ctx.lineTo(0, horizonY);
        ctx.closePath();
        const leftSlope = ctx.createLinearGradient(
          0,
          height * 0.43,
          width * 0.29,
          horizonY,
        );
        leftSlope.addColorStop(0, "#091b42");
        leftSlope.addColorStop(0.55, "#1e78ed");
        leftSlope.addColorStop(1, "#040b1c");
        ctx.fillStyle = leftSlope;
        ctx.fill();

        // Right Illuminated Slope
        ctx.beginPath();
        ctx.moveTo(width, height * 0.36 + my * 0.3);
        ctx.quadraticCurveTo(
          width * 0.85,
          height * 0.45,
          width * 0.71,
          horizonY,
        );
        ctx.lineTo(width, horizonY);
        ctx.closePath();
        const rightSlope = ctx.createLinearGradient(
          width,
          height * 0.36,
          width * 0.71,
          horizonY,
        );
        rightSlope.addColorStop(0, "#2686ff");
        rightSlope.addColorStop(0.65, "#1149ad");
        rightSlope.addColorStop(1, "#040b1c");
        ctx.fillStyle = rightSlope;
        ctx.fill();

        // Rippling Dark Water Reflection Plane
        const waterGrad = ctx.createLinearGradient(0, horizonY, 0, height);
        waterGrad.addColorStop(0, "#061536");
        waterGrad.addColorStop(0.5, "#030a1c");
        waterGrad.addColorStop(1, "#010308");
        ctx.fillStyle = waterGrad;
        ctx.fillRect(0, horizonY, width, height - horizonY);

        // Animated Water Reflection Columns under the Monolith
        for (let i = 0; i < 38; i++) {
          const py = i / 38;
          const ry = horizonY + py * (height - horizonY);
          const spread = mainCubeSize * (0.85 + py * 1.35);
          const wave = Math.sin(time * 2.2 + i * 0.65) * (12 * py + 2);
          const lineAlpha = (1 - py * 0.78) * 0.34 * heroPhase;

          ctx.fillStyle = `rgba(42, 152, 255, ${lineAlpha})`;
          ctx.fillRect(
            mainCubeX - spread * 0.5 + wave,
            ry,
            spread,
            1.4 + py * 2.2,
          );
        }
        ctx.restore();
      }

      // --- SCENE ELEMENT C: Diagonal Sweeping Light-Stream Ribbon (Stages 1 & 2) ---
      if (ribbonPhase > 0.01) {
        ctx.save();
        ctx.globalAlpha = ribbonPhase;

        const streamProgress = clamp((s - 0.3) / 2.2, 0, 1);

        for (let i = 0; i < 24; i++) {
          const offset = (i - 12) * 5;
          const isCore = Math.abs(i - 12) < 3;

          ctx.beginPath();
          ctx.moveTo(width * 0.02 + offset * 1.4, height * 0.98);
          ctx.quadraticCurveTo(
            width * (0.44 - streamProgress * 0.08) + offset + mx * 0.6,
            height * 0.54 + offset * 0.55 + my * 0.5,
            width * 0.95,
            height * (0.16 + streamProgress * 0.08) + offset * 0.3,
          );

          ctx.strokeStyle = isCore
            ? `rgba(115, 215, 255, ${0.65 * ribbonPhase})`
            : `rgba(28, 128, 255, ${0.22 * ribbonPhase})`;
          ctx.lineWidth = isCore ? 2.0 : 0.95;
          ctx.stroke();
        }
        ctx.restore();
      }

      // --- SCENE ELEMENT D: Multi-Monolith Valley & Converging Streams (Stages 3, 4, 5) ---
      if (valleyPhase > 0.01) {
        const vShift = (s - 2.5) * 28;

        // Distant Valley City Nodes
        ctx.save();
        ctx.globalAlpha = valleyPhase * 0.7;
        for (let i = 0; i < 32; i++) {
          const gx = (((i * 97) % 100) / 100) * width - vShift * 0.25;
          const gy = horizonY + ((i * 29) % 12) * 3.2;
          ctx.fillStyle = "#33a6ff";
          ctx.fillRect(gx, gy, 3, 3);
        }
        ctx.restore();

        // Center Distant Monolith
        draw3DMonolith(
          width * 0.51 - mx * 0.4,
          horizonY + height * 0.04,
          Math.min(width, height) * 0.055,
          -s * 0.6 + time * 0.2,
          valleyPhase,
          false,
        );

        // Right Secondary Monolith
        draw3DMonolith(
          width * 0.71 + vShift * 0.2 - mx * 0.6,
          horizonY - height * 0.01,
          Math.min(width, height) * 0.1,
          s * 0.75 + 1.2 + time * 0.2,
          valleyPhase,
          false,
        );

        // Converging Valley Fiber-Optic Streams
        ctx.save();
        ctx.globalAlpha = valleyPhase;
        for (let idx = 0; idx < 15; idx++) {
          const sp = (idx - 7) * 6.5;
          const isBright = idx % 4 === 0;

          ctx.strokeStyle = isBright
            ? `rgba(92, 212, 255, ${0.55 * valleyPhase})`
            : `rgba(25, 132, 255, ${0.22 * valleyPhase})`;
          ctx.lineWidth = isBright ? 1.5 : 0.85;

          // Left-to-Foreground Stream
          ctx.beginPath();
          ctx.moveTo(width * 0.04, horizonY + height * 0.06 + sp * 0.2);
          ctx.bezierCurveTo(
            width * 0.26,
            horizonY + height * 0.15 + sp * 0.4,
            width * 0.35,
            horizonY + height * 0.31 + sp * 0.7,
            width * 0.27 + sp * 1.9 - vShift * 0.5,
            height,
          );
          ctx.stroke();

          // Right-to-Foreground Stream
          ctx.beginPath();
          ctx.moveTo(width * 0.64, horizonY + height * 0.08 + sp * 0.15);
          ctx.bezierCurveTo(
            width * 0.49,
            horizonY + height * 0.19 + sp * 0.35,
            width * 0.4,
            horizonY + height * 0.35 + sp * 0.65,
            width * 0.24 + sp * 2.1 - vShift * 0.5,
            height,
          );
          ctx.stroke();
        }
        ctx.restore();
      }

      // Floating Bioluminescent Particles
      spores.forEach((sp) => {
        sp.y -= sp.vy;
        sp.phase += 0.025;
        if (sp.y < 0.12) sp.y = 0.96;

        const sx = sp.x * width - mx * 0.5;
        const sy = sp.y * height - my * 0.5;
        const alpha = 0.25 + 0.45 * Math.sin(sp.phase);

        ctx.beginPath();
        ctx.arc(sx, sy, sp.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(120, 190, 255, ${alpha})`;
        ctx.fill();
      });

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // --- File Upload Handler ---
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

  // --- SSE Stream Processing ---
  const analyzeTextStream = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setSelectedIdx(null);
    setStatusMessage("Generating k=3 consensus & running DeBERTa NLI...");

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

  // --- Export Markdown Report ---
  const exportAuditLog = () => {
    if (!result || !result.sentence_analysis.length) return;

    let content = `# AuditEngine Analysis Report\n\n`;
    content += `**Target Prompt:**\n> ${prompt.replace(/\n/g, "\n> ")}\n\n`;
    content += `### Metrics\n`;
    content += `- **Model:** ${selectedModel}\n`;
    content += `- **Latency:** ${result.latency}s\n`;
    content += `- **Flagged Claims:** ${
      result.sentence_analysis.filter((s) => s.flagged).length
    } / ${result.sentence_analysis.length}\n`;
    content += `- **Overall Rate:** ${(
      (result.sentence_analysis.filter((s) => s.flagged).length /
        result.sentence_analysis.length) *
      100
    ).toFixed(0)}%\n\n`;
    content += `---\n\n## Sentence Dissection\n\n`;

    result.sentence_analysis.forEach((item, idx) => {
      content += `### ${idx + 1}. ${
        item.flagged ? "⚠️ FLAGGED (Potential Hallucination)" : "✅ VERIFIED"
      }\n`;
      content += `**Text:** ${item.sentence}\n\n`;
      content += `**NLI Score:** \`${(item.score ?? 0).toFixed(3)}\`\n\n`;

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
  const errorRate =
    totalEvaluated > 0 ? Math.round((flaggedCount / totalEvaluated) * 100) : 0;

  return (
    <div className="relative w-full min-h-screen bg-[#030714] text-white select-none font-hubtown overflow-x-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        html, body, #root {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          display: block !important;
          background-color: #030714 !important;
          overflow-x: hidden !important;
        }

        .font-hubtown {
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        .font-mono-tech {
          font-family: 'JetBrains Mono', monospace;
        }

        .gpu-stage {
          will-change: transform, opacity, filter;
          backface-visibility: hidden;
          transform-style: preserve-3d;
        }

        .hubtown-chamfer-btn {
          position: relative;
          background: rgba(10, 22, 52, 0.72);
          border: 1px solid rgba(110, 175, 255, 0.42);
          clip-path: polygon(
            0 0,
            calc(100% - 13px) 0,
            100% 13px,
            100% 100%,
            13px 100%,
            0 calc(100% - 13px)
          );
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .hubtown-chamfer-btn:hover {
          background: rgba(32, 122, 255, 0.35);
          border-color: rgba(165, 215, 255, 0.95);
          box-shadow: 0 0 28px rgba(32, 128, 255, 0.45);
          transform: translateY(-1px);
        }

        .glass-card {
          background: linear-gradient(145deg, rgba(8, 18, 42, 0.84), rgba(4, 10, 26, 0.92));
          backdrop-filter: blur(16px);
          border: 1px solid rgba(100, 165, 255, 0.22);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55);
        }

        ::-webkit-scrollbar {
          width: 5px;
        }
        ::-webkit-scrollbar-track {
          background: #02050e;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(70, 145, 255, 0.38);
          border-radius: 3px;
        }
      `}</style>

      {/* 1. FIXED 60FPS 3D WORLD CANVAS */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-screen h-screen pointer-events-none z-0"
      />

      {/* 2. FIXED OUTER CHAMFERED ARCHITECTURAL FRAME */}
      <svg
        className="fixed inset-0 w-screen h-screen pointer-events-none z-30"
        preserveAspectRatio="none"
      >
        <path
          d="M 52,16 L calc(100% - 16px),16 L calc(100% - 16px),calc(100% - 16px) L 16,calc(100% - 16px) L 16,52 Z"
          fill="none"
          stroke="rgba(120, 170, 245, 0.18)"
          strokeWidth="1"
        />
        <line
          x1="16"
          y1="52"
          x2="52"
          y2="16"
          stroke="rgba(120, 170, 245, 0.42)"
          strokeWidth="1.2"
        />
      </svg>

      {/* 3. FIXED TOP NAVIGATION BAR */}
      <header className="fixed top-8 left-12 right-12 z-40 flex items-center justify-between pointer-events-none">
        <div
          onClick={() => scrollToSection(0)}
          className="pointer-events-auto cursor-pointer group flex items-center gap-3"
        >
          <svg
            width="205"
            height="24"
            viewBox="0 0 235 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="transition-transform duration-300 group-hover:scale-[1.02]"
          >
            <path
              d="M2 26V4H22V26H17.5V16.5H6.5V26H2ZM6.5 12.5H17.5V8H6.5V12.5Z"
              fill="#E2ECFF"
            />
            <path d="M30 4H34.5V21.5H45.5V4H50V26H30V4Z" fill="#E2ECFF" />
            <path
              d="M58 4H74L78 8V22L74 26H58V4ZM62.5 8V21.5H72L73.5 20V9.5L72 8H62.5Z"
              fill="#E2ECFF"
            />
            <path d="M86 4H91V26H86V4Z" fill="#E2ECFF" />
            <path d="M99 4H119V8.5H111.2V26H106.7V8.5H99V4Z" fill="#E2ECFF" />
            <g transform="translate(127, 4)">
              <rect
                x="1"
                y="1"
                width="20"
                height="20"
                stroke="#E2ECFF"
                strokeWidth="3.2"
              />
              <polygon points="0,0 22,22 0,22" fill="#E2ECFF" />
            </g>
            <path d="M157 26V4H177V26H172.5V8.5H161.5V26H157Z" fill="#E2ECFF" />
            <path
              d="M185 4H205V8.5H189.5V21.5H200.5V15H194.5V11H205V26H185V4Z"
              fill="#E2ECFF"
            />
          </svg>
        </div>

        <div className="hidden md:flex items-center gap-7 pointer-events-auto">
          {SECTIONS.map((sec, idx) => (
            <button
              key={sec.id}
              onClick={() => scrollToSection(idx)}
              className={`text-[11px] tracking-[0.24em] uppercase transition-all duration-300 cursor-pointer ${
                activeIdx === idx
                  ? "text-white font-semibold drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {sec.label}
            </button>
          ))}

          <button
            onClick={() => scrollToSection(1)}
            className="hubtown-chamfer-btn px-5 py-2.5 flex items-center gap-2.5 text-[10px] tracking-[0.25em] uppercase text-white font-medium cursor-pointer"
          >
            <span className="grid grid-cols-2 gap-0.5 w-2.5 h-2.5">
              <span className="w-1 h-1 bg-blue-400" />
              <span className="w-1 h-1 bg-transparent" />
              <span className="w-1 h-1 bg-transparent" />
              <span className="w-1 h-1 bg-white" />
            </span>
            <span>LIVE STUDIO</span>
          </button>
        </div>
      </header>

      {/* 4. FIXED BOTTOM-LEFT VERTICAL SLIDER BAR WITH PROGRESS LINE */}
      <aside className="fixed left-10 bottom-12 z-40 hidden lg:flex items-center gap-5 pointer-events-auto">
        {/* Continuous Vertical Scroll Progress Track */}
        <div className="w-[2px] h-48 bg-slate-800/80 relative overflow-hidden rounded-full">
          <div
            ref={progressFillRef}
            className="w-full bg-gradient-to-b from-blue-400 to-cyan-300 shadow-[0_0_10px_#60a5fa]"
            style={{ height: "0%" }}
          />
        </div>

        <div className="flex flex-col gap-3.5">
          {SECTIONS.map((sec, idx) => {
            const isActive = activeIdx === idx;
            return (
              <button
                key={sec.id}
                onClick={() => scrollToSection(idx)}
                className="group flex items-center text-left py-0.5 cursor-pointer focus:outline-none"
              >
                <span
                  className={`font-mono-tech text-[10px] mr-3 transition-colors duration-300 ${
                    isActive
                      ? "text-blue-400 font-semibold"
                      : "text-slate-600 group-hover:text-slate-400"
                  }`}
                >
                  {sec.code}
                </span>
                <span
                  className={`text-[11px] tracking-[0.3em] uppercase transition-all duration-300 ${
                    isActive
                      ? "text-white font-semibold translate-x-1.5 drop-shadow-[0_0_10px_rgba(255,255,255,0.75)]"
                      : "text-slate-500/80 group-hover:text-slate-300"
                  }`}
                >
                  {sec.label}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* =================================================================
          STAGE 01: HERO MONOLITH
         ================================================================= */}
      <div
        ref={(el) => (stageRefs.current[0] = el)}
        className="gpu-stage fixed inset-0 w-screen h-screen z-20 flex flex-col items-center justify-center px-6 sm:px-16 text-center"
      >
        <div className="max-w-4xl flex flex-col items-center mt-24">
          <span className="font-mono-tech text-[10px] tracking-[0.32em] uppercase text-blue-300/90 mb-3 px-3.5 py-1 border border-blue-400/25 bg-blue-950/30">
            AIR-GAPPED EDGE NLI VERIFICATION
          </span>

          <h1 className="text-3xl sm:text-5xl lg:text-[54px] font-semibold tracking-[0.15em] uppercase leading-[1.2] text-white drop-shadow-[0_6px_28px_rgba(0,0,0,0.9)]">
            WE BUILD THE FUTURE
            <br />
            <span className="text-blue-200">OF FACTUAL AI AUDITING</span>
          </h1>

          <p className="mt-6 text-slate-200/90 text-xs sm:text-sm lg:text-[15px] leading-relaxed max-w-2xl font-light tracking-wide drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
            AuditEngine has created a privacy-preserving edge verification
            architecture spanning real-time Server-Sent Events (SSE), DeBERTa-v3
            Cross-Encoders, and 4-bit quantized LLMs. From raw generative claims
            to verified truth within a strict 4.0 GB VRAM envelope.
          </p>

          <button
            onClick={() => scrollToSection(1)}
            className="hubtown-chamfer-btn mt-9 px-8 py-4 flex items-center gap-3 text-[11px] tracking-[0.26em] uppercase font-semibold text-white cursor-pointer"
          >
            <span className="grid grid-cols-2 gap-0.5 w-2.5 h-2.5">
              <span className="w-1 h-1 bg-white" />
              <span className="w-1 h-1 bg-blue-400" />
              <span className="w-1 h-1 bg-blue-400" />
              <span className="w-1 h-1 bg-white" />
            </span>
            <span>EXPLORE LIVE AUDIT STUDIO</span>
          </button>
        </div>
      </div>

      {/* =================================================================
          STAGE 02: LIVE AUDIT STUDIO
         ================================================================= */}
      <div
        ref={(el) => (stageRefs.current[1] = el)}
        className="gpu-stage fixed inset-0 w-screen h-screen z-20 flex flex-col items-center justify-center px-6 sm:px-16 select-text"
      >
        <div className="w-full max-w-5xl lg:pl-32">
          <div className="text-center mb-5">
            <span className="font-mono-tech text-[10px] tracking-[0.3em] uppercase text-blue-400 block mb-1">
              02 / REAL-TIME SSE DISSECTION PIPELINE
            </span>
            <h2 className="text-2xl sm:text-4xl font-semibold tracking-[0.15em] uppercase text-white">
              WE LEAD THE WAY IN{" "}
              <span className="text-blue-400">LIVE NLI DISSECTION</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Prompt Box */}
            <div className="lg:col-span-5 space-y-4">
              <div className="glass-card p-5">
                <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="font-mono-tech text-[10px] uppercase tracking-[0.22em] text-blue-300">
                      Model:
                    </span>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      disabled={loading}
                      className="bg-transparent font-mono-tech text-xs text-white focus:outline-none uppercase cursor-pointer"
                    >
                      <option value="llama3.2:3b" className="bg-[#040816]">
                        llama3.2:3b
                      </option>
                      <option value="mistral" className="bg-[#040816]">
                        mistral:7b
                      </option>
                      <option value="phi3" className="bg-[#040816]">
                        phi3:mini
                      </option>
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
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
                      className="font-mono-tech text-[10px] text-blue-300 hover:text-white uppercase tracking-wider cursor-pointer"
                    >
                      {isUploading ? "Extracting..." : "+ Upload File"}
                    </button>
                  </div>
                </div>

                <textarea
                  rows={4}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={loading}
                  placeholder="Enter claim passage or upload PDF/DOCX..."
                  className="w-full bg-transparent border-0 text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none leading-relaxed"
                />

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="font-mono-tech text-[11px] text-slate-400">
                    {prompt.trim().split(/\s+/).filter(Boolean).length} words •
                    k=3
                  </span>

                  <button
                    onClick={analyzeTextStream}
                    disabled={loading || !prompt.trim()}
                    className="hubtown-chamfer-btn px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-white cursor-pointer"
                  >
                    {loading ? "STREAMING..." : "RUN LIVE AUDIT"}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-rose-950/75 border border-rose-700 text-xs text-rose-200 font-mono-tech">
                  Error: {error}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="glass-card p-3 text-center">
                  <div className="font-mono-tech text-[9px] uppercase tracking-[0.2em] text-slate-400">
                    Flagged
                  </div>
                  <div className="text-xl font-semibold text-rose-400 mt-0.5 font-mono-tech">
                    {flaggedCount}/{totalEvaluated}
                  </div>
                </div>
                <div className="glass-card p-3 text-center">
                  <div className="font-mono-tech text-[9px] uppercase tracking-[0.2em] text-slate-400">
                    Drift Rate
                  </div>
                  <div className="text-xl font-semibold text-white mt-0.5 font-mono-tech">
                    {errorRate}%
                  </div>
                </div>
                <div className="glass-card p-3 text-center">
                  <div className="font-mono-tech text-[9px] uppercase tracking-[0.2em] text-slate-400">
                    Latency
                  </div>
                  <div className="text-xl font-semibold text-blue-400 mt-0.5 font-mono-tech">
                    {result?.latency ? `${result.latency}s` : "--"}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Dissection Stream */}
            <div className="lg:col-span-7 glass-card p-5 min-h-[320px] flex flex-col">
              <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="font-mono-tech text-[10px] uppercase tracking-[0.24em] text-blue-300">
                    Live Dissection Telemetry
                  </span>
                  {statusMessage && (
                    <span className="font-mono-tech text-[10px] text-amber-300 animate-pulse">
                      — {statusMessage}
                    </span>
                  )}
                </div>

                {totalEvaluated > 0 && !loading && (
                  <button
                    onClick={exportAuditLog}
                    className="font-mono-tech text-[10px] uppercase tracking-[0.2em] px-2.5 py-1 border border-blue-400/40 text-blue-300 hover:bg-blue-400 hover:text-slate-950 transition-all cursor-pointer"
                  >
                    Export .MD ↓
                  </button>
                )}
              </div>

              {!result && !loading && (
                <div className="flex-1 flex flex-col items-center justify-center py-14 text-center">
                  <p className="font-mono-tech text-xs uppercase tracking-[0.25em] text-slate-400">
                    Awaiting Execution Trigger...
                  </p>
                </div>
              )}

              {result && (
                <div className="space-y-2.5 overflow-y-auto max-h-[250px] pr-1">
                  {result.sentence_analysis.map((item, idx) => {
                    const isSelected = selectedIdx === idx;
                    const isFlagged = item.flagged;
                    const scoreVal = item.score ?? 0;

                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedIdx(isSelected ? null : idx)}
                        className={`p-3 border transition-all cursor-pointer ${
                          isFlagged
                            ? "bg-rose-950/40 border-rose-700/80"
                            : "bg-emerald-950/25 border-emerald-700/70"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-xs sm:text-sm leading-relaxed text-white">
                            {item.sentence}
                          </p>
                          <span className="font-mono-tech text-[11px] px-2 py-0.5 bg-slate-950/80 border border-slate-700 text-blue-300 flex-shrink-0">
                            {scoreVal.toFixed(3)}
                          </span>
                        </div>

                        <div className="mt-2 pt-1.5 border-t border-white/10 flex justify-between items-center font-mono-tech text-[9px] uppercase tracking-[0.2em] text-slate-400">
                          <span
                            className={
                              isFlagged ? "text-rose-400" : "text-emerald-400"
                            }
                          >
                            {isFlagged
                              ? "⚠️ Hallucination Flagged"
                              : "✅ Verified Grounded"}
                          </span>
                          <span className="text-blue-300">
                            {isSelected
                              ? "▲ Hide Claims"
                              : `▼ Atomic Claims (${
                                  item.atomic_claims?.length || 0
                                })`}
                          </span>
                        </div>

                        {isSelected && (
                          <div className="mt-2 pt-2 border-t border-slate-800 space-y-1">
                            {item.atomic_claims?.map((claim, cIdx) => (
                              <div
                                key={cIdx}
                                className="text-xs font-mono-tech text-slate-300 bg-slate-950/90 px-2.5 py-1 flex justify-between"
                              >
                                <span>{claim}</span>
                                <span className="text-blue-400">
                                  0{cIdx + 1}
                                </span>
                              </div>
                            ))}
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
      </div>

      {/* =================================================================
          STAGE 03: ARCHITECTURE (TECHNOLOGIES USED)
         ================================================================= */}
      <div
        ref={(el) => (stageRefs.current[2] = el)}
        className="gpu-stage fixed inset-0 w-screen h-screen z-20 flex flex-col items-center justify-center px-6 sm:px-16 text-center"
      >
        <div className="max-w-4xl w-full flex flex-col items-center lg:pl-20">
          <span className="font-mono-tech text-[11px] tracking-[0.3em] uppercase text-blue-400 mb-3">
            03 / 3-TIER EDGE COMPUTING STACK
          </span>
          <h2 className="text-3xl sm:text-5xl font-semibold tracking-[0.14em] uppercase leading-tight text-white">
            ENGINEERED FOR ZERO-TRUST
            <br />
            <span className="text-blue-200">4.0 GB VRAM EXECUTION</span>
          </h2>

          <p className="mt-4 text-slate-200/90 text-xs sm:text-sm max-w-2xl font-light leading-relaxed">
            Instead of sending sensitive clinical or legal data to external
            cloud APIs, AuditEngine orchestrates quantized GGUF inference and
            dual NLI transformers locally with explicit{" "}
            <code className="text-blue-300">torch.no_grad()</code> memory
            guardrails.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 w-full text-left">
            {[
              {
                tag: "SSE ORCHESTRATION",
                name: "FastAPI + React Vite",
                desc: "Asynchronous text/event-stream pipeline streaming sentence-level JSON evaluations in real time.",
              },
              {
                tag: "CROSS-ENCODER NLI",
                name: "DeBERTa-v3 + MiniLM",
                desc: "Combines full self-attention Entailment scoring with 384-D Cosine Similarity vector drift detection.",
              },
              {
                tag: "LOCAL GGUF RUNTIME",
                name: "Ollama + spaCy NLP",
                desc: "Runs 4-bit quantized Llama 3.2, Mistral 7B, and Phi-3 with regex-sanitized atomic claim extraction.",
              },
            ].map((t, i) => (
              <div key={i} className="glass-card p-5">
                <div className="font-mono-tech text-[10px] text-blue-400 tracking-[0.22em]">
                  {t.tag}
                </div>
                <div className="text-base font-semibold text-white mt-1 mb-1.5">
                  {t.name}
                </div>
                <p className="text-xs text-slate-300/85 leading-relaxed">
                  {t.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* =================================================================
          STAGE 04: PROTOCOL (HOW TO USE)
         ================================================================= */}
      <div
        ref={(el) => (stageRefs.current[3] = el)}
        className="gpu-stage fixed inset-0 w-screen h-screen z-20 flex flex-col items-center justify-center px-6 sm:px-16 text-center"
      >
        <div className="max-w-4xl w-full flex flex-col items-center lg:pl-20">
          <span className="font-mono-tech text-[11px] tracking-[0.3em] uppercase text-blue-400 mb-3">
            04 / OPERATIONAL PROTOCOL
          </span>
          <h2 className="text-3xl sm:text-5xl font-semibold tracking-[0.14em] uppercase text-white">
            FOUR STEPS TO VERIFIED
            <br />
            <span className="text-blue-200">GENERATIVE INTEGRITY</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 w-full text-left">
            {[
              {
                step: "01 / INITIALIZE",
                title: "Boot Ollama & FastAPI Server",
                desc: "Start `ollama run mistral` and `python server.py` to pin DeBERTa-v3 and MiniLM weights onto local CUDA memory.",
              },
              {
                step: "02 / INGEST",
                title: "Paste Prompt or Upload Dossier",
                desc: "Enter any synthetic passage in the Live Audit studio or upload .PDF, .DOCX, or .TXT files for automatic extraction.",
              },
              {
                step: "03 / DISSECT",
                title: "Stream Real-Time NLI Telemetry",
                desc: "Watch each sentence turn Green (Verified CHS ≤ 0.5) or Red (Flagged CHS > 0.5) against k=3 stochastic baselines.",
              },
              {
                step: "04 / EXPORT",
                title: "Inspect Atomic Claims & Export .MD",
                desc: "Click any sentence to view its decomposed atomic assertions and export a complete Markdown verification dossier.",
              },
            ].map((s, i) => (
              <div key={i} className="glass-card p-5">
                <span className="font-mono-tech text-[10px] text-blue-400 tracking-[0.24em]">
                  {s.step}
                </span>
                <h3 className="text-base font-semibold text-white mt-1 mb-1">
                  {s.title}
                </h3>
                <p className="text-xs text-slate-300/85 leading-relaxed">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* =================================================================
          STAGE 05: HORIZONS (FUTURE SCOPE)
         ================================================================= */}
      <div
        ref={(el) => (stageRefs.current[4] = el)}
        className="gpu-stage fixed inset-0 w-screen h-screen z-20 flex flex-col items-center justify-center px-6 sm:px-16 text-center"
      >
        <div className="max-w-4xl w-full flex flex-col items-center lg:pl-20">
          <span className="font-mono-tech text-[11px] tracking-[0.3em] uppercase text-blue-400 mb-3">
            05 / NEXT-GENERATION HORIZONS
          </span>
          <h2 className="text-3xl sm:text-5xl font-semibold tracking-[0.14em] uppercase text-white">
            SCALING THE HORIZON OF
            <br />
            <span className="text-blue-200">AUTONOMOUS VERIFICATION</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 w-full text-left">
            <div className="glass-card p-5">
              <span className="font-mono-tech text-[10px] text-blue-400 tracking-[0.22em]">
                HORIZON 01
              </span>
              <h3 className="text-base font-semibold text-white mt-1 mb-2">
                TensorRT & ONNX INT8
              </h3>
              <p className="text-xs text-slate-300/85 leading-relaxed">
                Compiling DeBERTa-v3 and MiniLM into TensorRT/ONNX INT8 graphs
                to reduce cross-encoder inference latency by 40%.
              </p>
            </div>

            <div className="glass-card p-5">
              <span className="font-mono-tech text-[10px] text-blue-400 tracking-[0.22em]">
                HORIZON 02
              </span>
              <h3 className="text-base font-semibold text-white mt-1 mb-2">
                Multimodal VLM Auditing
              </h3>
              <p className="text-xs text-slate-300/85 leading-relaxed">
                Extending verification to Vision-Language Models to cross-check
                diagnostic imagery and charts against clinical text.
              </p>
            </div>

            <div className="glass-card p-5">
              <span className="font-mono-tech text-[10px] text-blue-400 tracking-[0.22em]">
                HORIZON 03
              </span>
              <h3 className="text-base font-semibold text-white mt-1 mb-2">
                Hybrid Local RAG Firewall
              </h3>
              <p className="text-xs text-slate-300/85 leading-relaxed">
                Pairing zero-shot stochastic consensus with local FAISS/ChromaDB
                vector stores for enterprise document grounding.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* =================================================================
          STAGE 06: ARCHITECTS (ABOUT US)
         ================================================================= */}
      <div
        ref={(el) => (stageRefs.current[5] = el)}
        className="gpu-stage fixed inset-0 w-screen h-screen z-20 flex flex-col items-center justify-center px-6 sm:px-16 text-center"
      >
        <div className="max-w-4xl w-full flex flex-col items-center lg:pl-20">
          <span className="font-mono-tech text-[11px] tracking-[0.3em] uppercase text-blue-400 mb-3">
            06 / TIMSCDR RESEARCH ARCHITECTS
          </span>
          <h2 className="text-3xl sm:text-5xl font-semibold tracking-[0.14em] uppercase text-white">
            THE ARCHITECTS BEHIND
            <br />
            <span className="text-blue-200">AUDITENGINE</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-8 w-full text-left">
            <div className="glass-card p-6">
              <div className="flex justify-between items-center mb-2">
                <span className="font-mono-tech text-[10px] text-blue-400 tracking-[0.22em] uppercase">
                  Lead Full-Stack & ML Architect
                </span>
                <span className="font-mono-tech text-[10px] px-2 py-0.5 border border-blue-400/40 text-blue-200">
                  Roll No. 168
                </span>
              </div>
              <h3 className="text-xl font-semibold text-white">
                Raj Anil Shirke
              </h3>
              <p className="text-xs text-slate-300/85 mt-2 leading-relaxed">
                Engineered the FastAPI SSE streaming pipeline, CUDA VRAM
                optimization (<code>torch.no_grad()</code>), DeBERTa/MiniLM dual
                scoring engine, and interactive 3D scroll-scrubbed UI.
              </p>
            </div>

            <div className="glass-card p-6">
              <div className="flex justify-between items-center mb-2">
                <span className="font-mono-tech text-[10px] text-blue-400 tracking-[0.22em] uppercase">
                  Co-Researcher & NLP Evaluation Lead
                </span>
                <span className="font-mono-tech text-[10px] px-2 py-0.5 border border-blue-400/40 text-blue-200">
                  Roll No. 160
                </span>
              </div>
              <h3 className="text-xl font-semibold text-white">
                Shreshthi Sharma
              </h3>
              <p className="text-xs text-slate-300/85 mt-2 leading-relaxed">
                Led atomic claim decomposition, empirical benchmarking across
                Llama 3.2, Mistral 7B, and Phi-3, and formulation of the
                Verbosity Paradox.
              </p>
            </div>
          </div>

          <div className="mt-5 p-4 w-full glass-card text-xs text-slate-300">
            Guided by{" "}
            <strong className="text-white">
              Prof. Alifiya Shaikh & Prof. Thara Naveen
            </strong>{" "}
            • Thakur Institute of Management Studies, Career Development &
            Research (TIMSCDR), Mumbai – 400 101
          </div>
        </div>
      </div>

      {/* 6. CONTINUOUS 600VH SCROLL TRACK */}
      <div className="relative z-10 w-full pointer-events-none">
        {SECTIONS.map((sec) => (
          <div key={sec.id} className="h-screen w-full" />
        ))}
      </div>
    </div>
  );
}
