"""
Distance calculation tools using DistanceMatrix.ai API.
Calculates walking distances from housing listings to POIs and bus stops.
"""
import os
import asyncio
from typing import List, Dict, Any, Optional
import aiohttp
from dotenv import load_dotenv
from db import get_pool

load_dotenv()

DISTANCEMATRIX_API_KEY = os.getenv("DISTANCEMATRIX_API_KEY")
if not DISTANCEMATRIX_API_KEY:
    raise RuntimeError("DISTANCEMATRIX_API_KEY not set in .env")

# DistanceMatrix.ai API endpoint
DISTANCE_MATRIX_URL = "https://api.distancematrix.ai/maps/api/distancematrix/json"


async def get_pois() -> List[Dict[str, Any]]:
    """
    Fetch all points of interest from the database.
    Returns list of POIs with id, name, latitude, longitude.
    """
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, name, latitude, longitude, category
            FROM points_of_interest
            ORDER BY name;
            """
        )
    
    return [dict(row) for row in rows]


async def get_bus_stops() -> List[Dict[str, Any]]:
    """
    Fetch all bus stops from the database.
    Returns list of bus stops with id, name, latitude, longitude.
    """
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, name, latitude, longitude, routes
            FROM bus_stops
            ORDER BY name;
            """
        )
    
    return [dict(row) for row in rows]


async def calculate_distances_batch(
    origins: List[Dict[str, float]],
    destinations: List[Dict[str, float]],
    mode: str = "walking"
) -> Dict[str, Any]:
    """
    Calculate distances between multiple origins and destinations using DistanceMatrix.ai API.
    
    Args:
        origins: List of dicts with 'latitude' and 'longitude'
        destinations: List of dicts with 'latitude' and 'longitude'
        mode: Travel mode (walking, driving, transit, bicycling)
    
    Returns:
        API response with distance/duration data
    """
    if not origins or not destinations:
        return {"rows": []}
    
    # Format coordinates as "lat,lng" strings
    origin_coords = [f"{o['latitude']},{o['longitude']}" for o in origins]
    dest_coords = [f"{d['latitude']},{d['longitude']}" for d in destinations]
    
    # Join with pipe separator
    origins_str = "|".join(origin_coords)
    destinations_str = "|".join(dest_coords)
    
    params = {
        "origins": origins_str,
        "destinations": destinations_str,
        "mode": mode,
        "units": "imperial",  # Use miles and feet
        "key": DISTANCEMATRIX_API_KEY
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.get(DISTANCE_MATRIX_URL, params=params) as response:
            if response.status != 200:
                error_text = await response.text()
                raise Exception(f"DistanceMatrix.ai API error: {response.status} - {error_text}")
            
            data = await response.json()
            
            if data.get("status") != "OK":
                raise Exception(f"DistanceMatrix.ai API status: {data.get('status')} - {data.get('error_message', 'No error message')}")
            
            return data


async def enrich_listing_with_distances(
    listing: Dict[str, Any],
    pois: List[Dict[str, Any]],
    bus_stops: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Enrich a single listing with walking distances to POIs and bus stops.
    
    Args:
        listing: Housing listing dict with latitude/longitude
        pois: List of points of interest
        bus_stops: List of bus stops
    
    Returns:
        Listing enriched with 'distances_to_pois' and 'distances_to_bus_stops'
    """
    if not listing.get("latitude") or not listing.get("longitude"):
        listing["distances_to_pois"] = []
        listing["distances_to_bus_stops"] = []
        return listing
    
    origin = [{"latitude": listing["latitude"], "longitude": listing["longitude"]}]
    
    # Calculate distances to POIs
    poi_distances = []
    if pois:
        poi_coords = [{"latitude": p["latitude"], "longitude": p["longitude"]} for p in pois]
        
        try:
            poi_result = await calculate_distances_batch(origin, poi_coords)
            
            if poi_result.get("rows"):
                elements = poi_result["rows"][0].get("elements", [])
                
                for i, element in enumerate(elements):
                    if i >= len(pois):
                        break
                    
                    if element.get("status") == "OK":
                        poi_distances.append({
                            "poi_id": pois[i]["id"],
                            "poi_name": pois[i]["name"],
                            "category": pois[i].get("category"),
                            "distance_text": element["distance"]["text"],
                            "distance_meters": element["distance"]["value"],
                            "duration_text": element["duration"]["text"],
                            "duration_seconds": element["duration"]["value"]
                        })
        except Exception as e:
            print(f"Error calculating POI distances for listing {listing.get('id')}: {e}")
    
    # Calculate distances to bus stops
    bus_distances = []
    if bus_stops:
        bus_coords = [{"latitude": b["latitude"], "longitude": b["longitude"]} for b in bus_stops]
        
        try:
            bus_result = await calculate_distances_batch(origin, bus_coords)
            
            if bus_result.get("rows"):
                elements = bus_result["rows"][0].get("elements", [])
                
                for i, element in enumerate(elements):
                    if i >= len(bus_stops):
                        break
                    
                    if element.get("status") == "OK":
                        bus_distances.append({
                            "stop_id": bus_stops[i]["id"],
                            "stop_name": bus_stops[i]["name"],
                            "routes": bus_stops[i].get("routes"),
                            "distance_text": element["distance"]["text"],
                            "distance_meters": element["distance"]["value"],
                            "duration_text": element["duration"]["text"],
                            "duration_seconds": element["duration"]["value"]
                        })
        except Exception as e:
            print(f"Error calculating bus stop distances for listing {listing.get('id')}: {e}")
    
    # Sort by duration (closest first)
    poi_distances.sort(key=lambda x: x["duration_seconds"])
    bus_distances.sort(key=lambda x: x["duration_seconds"])
    
    listing["distances_to_pois"] = poi_distances
    listing["distances_to_bus_stops"] = bus_distances
    listing["nearest_poi"] = poi_distances[0] if poi_distances else None
    listing["nearest_bus_stop"] = bus_distances[0] if bus_distances else None
    
    return listing


async def enrich_listings_with_distances(
    listings: List[Dict[str, Any]],
    include_pois: bool = True,
    include_bus_stops: bool = True
) -> List[Dict[str, Any]]:
    """
    Enrich multiple listings with distance information.
    
    Args:
        listings: List of housing listings
        include_pois: Whether to calculate distances to POIs
        include_bus_stops: Whether to calculate distances to bus stops
    
    Returns:
        Enriched listings with distance data
    """
    if not listings:
        return []
    
    # Fetch POIs and bus stops
    pois = await get_pois() if include_pois else []
    bus_stops = await get_bus_stops() if include_bus_stops else []
    
    # Enrich each listing
    enriched_listings = []
    for listing in listings:
        enriched = await enrich_listing_with_distances(listing, pois, bus_stops)
        enriched_listings.append(enriched)
        
        # Small delay to avoid rate limiting (adjust as needed)
        await asyncio.sleep(0.2)
    
    return enriched_listings


async def get_listings_near_location(
    latitude: float,
    longitude: float,
    max_walk_time_minutes: int = 20,
    max_rent_per_person: Optional[int] = None,
    min_bedrooms: Optional[int] = None,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """
    Find listings within walking distance of a specific location.
    
    Args:
        latitude: Target latitude
        longitude: Target longitude
        max_walk_time_minutes: Maximum walking time in minutes
        max_rent_per_person: Optional rent filter
        min_bedrooms: Optional bedroom filter
        limit: Maximum results to return
    
    Returns:
        Listings within walking distance, enriched with distance data
    """
    from housing_tools import search_off_grounds_listings
    
    # Get candidate listings
    listings = await search_off_grounds_listings(
        max_rent_per_person=max_rent_per_person,
        min_bedrooms=min_bedrooms,
        limit=limit
    )
    
    # Filter by location (only keep listings with coordinates)
    listings_with_coords = [
        l for l in listings 
        if l.get("latitude") and l.get("longitude")
    ]
    
    if not listings_with_coords:
        return []
    
    # Calculate distances from target location to all listings
    target = [{"latitude": latitude, "longitude": longitude}]
    listing_coords = [
        {"latitude": l["latitude"], "longitude": l["longitude"]} 
        for l in listings_with_coords
    ]
    
    try:
        result = await calculate_distances_batch(target, listing_coords)
        
        if not result.get("rows"):
            return []
        
        elements = result["rows"][0].get("elements", [])
        
        # Filter and enrich listings
        nearby_listings = []
        max_walk_seconds = max_walk_time_minutes * 60
        
        for i, element in enumerate(elements):
            if i >= len(listings_with_coords):
                break
            
            if element.get("status") == "OK":
                duration_seconds = element["duration"]["value"]
                
                if duration_seconds <= max_walk_seconds:
                    listing = listings_with_coords[i].copy()
                    listing["walk_time_to_target"] = {
                        "distance_text": element["distance"]["text"],
                        "distance_meters": element["distance"]["value"],
                        "duration_text": element["duration"]["text"],
                        "duration_seconds": duration_seconds
                    }
                    nearby_listings.append(listing)
        
        # Sort by walk time
        nearby_listings.sort(key=lambda x: x["walk_time_to_target"]["duration_seconds"])
        
        return nearby_listings
        
    except Exception as e:
        print(f"Error calculating distances to target location: {e}")
        return []