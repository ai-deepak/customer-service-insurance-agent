import os
from typing import Any, Literal, Optional

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from apps.orchestrator.graph import run_turn


ORCH_PORT = int(os.getenv("ORCH_PORT", "8000"))
ADMIN_SHARED_SECRET = os.getenv("ADMIN_SHARED_SECRET", "change-me")


class RouteRequest(BaseModel):
	message: str
	session_id: Optional[str] = None
	user_role: Optional[Literal["user", "admin"]] = None
	context: Optional[dict[str, Any]] = None


class Action(BaseModel):
	type: Literal["confirm"]
	id: str
	summary: str
	payload: dict[str, Any]


class RouteResponse(BaseModel):
	messages: list[dict[str, str]]
	actions: list[Action] | None = None
	cards: dict[str, Any] | None = None
	state: dict[str, Any] | None = None


app = FastAPI(title="Insurance Orchestrator", version="0.1.0")

app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
	return {"status": "ok"}


@app.post("/route", response_model=RouteResponse)
async def route(request: RouteRequest) -> RouteResponse:
	# Call LangGraph compiled graph
	session_id = request.session_id or "session-default"
	output = run_turn(request.message, session_id, request.user_role)
	return RouteResponse(**output)


@app.post("/ingest")
async def ingest(x_admin_secret: str = Header(default="")) -> dict[str, str]:
	if x_admin_secret != ADMIN_SHARED_SECRET:
		raise HTTPException(status_code=401, detail="unauthorized")
	# Placeholder for ingestion pipeline
	return {"status": "accepted"}


if __name__ == "__main__":
	import uvicorn

	uvicorn.run("apps.orchestrator.main:app", host="0.0.0.0", port=ORCH_PORT, reload=True)
