# LearnLoop GPU Server

A FastAPI-based server for audio transcription and alignment with support for:

- CTC forced alignment with known transcripts
- Whisper-based transcription with word-level timestamps
- Speaker diarization
- Audio processing and voice activity detection
- Kokoro TTS integration

## Installation

```bash
# Activate virtual environment
source .venv/bin/activate

# Install dependencies
make install
```

## Usage

```bash
# Run the server
learnloop-server
```
