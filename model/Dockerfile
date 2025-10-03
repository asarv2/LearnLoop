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

# Point the dynamic loader at cuDNN wheel's libs (Conda-based PyTorch image path)
ENV LD_LIBRARY_PATH=/opt/conda/lib/python3.10/site-packages/nvidia/cudnn/lib:${LD_LIBRARY_PATH}

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
