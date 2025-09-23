# app/asr/vad.py
import numpy as np
import torch

SAMPLE_RATE = 16000

class SileroGate:
    def __init__(self, threshold: float = 0.5):
        # Load Silero VAD model - it returns a tuple with the model function
        model_tuple = torch.hub.load(
            'snakers4/silero-vad', 'silero_vad', force_reload=False, trust_repo=True
        )
        
        # Extract the model function from the tuple
        if isinstance(model_tuple, tuple):
            self.model = model_tuple[0]  # The model function is the first element
        else:
            self.model = model_tuple
        self.threshold = threshold

    def is_speech(self, pcm16_bytes: bytes) -> bool:
        audio = np.frombuffer(pcm16_bytes, dtype=np.int16).astype(np.float32) / 32768.0

        # Silero VAD expects a fixed window. Use 512 samples at 16kHz (or 256 for 8kHz).
        expected_samples = 512 if SAMPLE_RATE == 16000 else 256
        n = audio.size
        if n == 0:
            return False
        if n < expected_samples:
            # Pad with zeros to expected length
            pad = np.zeros(expected_samples - n, dtype=np.float32)
            audio = np.concatenate([audio, pad], axis=0)
        elif n > expected_samples:
            # Use the most recent window worth of samples
            audio = audio[-expected_samples:]

        with torch.no_grad():
            # Convert to torch tensor - Silero VAD expects 1D tensor
            audio_tensor = torch.from_numpy(audio)
            
            # Call the model - it expects (audio_tensor, sample_rate)
            conf = float(self.model(audio_tensor, SAMPLE_RATE).item())
        return conf >= self.threshold