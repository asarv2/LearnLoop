from pathlib import Path

# Root is project root when running "python -m app.main"
# Adjust if your runtime differs.
PROJECT_ROOT = Path(__file__).resolve().parents[1]

# Directory for generated PDF files
FILES_DIR = PROJECT_ROOT / "files"
FILES_DIR.mkdir(parents=True, exist_ok=True)
