import os
import asyncio
import asyncpg
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


async def main():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL missing. Put it in backend/.env")

    print("Connecting to DB...")
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        row = await conn.fetchrow("SELECT 1 AS ok;")
        print("Basic query ok:", dict(row))

        # Confirm housing_chunks exists and embeddings exist
        table_check = await conn.fetchval("""
            SELECT to_regclass('public.housing_chunks') IS NOT NULL AS exists;
        """)
        print("housing_chunks exists:", bool(table_check))

        if table_check:
            counts = await conn.fetchrow("""
                SELECT
                  COUNT(*) AS total,
                  COUNT(embedding) AS with_embedding
                FROM housing_chunks;
            """)
            print("housing_chunks counts:", dict(counts))

            # Optional: confirm pgvector operator works with a dummy query (won't run if table empty)
            if counts["with_embedding"] and counts["with_embedding"] > 0:
                # This will error if pgvector casting isn't right or embedding isn't vector type
                await conn.fetch("""
                    SELECT id
                    FROM housing_chunks
                    WHERE embedding IS NOT NULL
                    ORDER BY embedding <-> embedding
                    LIMIT 1;
                """)
                print("pgvector operator (<->) works ✅")

    finally:
        await conn.close()
        print("Closed DB connection.")


if __name__ == "__main__":
    asyncio.run(main())
