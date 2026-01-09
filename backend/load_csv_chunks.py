import csv
import os
import asyncio
import asyncpg
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
CSV_PATH = "backend/uva_chunks.csv"

async def main():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL missing")

    conn = await asyncpg.connect(DATABASE_URL)

    try:
        inserted = 0

        with open(CSV_PATH, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)

            for row in reader:
                content = row.get("content") or row.get("text") or row.get("chunk") or ""
                if not content.strip():
                    continue

                await conn.execute(
                    """
                    INSERT INTO housing_chunks (content)
                    VALUES ($1)
                    """,
                    content,
                )
                inserted += 1

        print(f"Inserted {inserted} new rows into housing_chunks")

    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
