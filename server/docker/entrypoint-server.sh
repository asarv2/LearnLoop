#!/usr/bin/env sh
set -euo pipefail

seed_dir() {
  src="$1"
  dst="$2"
  # seed if dst missing OR empty (robust check for truly empty dirs)
  if [ ! -d "$dst" ] || [ -z "$(ls -A "$dst" 2>/dev/null)" ]; then
    echo "Seeding $dst from $src"
    mkdir -p "$dst"
    # copy without overwriting existing files
    cp -a "$src"/. "$dst"/ 2>/dev/null || true
  else
    echo "Directory $dst already has content, skipping seed"
  fi
}

seed_dir "/opt/defaults/prompts" "/app/prompts"

exec "$@"
