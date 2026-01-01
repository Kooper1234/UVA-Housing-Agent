"""
Sync script to populate off_grounds_listings from RentCast API.

Run this manually when you want fresh data:
    python sync_listings.py

Or set up a cron job to run it periodically.
"""
import os
import asyncio
import requests
from pathlib import Path
from dotenv import load_dotenv
from db import get_pool

# Load .env from the same directory as this script
script_dir = Path(__file__).parent
load_dotenv(script_dir / ".env")

RENTCAST_API_KEY = os.getenv("RENTCAST_API_KEY")
if not RENTCAST_API_KEY:
    raise RuntimeError("RENTCAST_API_KEY not set in .env")


def fetch_rentcast_listings(city: str = "Charlottesville", state: str = "VA", limit: int = 100):
    """
    Fetch rental listings from RentCast API for a given city/state.
    
    Returns a list of listing dicts from the API response.
    """
    url = "https://api.rentcast.io/v1/listings/rentals"
    headers = {"X-Api-Key": RENTCAST_API_KEY}
    params = {
        "city": city,
        "state": state,
        "limit": limit,
    }
    
    print(f"Fetching listings from RentCast for {city}, {state}...")
    response = requests.get(url, headers=headers, params=params)
    
    if response.status_code != 200:
        print(f"Error from RentCast API: {response.status_code}")
        print(f"Response: {response.text}")
        return []
    
    data = response.json()
    listings = data.get("listings", [])
    print(f"Fetched {len(listings)} listings from RentCast")
    return listings


def transform_listing(api_listing: dict) -> dict | None:
    """
    Transform a RentCast API listing into our off_grounds_listings schema.
    
    Returns a dict ready for DB insertion, or None if the listing is missing
    required fields.
    """
    # Extract fields from RentCast response
    listing_id = str(api_listing.get("id", ""))
    if not listing_id:
        return None
    
    # RentCast fields (adjust these based on actual API response structure)
    name = api_listing.get("propertyName") or api_listing.get("address", "Unknown")
    address = api_listing.get("address", "")
    city = api_listing.get("city", "")
    state = api_listing.get("state", "")
    full_address = f"{address}, {city}, {state}".strip(", ")
    
    bedrooms = api_listing.get("bedrooms")
    if bedrooms is None:
        return None  # Skip listings without bedroom count
    
    price_total = api_listing.get("price") or api_listing.get("rent")
    if price_total is None:
        return None  # Skip listings without price
    
    # Calculate price_per_person (assume it's total rent / bedrooms)
    price_per_person = int(price_total / bedrooms) if bedrooms > 0 else None
    
    latitude = api_listing.get("latitude")
    longitude = api_listing.get("longitude")
    
    # URLs
    url = api_listing.get("url") or api_listing.get("listingUrl", "")
    landlord_contact_url = api_listing.get("contactUrl") or url
    
    return {
        "id": listing_id,
        "name": name,
        "address": full_address,
        "latitude": latitude,
        "longitude": longitude,
        "bedrooms": bedrooms,
        "price_total": int(price_total),
        "price_per_person": price_per_person,
        "url": url,
        "landlord_contact_url": landlord_contact_url,
    }


async def upsert_listings(listings: list[dict]):
    """
    Upsert listings into the off_grounds_listings table.
    Uses ON CONFLICT to update existing rows or insert new ones.
    """
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        # Start a transaction
        async with conn.transaction():
            inserted = 0
            updated = 0
            skipped = 0
            
            for listing in listings:
                try:
                    # Check if listing exists
                    existing = await conn.fetchrow(
                        "SELECT id FROM off_grounds_listings WHERE id = $1",
                        listing["id"]
                    )
                    
                    if existing:
                        # Update existing
                        await conn.execute(
                            """
                            UPDATE off_grounds_listings
                            SET
                                name = $2,
                                address = $3,
                                latitude = $4,
                                longitude = $5,
                                bedrooms = $6,
                                price_total = $7,
                                price_per_person = $8,
                                url = $9,
                                landlord_contact_url = $10,
                                last_seen_at = NOW()
                            WHERE id = $1
                            """,
                            listing["id"],
                            listing["name"],
                            listing["address"],
                            listing["latitude"],
                            listing["longitude"],
                            listing["bedrooms"],
                            listing["price_total"],
                            listing["price_per_person"],
                            listing["url"],
                            listing["landlord_contact_url"],
                        )
                        updated += 1
                    else:
                        # Insert new
                        await conn.execute(
                            """
                            INSERT INTO off_grounds_listings
                            (id, name, address, latitude, longitude, bedrooms,
                             price_total, price_per_person, url, landlord_contact_url, last_seen_at)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
                            """,
                            listing["id"],
                            listing["name"],
                            listing["address"],
                            listing["latitude"],
                            listing["longitude"],
                            listing["bedrooms"],
                            listing["price_total"],
                            listing["price_per_person"],
                            listing["url"],
                            listing["landlord_contact_url"],
                        )
                        inserted += 1
                except Exception as e:
                    print(f"Error upserting listing {listing.get('id', 'unknown')}: {e}")
                    skipped += 1
            
            print(f"\nSync complete:")
            print(f"  - Inserted: {inserted}")
            print(f"  - Updated: {updated}")
            print(f"  - Skipped (errors): {skipped}")


async def main():
    """
    Main sync function: fetch from RentCast, transform, and upsert to Supabase.
    """
    print("Starting RentCast → Supabase sync...\n")
    
    # Fetch listings from RentCast
    api_listings = fetch_rentcast_listings(city="Charlottesville", state="VA", limit=100)
    
    if not api_listings:
        print("No listings fetched. Check your RENTCAST_API_KEY and API response.")
        return
    
    # Transform to our schema
    print(f"\nTransforming {len(api_listings)} listings...")
    transformed = []
    for api_listing in api_listings:
        transformed_listing = transform_listing(api_listing)
        if transformed_listing:
            transformed.append(transformed_listing)
    
    print(f"Successfully transformed {len(transformed)} listings (skipped {len(api_listings) - len(transformed)} with missing fields)\n")
    
    # Upsert to Supabase
    await upsert_listings(transformed)
    
    print("\n✅ Sync finished!")


if __name__ == "__main__":
    asyncio.run(main())

