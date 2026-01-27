import os
import ssl
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
        
        # Create SSL context for Supabase connection
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        
        # Parse URL and create pool with SSL
        # IMPORTANT: statement_cache_size=0 is required for Supabase pooler
        try:
            _pool = await asyncpg.create_pool(
                DATABASE_URL,
                ssl=ssl_context,
                statement_cache_size=0,  # Required for Supabase pgbouncer
                server_settings={'jit': 'off'}  # Disable JIT for better compatibility
            )
        except Exception as e:
            print(f"Error creating database pool: {e}")
            print(f"DATABASE_URL (sanitized): {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else 'invalid'}")
            raise

    return _pool