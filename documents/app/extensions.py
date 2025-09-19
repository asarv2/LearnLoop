from pathlib import Path

# Root is project root when running "python -m app.main"
# Adjust if your runtime differs.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
TEMPLATES_DIR = PROJECT_ROOT / "templates"
TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)
