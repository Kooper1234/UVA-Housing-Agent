import os
import asyncpg
from dotenv import load_dotenv

load_dotenv()  # loads variables from backend/.env

DATABASE_URL = os.getenv("DATABASE_URL")

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    """
    Return a global connection pool to the Supabase Postgres DB.
    Creates it on first use, then reuses it.
    """
    global _pool

    if _pool is None:
        if not DATABASE_URL:
            raise RuntimeError("DATABASE_URL not set in .env")
        _pool = await asyncpg.create_pool(DATABASE_URL)

    return _pool

