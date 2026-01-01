# backend/db.py
import os
import asyncpg
from dotenv import load_dotenv
from typing import Optional

load_dotenv()  # loads variables from backend/.env

DATABASE_URL = os.getenv("DATABASE_URL")

_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    """
    Return a global connection pool to the Supabase Postgres DB.
    Creates it on first use, then reuses it.
    """
    global _pool

    if _pool is None:
        if not DATABASE_URL:
            raise RuntimeError("DATABASE_URL not set in backend/.env")
        _pool = await asyncpg.create_pool(DATABASE_URL)

    return _pool


async def get_db_connection() -> asyncpg.Connection:
    """
    Return a single connection from the pool.
    Use this if you prefer: conn = await get_db_connection()
    Remember to release it after use if you acquire from the pool directly.
    """
    pool = await get_pool()
    return await pool.acquire()


async def release_db_connection(conn: asyncpg.Connection) -> None:
    """
    Release a connection back to the pool.
    """
    pool = await get_pool()
    await pool.release(conn)
