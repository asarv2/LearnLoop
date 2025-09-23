# app/asr/vad.py
import numpy as np
import torch

SAMPLE_RATE = 16000

class SileroGate:
    def __init__(self, threshold: float = 0.5):
        self.model = torch.hub.load(
            'snakers4/silero-vad', 'silero_vad', force_reload=False, trust_repo=True
        )
        self.threshold = threshold

    def is_speech(self, pcm16_bytes: bytes) -> bool:
        audio = np.frombuffer(pcm16_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        with torch.no_grad():
            conf = float(self.model(torch.from_numpy(audio), SAMPLE_RATE).item())
        return conf >= self.threshold