# UVA Housing Agent - Product Scope (Pat, Product Manager)

## Definition of Done
Production-ready web app deployed on Vercel. Polished enough that a UVA student would use it over manually browsing multiple apartment sites.

## Value Proposition
One place to search all UVA-area housing with AI-powered assistance. Instead of jumping between apartment complex websites, Craigslist, the UVA off-grounds site, and Facebook groups, students search here and get consolidated results plus an AI assistant that knows UVA housing context (neighborhoods, transit, pricing norms, dorm comparisons).

## Target Users
Any UVA student looking for housing:
- Rising sophomores leaving dorms for the first time (least experienced, most confused)
- Upperclassmen who know what they want but need to compare options quickly
- Grad students (different priorities: quieter areas, proximity to specific buildings, solo living)
- Transfer/incoming students unfamiliar with Charlottesville geography

## User Stories

### Search & Browse
- As a student, I can browse all available off-grounds listings in one place without visiting multiple sites
- As a student, I can filter by price per person, bedrooms, and distance to key campus locations
- As a student, I can see listings on a map to understand where they are relative to campus
- As a student, I can view listing details and link out to the original listing or landlord contact

### AI Assistant
- As a student, I can ask natural language questions about housing ("What's the cheapest 3BR within walking distance of the engineering school?")
- As a student, I can ask about neighborhoods, transit, and campus context ("Is Fifeville safe? How do I get to the law school from JPA?")
- As a student, I get answers grounded in real UVA housing data, not generic responses

### Compare & Decide
- As a student, I can compare listings side by side
- As a student, I can save/favorite listings to revisit later (stretch)

## What's In (Phase 1 - MVP)
1. Listing search with filters (price, bedrooms, distance)
2. Map view with listing pins
3. AI chat assistant with RAG over housing data
4. Listing detail cards with external links
5. Mobile-responsive design
6. Deployed on Vercel

## What's Out (Deferred)
- User accounts / authentication
- Saved favorites
- Roommate matching
- Sublet listings
- Landlord reviews / ratings
- Push notifications for new listings
- On-grounds housing comparison (data exists but empty)
- Listing photos (no photo data in database currently)

## Hard Blockers
- None remaining. Supabase DB is live with data, API keys are configured, Vercel deployment is straightforward.

## Existing Technical Foundation
- 51 off-grounds listings in Supabase (15 with coordinates)
- 18 RAG chunks with embeddings (housing info from UVA sites)
- 159 bus stops, 10 transit routes, 8 POIs
- 37 UVA slang terms
- Working API routes for listings and chat (already built)
- Next.js scaffold on `feature/next-rebuild` branch

## Success Criteria
1. A UVA student can find relevant housing options in under 60 seconds
2. The AI assistant gives useful, grounded answers about UVA housing
3. The site feels professional and trustworthy (not a class project demo)
4. Mobile experience is fully functional

## Constraints
- No listing photos available (design must work without them)
- Only 15/51 listings have coordinates (map should gracefully handle missing coords)
- RAG corpus is small (18 chunks) so AI answers will sometimes lack specificity
