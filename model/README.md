# LearnLoop Model Service

A centralized FastAPI service for running ML models, specifically focused on CTC transcription and audio processing.

## Features

- **CTC Transcription**: Audio-text alignment using Wav2Vec2 and CTC segmentation
- **Whisper Transcription**: Audio transcription using Faster-Whisper
- **FastAPI Server**: RESTful API endpoints for model inference
- **Docker Support**: Containerized deployment with PyTorch base image
- **Health Monitoring**: Model status and health check endpoints

## API Endpoints

- `GET /` - Service information
- `GET /health` - Health check and model status
- `POST /transcribe` - Transcribe audio (with optional reference text)
- `POST /align` - Align audio with reference text using CTC
- `GET /docs` - Interactive API documentation

## Installation

### Local Development (CPU)

```bash
pip install -e ".[local]"
```

### Production (GPU)

```bash
pip install -e ".[prod]"
```

## Running the Service

### Local Development

```bash
python -m app.main
```

### Docker

```bash
docker build -t learnloop-model-service .
docker run -p 8001:8001 learnloop-model-service
```

## Environment Variables

- `PORT`: Server port (default: 8001)
- `HOST`: Server host (default: 0.0.0.0)
- `WHISPER_DEVICE`: Device for Whisper model (cpu/cuda, default: auto)

## Usage Examples

### Transcribe Audio

```bash
curl -X POST "http://localhost:8001/transcribe" \
  -F "audio_file=@audio.wav"
```

### Align Audio with Reference Text

```bash
curl -X POST "http://localhost:8001/align" \
  -F "audio_file=@audio.wav" \
  -F "reference_text=Hello world this is a test"
```

### Health Check

```bash
curl "http://localhost:8001/health"
```

## Models

- **Wav2Vec2**: `facebook/wav2vec2-base-960h` for CTC alignment
- **Whisper**: `tiny` model via Faster-Whisper for transcription

## Development

```bash
# Install development dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Format code
ruff format .

# Lint code
ruff check .
```