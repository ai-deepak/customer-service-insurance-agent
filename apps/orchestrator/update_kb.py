#!/usr/bin/env python3
"""
Update Knowledge Base Script
Re-ingests the knowledge base with improved content that forces agent to use search.
"""
import os
import sys
import json
from pathlib import Path
import psycopg
from langchain_openai import OpenAIEmbeddings

# Add the current directory to Python path so we can import
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Configuration
DB_URL = os.getenv("DB_URL", "postgres://postgres:postgres@localhost:5432/insurance")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")

def main():
    """Update the knowledge base with improved content."""
    
    # Check if we're in the right directory
    kb_path = Path("../../knowledge_base.json")
    if not kb_path.exists():
        # Try relative to orchestrator directory
        kb_path = Path("knowledge_base.json")
        if not kb_path.exists():
            print("❌ Error: knowledge_base.json not found.")
            print("   Please run from project root or orchestrator directory.")
            return False
    
    print(f"📚 Loading updated knowledge base from {kb_path}")
    
    try:
        with open(kb_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"✅ Found {len(data)} documents to update")
    except Exception as e:
        print(f"❌ Error loading knowledge base: {e}")
        return False
    
    try:
        print("🔗 Connecting to database...")
        embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)
        
        with psycopg.connect(DB_URL) as conn, conn.cursor() as cur:
            # Clear existing documents
            print("🗑️  Clearing existing knowledge base...")
            cur.execute("DELETE FROM documents WHERE source IN ('Policy', 'ClaimStep', 'FAQ', 'kb')")
            deleted_count = cur.rowcount
            print(f"   Deleted {deleted_count} existing documents")
            
            # Insert updated documents
            print("📥 Inserting updated documents...")
            for i, item in enumerate(data, 1):
                content = item["content"]
                meta = item.get("metadata", {})
                source = meta.get("source_type") or meta.get("doc_id") or "kb"
                title = meta.get("doc_id") or meta.get("policy_number") or f"doc_{i}"
                
                print(f"   Processing {i}/{len(data)}: {source} - {title}")
                
                try:
                    # Generate embedding
                    embedding = embeddings.embed_query(content)
                    vec_lit = "[" + ",".join(f"{x:.8f}" for x in embedding) + "]"
                    
                    # Insert document
                    cur.execute(
                        """
                        INSERT INTO documents (source, title, content, embedding, metadata)
                        VALUES (%s, %s, %s, %s::vector, %s::jsonb)
                        """,
                        (source, title, content, vec_lit, json.dumps(meta)),
                    )
                    print(f"     ✅ Inserted successfully")
                    
                except Exception as e:
                    print(f"     ❌ Error: {e}")
                    continue
            
            # Commit all changes
            conn.commit()
            print(f"\n🎉 Knowledge base update complete!")
            print(f"   Updated {len(data)} documents")
            
            # Verify the update
            cur.execute("SELECT COUNT(*) FROM documents")
            total_docs = cur.fetchone()[0]
            print(f"   Total documents in database: {total_docs}")
            
    except Exception as e:
        print(f"❌ Database error: {e}")
        return False
    
    print("\n✅ Knowledge base successfully updated!")
    print("   The agent will now be forced to search the knowledge base for all questions.")
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
