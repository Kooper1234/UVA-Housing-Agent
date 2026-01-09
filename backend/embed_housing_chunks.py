import os
from dotenv import load_dotenv
from supabase import create_client
from openai import OpenAI

# Load env vars from .env in this folder
load_dotenv()

# ---- ENV ----
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# OpenRouter's OpenAI-compatible base URL
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

# OpenRouter embedding model id (important!)
EMBED_MODEL = "openai/text-embedding-3-small"

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")

if not OPENROUTER_API_KEY:
    raise RuntimeError("Missing OPENROUTER_API_KEY in .env")

# Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# OpenRouter client (OpenAI SDK pointed at OpenRouter)
openai_client = OpenAI(
    api_key=OPENROUTER_API_KEY,
    base_url=OPENROUTER_BASE_URL,
)


def embed_text(text: str):
    # Safety: avoid empty strings
    text = (text or "").strip()
    if not text:
        return None

    resp = openai_client.embeddings.create(
        model=EMBED_MODEL,
        input=text,
    )
    return resp.data[0].embedding


def main():
    print("Fetching housing chunks without embeddings...")

    # Pull rows where embedding is NULL
    res = (
        supabase.table("housing_chunks")
        .select("id, content")
        .is_("embedding", None)
        .execute()
    )

    rows = res.data or []
    print(f"Found {len(rows)} rows to embed")

    for r in rows:
        row_id = r["id"]
        content = r.get("content", "")

        print(f"Embedding row {row_id}...")
        embedding = embed_text(content)

        if embedding is None:
            print(f"Skipping row {row_id} (empty content)")
            continue

        # Update the row
        upd = (
            supabase.table("housing_chunks")
            .update({"embedding": embedding})
            .eq("id", row_id)
            .execute()
        )

        if getattr(upd, "data", None) is None:
            print(f"Warning: update may not have returned data for row {row_id}")
        else:
            print(f"Updated row {row_id}")

    print("Done.")


if __name__ == "__main__":
    main()
