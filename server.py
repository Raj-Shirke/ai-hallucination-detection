from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import io
import json
import pypdf
import docx
from pipeline import detect_hallucinations_stream, DEFAULT_MODEL

app = FastAPI(title="Hallucination Detection API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    prompt: str
    samples: int = 3
    model: str = DEFAULT_MODEL


@app.post("/api/analyze/stream")
async def analyze_prompt_stream(request: AnalyzeRequest):
    def event_generator():
        for event in detect_hallucinations_stream(
            prompt=request.prompt,
            model=request.model,
            n_samples=request.samples,
        ):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/upload")
async def upload_document(file: UploadFile = File(...)):
    try:
        content = await file.read()
        text = ""

        if file.filename.endswith(".txt"):
            text = content.decode("utf-8")
        elif file.filename.endswith(".pdf"):
            pdf_reader = pypdf.PdfReader(io.BytesIO(content))
            text = "\n".join(
                [
                    page.extract_text()
                    for page in pdf_reader.pages
                    if page.extract_text()
                ]
            )
        elif file.filename.endswith(".docx"):
            doc = docx.Document(io.BytesIO(content))
            text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
        else:
            raise HTTPException(
                status_code=400,
                detail="Unsupported format. Upload TXT, PDF, or DOCX.",
            )

        return {"extracted_text": text.strip()}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error reading file: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)