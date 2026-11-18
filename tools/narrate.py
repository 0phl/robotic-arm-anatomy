"""Generate the bundled English tracks with Piper and a local ONNX voice."""
import argparse
import json
from pathlib import Path
import wave

from piper import PiperVoice

parser = argparse.ArgumentParser()
parser.add_argument("model", type=Path, help="Path to a Piper .onnx file with its .onnx.json beside it")
voice = PiperVoice.load(parser.parse_args().model)
root = Path(__file__).resolve().parents[1]
parts = json.loads((root / "src/lesson-content.json").read_text(encoding="utf-8"))["parts"]
destination = root / "assets/voice"
destination.mkdir(parents=True, exist_ok=True)
for part in parts:
    text = " ".join([part["name"] + ".", part["description"], part["detail"], part["prompt"]])
    with wave.open(str(destination / (part["id"] + ".wav")), "wb") as output:
        voice.synthesize_wav(text, output)
    print(part["name"], flush=True)
