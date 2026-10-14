# Production image: builds the React UI, then serves API + UI from one FastAPI process.

FROM node:22-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
COPY backend/requirements.txt backend/requirements.txt
RUN pip install -r backend/requirements.txt \
 && python -m compileall -q /usr/local/lib/python3.12/site-packages
COPY backend/app backend/app
# Pre-compile bytecode so the (slow, shared-CPU) container doesn't do it on every cold start.
RUN python -m compileall -q backend/app
COPY --from=frontend /app/frontend/dist frontend/dist
WORKDIR /app/backend
# Render (and most hosts) provide $PORT; default to 8000 locally.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
