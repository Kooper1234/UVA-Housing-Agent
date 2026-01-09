# backend/main.py
import logging
import traceback
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

from db import get_pool
from housing_tools import (
    embed_query_text,
    vector_search_housing_chunks,
    search_off_grounds_listings,
    call_openrouter_chat,
)

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("uva-housing-agent")

app = FastAPI()


class ChatRequest(BaseModel):
    message: str
    top_k: int = 6
    include_off_grounds: bool = False


@app.get("/health")
async def health():
    return {"ok": True}


@app.get("/db-check")
async def db_check():
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow("SELECT 1 AS ok;")
        return {"db_connected": True, "result": dict(row)}
    except Exception as e:
        logger.error("DB check failed: %s", str(e))
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="DB check failed")


@app.post("/chat")
async def chat(req: ChatRequest):
    try:
        question = req.message.strip()
        if not question:
            raise HTTPException(status_code=400, detail="message cannot be empty")

        # 1) Embed question
        query_embedding = await embed_query_text(question)

        # 2) Retrieve top chunks (RAG)
        pool = await get_pool()
        async with pool.acquire() as conn:
            chunks = await vector_search_housing_chunks(conn, query_embedding, top_k=req.top_k)

            listings = []
            if req.include_off_grounds:
                # this won't crash anymore even if main passes extra filters later
                listings = await search_off_grounds_listings(conn, question, limit=5)

        # 3) Build citations + context
        citations = []
        context_parts = []

        for i, ch in enumerate(chunks, start=1):
            label = ch["source"] or f"housing_chunks:{ch['id']}"
            citations.append({
                "cite": f"[{i}]",
                "source": label,
                "url": ch["url"],
                "chunk_id": ch["id"],
                "distance": ch["distance"],
            })
            context_parts.append(f"[{i}] {ch['content']}")

        listings_text = ""
        if listings:
            listings_lines = []
            for l in listings:
                listings_lines.append(f"- {l.get('title','(listing)')} | {l.get('location','')} | {l.get('price','')} | {l.get('url','')}")
            listings_text = "\n\nOff-grounds listings:\n" + "\n".join(listings_lines)

        system_msg = (
            "You are the UVA Housing Agent. Use the provided context to answer. "
            "If the context does not contain the answer, say what is missing. "
            "Cite sources using [1], [2], etc."
        )

        user_msg = (
            f"Question:\n{question}\n\n"
            f"Context:\n" + "\n\n".join(context_parts) +
            listings_text +
            "\n\nWrite a helpful answer with citations."
        )

        # 4) Call OpenRouter
        answer = await call_openrouter_chat([
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_msg},
        ])

        return {
            "answer": answer,
            "citations": citations,
            "num_chunks": len(chunks),
            "num_listings": len(listings),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("CHAT failed: %s", str(e))
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Internal Server Error. Check server logs.")
