FROM pytorch/pytorch:2.8.0-cuda12.8-cudnn9-runtime

# Set working directory
WORKDIR /app

# Runtime-only OS deps (no compilers)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
 && rm -rf /var/lib/apt/lists/*

# Build ctc-segmentation from source, then remove build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential python3-dev \
  && pip install --no-cache-dir --upgrade pip \
  && pip install --no-cache-dir numpy==1.26.4 \
  && pip install --no-cache-dir "ctc-segmentation==1.7.4" \
  && apt-get purge -y --auto-remove build-essential python3-dev \
  && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Dynamically locate cuDNN wheel's lib dir and register it
RUN python - <<'PY'
import pathlib, nvidia.cudnn as cudnn
p = (pathlib.Path(cudnn.__file__).parent / "lib").resolve()
print("cuDNN lib dir:", p)
assert p.exists()
open("/etc/ld.so.conf.d/zz-cudnn.conf", "w").write(str(p) + "\n")
PY
RUN ldconfig

# Validation: Verify cuDNN libraries are properly loaded
# Uncomment the following lines for debugging if needed:
# RUN ldconfig -p | grep libcudnn_cnn || echo "cuDNN CNN libs not found in ldconfig"
# RUN ls -l /opt/conda/lib/python*/site-packages/nvidia/cudnn/lib/libcudnn_cnn.so* || echo "cuDNN CNN libs not found in filesystem"

# Copy application code
COPY app/ ./app/

# Create required directories
RUN mkdir -p /app/model_cache

# Set environment variables
ENV PYTHONPATH=/app \
    PORT=8000 \
    CTRANSLATE2_RANK=0 \
    CTRANSLATE2_CACHE_DIR=/app/model_cache/ctranslate2 \
    WHISPER_DEVICE=cuda

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "app.main:app", "--host","0.0.0.0","--port","8000"]
