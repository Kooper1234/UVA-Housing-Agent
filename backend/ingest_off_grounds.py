import os
import asyncio
import aiohttp
from typing import Optional, List
from dotenv import load_dotenv
from pathlib import Path
from dotenv import load_dotenv

from db import get_pool
from models import OffGroundListingModel

load_dotenv(Path(__file__).parent / ".env")


RENTCAST_API_KEY = os.getenv("RENTCAST_API_KEY")

if not RENTCAST_API_KEY:
    raise RuntimeError("RENTCAST_API_KEY not set")

BASE_URL = "https://api.rentcast.io/v1"
PROPERTIES_URL = f"{BASE_URL}/properties"
RENT_ESTIMATES_URL = f"{BASE_URL}/rent-estimates"
PAGE_LIMIT = 500


async def fetch_properties_page(
    session: aiohttp.ClientSession,
    *, 
    city: Optional[str] = None, 
    county: Optional[str] = None, 
    state: str, 
    offset: int
) -> List[dict]:
    params = {"state": state, "limit": PAGE_LIMIT, "offset": offset}
    if city:
        params["city"] = city
    if county:
        params["county"] = county

    async with session.get(
        PROPERTIES_URL,
        params=params,
        headers={"X-Api-Key": RENTCAST_API_KEY},
        timeout=aiohttp.ClientTimeout(total=60),
    ) as resp:
        resp.raise_for_status()
        return await resp.json()


async def fetch_rent_estimate(
    session: aiohttp.ClientSession,
    *,
    address: str
) -> Optional[int]:
    params = {"address": address}

    async with session.get(
        RENT_ESTIMATES_URL, 
        params=params, 
        headers={"X-Api-Key": RENTCAST_API_KEY},
        timeout=aiohttp.ClientTimeout(total=60),
    ) as resp:
        if resp.status == 404:
            # RentCast has no estimate for this address
            return None
        resp.raise_for_status()
        data = await resp.json()

        if "rent" in data:
            return data["rent"]
        elif "rentLow" in data and "rentHigh" in data:
            return (data["rentLow"] + data["rentHigh"]) // 2

        return None
    

async def map_property_to_listing(session: aiohttp.ClientSession, p: dict) -> OffGroundListingModel:
    address = p.get("formattedAddress")
    bedrooms = p.get("bedrooms")
    rent = await fetch_rent_estimate(session, address=address) if address else None

    if address:
        rent = await fetch_rent_estimate(session, address=address)

    return OffGroundListingModel(
        id=p["id"],
        name=address,
        address=address,
        latitude=p.get("latitude"),
        longitude=p.get("longitude"),
        bedrooms=bedrooms,
        price_total=rent,
        price_per_person=(rent // bedrooms if rent and bedrooms else None),
        url=p.get("url"),
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
        name = excluded.name,
        address = excluded.address,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        bedrooms = excluded.bedrooms,
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


async def ingest_area(*, city=None, county=None, state="VA"):
    offset = 0
    total = 0

    async with aiohttp.ClientSession() as session:
        while True:
            location = city or county or state
            print(f"Fetching properties offset={offset} ({location})")
            properties = await fetch_properties_page(
                session, city=city, county=county, state=state, offset=offset
            )
            if not properties:
                break

            listings = [await map_property_to_listing(session, p) for p in properties]
            await upsert_off_grounds_listings(listings)

            total += len(listings)
            offset += PAGE_LIMIT
            print(f"Ingested {total} listings so far for {location}")

    print(f"Done ingesting {city or county or state}")


async def main():
    await ingest_area(city="Charlottesville", state="VA")
    await ingest_area(county="Albemarle", state="VA")
    print("Off-grounds ingestion complete")


if __name__ == "__main__":
    asyncio.run(main())