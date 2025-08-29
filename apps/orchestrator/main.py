import os
from typing import Any, Literal, Optional, Dict

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import psycopg
from langchain_openai import OpenAIEmbeddings

# Import the new OpenAI agent
from openai_agent import run_turn_sync


ORCH_PORT = int(os.getenv("ORCH_PORT", "8001"))
ADMIN_SHARED_SECRET = os.getenv("ADMIN_SHARED_SECRET", "change-me")
DB_URL = os.getenv("DB_URL", "postgres://postgres:postgres@localhost:5432/insurance")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")


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

class IngestRequest(BaseModel):
    title: str
    content: str
    source: str
    metadata: Optional[Dict[str, Any]] = None

class IngestResponse(BaseModel):
    success: bool
    message: str
    document_id: Optional[str] = None

class DeleteResponse(BaseModel):
    success: bool
    message: str

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

@app.post("/ingest", response_model=IngestResponse)
async def ingest_document(
    request: IngestRequest,
    x_admin_secret: str = Header(alias="X-Admin-Secret")
):
    """Ingest a document into the knowledge base (admin only)"""
    # Verify admin secret
    if x_admin_secret != ADMIN_SHARED_SECRET:
        raise HTTPException(status_code=403, detail="Invalid admin secret")
    
    try:
        # Generate embedding for the content
        embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)
        embedding = embeddings.embed_query(request.content)
        
        # Convert embedding to vector literal for PostgreSQL
        vec_lit = "[" + ",".join(f"{x:.8f}" for x in embedding) + "]"
        
        # Insert into database
        with psycopg.connect(DB_URL) as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO documents (title, content, source, embedding, metadata)
                VALUES (%s, %s, %s, %s::vector, %s)
                RETURNING id
                """,
                (
                    request.title,
                    request.content,
                    request.source,
                    vec_lit,
                    request.metadata or {}
                )
            )
            document_id = cur.fetchone()[0]
            conn.commit()
        
        return IngestResponse(
            success=True,
            message=f"Document '{request.title}' ingested successfully",
            document_id=str(document_id)
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to ingest document: {str(e)}"
        )

@app.delete("/documents/{document_id}", response_model=DeleteResponse)
async def delete_document(
    document_id: str,
    x_admin_secret: str = Header(alias="X-Admin-Secret")
):
    """Delete a document from the knowledge base (admin only)"""
    # Verify admin secret
    if x_admin_secret != ADMIN_SHARED_SECRET:
        raise HTTPException(status_code=403, detail="Invalid admin secret")
    
    try:
        with psycopg.connect(DB_URL) as conn, conn.cursor() as cur:
            # Check if document exists
            cur.execute("SELECT title FROM documents WHERE id = %s", (document_id,))
            result = cur.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail="Document not found")
            
            title = result[0]
            
            # Delete the document
            cur.execute("DELETE FROM documents WHERE id = %s", (document_id,))
            conn.commit()
        
        return DeleteResponse(
            success=True,
            message=f"Document '{title}' deleted successfully"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete document: {str(e)}"
        )

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
            "POST /ingest - Ingest documents (admin only)",
            "DELETE /documents/{id} - Delete documents (admin only)",
            "GET /health - Health check"
        ]
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
