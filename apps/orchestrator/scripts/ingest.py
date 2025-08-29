import os
import json
from pathlib import Path
from typing import Any

import psycopg
from psycopg.rows import dict_row
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.getenv("DB_URL", "postgres://postgres:postgres@localhost:5432/insurance")
EMBED_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
client = OpenAI()


def embed(text: str) -> list[float]:
    """Generate embeddings using OpenAI's text-embedding-3-small model."""
    text = text.replace("\n", " ")
    res = client.embeddings.create(model=EMBED_MODEL, input=text)
    return res.data[0].embedding


def to_vector_literal(vec: list[float]) -> str:
    """Convert embedding list to PostgreSQL vector literal."""
    return "[" + ",".join(f"{x:.8f}" for x in vec) + "]"


def main():
    """Ingest knowledge base into pgvector documents table."""
    kb_path = Path("knowledge_base.json")
    if not kb_path.exists():
        print(f"Error: {kb_path} not found. Run from project root.")
        return

    print(f"Loading knowledge base from {kb_path}")
    data: list[dict[str, Any]] = json.loads(kb_path.read_text(encoding="utf-8"))
    print(f"Found {len(data)} documents to ingest")

    with psycopg.connect(DB_URL, row_factory=dict_row) as conn, conn.cursor() as cur:
        for i, item in enumerate(data, 1):
            content = item["content"]
            meta = item.get("metadata", {})
            source = meta.get("source_type") or meta.get("doc_id") or "kb"
            title = meta.get("doc_id") or meta.get("policy_number")
            
            print(f"Processing {i}/{len(data)}: {source} - {title}")
            
            try:
                vec = embed(content)
                assert len(vec) == 1536, f"Unexpected embedding size: {len(vec)}"
                vec_lit = to_vector_literal(vec)

                cur.execute(
                    """
                    INSERT INTO documents (source, title, content, embedding, metadata)
                    VALUES (%s, %s, %s, %s::vector, %s::jsonb)
                    ON CONFLICT DO NOTHING
                    """,
                    (source, title, content, vec_lit, json.dumps(meta)),
                )
                print(f"  ✓ Inserted/updated")
                
            except Exception as e:
                print(f"  ✗ Error: {e}")
                continue

        conn.commit()
        print(f"\nIngestion complete. Check documents table for {len(data)} entries.")


if __name__ == "__main__":
    main()
