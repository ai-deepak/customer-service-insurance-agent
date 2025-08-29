#!/usr/bin/env python3
"""
Test script for the OpenAI agent orchestrator
"""

import asyncio
import os
from openai_agent import run_turn_sync

# Set environment variables for testing
os.environ["OPENAI_API_KEY"] = "your-api-key-here"  # Replace with actual key
os.environ["NEST_API_URL"] = "http://localhost:3000"

def test_basic_queries():
    """Test basic queries to the orchestrator"""
    
    test_cases = [
        "What are my policy details for USER-001?",
        "Check claim status 98765",
        "What if I increase collision coverage from 50k to 80k?",
        "Tell me about available insurance policies",
        "How do I submit a claim?"
    ]
    
    print("Testing OpenAI Agent Orchestrator")
    print("=" * 50)
    
    for i, query in enumerate(test_cases, 1):
        print(f"\nTest {i}: {query}")
        print("-" * 30)
        
        try:
            # Test with a unique session ID
            session_id = f"test-session-{i}"
            result = run_turn_sync(query, session_id, "user")
            
            if isinstance(result, str):
                print(f"Response: {result}")
            elif isinstance(result, dict):
                print(f"Response: {result}")
            else:
                print(f"Unexpected response type: {type(result)}")
                
        except Exception as e:
            print(f"Error: {e}")
        
        print()

if __name__ == "__main__":
    print("Note: Make sure you have set your OPENAI_API_KEY environment variable")
    print("Note: Make sure the NestJS API is running on port 3000")
    print()
    
    test_basic_queries()
