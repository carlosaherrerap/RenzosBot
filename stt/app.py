from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
import base64, tempfile, subprocess, os, uuid

app = FastAPI()

class TranscribeRequest(BaseModel):
    url: Optional[str] = None
    audio_base64: Optional[str] = None

class TranscribeResponse(BaseModel):
    text: str

class TTSRequest(BaseModel):
    text: str

class TTSResponse(BaseModel):
    audio_base64: str

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/transcribe", response_model=TranscribeResponse)
def transcribe(req: TranscribeRequest):
    if not req.audio_base64:
        return {"text": ""}
    raw = base64.b64decode(req.audio_base64)
    tmpdir = tempfile.mkdtemp()
    ogg_path = os.path.join(tmpdir, f"{uuid.uuid4().hex}.ogg")
    wav_path = os.path.join(tmpdir, f"{uuid.uuid4().hex}.wav")
    txt_prefix = os.path.join(tmpdir, f"{uuid.uuid4().hex}")
    with open(ogg_path, "wb") as f:
        f.write(raw)
    subprocess.run(["ffmpeg", "-y", "-i", ogg_path, "-ar", "16000", "-ac", "1", wav_path], check=True)
    whisper_bin = "/opt/whisper/main"
    model_path = "/opt/whisper/models/ggml-base.bin"
    subprocess.run([whisper_bin, "-m", model_path, "-l", "es", "-f", wav_path, "-otxt", "-of", txt_prefix], check=True)
    txt_path = f"{txt_prefix}.txt"
    if os.path.exists(txt_path):
        with open(txt_path, "r", encoding="utf-8") as f:
            text = f.read().strip()
    else:
        text = ""
    return {"text": text}

@app.post("/tts", response_model=TTSResponse)
def tts(req: TTSRequest):
    from gtts import gTTS
    import io, base64
    tts = gTTS(text=req.text, lang="es")
    buf = io.BytesIO()
    tts.write_to_fp(buf)
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return {"audio_base64": b64}
