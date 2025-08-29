from __future__ import annotations

import os
from typing import Any, Dict, Literal, Optional

import httpx
import numpy as np
import psycopg
from langchain_openai import OpenAIEmbeddings
from langgraph.graph import END, StateGraph
from langgraph.checkpoint.memory import MemorySaver
from pydantic import BaseModel

DB_URL = os.getenv("DB_URL", "postgres://postgres:postgres@localhost:5432/insurance")
NEST_API_URL = os.getenv("NEST_API_URL", "http://localhost:3000")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
SERVICE_EMAIL = os.getenv("ORCH_SERVICE_EMAIL", "admin@insurance.com")
SERVICE_PASSWORD = os.getenv("ORCH_SERVICE_PASSWORD", "admin123")

# Lightweight pending confirmation store to bridge turns reliably
SESSIONS: Dict[str, Dict[str, Any]] = {}


class SessionState(BaseModel):
    session_id: str
    last_intent: Optional[Literal["kb", "api", "both", "fallback"]] = None
    pending_confirmation: bool = False
    claim_id: Optional[str] = None
    policy_id: Optional[str] = None
    slots: Dict[str, Any] = {}
    message: Optional[str] = None
    user_role: Optional[Literal["user", "admin"]] = None
    
    # outputs rendered to API
    messages: list[dict] = []
    actions: list[dict] = []
    cards: dict = {}


_embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)


def _embed(text: str) -> list[float]:
    return _embeddings.embed_query(text)


def _get_service_token() -> str:
    with httpx.Client(timeout=10.0) as client:
        resp = client.post(
            f"{NEST_API_URL}/auth/login",
            json={"email": SERVICE_EMAIL, "password": SERVICE_PASSWORD},
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("access_token", "")


def _execute_get_claim(claim_id: str) -> Dict[str, Any]:
    token = _get_service_token()
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    with httpx.Client(timeout=10.0, headers=headers) as client:
        resp = client.get(f"{NEST_API_URL}/claims", params={"claim_id": claim_id})
        resp.raise_for_status()
        return resp.json()


def _execute_post_claim(body: Dict[str, Any]) -> Dict[str, Any]:
    token = _get_service_token()
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    with httpx.Client(timeout=10.0, headers=headers) as client:
        resp = client.post(f"{NEST_API_URL}/claims", json=body)
        resp.raise_for_status()
        return resp.json()


def _set_pending(session_id: str, payload: Dict[str, Any]) -> None:
    SESSIONS.setdefault(session_id, {})
    SESSIONS[session_id]["pending_confirmation"] = True
    SESSIONS[session_id]["confirm_payload"] = payload


def _clear_pending(session_id: str) -> None:
    if session_id in SESSIONS:
        SESSIONS[session_id]["pending_confirmation"] = False
        SESSIONS[session_id]["confirm_payload"] = None


def _get_payload(session_id: str) -> Optional[Dict[str, Any]]:
    return SESSIONS.get(session_id, {}).get("confirm_payload")


def _is_pending(session_id: str) -> bool:
    return bool(SESSIONS.get(session_id, {}).get("pending_confirmation"))


def intent_router(state: SessionState) -> SessionState:
    # Route approval turns or when a prior confirm payload exists directly to API
    if state.pending_confirmation or state.slots.get("confirm_payload") or _is_pending(state.session_id):
        state.last_intent = "api"
        return state

    text = (state.message or "")
    lower = text.lower()

    # Submission intent keywords
    if ("submit" in lower or "file" in lower) and "claim" in lower:
        # New submission: clear any stale pending
        state.pending_confirmation = False
        state.actions = []
        state.slots.pop("confirm_payload", None)
        _clear_pending(state.session_id)
        state.last_intent = "api"
        # mark op
        state.slots.setdefault("op", "SUBMIT_CLAIM")
        return state

    # If the user provided a standalone claim-like token (e.g., "98765"), treat as api
    import re
    token_match = re.search(r"\b[0-9A-Za-z]{1,10}\b", text)
    if token_match and any(ch.isdigit() for ch in token_match.group(0)):
        state.last_intent = "api"
        return state

    if any(k in lower for k in ["policy", "coverage", "deductible", "faq"]):
        state.last_intent = "kb"
    elif "claim" in lower or "premium" in lower:
        state.last_intent = "api"
    else:
        state.last_intent = "fallback"
    return state


def validator(state: SessionState) -> SessionState:
    # Example: enforce claim_id format when present
    if state.claim_id is not None:
        import re
        # Require alphanumeric up to 10 and at least one digit to reduce false picks like 'status'
        if not re.match(r"^(?=.*\d)[A-Za-z0-9]{1,10}$", state.claim_id):
            state.messages.append({
                "from": "assistant",
                "text": "Please provide a valid claim ID (alphanumeric, up to 10 characters, include at least one number).",
            })
            state.claim_id = None
    return state


def kb_agent(state: SessionState) -> SessionState:
    query = state.message or ""
    if not query.strip():
        return state
    try:
        vec = _embed(query)
        vec_lit = "[" + ",".join(f"{x:.8f}" for x in vec) + "]"
        with psycopg.connect(DB_URL) as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, title, content, metadata
                FROM documents
                ORDER BY embedding <-> %s::vector
                LIMIT 5
                """,
                (vec_lit,)
            )
            rows = cur.fetchall()
        if rows:
            snippets = [r[2] for r in rows]
            sources = [r[1] or r[0] for r in rows]
            state.messages.append({
                "from": "assistant",
                "text": "\n\n".join(snippets[:2])
            })
            state.cards["kb"] = {"sources": sources}
        else:
            state.messages.append({"from": "assistant", "text": "I couldn't find relevant information."})
    except Exception as e:
        state.messages.append({"from": "system", "text": f"KB error: {e}"})
    return state


def _need_submit_slots(slots: Dict[str, Any]) -> list[str]:
    needed: list[str] = []
    if not slots.get("policy_id"):
        needed.append("policy_id")
    if not slots.get("vehicle"):
        needed.append("vehicle")
    if not slots.get("damage_description") or len(str(slots.get("damage_description"))) < 10:
        needed.append("damage_description")
    return needed


def _handle_slot_input(slots: Dict[str, Any], user_text: str) -> Dict[str, Any]:
    awaiting: Optional[str] = slots.get("awaiting")
    text = user_text.strip()
    if awaiting == "policy_id":
        # accept first token-like id
        import re
        m = re.search(r"[A-Za-z0-9_\-]+", text)
        if m:
            slots["policy_id"] = m.group(0)
            slots["awaiting"] = None
    elif awaiting == "vehicle":
        slots["vehicle"] = text
        slots["awaiting"] = None
    elif awaiting == "damage_description":
        slots["damage_description"] = text
        slots["awaiting"] = None
    return slots


def api_agent(state: SessionState) -> SessionState:
    text = (state.message or "").lower().strip()
    import re

    # Handle approval/cancel if pending (either in state or in session store)
    if state.pending_confirmation or _is_pending(state.session_id):
        if text in {"yes", "y", "approve", "confirm", "ok"}:
            payload = state.slots.get("confirm_payload") or _get_payload(state.session_id) or {}
            op = payload.get("op")
            try:
                if op == "GET_CLAIM":
                    claim_id = payload.get("claim_id") or state.claim_id or ""
                    if not claim_id or not any(ch.isdigit() for ch in claim_id):
                        raise ValueError("claim_id missing or invalid")
                    result = _execute_get_claim(claim_id)
                    state.messages.append({"from": "assistant", "text": f"Claim {result.get('claim_id')} status: {result.get('status')}"})
                    state.cards["claim_status"] = result
                elif op == "SUBMIT_CLAIM":
                    body = payload.get("body") or {}
                    result = _execute_post_claim(body)
                    state.messages.append({"from": "assistant", "text": f"Claim submitted successfully. New claim ID: {result.get('claim_id')}"})
                    state.cards["claim_submitted"] = result
                else:
                    state.messages.append({"from": "assistant", "text": "Operation not supported yet."})
            except Exception as e:
                state.messages.append({"from": "system", "text": f"API error: {e}"})
            state.pending_confirmation = False
            state.actions = []
            state.slots.pop("confirm_payload", None)
            _clear_pending(state.session_id)
            return state
        if text in {"no", "n", "cancel", "stop"}:
            state.pending_confirmation = False
            state.actions = []
            state.slots.pop("confirm_payload", None)
            _clear_pending(state.session_id)
            state.messages.append({"from": "assistant", "text": "Okay, cancelled."})
            return state
        payload = state.slots.get("confirm_payload") or _get_payload(state.session_id) or {}
        # Re-emit confirm
        summary = payload.get("summary") or (
            f"Check status for claim ID {payload.get('claim_id')}?" if payload.get("op") == "GET_CLAIM" else
            "Submit the new claim?"
        )
        state.messages.append({"from": "assistant", "text": "Please reply yes or no to proceed."})
        state.actions = [{
            "type": "confirm",
            "id": f"confirm-{state.session_id}",
            "summary": summary,
            "payload": payload,
        }]
        state.pending_confirmation = True
        _set_pending(state.session_id, payload)
        return state

    # Handle SUBMIT_CLAIM slot filling
    if state.slots.get("op") == "SUBMIT_CLAIM" or (("submit" in text or "file" in text) and "claim" in text):
        # Initialize op if not set
        state.slots.setdefault("op", "SUBMIT_CLAIM")
        # If awaiting a specific slot, capture it
        if state.slots.get("awaiting"):
            state.slots = _handle_slot_input(state.slots, state.message or "")
        # Determine missing slots
        missing = _need_submit_slots(state.slots)
        if missing:
            next_slot = missing[0]
            state.slots["awaiting"] = next_slot
            prompt = {
                "policy_id": "Please provide your policy_id.",
                "vehicle": "Please provide the vehicle (make/model/year).",
                "damage_description": "Please describe the damage (at least 10 characters).",
            }[next_slot]
            state.messages.append({"from": "assistant", "text": prompt})
            return state
        # All slots present → confirm
        body = {
            "policy_id": state.slots.get("policy_id"),
            "vehicle": state.slots.get("vehicle"),
            "damage_description": state.slots.get("damage_description"),
            "photos": state.slots.get("photos") or [],
        }
        summary = (
            f"Submit claim for policy {body['policy_id']} on vehicle '{body['vehicle']}' with description '{body['damage_description']}'?"
        )
        payload = {"op": "SUBMIT_CLAIM", "body": body, "summary": summary}
        state.pending_confirmation = True
        state.actions = [{
            "type": "confirm",
            "id": f"confirm-{state.session_id}",
            "summary": summary,
            "payload": payload,
        }]
        state.slots["confirm_payload"] = payload
        _set_pending(state.session_id, payload)
        return state

    # GET_CLAIM path (no pending confirmation: detect claim_id and emit confirm)
    m = re.search(r"claim\s+([A-Za-z0-9]{1,10})", text)
    if m and any(ch.isdigit() for ch in m.group(1)):
        state.claim_id = state.claim_id or m.group(1)
    else:
        candidates = re.findall(r"\b[0-9A-Za-z]{1,10}\b", text)
        digit_candidates = [c for c in candidates if any(ch.isdigit() for ch in c)]
        if digit_candidates:
            state.claim_id = state.claim_id or digit_candidates[-1]

    # If we still don't have a valid claim_id, ask for it instead of confirming
    if not state.claim_id or not any(ch.isdigit() for ch in state.claim_id):
        state.messages.append({
            "from": "assistant",
            "text": "Please provide your claim ID (alphanumeric, up to 10 characters).",
        })
        return state

    payload = {"op": "GET_CLAIM", "claim_id": state.claim_id}
    state.pending_confirmation = True
    state.actions = [{
        "type": "confirm",
        "id": f"confirm-{state.session_id}",
        "summary": f"Check status for claim ID {state.claim_id}?",
        "payload": payload,
    }]
    state.slots["confirm_payload"] = payload
    _set_pending(state.session_id, payload)
    return state


def fallback_agent(state: SessionState) -> SessionState:
    state.messages.append({"from": "assistant", "text": "I can help with claims, premiums, or policy info."})
    return state


def conversation_manager(state: SessionState) -> SessionState:
    return state


def build_graph() -> StateGraph:
    graph = StateGraph(SessionState)
    graph.add_node("intent_router", intent_router)
    graph.add_node("validator", validator)
    graph.add_node("kb_agent", kb_agent)
    graph.add_node("api_agent", api_agent)
    graph.add_node("fallback_agent", fallback_agent)
    graph.add_node("conversation_manager", conversation_manager)

    graph.set_entry_point("intent_router")

    def route_after_intent(state: SessionState) -> str:
        if state.last_intent == "kb":
            return "kb_agent"
        if state.last_intent == "api":
            return "api_agent"
        return "fallback_agent"

    graph.add_conditional_edges("intent_router", route_after_intent)
    graph.add_edge("kb_agent", "validator")
    graph.add_edge("api_agent", "validator")
    graph.add_edge("fallback_agent", "validator")
    graph.add_edge("validator", "conversation_manager")
    graph.add_edge("conversation_manager", END)

    return graph


checkpoint = MemorySaver()

global_compiled_graph = build_graph().compile(checkpointer=checkpoint)


def run_turn(message: str, session_id: str, user_role: Optional[str]) -> dict:
    init = SessionState(session_id=session_id, message=message, user_role=user_role)
    out = global_compiled_graph.invoke(init, config={"configurable": {"thread_id": session_id}})
    if isinstance(out, SessionState):
        state_dict = out.model_dump()
    elif isinstance(out, dict):
        state_dict = out
    else:
        state_dict = SessionState(**out).model_dump()  # type: ignore[arg-type]

    return {
        "messages": state_dict.get("messages", []),
        "actions": state_dict.get("actions", []),
        "cards": state_dict.get("cards", {}),
        "state": {
            "pending_confirmation": state_dict.get("pending_confirmation", False),
            "claim_id": state_dict.get("claim_id"),
            "policy_id": state_dict.get("policy_id"),
            "last_intent": state_dict.get("last_intent"),
        },
    }
