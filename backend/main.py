# backend/main.py
from fastapi import FastAPI
from pydantic import BaseModel
from db import get_pool
from housing_tools import search_off_grounds_listings

app = FastAPI()


class ChatRequest(BaseModel):
    """
    Minimal chat request model.
    For now, the user can optionally pass numeric filters directly; later
    you'll parse them out of the free-form message using an LLM.
    """
    message: str
    max_rent_per_person: int | None = None
    min_bedrooms: int | None = None
    max_bedrooms: int | None = None


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/db-check")
async def db_check():
    """
    Simple connectivity check to Supabase Postgres.
    Runs a lightweight SELECT 1 query and reports success/failure.
    """
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow("SELECT 1 AS ok;")
        return {"db_connected": True, "result": dict(row)}
    except Exception as e:
        # In a real prod app you wouldn't return the raw error, but for now it's
        # helpful for debugging your setup.
        return {"db_connected": False, "error": str(e)}


@app.get("/test/off-grounds")
async def test_off_grounds():
    """
    Temporary endpoint to prove we can talk to Supabase.
    It returns up to 5 rows from off_grounds_listings.
    """
    pool = await get_pool()

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, name, price_per_person, bedrooms
            FROM off_grounds_listings
            ORDER BY price_per_person ASC
            LIMIT 5;
            """
        )

    # convert asyncpg Records to plain dicts so FastAPI can JSON-serialize them
    return [dict(row) for row in rows]


@app.get("/search/off-grounds")
async def search_off_grounds(
    max_rent_per_person: int | None = None,
    min_bedrooms: int | None = None,
    max_bedrooms: int | None = None,
    limit: int = 20,
):
    """
    Public API endpoint that wraps search_off_grounds_listings.
    Example:
    /search/off-grounds?max_rent_per_person=900&min_bedrooms=4
    """
    listings = await search_off_grounds_listings(
        max_rent_per_person=max_rent_per_person,
        min_bedrooms=min_bedrooms,
        max_bedrooms=max_bedrooms,
        limit=limit,
    )
    return {"results": listings}


@app.post("/chat")
async def chat(request: ChatRequest):
    """
    Very simple chat endpoint:
    - Takes a message and optional numeric filters.
    - Calls search_off_grounds_listings.
    - Returns a basic text response plus the raw listings.

    Example body:
    {
      "message": "Looking for a 3BR or 4BR near Grounds around $900/person",
      "max_rent_per_person": 900,
      "min_bedrooms": 3,
      "max_bedrooms": 4
    }
    """
    listings = await search_off_grounds_listings(
        max_rent_per_person=request.max_rent_per_person,
        min_bedrooms=request.min_bedrooms,
        max_bedrooms=request.max_bedrooms,
        limit=10,
    )

    count = len(listings)
    if count == 0:
        reply = "I couldn't find any off-grounds listings that match those filters yet. Try adjusting the budget or bedroom count."
    else:
        reply = (
            f"I found {count} off-grounds place(s) that match your filters. "
            "Here are some options with their prices and bedroom counts."
        )

    return {
        "message": reply,
        "filters_used": {
            "max_rent_per_person": request.max_rent_per_person,
            "min_bedrooms": request.min_bedrooms,
            "max_bedrooms": request.max_bedrooms,
        },
        "results": listings,
    }
