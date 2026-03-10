# UVA Housing Agent - Project Brief

## Goal
Ship a polished, professional UVA student housing search site. Deployed on Vercel.

## Reference Design
See the attached mockup image (saved by Curt). Key elements:
- Listing cards: photo, price/person, beds/baths, sqft, walking distance badge, match %, favorite heart, contact/details buttons
- Filter bar: price range, roommates (1-6+), distance to Rotunda, lease term, amenities
- Map view: interactive map with price-labeled pins, "Search this area" button
- Show Map toggle
- Nav: Listings, Roommates, Sublets tabs
- Search bar with location
- User account icon

## Architecture
- **Frontend:** Next.js (App Router) + Tailwind on Vercel
- **Backend:** Next.js API routes (no separate Python server)
- **Database:** Supabase Postgres (pgvector enabled)
- **AI:** OpenRouter API (embeddings + chat completions)
- **Maps:** Mapbox GL JS or Leaflet (free tier)

## Existing Database (Supabase)

### Tables with data:
- `off_grounds_listings` (51 rows): id, name, address, lat/lng (15 have coords), bedrooms, price_total, price_per_person, url, landlord_contact_url
- `housing_chunks` (18 rows): topic, scope, source_url, content, embedding (all 18 have embeddings, pgvector)
- `dorm_website_chunks` (39 rows): url, chunk_text, chunk_index, metadata
- `onground_housing_general_chunks` (9 rows): content, topic, scope, source_url
- `points_of_interest` (8 rows): name, address, lat/lng, category (libraries, etc.)
- `bus_stops` (5 rows): name, lat/lng, routes array
- `routes` (10 rows): description, color, is_active
- `stops` (159 rows): name, lat/lng
- `route_stops` (159 rows): route_id, stop_id, stop_sequence
- `route_documents` (10 rows): route_id, content, embedding
- `UVA_Slang` (37 rows): Term, Definition
- `on_grounds_housing` (0 rows, schema exists): name, address, lat/lng, min/max price, room_types, official_link

### Data gaps:
- Only 15/51 off-grounds listings have coordinates (need geocoding for the rest to show on map)
- No listing photos in the database
- No amenities data
- No sqft data
- price_total on some listings looks like per-person not total (e.g., $849 total for 4BR = $212/person seems wrong, likely $849/person)

## Existing Code (branches to merge)
- `integration/search-plus-rag`: RAG pipeline (embed query -> pgvector search -> OpenRouter chat with citations), preference extraction
- `Distance-Matrix-API`: Walking distance calculations via DistanceMatrix.ai API, POI/bus stop queries
- `main`: Basic FastAPI with Supabase search, scraper, RentCast sync

## Environment Variables
Stored in `backend/.env` (gitignored):
- DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
- OPENROUTER_API_KEY, RENTCAST_API_KEY
- EMBEDDING_MODEL, CHAT_MODEL

For Vercel, these go in project environment variables.

## Key Decisions
1. Next.js API routes replace FastAPI (single Vercel deploy)
2. Use Supabase JS client (@supabase/supabase-js) for DB queries
3. Use Supabase's built-in pgvector support for RAG
4. Map: Leaflet with OpenStreetMap tiles (free, no API key needed) or Mapbox
5. Listing photos: placeholder/generic images initially (no photo data exists)
6. Walking distance: calculate from listing coords to Rotunda (38.0336, -78.5080)

## Repo
- GitHub: Kooper1234/UVA-Housing-Agent (curoda is collaborator)
- Deploy: Vercel (Curt's account)
