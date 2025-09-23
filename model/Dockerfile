FROM pytorch/pytorch:2.8.0-cuda12.8-cudnn9-runtime

# Set working directory
WORKDIR /app

# Install system dependencies including tini
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl build-essential gcc ca-certificates tini \
    ffmpeg libsndfile1 \
 && rm -rf /var/lib/apt/lists/*

# Install cuDNN 9 split libs via pip (no apt repo needed)
RUN pip install --no-cache-dir "nvidia-cudnn-cu12==9.*" && \
    python - <<'PY'
import os, sys
import nvidia.cudnn
libdir = os.path.join(nvidia.cudnn.__path__[0], 'lib')
print("cuDNN libdir:", libdir)
# register with the dynamic linker
open('/etc/ld.so.conf.d/nvidia-cudnn9.conf','w').write(libdir + '\n')
PY
RUN ldconfig

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -U pip setuptools wheel packaging ninja einops && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir https://github.com/Dao-AILab/flash-attention/releases/download/v2.8.3/flash_attn-2.8.3+cu12torch2.8cxx11abiFALSE-cp311-cp311-linux_x86_64.whl

# Comprehensive sanity check for cuDNN 9 split libs
RUN ldconfig -p | grep -E 'libcudnn_(ops|cnn|adv)\.so\.9' || true
RUN python - <<'PY'
import ctypes
ctypes.CDLL('libcudnn_ops.so.9')
ctypes.CDLL('libcudnn_cnn.so.9')
ctypes.CDLL('libcudnn_adv.so.9')
print("cuDNN 9 split libs resolved ✓")
PY

# Copy application code
COPY app/ ./app/

# Runtime dirs (will be bind-mounted)
RUN mkdir -p /app/model_cache

# Keep HF caches inside the mounted model_cache
ENV PYTHONPATH=/app \
    BNB_CUDA_VERSION=128 \
    HF_HOME=/app/model_cache/hf \
    TORCH_HOME=/app/model_cache/torch \
    CTRANSLATE2_RANK=0 \
    CTRANSLATE2_CACHE_DIR=/app/model_cache/ctranslate2 \
    LD_LIBRARY_PATH=/opt/conda/lib/python3.11/site-packages/nvidia/cudnn/lib:$LD_LIBRARY_PATH

# Expose port
EXPOSE 8000

# Healthcheck (same)
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

ENTRYPOINT ["/usr/bin/tini","-s","--"]
# GPU services: keep a single worker to avoid double-allocating VRAM
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8000","--workers","1"]