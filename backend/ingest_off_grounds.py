import os
import asyncio
import aiohttp
from typing import Optional, List
from pathlib import Path
from math import radians, cos, sin, acos
from dotenv import load_dotenv

from db import get_pool
from models import OffGroundListingModel

# Load env
load_dotenv(Path(__file__).parent / ".env")

RENTCAST_API_KEY = os.getenv("RENTCAST_API_KEY")
if not RENTCAST_API_KEY:
    raise RuntimeError("RENTCAST_API_KEY not set")

BASE_URL = "https://api.rentcast.io/v1"
LISTINGS_URL = f"{BASE_URL}/listings"

PAGE_LIMIT = 10
MAX_LISTINGS = 100

# UVA location
UVA_LAT = 38.034
UVA_LON = -78.503
MAX_DISTANCE_MILES = 3
MAX_BEDROOMS = 4


def distance_miles(lat1, lon1, lat2, lon2):
    return 3959 * acos(
        cos(radians(lat1)) * cos(radians(lat2)) *
        cos(radians(lon2) - radians(lon1)) +
        sin(radians(lat1)) * sin(radians(lat2))
    )


async def fetch_listings_page(
    session: aiohttp.ClientSession,
    *,
    city: str,
    state: str,
    page: int
) -> dict:
    LISTINGS_URL = f"{BASE_URL}/listings/search"  # fixed endpoint

    params = {
        "city": city,
        "state": state,
        "status": "Active",
        "limit": PAGE_LIMIT,
        "page": page,
        "propertyType": "Apartment"
    }

    try:
        async with session.get(
            LISTINGS_URL,
            params=params,
            headers={"Authorization": f"Bearer {RENTCAST_API_KEY}"},
            timeout=aiohttp.ClientTimeout(total=60),
        ) as resp:
            if resp.status == 404:
                print(f"❌ 404 Not Found: {LISTINGS_URL}")
                return {}
            elif resp.status != 200:
                text = await resp.text()
                print(f"❌ Error fetching listings: {resp.status} {text}")
                return {}
            return await resp.json()

    except aiohttp.ClientError as e:
        print(f"❌ Client error fetching listings: {e}")
        return {}
    except asyncio.TimeoutError:
        print(f"❌ Timeout fetching listings page {page}")
        return {}




def map_listing_to_model(l: dict) -> Optional[OffGroundListingModel]:
    address = l.get("formattedAddress")
    rent = l.get("rent")
    bedrooms = l.get("bedrooms")
    latitude = l.get("latitude")
    longitude = l.get("longitude")

    if not address or bedrooms is None:
        return None

    if bedrooms > MAX_BEDROOMS:
        return None

    if latitude is None or longitude is None:
        return None

    if distance_miles(UVA_LAT, UVA_LON, latitude, longitude) > MAX_DISTANCE_MILES:
        return None

    price_per_person = None
    if rent is not None and bedrooms > 0:
        price_per_person = rent // bedrooms

    return OffGroundListingModel(
        id=l["id"],
        name=address,
        address=address,
        latitude=latitude,
        longitude=longitude,
        bedrooms=bedrooms,
        price_total=rent,              # can be NULL
        price_per_person=price_per_person,
        url=l.get("listingUrl"),
        landlord_contact_url=None,
    )



async def upsert_off_grounds_listings(listings: List[OffGroundListingModel]):
    if not listings:
        return

    query = """
    INSERT INTO off_grounds_listings (
        id, name, address, latitude, longitude, bedrooms,
        price_total, price_per_person, url, landlord_contact_url, last_seen_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
    ON CONFLICT (id) DO UPDATE SET
        price_total = excluded.price_total,
        price_per_person = excluded.price_per_person,
        last_seen_at = now()
    """

    rows = [
        (
            l.id,
            l.name,
            l.address,
            l.latitude,
            l.longitude,
            l.bedrooms,
            l.price_total,
            l.price_per_person,
            l.url,
            l.landlord_contact_url,
        )
        for l in listings
    ]

    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.executemany(query, rows)


async def ingest_city(city: str, state: str = "VA"):
    page = 1
    total = 0

    async with aiohttp.ClientSession() as session:
        while total < MAX_LISTINGS:
            print(f"Fetching listings page={page} ({city})")

            raw = await fetch_listings_page(
                session,
                city=city,
                state=state,
                page=page
            )

            listings_raw = raw.get("listings", [])
            if not listings_raw:
                break

            models = []
            for l in listings_raw:
                model = map_listing_to_model(l)
                if model:
                    models.append(model)
                if total + len(models) >= MAX_LISTINGS:
                    break

            await upsert_off_grounds_listings(models)

            total += len(models)
            page += 1

            print(f"Ingested {total} listings")

    print(f"✅ Done ingesting {city}")



async def main():
    await ingest_city("Charlottesville")
    print("✅ Student housing ingestion complete")


if __name__ == "__main__":
    asyncio.run(main())
