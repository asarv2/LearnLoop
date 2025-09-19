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
    curl ca-certificates tini gosu \
 && rm -rf /var/lib/apt/lists/*

# Make files dir for output
RUN mkdir -p /app/files

# Copy reqs early for caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app
COPY app/ ./app/
COPY templates/ ./templates/

# Non-root user
RUN useradd -m -u 10001 appuser
USER appuser

EXPOSE 8000

# Healthcheck (FastAPI health)
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["python", "-m", "app.main"]
