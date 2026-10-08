FROM python:3.13-slim

# Set Python environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install system runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy dependencies manifest and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend codebase
COPY . .

# Ensure entrypoint script is executable
RUN chmod +x entrypoint.sh

# Expose FastAPI port
EXPOSE 8000

# Server execution entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]
