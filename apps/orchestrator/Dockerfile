FROM python:3.11-slim

WORKDIR /app

COPY apps/orchestrator/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/orchestrator ./apps/orchestrator
COPY knowledge_base.json ./knowledge_base.json

EXPOSE 8000
CMD ["uvicorn", "apps.orchestrator.main:app", "--host", "0.0.0.0", "--port", "8000"]
