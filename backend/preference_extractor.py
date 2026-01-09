"""
LLM-based preference extraction from natural language user messages.
Uses OpenRouter API for LLM access.
"""
import os
import json
from typing import Optional
from openai import OpenAI
from dotenv import load_dotenv
from pathlib import Path

# Load .env from the same directory as this script
script_dir = Path(__file__).parent
load_dotenv(script_dir / ".env")

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
if not OPENROUTER_API_KEY:
    raise RuntimeError("OPENROUTER_API_KEY not set in .env")

# Initialize OpenAI client pointing to OpenRouter
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY,
)


def extract_preferences(user_message: str) -> dict:
    """
    Use LLM to extract structured search preferences from a natural language message.
    
    Returns a dict with:
    - max_rent_per_person: int | None
    - min_bedrooms: int | None
    - max_bedrooms: int | None
    
    Example:
        extract_preferences("I'm looking for a 4 bedroom place around $900 per person")
        -> {"max_rent_per_person": 900, "min_bedrooms": 4, "max_bedrooms": 4}
    """
    prompt = f"""You are a housing search assistant. Extract search preferences from this user message.

User message: "{user_message}"

Extract the following information and return ONLY valid JSON (no markdown, no explanation):
- max_rent_per_person: maximum budget per person per month (integer, or null if not mentioned)
- min_bedrooms: minimum number of bedrooms (integer, or null if not mentioned)
- max_bedrooms: maximum number of bedrooms (integer, or null if not mentioned)

Rules:
- If user says "4 bedroom" or "4BR", set min_bedrooms=4 and max_bedrooms=4
- If user says "3-4 bedrooms" or "3 or 4", set min_bedrooms=3, max_bedrooms=4
- If user says "for 3 people", infer min_bedrooms=3, max_bedrooms=3
- Extract dollar amounts like "$900", "$900/person", "900 per person" as max_rent_per_person=900
- If user says "around $800-900", use max_rent_per_person=900
- Return null for any field that isn't clearly mentioned

Return ONLY this JSON format (no other text):
{{
  "max_rent_per_person": <integer or null>,
  "min_bedrooms": <integer or null>,
  "max_bedrooms": <integer or null>
}}
"""

    try:
        response = client.chat.completions.create(
            model="openai/gpt-4o-mini",  # OpenRouter model format: provider/model-name
            messages=[
                {"role": "system", "content": "You are a helpful assistant that extracts structured data from user messages. Always return valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,  # Low temperature for consistent extraction
            response_format={"type": "json_object"},  # Force JSON output
            extra_headers={
                "HTTP-Referer": "https://github.com/yourusername/uva-housing-agent",  # Optional: for OpenRouter tracking
                "X-Title": "UVA Housing Agent",  # Optional: for OpenRouter tracking
            }
        )
        
        content = response.choices[0].message.content
        parsed = json.loads(content)
        
        # Validate and clean the response
        return {
            "max_rent_per_person": parsed.get("max_rent_per_person"),
            "min_bedrooms": parsed.get("min_bedrooms"),
            "max_bedrooms": parsed.get("max_bedrooms"),
        }
    except Exception as e:
        print(f"Error extracting preferences with LLM: {e}")
        # Fallback: return None for all fields
        return {
            "max_rent_per_person": None,
            "min_bedrooms": None,
            "max_bedrooms": None,
        }

