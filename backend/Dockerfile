FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN chmod +x docker-entrypoint.sh \
    && useradd --system --create-home appuser \
    && chown -R appuser:appuser /app
USER appuser

ENTRYPOINT ["./docker-entrypoint.sh"]
