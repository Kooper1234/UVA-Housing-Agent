# backend/housing_tools.py
import os
import logging
from typing import List, Dict, Any, Optional

import httpx

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")


# -------------------------
# 1) Embedding helper
# -------------------------
async def embed_query_text(text: str) -> List[float]:
    """
    Returns an embedding vector for the user query.
    Uses OpenRouter's OpenAI-compatible endpoint.
    """
    if not OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is missing. Check backend/.env loading.")

    embedding_model = os.getenv("EMBEDDING_MODEL", "openai/text-embedding-3-small")

    url = "https://openrouter.ai/api/v1/embeddings"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {"model": embedding_model, "input": text}

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()

    return data["data"][0]["embedding"]


# -------------------------
# 2) Vector search (pgvector) — SAFE VERSION
# -------------------------
async def vector_search_housing_chunks(conn, query_embedding: List[float], top_k: int = 6) -> List[Dict[str, Any]]:
    """
    Vector search using pgvector (<->).
    asyncpg needs the embedding passed as a STRING for $1::vector, not a Python list.
    """

    text_col = os.getenv("HOUSING_CHUNKS_TEXT_COL", "content")

    # Convert Python list -> pgvector literal string: '[0.1,0.2,0.3]'
    vector_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

    sql = f"""
        SELECT
            id,
            {text_col} AS content,
            embedding <-> $1::vector AS distance
        FROM housing_chunks
        WHERE embedding IS NOT NULL
        ORDER BY embedding <-> $1::vector
        LIMIT $2;
    """

    rows = await conn.fetch(sql, vector_str, top_k)

    results = []
    for r in rows:
        results.append({
            "id": r["id"],
            "content": r["content"],
            "source": f"housing_chunks:{r['id']}",
            "url": "",
            "distance": float(r["distance"]),
        })

    return results


# -------------------------
# 3) Off-grounds listings search (safe)
# -------------------------
async def search_off_grounds_listings(conn, query: str, limit: int = 5, **kwargs) -> List[Dict[str, Any]]:
    """
    Safe stub: accepts extra filters so /chat won't crash.
    If OFF_GROUNDS_TABLE is not set, returns [].

    kwargs may contain: max_bedrooms, min_price, max_price, etc.
    We ignore kwargs for now.
    """
    table = os.getenv("OFF_GROUNDS_TABLE", "")
    if not table:
        return []

    sql = f"""
        SELECT id, title, price, location, url
        FROM {table}
        WHERE title ILIKE $1 OR location ILIKE $1
        LIMIT $2;
    """

    rows = await conn.fetch(sql, f"%{query}%", limit)

    return [{
        "id": r["id"],
        "title": r["title"],
        "price": r.get("price"),
        "location": r.get("location"),
        "url": r.get("url"),
    } for r in rows]


# -------------------------
# 4) OpenRouter chat helper
# -------------------------
async def call_openrouter_chat(messages: List[Dict[str, str]]) -> str:
    """
    Calls OpenRouter chat completions endpoint.
    """
    if not OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is missing. Check backend/.env loading.")

    chat_model = os.getenv("CHAT_MODEL", "openai/gpt-4o-mini")

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": chat_model,
        "messages": messages,
        "temperature": 0.2,
    }

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()

    return data["choices"][0]["message"]["content"]
