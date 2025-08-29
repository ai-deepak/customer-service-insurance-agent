import os
from typing import Any, Literal, Optional, Dict

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Import the new OpenAI agent
from openai_agent import run_turn_sync


ORCH_PORT = int(os.getenv("ORCH_PORT", "8001"))
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


app = FastAPI(title="Insurance Orchestrator", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    session_id: str
    user_role: Optional[str] = None

class ChatResponse(BaseModel):
    messages: list = []
    actions: list = []
    cards: Dict[str, Any] = {}
    state: Dict[str, Any] = {}

@app.post("/route", response_model=ChatResponse)
async def route_chat(request: ChatRequest):
    """Route chat messages through the OpenAI agent orchestrator"""
    try:
        # Call the new OpenAI agent
        result = run_turn_sync(request.message, request.session_id, request.user_role)
        
        # Handle different response types
        if isinstance(result, str):
            # If it's a string, wrap it in the expected format
            return ChatResponse(
                messages=[{"from": "assistant", "text": result}],
                actions=[],
                cards={},
                state={}
            )
        elif isinstance(result, dict):
            # If it's already a dict, use it directly
            return ChatResponse(**result)
        else:
            # Fallback for unexpected types
            return ChatResponse(
                messages=[{"from": "assistant", "text": str(result)}],
                actions=[],
                cards={},
                state={}
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing chat: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "insurance-orchestrator"}

@app.get("/")
async def root():
    """Root endpoint with service information"""
    return {
        "service": "Insurance Orchestrator",
        "version": "1.0.0",
        "description": "OpenAI Agents SDK-based insurance chatbot orchestrator",
        "endpoints": [
            "POST /route - Process chat messages",
            "GET /health - Health check"
        ]
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
