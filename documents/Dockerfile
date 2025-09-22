FROM python:3.11-slim

# Prevent tzdata prompting
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1

WORKDIR /app

# System deps: xelatex + latexmk + common fonts
# Note: texlive-full is huge; we pick a slimmer, Unicode-capable set.
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-xetex \
    texlive-latex-recommended \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-lang-european texlive-lang-cjk texlive-lang-greek texlive-lang-cyrillic \
    latexmk \
    fonts-noto fonts-noto-cjk fonts-noto-color-emoji fonts-dejavu \
    curl ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*

# Make files dir for output
RUN mkdir -p /app/files

# Copy reqs early for caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app + **bake defaults** for templates
COPY app/ ./app/
COPY --chown=10001:10001 templates/ /opt/defaults/templates/

# Non-root user
RUN useradd -m -u 10001 appuser

EXPOSE 8000

# Healthcheck remains fine for gunicorn/uvicorn
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/health || exit 1

# Seed entrypoint + uvicorn
COPY docker/entrypoint-docs.sh /usr/local/bin/entrypoint-docs.sh
USER root && chmod +x /usr/local/bin/entrypoint-docs.sh && chown appuser:appuser /usr/local/bin/entrypoint-docs.sh && \
     chown -R appuser:appuser /app && \
     true
USER appuser

ENTRYPOINT ["/usr/bin/tini","--","/usr/local/bin/entrypoint-docs.sh"]
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8000","--log-level","info"]
