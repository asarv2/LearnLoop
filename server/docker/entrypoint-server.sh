#!/usr/bin/env sh
set -eu

seed_dir() {
  src="$1"
  dst="$2"
  # seed if dst missing OR empty
  if [ ! -d "$dst" ] || [ -z "$(ls -A "$dst" 2>/dev/null || true)" ]; then
    echo "Seeding $dst from $src"
    mkdir -p "$dst"
    # copy without overwriting existing files
    cp -an "$src"/. "$dst"/ 2>/dev/null || true
  fi
}

seed_dir "/opt/defaults/prompts" "/app/prompts"

exec "$@"
