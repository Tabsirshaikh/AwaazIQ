import sys
from pathlib import Path

from speech_to_text import transcribe_audio

sys.stdout.reconfigure(encoding="utf-8")

SAMPLE_DIR = Path(__file__).parent / "sample_audio"


def run():
    SAMPLE_DIR.mkdir(exist_ok=True)

    audio_files = sorted(
        p for p in SAMPLE_DIR.iterdir() if p.suffix.lower() in (".wav", ".mp3")
    )

    if not audio_files:
        print(f"No .wav or .mp3 files found in {SAMPLE_DIR}\n")
        print("To test transcription:")
        print("  1. Record 2-3 short voice clips (a few seconds each), e.g.:")
        print('       - "sadak bahut kharab hai"')
        print('       - "rasta kharab ahe"')
        print('       - "there is a water problem"')
        print(f"  2. Save them as .wav files in: {SAMPLE_DIR}")
        print("  3. Re-run this script:  python test_speech_to_text.py")
        return

    print(f"Found {len(audio_files)} audio file(s) in {SAMPLE_DIR}\n")
    for path in audio_files:
        text = transcribe_audio(str(path))
        print(f"{path.name}: {text!r}")


if __name__ == "__main__":
    run()
