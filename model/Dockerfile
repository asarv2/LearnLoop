FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

# Set working directory
WORKDIR /app

# Install Python 3.11 and system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3.11 python3.11-venv python3.11-dev python3-pip \
      build-essential ffmpeg libsndfile1 \
  && ln -s /usr/bin/python3.11 /usr/bin/python \
  && python -m pip install --upgrade pip \
  && rm -rf /var/lib/apt/lists/*

# Install pip PyTorch + FlashAttention that match CUDA 12.4 and Python 3.11
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cu124 \
      torch==2.6.0+cu124 torchaudio==2.6.0+cu124 && \
    pip uninstall -y flash-attn || true && \
    pip install --no-cache-dir \
      https://github.com/Dao-AILab/flash-attention/releases/download/v2.8.3/flash_attn-2.8.3+cu12torch2.6cxx11abiFALSE-cp311-cp311-linux_x86_64.whl

# Sanity check: Verify ABI compatibility
RUN python - <<'PY'
import torch, importlib, pkgutil
print("Torch:", torch.__version__, "CUDA:", torch.version.cuda)
print("GLIBCXX_USE_CXX11_ABI:", getattr(torch._C, "_GLIBCXX_USE_CXX11_ABI", "n/a"))
print("flash_attn present:", pkgutil.find_loader("flash_attn_2_cuda") is not None)
import flash_attn_2_cuda
print("FlashAttention CUDA loaded from:", flash_attn_2_cuda.__file__)
PY

# Build ctc-segmentation from source, then remove build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential python3-dev \
  && pip install --no-cache-dir numpy==1.26.0 \
  && pip install --no-cache-dir "ctc-segmentation==1.7.4" \
  && apt-get purge -y --auto-remove build-essential python3-dev \
  && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt ./

# Install Python dependencies with build tools for compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential g++ gcc python3-dev cython3 \
  && pip install --no-cache-dir --upgrade pip \
  && pip install --no-cache-dir --prefer-binary --upgrade-strategy only-if-needed \
       -r requirements.txt \
  && apt-get purge -y --auto-remove build-essential g++ gcc python3-dev cython3 \
  && rm -rf /var/lib/apt/lists/*

# FlashAttention already installed above with PyTorch

# Make cuDNN's pip-installed libs visible to the dynamic linker
RUN python - <<'PY'
import pathlib, nvidia.cudnn as cudnn
lib_dir = (pathlib.Path(next(iter(cudnn.__path__))) / "lib").resolve()
print("cuDNN lib dir:", lib_dir)
open("/etc/ld.so.conf.d/zz-cudnn.conf", "w").write(str(lib_dir) + "\n")
PY
RUN ldconfig

# (Optional) sanity checks
RUN ldconfig -p | grep -E 'libcudnn_(cnn|ops)\.so\.9' || true
RUN python - <<'PY'
import ctypes, pathlib, nvidia.cudnn as cudnn
lib_dir = (pathlib.Path(next(iter(cudnn.__path__))) / "lib").resolve()
ctypes.CDLL(str(lib_dir / "libcudnn_cnn.so.9"))
ctypes.CDLL(str(lib_dir / "libcudnn_ops.so.9"))
print("Loaded cuDNN CNN/OPS successfully")
PY

# Sanity check: Verify FlashAttention loads correctly
RUN python - <<'PY'
import torch
print("Torch:", torch.__version__)
import importlib, pkgutil
print("flash_attn present:", pkgutil.find_loader("flash_attn_2_cuda") is not None)
import flash_attn_2_cuda  # should succeed now
print("FlashAttention CUDA loaded OK")
PY

# Sanity check: Verify Torch, Triton, and CUDA versions
RUN python - <<'PY'
import torch, sys
print("Torch:", torch.__version__)
import triton
print("Triton:", triton.__version__)
print("CUDA available:", torch.cuda.is_available())
if torch.cuda.is_available():
    print("CUDA version:", torch.version.cuda)
    print("GPU count:", torch.cuda.device_count())
PY


# Validation: Verify cuDNN libraries are properly loaded
# Uncomment the following lines for debugging if needed:
# RUN ldconfig -p | grep libcudnn_cnn || true
# RUN python - <<'PY'
# import ctranslate2 as ct, torch
# print("ct2 CUDA devices:", getattr(ct, "get_cuda_device_count", lambda:0)())
# print("torch CUDA available:", torch.cuda.is_available())
# PY
# RUN python - <<'PY'
# import ctypes; ctypes.CDLL("libcudnn_cnn.so.9")
# print("Loaded libcudnn_cnn.so.9 OK")
# PY

# Copy application code
COPY app/ ./app/

# Create required directories
RUN mkdir -p /app/model_cache

# Set environment variables
ENV PYTHONPATH=/app \
    PORT=8000 \
    CTRANSLATE2_RANK=0 \
    CTRANSLATE2_CACHE_DIR=/app/model_cache/ctranslate2 \
    WHISPER_DEVICE=cuda \
    HF_HOME=/app/model_cache/huggingface \
    HUGGINGFACE_HUB_CACHE=/app/model_cache/huggingface

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "app.main:app", "--host","0.0.0.0","--port","8000"]
