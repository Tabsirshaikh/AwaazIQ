from faster_whisper import WhisperModel


_model = WhisperModel(
    "small",
    device="cpu",
    compute_type="int8"
)


def transcribe(
    audio_path: str,
    language_hint: str | None = None
) -> str:

    segments, _info = _model.transcribe(
        audio_path,
        language=language_hint
    )

    return " ".join(
        segment.text
        for segment in segments
    ).strip()