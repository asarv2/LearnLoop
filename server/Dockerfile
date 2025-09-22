# syntax=docker/dockerfile:1.7
############################################
# 1️⃣  shared deps  (never re-installed if unchanged)
############################################
FROM python:3.11-slim AS deps
WORKDIR /install

# build tools + cache APT index between builds
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends build-essential gcc && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip && \
    pip install --prefer-binary --prefix=/install -r requirements.txt

############################################
# 3️⃣  runtime image  (what you actually deploy)
############################################
FROM python:3.11-slim AS runtime
WORKDIR /app

# runtime helpers
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates tini && \
    rm -rf /var/lib/apt/lists/*

# bring in the wheels
COPY --from=deps /install /usr/local

# 1) put code in /app
COPY app/ ./app/

# 2) bake **defaults** to a safe path that won't be bind-mounted
#    (use --chown so your non-root user can read them)
COPY --chown=1001:1001 prompts/ /opt/defaults/prompts/

# non-root for prod
ARG APP_UID=1001
ARG APP_GID=1001   # pick any unused id ≥ 1000

# create group & user with those ids
RUN addgroup --system --gid $APP_GID appuser && \
    adduser  --system --uid $APP_UID --gid $APP_GID \
             --home /home/appuser appuser

ENV PYTHONUNBUFFERED=1 PYTHONPATH=/app
EXPOSE 8000

# 3) add an entrypoint that seeds /app/prompts from /opt/defaults/prompts if empty
COPY docker/entrypoint-server.sh /usr/local/bin/entrypoint-server.sh
RUN chmod +x /usr/local/bin/entrypoint-server.sh

USER appuser
ENTRYPOINT ["/usr/bin/tini","--","/usr/local/bin/entrypoint-server.sh"]
CMD ["gunicorn", "app.main:app", "-w", "1", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000", "--log-level", "info"]
