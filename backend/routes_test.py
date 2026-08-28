"""
Dev-only endpoints backing frontend-test/index.html, so pipeline functions
can be exercised from a browser instead of the terminal.
"""

import sys
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, UploadFile
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline.language_detector import detect_language  # noqa: E402
from pipeline.speech_to_text import transcribe_audio  # noqa: E402

router = APIRouter(prefix="/test")


class DetectLanguageIn(BaseModel):
    text: str


@router.post("/detect-language")
def test_detect_language(payload: DetectLanguageIn):
    return {"language": detect_language(payload.text)}


@router.post("/transcribe")
async def test_transcribe(file: UploadFile = File(...)):
    suffix = Path(file.filename).suffix or ".wav"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        text = transcribe_audio(tmp_path)
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    return {"transcription": text}
