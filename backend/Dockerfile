FROM python:3.12-slim

WORKDIR /app

# Install system deps for psycopg2
RUN apt-get update && apt-get install -y gcc libpq-dev && rm -rf /var/lib/apt/lists/*

# Copy shared utilities first (cached layer)
COPY shared/ ./shared/
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy service code
ARG SERVICE_NAME
COPY ${SERVICE_NAME}/ ./${SERVICE_NAME}/

# Expose port via build arg (default 8000)
ARG PORT=8000
EXPOSE ${PORT}

# Run the service: uvicorn <service_name>.main:app
CMD uvicorn ${SERVICE_NAME}.main:app --host 0.0.0.0 --port ${PORT} --workers 2
