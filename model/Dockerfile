FROM pytorch/pytorch:2.8.0-cuda12.8-cudnn9-runtime

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -U pip setuptools wheel packaging ninja einops && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir https://github.com/Dao-AILab/flash-attention/releases/download/v2.8.3/flash_attn-2.8.3+cu12torch2.8cxx11abiFALSE-cp311-cp311-linux_x86_64.whl

# Create directories for audio and model cache (will be mounted as volumes)
RUN mkdir -p /app/audio /app/model_cache

# Copy application code
COPY app/ ./app/

# Set Python path
ENV PYTHONPATH=/app
ENV BNB_CUDA_VERSION=128

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run the application
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]