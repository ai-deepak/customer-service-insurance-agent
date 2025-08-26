SHELL := /bin/sh

.PHONY: up seed test docs wipe orchestrator

up:
docker compose up -d db

orchestrator:
python -m uvicorn apps.orchestrator.main:app --host 0.0.0.0 --port .env{ORCH_PORT:-8000} --reload

seed:
python apps/orchestrator/scripts/ingest.py

test:
@echo "Tests not implemented yet"

docs:
@echo "Swagger will be on http://localhost:3000/docs (API not scaffolded yet)"

wipe:
docker compose down -v && docker compose up -d db
