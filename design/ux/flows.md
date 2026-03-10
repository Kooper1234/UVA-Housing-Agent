# UVA Housing Agent UX Flows

## 0) Product UX Principles (for all screens)

1. **Student-first framing**: always show decisions in student language ("per person," "to your class building," "bus to class").
2. **AI as core guide**: AI is part of the main page structure, not hidden in a corner.
3. **No-photo confidence**: listing cards should still feel credible and scannable without photos.
4. **Progressive complexity**: first-time users get simple defaults first, advanced filters second.
5. **Mobile-primary**: every primary action should be reachable by thumb in <2 taps.
6. **Truthful uncertainty**: explicitly label missing data (coordinates, transit confidence, lease info) instead of implying precision.

---

## 1) Information Architecture

## 1.1 Primary Views

1. **Home / Search Onboarding ("Find your UVA fit")**
   - Quick setup for intent: budget/person, roommates, "where are your classes?"
   - AI prompt chips to start conversation quickly
   - CTA: "Show matches"

2. **Listings Explorer (Core experience)**
   - Unified list + map + AI panel experience
   - Filter chips focused on student needs
   - Sort and compare actions

3. **Listing Detail (Sheet on mobile, side panel/full page on desktop)**
   - Full property context, commute, lease details, contact/source links
   - AI follow-up actions tied to that listing

4. **Compare View (2–4 listings)**
   - Side-by-side differences: per-person cost, commute, lease timing, confidence flags

5. **AI Conversation View (embedded mode on explorer, full-screen mode on mobile)**
   - Conversational planning + recommendations linked to listing cards

## 1.2 Secondary Views / States

- **No-results recommendation state**
- **Missing-coordinates fallback state**
- **Loading/skeleton state**
- **Error/retry state**
- **Data-quality disclaimer microcopy** (e.g., uncertain total rent)

## 1.3 Navigation Model

### Mobile bottom nav (sticky)
- **Explore**
- **Map**
- **Compare**
- **Ask UVA AI**

### Desktop top nav
- Logo + search context + tabs: Explore | Map | Compare | Ask AI
- Right side: selected building context + filter summary

Note: "Roommates" and "Sublets" are future tabs (visually present but labeled "Coming soon" only if product wants roadmap signaling; otherwise omit for MVP to avoid dead ends).

---

## 2) First-Time User Experience (what they see first)

## 2.1 First screen content

**Hero card:**
- Headline: "Find housing that fits *your* UVA life"
- Subtext: "Search by price per person, your class buildings, and bus/walk options."

**3-field quick start (single card, mobile-first):**
1. Budget per person/month (slider + manual input)
2. Roommates/bedrooms (stepper chips: 1, 2, 3, 4+)
3. "Where are most of your classes?" (search/select major buildings: Rice Hall, New Cabell, Law School, etc.)

**Primary CTA:** "See my matches"

**AI starter directly below:**
- Input placeholder: "Ask: Can I find a 3BR near engineering under $900/person?"
- Prompt chips:
  - "I’m moving off grounds for the first time"
  - "Best options near Engineering"
  - "Cheapest places with good bus access"

Rationale: first-time students often don’t know filter strategy; this gives immediate structure + conversational entry.

---

## 3) Listings Explorer UX (core flow)

## 3.1 Layout (mobile)

1. Sticky top bar:
   - Back/logo
   - Search context pill (e.g., "Near Rice Hall")
   - Filter button with active count
2. AI insight strip (collapsible):
   - "Based on your setup, most options are in JPA + 14th St"
   - Tap opens AI full-screen thread
3. Listing cards feed (default view)
4. Bottom sticky action bar:
   - Toggle: List | Map
   - Compare tray indicator ("2 selected")

## 3.2 Layout (desktop)

3-column default:
- **Left: filters + quick AI guidance snippets**
- **Center: listing results list**
- **Right: map (or AI panel toggle)**

User can switch right column between Map and AI conversation while list remains persistent.

## 3.3 Filter architecture (student-priority)

### Primary filters (always visible as chips)
- **Price/person** (min-max)
- **Beds/roommates**
- **Distance to my building** (selected building)
- **Commute mode** (walk/bus/bike/car)
- **Lease term** (12mo, academic-year, flexible)

### Secondary filters (drawer)
- Distance ceiling (minutes)
- Near friends (manual address or selected saved pin in-session)
- Bus route preference (e.g., UVA lines)
- Furnished / unfurnished (if data unavailable, show disabled with "data coming")
- Availability timing

### Sorting
- Best match (default)
- Lowest price/person
- Shortest commute to selected building
- Most complete listing data

## 3.4 Listing card information hierarchy

Because there are no photos, card structure must be text-led and badge-led:

1. **Top row**
   - Listing name
   - Match badge (e.g., "89% fit")
2. **Primary value row (largest text)**
   - **$X/person** (prominent)
   - Secondary muted: "$Y total" when reliable
3. **Core metadata row**
   - Bedrooms
   - Address neighborhood label (student-friendly, e.g., "Near Corner/JPA")
4. **Commute row**
   - "12 min bus to Rice Hall" or "18 min walk to New Cabell"
   - If coordinates missing: "Commute estimate unavailable"
5. **Confidence/data badges**
   - "Verified link"
   - "Missing exact map pin"
   - "Total rent uncertain" (if mismatch likely)
6. **Actions row**
   - Details
   - Compare (toggle)
   - Ask AI about this

No fake photo placeholders dominating space. Optional small "housing icon tile" can be used for visual rhythm, but never presented as property imagery.

---

## 4) AI Assistant Integration (core, not secondary)

## 4.1 Embedded AI behaviors

AI appears in **three places**:
1. **Onboarding prompt box** (before any results)
2. **Explorer insight strip** (proactive context from current filters)
3. **Full AI panel/view** with linked recommendation cards

## 4.2 AI tone and interaction model

- Voice: peer advisor ("friend who knows UVA housing")
- Short, practical responses first; expandable details second
- Always references user context: budget/person, class building, commute style

## 4.3 AI-to-UI handoff patterns

- AI response includes actions:
  - "Apply these filters"
  - "Show 3 cheapest near Engineering"
  - "Compare these 2"
- Clicking an action mutates filter state directly and scrolls to affected results.

## 4.4 Guardrails for thin RAG knowledge

When uncertain, AI says:
- "I don’t have enough listing detail to confirm X. Want me to show alternatives with complete data?"
- Provides best effort + labels assumptions.

---

## 5) Listing Detail UX

## 5.1 Mobile

- Opens as bottom sheet from card; can expand full-screen
- Sections:
  1. Price/person + beds + lease summary
  2. Commute to selected building (or missing-data explanation)
  3. Location context for newcomers ("This area is popular with 2nd years")
  4. Source link / landlord contact CTA
  5. "Ask AI about this place" quick prompts

## 5.2 Desktop

- Right-side panel or dedicated page
- Compare add/remove persistent
- Map highlight pin if coordinates exist

## 5.3 Missing data handling in details

- Missing coordinate: "Exact map location unavailable from source"
- Missing lease info: "Lease terms not listed"
- Suspicious total price: "Total may be mislabeled in source; per-person shown as primary"

---

## 6) Map UX with Partial Coordinates (15/51 only)

## 6.1 Map/List synchronization

- Pins only for listings with coordinates
- List always shows all listings
- For non-mapped listings, card badge: "No pin yet"

## 6.2 Map controls

- Toggle: "Show mapped only" / "Show all in list"
- Banner above map: "15 of 51 listings can be pinned"
- "Why?" tooltip explains source-data limitations

## 6.3 Interaction behavior

- Tap pin -> preview card -> open details
- Selecting non-mapped listing from list does **not** force map recenter; instead highlights message "This listing has no exact map pin"

---

## 7) Primary User Flows

## 7.1 Primary flow A: First-time student finds first shortlist

1. Lands on onboarding screen
2. Sets budget/person, roommates, class building
3. Taps "See my matches"
4. Views sorted list with match scores + commute context
5. Uses AI chip "I’m moving off grounds for first time"
6. AI suggests 3 starter options + warns about tradeoffs
7. User compares 2–3 listings
8. Opens detail, then clicks external listing/contact

Success metric: user reaches meaningful shortlist in <60 seconds.

## 7.2 Primary flow B: Student asks natural-language query first

1. Lands and types question directly into AI entry
2. AI extracts constraints and asks one clarifying question max (e.g., "max price/person?")
3. AI applies filters and returns linked recommendations
4. User opens cards and compare view

## 7.3 Secondary flow: Map-first exploration

1. User taps Map tab
2. Sees pins + mapped-count banner
3. Drags map and taps "Search this area"
4. List updates; non-mapped listings remain in list unless user toggles mapped-only

---

## 8) Interaction Specs

## 8.1 Search/filter interactions

- Filter chip tap opens lightweight popover (mobile bottom sheet)
- Apply updates list in place with loading skeleton <500ms target perception
- Clear-all always visible in filter drawer footer

## 8.2 Card interactions

- Card tap: open details
- Compare toggle: adds to sticky compare tray
- Ask AI on card: opens AI with listing context prefilled

## 8.3 Compare interactions

- Max 4 listings
- If >4 attempt: toast "Compare up to 4 at once"
- Differences highlighted row-by-row (green = best on selected priority)

## 8.4 AI interactions

- Enter sends message
- Suggested follow-ups shown as quick chips
- "Apply" actions visually confirm with check + filter pulse animation

---

## 9) Empty, Loading, and Error States

## 9.1 No results

Message:
- "No matches yet — let’s loosen one filter."
Actions:
- Auto-suggest nearest alternatives (e.g., +$100/person or +10 min commute)
- "Ask AI to adjust for me"

## 9.2 Sparse map data

Message:
- "Most listings don’t include exact coordinates yet. You can still compare them in list view."
Action:
- Switch back to list with one tap

## 9.3 Slow network/loading

- Skeleton cards with shimmer
- AI panel placeholder text: "Thinking through UVA-specific options..."

## 9.4 Chat failure / backend error

- Friendly fallback: "I couldn’t load housing advice right now. You can still browse listings and try again."
- Retry button + preserve draft input

## 9.5 External link failure

- "Source listing couldn’t open"
- Provide copied URL button + alternate contact link when available

---

## 10) Mobile vs Desktop Differences

## Mobile-first decisions
- AI has dedicated bottom-nav destination
- Filters in full-height sheet with sticky apply button
- Compare tray is bottom dock
- Detail view as sheet (fast return to list)

## Desktop enhancements
- Parallel visibility (list + map + AI)
- Hover preview states on cards/pins
- Keyboard shortcuts: "/" focus AI, "F" filters, "C" compare (optional enhancement)

---

## 11) Content & Microcopy Guidelines

- Use "per person" consistently; avoid real-estate jargon
- Explain neighborhoods with student anchors ("near The Corner," "walkable to Engineering")
- Use confidence labels for uncertain data, never hide uncertainty
- AI copy should be conversational, concise, and specific to UVA

Example microcopy:
- "Not sure where to start? Tell me your major and budget — I’ll narrow it down."
- "This price may be listed per bedroom by the source."

---

## 12) Self-Review and Revisions Applied

### Review question: Does a first-time apartment hunter know what to do?
- **Fix applied:** Added explicit 3-field quick start and one primary CTA before any advanced controls.

### Review question: Any dead ends or confusing moments?
- **Fix applied:** Added no-results alternatives and disabled/deferred filter handling to avoid dead-end filter settings.

### Review question: Is AI discoverable and useful?
- **Fix applied:** AI appears in onboarding, explorer strip, and dedicated tab; includes direct filter-application actions.

### Review question: Would this work on a phone?
- **Fix applied:** Defined bottom nav, sticky actions, sheet-based details, and compare dock for thumb-friendly use.

---

## 13) MVP Component Checklist (design-ready handoff)

1. Onboarding quick-start card
2. Filter chip bar + filter sheet
3. Listing card (no-photo optimized)
4. Compare tray + compare table
5. AI insight strip + AI full view
6. Map with mapped-count banner
7. Detail sheet/panel
8. State components: loading, empty, error, missing-data badges

This UX is intentionally built for UVA students making early housing decisions with incomplete data and high uncertainty, while making AI guidance a first-class part of finding a home.