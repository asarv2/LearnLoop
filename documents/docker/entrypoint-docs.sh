#!/usr/bin/env bash
set -euo pipefail

# Ensure the writable volume exists and is owned by appuser
mkdir -p /app/files
chown -R 10001:10001 /app/files || true

# Drop privileges and exec the server
exec su -s /bin/sh -c 'uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level info' appuser
