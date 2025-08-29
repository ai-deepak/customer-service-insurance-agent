# openai_agent.py
import os
import sys
import io
import asyncio
import contextlib
from dataclasses import dataclass
from typing import Optional, Dict, Any, List, Tuple
import json
import re

# Initialize Phoenix tracing early
from phoenix_tracing import setup_phoenix_tracing, log_agent_interaction, PHOENIX_PROJECT_NAME
_tracer_provider = setup_phoenix_tracing()

# ---------- OpenAI Agents SDK ----------
from agents import (
    Agent,
    Runner,
    ModelSettings,
    function_tool,
    SQLiteSession,
    set_default_openai_key,
    set_default_openai_client,
)
from agents.agent import StopAtTools

# If you use a custom base URL (Azure or gateway), we can supply a custom client
from openai import AsyncOpenAI
from openai import APIConnectionError, APIStatusError, AuthenticationError, OpenAIError

# ---------- Database and API imports ----------
import httpx
import psycopg
from langchain_openai import OpenAIEmbeddings

# =========================
# Config
# =========================
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
DB_URL = os.getenv("DB_URL", "postgres://postgres:postgres@localhost:5432/insurance")
NEST_API_URL = os.getenv("NEST_API_URL", "http://localhost:3000")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
SERVICE_EMAIL = os.getenv("ORCH_SERVICE_EMAIL", "admin@insurance.com")
SERVICE_PASSWORD = os.getenv("ORCH_SERVICE_PASSWORD", "admin123")

if os.getenv("OPENAI_API_KEY"):
    set_default_openai_key(os.environ["OPENAI_API_KEY"])
else:
    raise RuntimeError("OPENAI_API_KEY not set.")

# OPTIONAL: custom endpoint (Azure/OpenAI-compatible gateway)
if os.getenv("OPENAI_BASE_URL"):
    custom_client = AsyncOpenAI(
        base_url=os.environ["OPENAI_BASE_URL"],
        api_key=os.environ["OPENAI_API_KEY"],
        timeout=60,
        max_retries=3,
    )
    set_default_openai_client(custom_client)

# =========================
# Agent names & route key
# =========================
ORCHESTRATOR = "Orchestrator"
POLICY_DETAILS = "PolicyDetails_Agent"
CLAIM_STATUS = "ClaimStatus_Agent"
SUBMIT_CLAIM = "SubmitClaim_Agent"
CALC_PREMIUM = "CalculatePremium_Agent"
KNOWLEDGE_BASE = "KnowledgeBase_Agent"

ROUTE_PREFIX = "ROUTE:"  # stored as a system item in session history

# =========================
# App context (DI bag)
# =========================
@dataclass
class AppContext:
    app_name: str = "Insurance Chat"
    user_role: Optional[str] = None

# =========================
# Session route helpers
# =========================
async def get_last_route(session: SQLiteSession) -> Optional[str]:
    items = await session.get_items()
    for item in reversed(items or []):
        if item.get("role") == "system" and isinstance(item.get("content"), str):
            content = item["content"].strip()
            if content.startswith(ROUTE_PREFIX):
                return content[len(ROUTE_PREFIX):].strip()
    return None

async def set_route(session: SQLiteSession, agent_name: str) -> None:
    await session.add_items([{"role": "system", "content": f"{ROUTE_PREFIX}{agent_name}"}])

# =========================
# Utils
# =========================
def format_premium_line(payload: Dict[str, Any],
                        inputs: Tuple[float, float] | None = None) -> Optional[str]:
    """Deterministic final sentence for premium results."""
    if not payload:
        return None
    cur_prem = payload.get("current_premium")
    new_prem = payload.get("new_premium")
    pol = payload.get("policy_id")
    cur_cov, new_cov = (inputs or (None, None))
    if any(x is None for x in [cur_prem, new_prem, pol]):
        return None
    cov_part = (
        f" for coverage increase from ${cur_cov:,.0f} to ${new_cov:,.0f}"
        if cur_cov is not None and new_cov is not None else ""
    )
    return f"Your premium would change from ${cur_prem:,.2f} to ${new_prem:,.2f}{cov_part} per period on policy {pol}."

@contextlib.contextmanager
def silence_stdout():
    """Temporarily silence stdout (to hide api_client prints)."""
    saved = sys.stdout
    try:
        sys.stdout = io.StringIO()
        yield
    finally:
        sys.stdout = saved

# =========================
# Database and API helpers
# =========================
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
        resp = client.get(f"{NEST_API_URL}/insurance/claims", params={"claim_id": claim_id})
        resp.raise_for_status()
        return resp.json()

def _execute_post_claim(body: Dict[str, Any]) -> Dict[str, Any]:
    token = _get_service_token()
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    with httpx.Client(timeout=10.0, headers=headers) as client:
        resp = client.post(f"{NEST_API_URL}/insurance/claims", json=body)
        resp.raise_for_status()
        return resp.json()

def _execute_get_policy(user_id: str) -> Dict[str, Any]:
    token = _get_service_token()
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    with httpx.Client(timeout=10.0, headers=headers) as client:
        resp = client.get(f"{NEST_API_URL}/insurance/policy", params={"user_id": user_id})
        resp.raise_for_status()
        return resp.json()

def _execute_calculate_premium(policy_id: str, current_coverage: float, new_coverage: float) -> Dict[str, Any]:
    token = _get_service_token()
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    with httpx.Client(timeout=10.0, headers=headers) as client:
        resp = client.post(f"{NEST_API_URL}/insurance/premium", json={
            "policy_id": policy_id,
            "current_coverage": current_coverage,
            "new_coverage": new_coverage
        })
        resp.raise_for_status()
        return resp.json()

# =========================
# Tools (strict docstrings)
# =========================
@function_tool
def get_policy_details_tool(user_id: str) -> Dict[str, Any]:
    """Fetch policy details for a user.

    Args:
        user_id (str): User identifier, e.g., 'USER-002'.

    Returns:
        Dict[str, Any]: API payload with policy details.
    """
    try:
        data = _execute_get_policy(user_id)
        return data or {}
    except Exception as e:
        return {"error": f"Failed to fetch policy: {str(e)}"}

@function_tool
def get_claim_status_tool(claim_id: str) -> Dict[str, Any]:
    """Fetch claim status.

    Args:
        claim_id (str): Claim identifier, e.g., '98765'.

    Returns:
        Dict[str, Any]: API payload with claim status.
    """
    try:
        data = _execute_get_claim(claim_id)
        return data or {}
    except Exception as e:
        return {"error": f"Failed to fetch claim: {str(e)}"}

@function_tool
def submit_claim_tool(
    policy_id: str,
    damage_description: str,
    vehicle: str,
    photos: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Submit a new claim.

    Args:
        policy_id (str): Policy identifier, e.g., 'POL-1002'.
        damage_description (str): Short description of the damage.
        vehicle (str): Vehicle details, e.g., '2021 Honda Civic'.
        photos (Optional[List[str]]): Optional list of filenames.

    Returns:
        Dict[str, Any]: API payload for the submitted claim.
    """
    try:
        data = _execute_post_claim({
            "policy_id": policy_id,
            "damage_description": damage_description,
            "vehicle": vehicle,
            "photos": photos or []
        })
        return data or {}
    except Exception as e:
        return {"error": f"Failed to submit claim: {str(e)}"}

@function_tool
def calculate_premium_tool(
    policy_id: str,
    current_coverage: float,
    new_coverage: float,
) -> Dict[str, Any]:
    """Calculate premium for a coverage change.

    Args:
        policy_id (str): Policy identifier, e.g., 'POL-1001'.
        current_coverage (float): Current coverage amount.
        new_coverage (float): Requested new coverage amount (must be greater than current_coverage).

    Returns:
        Dict[str, Any]: API payload including 'policy_id', 'current_premium', 'new_premium'.
            Also includes a private field '_inputs' for orchestrator formatting.
    """
    # Validate inputs BEFORE calling the API
    if float(new_coverage) <= float(current_coverage):
        return {
            "error": "new_coverage must be greater than current_coverage",
            "_inputs": {
                "policy_id": policy_id,
                "current_coverage": float(current_coverage),
                "new_coverage": float(new_coverage),
            },
        }

    try:
        data = _execute_calculate_premium(policy_id, float(current_coverage), float(new_coverage))

        # Ensure we have policy id in payload
        if not isinstance(data, dict):
            data = {}
        if "policy_id" not in data:
            data["policy_id"] = policy_id

        # Attach inputs for downstream formatting (we won't show this in Expected Output)
        data["_inputs"] = {
            "policy_id": policy_id,
            "current_coverage": float(current_coverage),
            "new_coverage": float(new_coverage),
        }
        return data
    except Exception as e:
        return {"error": f"Failed to calculate premium: {str(e)}"}

@function_tool
def search_knowledge_base_tool(query: str) -> Dict[str, Any]:
    """Search the knowledge base for policy information, coverage details, and FAQs.

    Args:
        query (str): The search query about insurance policies, coverage, or general questions.

    Returns:
        Dict[str, Any]: Search results with relevant information and sources.
    """
    print(f"🔍 KNOWLEDGE BASE TOOL CALLED with query: '{query}'")
    try:
        print(f"🔍 Generating embedding for query...")
        vec = _embed(query)
        print(f"🔍 Embedding generated, length: {len(vec)}")
        vec_lit = "[" + ",".join(f"{x:.8f}" for x in vec) + "]"
        
        print(f"🔍 Connecting to database: {DB_URL}")
        with psycopg.connect(DB_URL) as conn, conn.cursor() as cur:
            print(f"🔍 Executing vector search query...")
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
            print(f"🔍 Found {len(rows)} matching documents")
        
        if rows:
            snippets = [r[2] for r in rows]
            sources = [r[1] or r[0] for r in rows]
            result = {
                "results": snippets,  # Return ALL snippets, not just first 2
                "sources": sources,
                "query": query
            }
            print(f"🔍 Returning results: {result}")
            return result
        else:
            print(f"🔍 No results found in knowledge base")
            return {
                "results": ["I couldn't find relevant information in our knowledge base."],
                "sources": [],
                "query": query
            }
    except Exception as e:
        print(f"🔍 ERROR in knowledge base search: {e}")
        return {"error": f"Knowledge base search failed: {str(e)}"}

# =========================
# Specialist agents
# =========================
policy_details_agent = Agent(
    name=POLICY_DETAILS,
    instructions=(
        "You help users retrieve policy details. "
        "Collect a 'user_id' like USER-002 if missing, then call get_policy_details_tool. "
        "Keep replies concise; do not invent IDs. "
        "IMPORTANT: You must call get_policy_details_tool to get the actual policy data. "
        "Do not invent or return policy data directly."
        "\n\nDEBUG: You are the PolicyDetails_Agent. Log when you start working."
    ),
    tools=[get_policy_details_tool],
    # Force the agent to use the tool and stop
    tool_use_behavior=StopAtTools(stop_at_tool_names=["get_policy_details_tool"]),
    model=MODEL,
    model_settings=ModelSettings(temperature=0.0),  # Lower temperature for more deterministic behavior
)

claim_status_agent = Agent(
    name=CLAIM_STATUS,
    instructions=(
        "You help users check claim status. "
        "1) Collect a 'claim_id' (e.g., 98765) if missing. "
        "2) Once you have the claim_id, ask for confirmation: 'Can you please confirm the claim ID {claim_id}?' "
        "3) Wait for user confirmation (yes, sure, ok, anything positive). "
        "4) Only after confirmation, call get_claim_status_tool with the confirmed claim_id. "
        "5) CRITICAL: After calling get_claim_status_tool, you MUST stop immediately and let the orchestrator handle the response formatting. Do NOT provide any additional text, formatting, or explanation."
        "Keep replies concise; do not invent IDs."
        "\n\nDEBUG: You are the ClaimStatus_Agent. Log when you start working."
    ),
    tools=[get_claim_status_tool],
    # Force stop after tool to ensure clean data return
    tool_use_behavior=StopAtTools(stop_at_tool_names=["get_claim_status_tool"]),
    model=MODEL,
    model_settings=ModelSettings(temperature=0.0),  # Lower temperature for more deterministic behavior
)

submit_claim_agent = Agent(
    name=SUBMIT_CLAIM,
    instructions=(
        "You help users file a claim. "
        "Collect: policy_id, damage_description, vehicle, optional photos. "
        "When all are present, call submit_claim_tool and summarize the created claim."
    ),
    tools=[submit_claim_tool],
    model=MODEL,
    model_settings=ModelSettings(temperature=0.1),
)

# IMPORTANT: stop after the tool so WE (code) decide the final output text
calculate_premium_agent = Agent(
    name=CALC_PREMIUM,
    instructions=(
        "You help users calculate premium for coverage changes. "
        "Collect: policy_id, current_coverage, new_coverage. "
        "Validate that new_coverage > current_coverage. "
        "If valid, call calculate_premium_tool. Do not invent values."
        "\n\nDEBUG: You are the CalculatePremium_Agent. Log when you start working."
    ),
    tools=[calculate_premium_tool],
    tool_use_behavior=StopAtTools(stop_at_tool_names=["calculate_premium_tool"]),
    model=MODEL,
    model_settings=ModelSettings(temperature=0.0),
)

knowledge_base_agent = Agent(
    name=KNOWLEDGE_BASE,
    instructions=(
        "You help users find information about available policies, coverage options, and general insurance questions. "
        "CRITICAL: You MUST ALWAYS call search_knowledge_base_tool first for every question. "
        "NEVER answer questions directly from your training data. "
        "ONLY provide information that comes from the search_knowledge_base_tool results. "
        "If the search returns no results, tell the user you couldn't find that information in the knowledge base. "
        "Always base your answers strictly on the returned search results."
        "\n\nDEBUG: You are the KnowledgeBase_Agent. You MUST use search_knowledge_base_tool for every query."
    ),
    tools=[search_knowledge_base_tool],
    # Force the agent to use the search tool
    tool_use_behavior=StopAtTools(stop_at_tool_names=["search_knowledge_base_tool"]),
    model=MODEL,
    model_settings=ModelSettings(temperature=0.1),  # Lower temperature for more deterministic behavior
)

# =========================
# Orchestrator agent (router)
# =========================
orchestrator_agent = Agent(
    name=ORCHESTRATOR,
    instructions=(
        f"You are the Orchestrator. Your job:\n"
        f"1) If the user's request maps to a task, HANDOFF to the correct specialist:\n"
        f"   - '{POLICY_DETAILS}': policy details, policy summary, my policy, check my policy for USER-XXX\n"
        f"   - '{CLAIM_STATUS}': claim status, track claim, check claim, claim ID 98765\n"
        f"   - '{SUBMIT_CLAIM}': file/submit claim, report damage, I need to file a claim\n"
        f"   - '{CALC_PREMIUM}': raise/lower coverage, premium change, calculate premium, what if I increase coverage\n"
        f"   - '{KNOWLEDGE_BASE}': FAQ questions, general insurance questions, policy information, coverage details, deductibles, roadside assistance, cancellation policies, claim processes, processing times, document requirements, what is, how to, can I, does it include, general knowledge about insurance\n"
        f"2) IMPORTANT: FAQ questions like 'Can I cancel my policy?', 'What is the deductible?', 'How long does it take?', 'What documents do I need?' should go to '{KNOWLEDGE_BASE}'\n"
        f"3) Do NOT collect parameters here; specialists will do slot-filling.\n"
        f"4) If general chit-chat, answer briefly.\n"
        f"5) If the session shows a last active agent, prefer continuing with it unless the user clearly changes topic.\n"
        f"6) You MUST use handoffs - you do not have any tools to answer questions directly.\n"
    ),
    tools=[],  # Orchestrator should not have any tools
    handoffs=[policy_details_agent, claim_status_agent, submit_claim_agent, calculate_premium_agent, knowledge_base_agent],
    model=MODEL,
    model_settings=ModelSettings(temperature=0.0),
)

# =========================
# Utility: infer UI payloads (from working experiment-assistant)
# =========================
def _is_policy_payload(d: Dict[str, Any]) -> bool:
    """Heuristics: typical keys from your policy_details payload"""
    keys = set(d.keys())
    return bool({"plan", "deductible"}.intersection(keys)) or "collision_coverage" in keys

def _is_claim_payload(d: Dict[str, Any]) -> bool:
    """Heuristics: typical keys from your claim_status payload"""
    keys = set(d.keys())
    return "claim_id" in keys or ("status" in keys and "policy_id" in keys)

def _shape_ui_from_tool_result(tool_name: str, output: Any) -> Optional[Dict[str, Any]]:
    """
    Build { type: 'policy_details'|'claim_status'|'knowledge_base', data: ... } from tool outputs.
    Handles dict or list[dict].
    """
    if output is None:
        return None

    # Normalize to list for easier checks
    if isinstance(output, list):
        list_out = output
    else:
        list_out = [output]

    # Try to detect by tool name first
    if tool_name == "get_policy_details_tool":
        # expect single dict of fields for the policy
        obj = list_out[0] if list_out else {}
        if isinstance(obj, dict):
            return {"type": "policy_details", "data": obj}
    elif tool_name == "get_claim_status_tool":
        # could be single dict or list of claims
        if all(isinstance(x, dict) for x in list_out):
            # If there's only one, send object; else send list
            if len(list_out) == 1:
                return {"type": "claim_status", "data": list_out[0]}
            return {"type": "claim_status", "data": list_out}
    elif tool_name == "search_knowledge_base_tool":
        # knowledge base results
        if isinstance(output, dict) and "results" in output:
            return {"type": "knowledge_base", "data": output}
    else:
        # fallback by shape if tool name is unknown
        if isinstance(output, dict) and _is_policy_payload(output):
            return {"type": "policy_details", "data": output}
        if isinstance(output, dict) and _is_claim_payload(output):
            return {"type": "claim_status", "data": output}
        if isinstance(output, list) and output and isinstance(output[0], dict) and _is_claim_payload(output[0]):
            return {"type": "claim_status", "data": output}

    return None

# =========================
# Orchestrated turn runner
# =========================
async def run_turn(user_text: str, session: SQLiteSession, ctx: AppContext):
    try:
        print(f"DEBUG: Running orchestrator with text: '{user_text}'")
        print(f"DEBUG: Orchestrator agent name: {orchestrator_agent.name}")
        print(f"DEBUG: Orchestrator handoffs: {[agent.name for agent in orchestrator_agent.handoffs]}")
        
        # Run the agent with Phoenix tracing
        result = await Runner.run(orchestrator_agent, user_text, session=session, context=ctx)
        
        print(f"DEBUG: Orchestrator result type: {type(result)}")
        print(f"DEBUG: Orchestrator final_output: {result.final_output}")
        
        # Log to Phoenix for additional insights
        session_id = getattr(session, 'session_id', 'unknown')
        log_agent_interaction(
            session_id=session_id,
            agent_name=orchestrator_agent.name,
            user_message=user_text,
            response=str(result.final_output)
        )
    except AuthenticationError:
        return "Auth error: OPENAI_API_KEY invalid or missing."
    except APIConnectionError as e:
        return f"Connection error (DNS/proxy/VPN/firewall). Details: {e}"
    except APIStatusError as e:
        body = getattr(e, "response", None)
        return f"OpenAI API returned {e.status_code}: {getattr(body, 'text', '')[:200]}"
    except OpenAIError as e:
        return f"OpenAI error: {e}"
    except Exception as e:
        return f"Unexpected error: {e}"

    tool_results = getattr(result, "tool_results", []) or []
    print(f"DEBUG: Tool results count: {len(tool_results)}")

    routed_to: Optional[str] = None
    specialist_finished: bool = False
    premium_expected_json: Optional[Dict[str, Any]] = None
    premium_sentence: Optional[str] = None

    # Log all tool results to see what happened
    for i, tr in enumerate(tool_results):
        name = getattr(tr, "tool_name", "") or ""
        output = getattr(tr, "output", None)
        print(f"DEBUG: Tool {i}: name='{name}', output_type={type(output)}")

        # Handoffs appear as transfer_to_<AgentName>
        if name.startswith("transfer_to_"):
            target = name[len("transfer_to_"):]
            print(f"DEBUG: 🚀 ROUTING DECISION: Transfer to '{target}'")
            if target in {POLICY_DETAILS, CLAIM_STATUS, SUBMIT_CLAIM, CALC_PREMIUM, KNOWLEDGE_BASE, ORCHESTRATOR}:
                routed_to = target
                print(f"DEBUG: ✅ Valid routing target: {routed_to}")
                print(f"DEBUG: 🎯 Agent '{target}' will be triggered for this request")

        # Specialized tools:
        if name in {"get_policy_details_tool", "get_claim_status_tool", "submit_claim_tool", "search_knowledge_base_tool"}:
            specialist_finished = True
            print(f"DEBUG: 🛠️ Specialist agent finished: {name}")

        if name == "calculate_premium_tool":
            specialist_finished = True
            print(f"DEBUG: 🛠️ Premium calculation agent finished: {name}")
            if isinstance(output, dict):
                # Build Expected Output (exact keys only)
                premium_expected_json = {
                    "policy_id": output.get("policy_id"),
                    "current_premium": output.get("current_premium"),
                    "new_premium": output.get("new_premium"),
                }
                # Derive final sentence with inputs (if the tool attached them)
                inputs = output.get("_inputs")
                cov_tuple = None
                if isinstance(inputs, dict):
                    cov_tuple = (inputs.get("current_coverage"), inputs.get("new_coverage"))
                premium_sentence = format_premium_line(output, inputs=cov_tuple)

    # Route persistence
    if routed_to and routed_to != ORCHESTRATOR:
        await set_route(session, routed_to)
    elif specialist_finished:
        await set_route(session, ORCHESTRATOR)

    # --- PREMIUM: print exactly as you want ---
    if premium_expected_json or premium_sentence:
        # print Expected Output JSON *first*
        if premium_expected_json:
            print("Expected Output:")
            print(json.dumps(premium_expected_json, indent=2))
        # then return the final message (deterministic sentence)
        if premium_sentence:
            await session.add_items([{"role": "assistant", "content": premium_sentence}])
            return premium_sentence
        # if somehow sentence failed, fall back to JSON
        return json.dumps(premium_expected_json or {}, indent=2)

    # --- CLAIM STATUS: Special handling to ensure clean JSON response ---
    claim_status_data = None
    for tr in tool_results:
        name = getattr(tr, "tool_name", "") or ""
        output = getattr(tr, "output", None)
        if name == "get_claim_status_tool" and isinstance(output, dict) and not output.get("error"):
            claim_status_data = output
            break

    if claim_status_data:
        # Return structured JSON response for frontend to parse
        ui_block = {"type": "claim_status", "data": claim_status_data}
        response = json.dumps({
            "message": f"Found claim status for claim ID {claim_status_data.get('claim_id', 'N/A')}.",
            "ui": ui_block
        })
        print(f"DEBUG: Returning claim status structured response: {response}")
        return response

    # --- KNOWLEDGE BASE: Special handling to ensure KB usage ---
    kb_data = None
    for tr in tool_results:
        name = getattr(tr, "tool_name", "") or ""
        output = getattr(tr, "output", None)
        if name == "search_knowledge_base_tool" and isinstance(output, dict) and not output.get("error"):
            kb_data = output
            break

    if kb_data:
        # Return structured JSON response with knowledge base results
        ui_block = {"type": "knowledge_base", "data": kb_data}
        
        # Create a user-friendly message based on the results
        results = kb_data.get("results", [])
        if results and results[0] != "I couldn't find relevant information in our knowledge base.":
            message = f"Found information in our knowledge base about: {kb_data.get('query', 'your question')}"
        else:
            message = "I couldn't find that information in our knowledge base."
            
        response = json.dumps({
            "message": message,
            "ui": ui_block
        })
        print(f"DEBUG: Returning knowledge base structured response: {response}")
        return response

    # Build UI block for policy details and claim status
    ui_block: Optional[Dict[str, Any]] = None
    
    # Debug: Print tool results to see what's happening
    print(f"DEBUG: Tool results count: {len(tool_results)}")
    
    # Check if we have any tool results that can create UI blocks
    for tr in tool_results:
        name = getattr(tr, "tool_name", "") or ""
        output = getattr(tr, "output", None)
        print(f"DEBUG: Tool name: {name}, Output type: {type(output)}")
        
        # Build UI block for different tool types using the working logic from experiment-assistant
        ui_guess = _shape_ui_from_tool_result(name, output)
        if ui_guess and ui_block is None:
            ui_block = ui_guess
            print(f"DEBUG: UI block created from tool: {ui_block}")
    
    print(f"DEBUG: Final UI block: {ui_block}")
    
    # Return structured response with UI component data
    if ui_block:
        # Return a special format that the frontend can parse to extract UI data
        response = json.dumps({
            "message": result.final_output,
            "ui": ui_block
        })
        print(f"DEBUG: Returning structured response: {response}")
        return response
    
    print(f"DEBUG: No UI block, returning final output: {result.final_output}")
    
    # Otherwise, return LLM's final output
    return result.final_output

# =========================
# Session cache for memory persistence
# =========================
_sessions: Dict[str, SQLiteSession] = {}

def get_session(session_id: str) -> SQLiteSession:
    """Get or create a session to maintain conversation memory"""
    if session_id not in _sessions:
        _sessions[session_id] = SQLiteSession(session_id)
    return _sessions[session_id]

# =========================
# Main function for compatibility
# =========================
def run_turn_sync(message: str, session_id: str, user_role: Optional[str]) -> str:
    """Synchronous wrapper for the async run_turn function"""
    async def _run():
        session = get_session(session_id)  # Use cached session instead of creating new one
        ctx = AppContext(user_role=user_role)
        result = await run_turn(message, session, ctx)
        return result
    
    try:
        # Try to get the current event loop, or create a new one if none exists
        try:
            loop = asyncio.get_running_loop()
            # If we're in an event loop, we need to run this differently
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(asyncio.run, _run())
                return future.result()
        except RuntimeError:
            # No event loop running, we can create one
            return asyncio.run(_run())
    except Exception as e:
        return f"Error: {str(e)}"

if __name__ == "__main__":
    asyncio.run(main())
