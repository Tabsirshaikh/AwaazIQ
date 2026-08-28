"""
Speech-to-text for citizen complaint audio (Marathi, Hindi, English), using
faster-whisper (local, open-source, no API key).

Replaces the earlier pipeline/asr.py, which did the same thing under a
different name/signature.
"""

from pathlib import Path

from faster_whisper import WhisperModel

MODEL_SIZE = "small"

# Nudges the decoder toward correct spellings of common civic-complaint
# vocabulary it might otherwise mishear or misspell, without needing any
# fine-tuning. Cheap, well-known whisper technique.
DOMAIN_PROMPT = (
    "sadak gaddha paani bijli gaon nagar naali kachra shauchalay "
    "school hospital rasta khadda current transformer borewell "
    "सड़क पानी बिजली "
    "रस्ता गाव शाळा"
)

_model: WhisperModel | None = None


def _get_model() -> WhisperModel:
    global _model
    if _model is None:
        _model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")
    return _model


def transcribe_audio(audio_file_path: str, language_hint: str | None = None) -> str:
    """
    Transcribe an audio file to text.

    language_hint: "hi", "mr", or "en" to help whisper, or None to auto-detect.
    Returns the transcribed text, or "" if transcription fails for any reason
    (missing file, corrupted audio, unsupported format, etc).
    """
    if not Path(audio_file_path).exists():
        print(f"[speech_to_text] file not found: {audio_file_path!r}")
        return ""

    try:
        model = _get_model()
        segments, _info = model.transcribe(
            audio_file_path,
            language=language_hint,
            initial_prompt=DOMAIN_PROMPT,
            vad_filter=True,
            condition_on_previous_text=False,
        )
        return " ".join(segment.text for segment in segments).strip()
    except Exception as exc:
        print(f"[speech_to_text] failed to transcribe {audio_file_path!r}: {exc}")
        return ""
