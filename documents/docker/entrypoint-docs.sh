#!/usr/bin/env bash
set -euo pipefail

# Ensure the writable volume exists and is owned by appuser
mkdir -p /app/files
chown -R 10001:10001 /app/files || true

# (Optional) seed templates if you support baked defaults
if [ -d /opt/defaults/templates ] && [ ! -e /app/templates/.seeded ]; then
  # Only copy if /app/templates is writeable; if it's a :ro bind this will simply fail harmlessly
  cp -an /opt/defaults/templates/. /app/templates/ 2>/dev/null || true
  touch /app/templates/.seeded 2>/dev/null || true
fi

# Drop privileges and exec the server
exec su -s /bin/sh -c 'uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level info' appuser
