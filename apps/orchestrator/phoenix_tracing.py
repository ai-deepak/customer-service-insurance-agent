"""
Arize Phoenix Tracing Configuration for OpenAI Agents SDK
Based on: https://arize.com/docs/phoenix/integrations/llm-providers/openai/openai-agents-sdk-tracing
"""
import os
from typing import Optional

# Phoenix configuration
PHOENIX_ENABLED = os.getenv("PHOENIX_ENABLED", "false").lower() == "true"
PHOENIX_PROJECT_NAME = os.getenv("PHOENIX_PROJECT_NAME", "insurance-agent")
PHOENIX_COLLECTOR_ENDPOINT = os.getenv("PHOENIX_COLLECTOR_ENDPOINT", "http://localhost:6006")
PHOENIX_API_KEY = os.getenv("PHOENIX_API_KEY")


def setup_phoenix_tracing() -> Optional[object]:
    """
    Set up Phoenix tracing for OpenAI Agents SDK
    
    Returns:
        Tracer provider if successful, None if disabled or failed
    """
    if not PHOENIX_ENABLED:
        print("🔍 Phoenix tracing is disabled. Set PHOENIX_ENABLED=true to enable.")
        return None
    
    try:
        print(f"🔍 Setting up Phoenix tracing for project: {PHOENIX_PROJECT_NAME}")
        
        # Set Phoenix environment variables
        os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = PHOENIX_COLLECTOR_ENDPOINT
        
        # Set API key if provided (for Phoenix Cloud)
        if PHOENIX_API_KEY:
            os.environ["PHOENIX_CLIENT_HEADERS"] = f"api_key={PHOENIX_API_KEY}"
            print("🔑 Using Phoenix Cloud with API key")
        else:
            print(f"🏠 Using local Phoenix instance at {PHOENIX_COLLECTOR_ENDPOINT}")
        
        # Import and configure Phoenix
        from phoenix.otel import register
        
        # Configure the Phoenix tracer
        tracer_provider = register(
            project_name=PHOENIX_PROJECT_NAME,
            auto_instrument=True  # Auto-instrument based on installed dependencies
        )
        
        print("✅ Phoenix tracing initialized successfully!")
        print(f"📊 Traces will be sent to: {PHOENIX_COLLECTOR_ENDPOINT}")
        print(f"🏷️  Project name: {PHOENIX_PROJECT_NAME}")
        
        return tracer_provider
        
    except ImportError as e:
        print(f"❌ Phoenix tracing dependencies not installed: {e}")
        print("   Install with: pip install arize-phoenix-otel openinference-instrumentation-openai-agents")
        return None
    except Exception as e:
        print(f"❌ Failed to initialize Phoenix tracing: {e}")
        return None


def log_agent_interaction(session_id: str, agent_name: str, user_message: str, response: str):
    """
    Log additional context for agent interactions
    
    This adds extra metadata that can be useful for analysis in Phoenix
    """
    if not PHOENIX_ENABLED:
        return
        
    try:
        # You can add custom spans or attributes here
        # This is useful for adding business context to your traces
        print(f"🤖 Agent Interaction: {agent_name} | Session: {session_id}")
        print(f"📝 Message length: {len(user_message)} chars | Response length: {len(response)} chars")
        
    except Exception as e:
        print(f"❌ Error logging agent interaction: {e}")
