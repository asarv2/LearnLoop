import av  # type: ignore
import numpy as np

PCM_SR = 48_000  # your bus rate


def frame_to_i16_mono_safe(frame: av.AudioFrame) -> np.ndarray:
    """
    Convert any aiortc/PyAV AudioFrame (stereo/mono, interleaved/planar,
    int/float, any device rate) to mono int16 @ 48k with proper scaling.
    """
    # Reformat at the *frame* level first: rate/layout/format are canonicalized here
    f = frame
    if (
        getattr(f, "sample_rate", None) != PCM_SR
        or getattr(getattr(f, "layout", None), "name", None) != "mono"
        or getattr(getattr(f, "format", None), "name", None) not in ("s16", "s16p")
    ):
        # Use PyAV's high-quality resampler + channel mixer
        resampler = av.AudioResampler(format="s16", layout="mono", rate=PCM_SR)
        resampled_frames = resampler.resample(f)
        f = resampled_frames[0] if resampled_frames else f

    arr = f.to_ndarray()  # usually shape (samples,) or (channels, samples)
    arr = np.asarray(arr, dtype=np.int16)

    # Normalize shape to (samples,)
    if arr.ndim == 2:
        # For planar s16p this is (channels, samples) with channels=1 after layout='mono'
        if arr.shape[0] == 1:
            arr = arr[0]
        else:
            # Defensive: if somehow >1 channel slipped through, average to mono
            arr = arr.mean(axis=0)

    # Ensure dtype and 1-D mono
    pcm_i16 = arr.astype(np.int16, copy=False).reshape(-1)

    return pcm_i16  # type: ignore


def f32_levels(x: np.ndarray) -> tuple[float, float, int]:
    """Simple meter for debugging audio levels"""
    peak = float(np.max(np.abs(x))) if x.size else 0.0
    rms = float(np.sqrt(np.mean(x**2))) if x.size else 0.0
    clips = int((np.abs(x) >= 0.999).sum())
    return peak, rms, clips
