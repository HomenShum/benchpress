# =============================================================================
# attrition-executor — Python sandbox for running the literal emitted scaffold
# =============================================================================
FROM python:3.11-slim-bookworm

# System deps for Python build wheels + subprocess execution
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
         build-essential \
         ca-certificates \
         bash \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install executor deps first for layer caching
COPY executor/requirements.txt /app/executor/requirements.txt
RUN pip install --no-cache-dir -r /app/executor/requirements.txt

# Install the emitter package's dependencies (google-genai, fastapi
# uvicorn, etc.) so the scaffold's subprocess can import the canonical
# modules without re-installing per-request.
RUN pip install --no-cache-dir \
      "google-genai>=0.7.0" \
      "fastapi>=0.115.0" \
      "uvicorn[standard]>=0.34.0" \
      "anthropic>=0.42.0" \
      "httpx>=0.27.0" \
      "openai>=1.60.0"

# Copy the emitter source so the executor can import
# daas.compile_down.emitters._bundle_finalize at runtime. The exact
# same files users download via the Builder are produced server-side.
COPY daas/ /app/daas/

# Copy the executor service code
COPY executor/main.py /app/executor/main.py

# Cloud Run injects $PORT
ENV PORT=8080
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

EXPOSE 8080

CMD ["python3", "/app/executor/main.py"]
