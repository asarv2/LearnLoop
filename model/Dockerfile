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
import os, nvidia.cudnn.lib
p = os.path.dirname(nvidia.cudnn.lib.__file__)
open('/etc/ld.so.conf.d/nvidia-cudnn9.conf','w').write(p+'\n')
PY
RUN ldconfig

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -U pip setuptools wheel packaging ninja einops && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir https://github.com/Dao-AILab/flash-attention/releases/download/v2.8.3/flash_attn-2.8.3+cu12torch2.8cxx11abiFALSE-cp311-cp311-linux_x86_64.whl

# Verify cuDNN 9 split libs are available
RUN ldconfig -p | grep -E 'libcudnn_(ops|cnn|adv|cnh|cnn_infer|ops_infer|cnn_train)\.so\.9' || true

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
    CTRANSLATE2_CACHE_DIR=/app/model_cache/ctranslate2

# Expose port
EXPOSE 8000

# Healthcheck (same)
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

ENTRYPOINT ["/usr/bin/tini","-s","--"]
# GPU services: keep a single worker to avoid double-allocating VRAM
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8000","--workers","1"]