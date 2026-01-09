# backend/main.py
from fastapi import FastAPI
from pydantic import BaseModel
from db import get_pool
from housing_tools import search_off_grounds_listings
from preference_extractor import extract_preferences

app = FastAPI()


class ChatRequest(BaseModel):
    """
    Chat request model.
    The LLM will extract preferences from the message, but you can also
    override them by passing explicit filters.
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
    Smart chat endpoint that uses LLM to extract preferences from natural language.
    
    - Extracts max_rent_per_person, min_bedrooms, max_bedrooms from the message
    - Explicit filters in the request body override LLM-extracted values
    - Searches listings and returns results
    
    Example body:
    {
      "message": "I'm looking for a 4 bedroom place around $900 per person"
    }
    """
    try:
        # Extract preferences using LLM
        extracted = extract_preferences(request.message)
        
        # Use explicit filters if provided, otherwise use LLM-extracted values
        max_rent = request.max_rent_per_person or extracted.get("max_rent_per_person")
        min_bedrooms = request.min_bedrooms or extracted.get("min_bedrooms")
        max_bedrooms = request.max_bedrooms or extracted.get("max_bedrooms")
        
        # Search listings
        listings = await search_off_grounds_listings(
            max_rent_per_person=max_rent,
            min_bedrooms=min_bedrooms,
            max_bedrooms=max_bedrooms,
            limit=10,
        )

        count = len(listings)
        if count == 0:
            reply = (
                f"I searched for listings matching your preferences, but couldn't find any results. "
                "Try adjusting your budget or bedroom requirements."
            )
        else:
            reply = (
                f"I found {count} off-grounds place(s) that match your preferences. "
                "Here are some options with their prices and bedroom counts."
            )

        return {
            "message": reply,
            "filters_used": {
                "max_rent_per_person": max_rent,
                "min_bedrooms": min_bedrooms,
                "max_bedrooms": max_bedrooms,
            },
            "extracted_from_message": extracted,  # Show what the LLM extracted
            "results": listings,
        }
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in /chat endpoint: {error_details}")  # Print to server logs
        return {
            "message": f"Sorry, I encountered an error: {str(e)}",
            "error": str(e),
            "error_details": error_details,
        }
