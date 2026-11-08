FROM python:3.12-slim

WORKDIR /app

# Install build dependencies and curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install uv for ultra-fast dependency resolution
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Copy dependency files
COPY pyproject.toml README.md ./
RUN uv pip install --system --no-cache fastapi "uvicorn[standard]" pydantic numpy scipy pandas scikit-learn python-multipart pytest httpx

# Copy application source
COPY app/ ./app
COPY pytest.ini ./

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
