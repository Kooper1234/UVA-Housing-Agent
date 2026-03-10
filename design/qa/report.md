# QA Report — UVA Housing Agent

Date: 2026-03-01  
Tester: Sam (QA)
App URL: http://localhost:3003

## Scope Reviewed
- `design/product/scope.md`
- `design/ux/flows.md`

## 1) API Tests (curl)

### 1.1 GET `/api/listings` (no filters)
**Result:** ✅ PASS  
- Response returned listing objects with expected fields.
- Default response included 20 listings.
- `price_per_person` values were sorted ascending in returned set (`sorted=True`).

### 1.2 GET `/api/listings?max_price=500`
**Result:** ✅ PASS  
- Returned 8 listings.
- Max `price_per_person` observed: 499.

### 1.3 GET `/api/listings?min_bedrooms=3&max_bedrooms=4`
**Result:** ✅ PASS  
- Returned 20 listings (likely capped by default limit).
- All returned bedroom counts were within 3–4.

### 1.4 GET `/api/listings?limit=3`
**Result:** ✅ PASS  
- Returned exactly 3 listings.

### 1.5 POST `/api/chat` with `{"message":"What neighborhoods are popular?"}`
**Result:** ✅ PASS (with quality caveat)  
- Returned `answer` and `citations`.
- Caveat: citations list includes entries with null `source_url`.

### 1.6 POST `/api/chat` with `{"message":""}`
**Result:** ✅ PASS  
- Returned HTTP 400 and body: `{ "error": "\`message\` is required." }`.

### 1.7 POST `/api/chat` with off-topic weather query
**Result:** ✅ PASS  
- Returned housing-domain redirect response: “I’m best at UVA housing decisions…”

---

## 2) Page Load Test

### 2.1 `curl http://localhost:3003`
**Result:** ✅ PASS  
- Returned valid HTML with expected content including:
  - `<title>UVA Housing Agent</title>`
  - onboarding hero copy (“Find housing that fits your UVA life”)

---

## 3) Build Verification

Working dir: `/Users/clawdodar/Documents/GitHub/UVA-Housing-Agent/frontend`

### 3.1 `npm run build`
**Result:** ✅ PASS  
- Production build completed successfully.

### 3.2 `npm run lint`
**Result:** ✅ PASS  
- ESLint completed with no reported issues.

---

## 4) Code Review (`frontend/src/app/page.tsx`)

### Checks
- Unused imports/variables: **None found by lint**.
- Missing error handling: **Basic fetch/chat error handling present**.
- Hardcoded values: **Found** (see bug list).
- Accessibility: **Some gaps found** (see bug list).
- `console.log`: **None found**.
- Security issues (API keys client-side): **No exposed API keys observed in page component**.

---

## 5) Data Integrity

Command run:
```bash
curl -s http://localhost:3003/api/listings?limit=5 | python3 -m json.tool
```

**Result:** ✅ PASS  
- Listings include realistic IDs, names, prices, and URLs.
- Data appears to be real UVA/off-grounds listing data, not placeholders.

---

## 6) Chat Quality Test

### Query 1
`I need a 3 bedroom place near the engineering school under $900/person`

**Result:** ⚠️ PARTIAL PASS  
- Response was UVA-housing themed and structured.
- However, recommendation grounding appears weak (references generic housing options not clearly tied to current live listings returned by `/api/listings`).

### Query 2
`Tell me about the neighborhoods around UVA`

**Result:** ✅ PASS (with caveat)  
- Returned UVA-relevant neighborhood context.
- Caveat: some citations had null source metadata.

### Query 3
`What's the cheapest option available?`

**Result:** ❌ FAIL  
- Response says listing/price data is unavailable.
- This conflicts with live listing API data and indicates a retrieval/grounding issue.

---

## Bugs Found

### Bug 1: Chat fails to ground “cheapest option” in available listing data
- **Severity:** High
- **Area:** `/api/chat` (RAG / grounding)
- **Repro steps:**
  1. `curl -s -X POST http://localhost:3003/api/chat -H 'Content-Type: application/json' -d '{"message":"What is the cheapest option available?"}'`
  2. Inspect `answer`.
- **Expected:** Assistant should identify cheapest current listing (or top cheapest options) from available listing dataset.
- **Actual:** Assistant says specific listing/price data is unavailable.
- **Impact:** Core value proposition (“AI grounded in real UVA housing data”) is weakened.

### Bug 2: Chat citations include null/empty source metadata
- **Severity:** Medium
- **Area:** `/api/chat` citation quality
- **Repro steps:**
  1. Send `What neighborhoods are popular?` to `/api/chat`.
  2. Check citations array.
- **Expected:** Citations should include valid source URLs/metadata or omit invalid entries.
- **Actual:** Multiple citation items have null `topic`, `scope`, and `source_url`.
- **Impact:** Reduces trust and verifiability.

### Bug 3: Chat composer input lacks explicit accessible label
- **Severity:** Low
- **Area:** `frontend/src/app/page.tsx` (`ChatPanel` form input)
- **Repro steps:**
  1. Review chat composer input JSX in `ChatPanel`.
  2. Observe no `<label>` / `aria-label` tied to input.
- **Expected:** Text input should have explicit accessible name (label or `aria-label`).
- **Actual:** Placeholder text only.
- **Impact:** Accessibility and screen-reader usability issue.

### Bug 4: Desktop/mobile breakpoint check is not reactive on resize
- **Severity:** Low
- **Area:** `frontend/src/app/page.tsx`
- **Repro steps:**
  1. Start app on desktop width and enter explorer.
  2. Resize viewport across 1025px breakpoint.
  3. Observe layout logic tied to `isDesktop` from a one-time `useMemo` read.
- **Expected:** Layout state should update when viewport crosses breakpoint.
- **Actual:** `isDesktop` is computed once and does not subscribe to resize/media query changes.
- **Impact:** Potential stale layout behavior when resizing.

---

## Overall Assessment

The app is in good shape for baseline MVP functionality:
- API listing filters work.
- Build and lint are clean.
- Main page loads with expected onboarding content.

However, there is a **high-severity AI grounding issue**: the assistant cannot reliably use listing data for direct pricing questions (e.g., cheapest listing), which is central to product promise. Citation quality also needs improvement. I recommend fixing chat grounding and citation filtering before release.
