import gradio as gr
from pipeline import detect_hallucinations

CUSTOM_CSS = """
* { box-sizing: border-box; }

html, body {
    min-height: 100vh;
}

.gradio-container {
    max-width: 900px !important;
    width: 100% !important;
    margin: 0 auto !important;
    padding: 60px 24px 80px 24px !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif !important;
    min-height: 100vh;
}

#header h1 {
    font-size: 1.8rem;
    font-weight: 700;
    margin: 0 0 10px 0;
    letter-spacing: -0.01em;
}
#header p {
    font-size: 0.95rem;
    color: #6b6b6b !important;
    line-height: 1.6;
    margin: 0 0 8px 0;
    max-width: 680px;
}

label span {
    background: none !important;
    border: none !important;
    padding: 0 !important;
    box-shadow: none !important;
    font-size: 0.78rem !important;
    font-weight: 600 !important;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #6b6b6b !important;
}

#check-btn {
    font-weight: 600 !important;
    font-size: 0.95rem !important;
    padding: 12px 0 !important;
    box-shadow: none !important;
}

#summary {
    font-size: 1rem;
    font-weight: 600;
    margin: 32px 0 4px 0;
    padding-top: 24px;
    border-top: 1px solid #e5e5e5;
}

#legend {
    font-size: 0.82rem;
    color: #6b6b6b;
    margin: 0 0 16px 0;
    display: flex;
    gap: 20px;
    align-items: center;
}
#legend .dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 2px;
    margin-right: 6px;
}
#legend .flagged-dot { background-color: #d64545; }
#legend .ok-dot { background-color: #d9d9d9; border: 1px solid #bbb; }

#result-box {
    line-height: 2.2;
    font-size: 1rem;
    padding: 28px;
    border: 1px solid #e5e5e5;
    border-radius: 10px;
}

.hallu-flagged {
    background-color: #fbdede;
    color: #8a1f1f;
    font-weight: 600;
    border-bottom: 2px solid #d64545;
    padding: 2px 3px;
    border-radius: 3px;
}
.hallu-ok {
    color: #2a2a2a;
}

footer { display: none !important; }
"""

THEME = gr.themes.Base(
    font=[gr.themes.GoogleFont("Inter"), "sans-serif"],
).set(
    body_background_fill="#fafafa",
    body_background_fill_dark="#fafafa",
    background_fill_primary="#ffffff",
    background_fill_primary_dark="#ffffff",
    background_fill_secondary="#f5f5f5",
    background_fill_secondary_dark="#f5f5f5",
    block_background_fill="#ffffff",
    block_background_fill_dark="#ffffff",
    border_color_primary="#e5e5e5",
    border_color_primary_dark="#e5e5e5",
    body_text_color="#1a1a1a",
    body_text_color_dark="#1a1a1a",
    block_label_text_color="#6b6b6b",
    block_label_text_color_dark="#6b6b6b",
    input_background_fill="#ffffff",
    input_background_fill_dark="#ffffff",
    button_primary_background_fill="#1a1a1a",
    button_primary_background_fill_dark="#1a1a1a",
    button_primary_background_fill_hover="#333333",
    button_primary_background_fill_hover_dark="#333333",
    button_primary_text_color="#ffffff",
    button_primary_text_color_dark="#ffffff",
)


def run_detector(prompt, n_samples):
    if not prompt.strip():
        return gr.update(visible=False), gr.update(visible=False), gr.update(visible=False)

    main_response, results = detect_hallucinations(prompt, n_samples=int(n_samples))

    flagged_count = sum(r["flagged"] for r in results)
    total = len(results)

    spans = []
    for r in results:
        css_class = "hallu-flagged" if r["flagged"] else "hallu-ok"
        title = f"score: {r['score']:.2f}"
        spans.append(f"<span class='{css_class}' title='{title}'>{r['sentence']}</span>")

    result_html = f"<div id='result-box'>{' '.join(spans)}</div>"
    summary = f"{flagged_count} of {total} sentences flagged as potentially unsupported"
    legend_html = (
        "<div id='legend'>"
        "<span><span class='dot flagged-dot'></span>Likely hallucinated</span>"
        "<span><span class='dot ok-dot'></span>Supported</span>"
        "</div>"
    )

    return (
        gr.update(value=summary, visible=True),
        gr.update(value=legend_html, visible=True),
        gr.update(value=result_html, visible=True),
    )


with gr.Blocks(css=CUSTOM_CSS, theme=THEME, title="Hallucination Detector") as demo:
    gr.HTML(
        "<div id='header'>"
        "<h1>Hallucination Detector</h1>"
        "<p>Cross-checks each claim in a response against several independently "
        "sampled generations to flag statements that aren't consistently supported "
        "— a black-box, sampling-based approach.</p>"
        "</div>"
    )

    with gr.Group():
        prompt_input = gr.Textbox(
            label="Question",
            placeholder="Ask a factual question…",
            lines=2,
        )
        n_samples_input = gr.Slider(
            minimum=2, maximum=5, value=3, step=1,
            label="Consistency-check samples",
        )
        submit_btn = gr.Button("Check", variant="primary", elem_id="check-btn")

    summary_output = gr.Markdown(elem_id="summary", visible=False)
    legend_output = gr.HTML(elem_id="legend-wrap", visible=False)
    result_output = gr.HTML(visible=False)

    submit_btn.click(
        fn=run_detector,
        inputs=[prompt_input, n_samples_input],
        outputs=[summary_output, legend_output, result_output],
    )

if __name__ == "__main__":
    demo.launch()