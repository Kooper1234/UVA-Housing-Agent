"use client";

import dynamic from "next/dynamic";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import type { Citation, Listing } from "@/types/listings";

const ListingMap = dynamic(() => import("@/components/ListingMap"), {
  ssr: false,
  loading: () => (
    <div className="map-empty-state">Loading map with UVA-area listings...</div>
  ),
});

type CommuteMode = "walk" | "bus" | "bike" | "car";
type SortMode = "best" | "price" | "commute";
type ViewMode = "explore" | "map" | "compare" | "ai";
type DistanceFilter = "any" | "10" | "20" | "30";

type BuildingOption = {
  key: string;
  label: string;
  lat: number;
  lng: number;
};

type ListingWithMetrics = Listing & {
  neighborhood: string;
  commuteMinutes: number | null;
  fitScore: number;
  confidence: "high" | "medium" | "low";
  hasCoordinates: boolean;
};

type ChatAction = {
  id: string;
  label: string;
  apply: () => void;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  citations?: Citation[];
  actions?: ChatAction[];
};

const BUILDINGS: BuildingOption[] = [
  { key: "rice", label: "Rice Hall (Engineering)", lat: 38.0316, lng: -78.5106 },
  { key: "new-cabell", label: "New Cabell Hall", lat: 38.0352, lng: -78.5034 },
  { key: "law", label: "Law School", lat: 38.0415, lng: -78.5057 },
  { key: "mcintire", label: "McIntire School", lat: 38.0331, lng: -78.5133 },
  { key: "rotunda", label: "Rotunda", lat: 38.0336, lng: -78.508 },
];

const ROOMMATE_OPTIONS = [1, 2, 3, 4];
const STARTER_PROMPTS = [
  "I’m moving off grounds for the first time — where should I start?",
  "Best options near Engineering under $900/person",
  "Cheapest 3BR with decent bus access to Grounds",
  "Show walkable places near The Corner for 2 roommates",
  "I’m at the Law School — what areas make commuting easiest?",
  "Compare 3 affordable options with the shortest commute",
  "I care more about quiet than nightlife — where should I look?",
  "What can I get for $800–$1,000 per person near JPA/Rugby?",
  "Show me listings with the most complete/verified data",
  "I don’t have a car — find bus-friendly options",
];

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatCurrency(value: number | null) {
  if (value == null || Number.isNaN(value)) return "Unknown";
  return `$${Math.round(value).toLocaleString()}`;
}

function parseBuilding(input: string): BuildingOption {
  const exact = BUILDINGS.find(
    (building) => building.key === input || building.label === input,
  );
  return exact ?? BUILDINGS[0];
}

function inferNeighborhood(address: string | null): string {
  const value = (address || "").toLowerCase();
  if (value.includes("jpa") || value.includes("jefferson park")) return "Near JPA";
  if (value.includes("rugby")) return "Rugby Road";
  if (value.includes("14th")) return "14th Street";
  if (value.includes("fifeville")) return "Fifeville";
  if (value.includes("corner")) return "Near The Corner";
  return "Near Grounds";
}

function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadius = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return earthRadius * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function estimateCommuteMinutes(miles: number, mode: CommuteMode) {
  const mphByMode: Record<CommuteMode, number> = {
    walk: 3,
    bike: 9,
    bus: 12,
    car: 18,
  };

  const base = (miles / mphByMode[mode]) * 60;
  const overhead = mode === "bus" ? 4 : mode === "car" ? 2 : 0;
  return Math.round(base + overhead);
}

function deriveConfidence(listing: Listing): "high" | "medium" | "low" {
  const completeness = [
    listing.latitude != null,
    listing.longitude != null,
    listing.price_total != null,
    listing.price_per_person != null,
    listing.bedrooms != null,
    !!listing.url,
  ].filter(Boolean).length;

  if (completeness >= 5) return "high";
  if (completeness >= 3) return "medium";
  return "low";
}

function getFitScore(
  listing: Listing,
  options: {
    budgetMax: number;
    roommates: number;
    commuteMinutes: number | null;
  },
) {
  const budgetRatio =
    listing.price_per_person && options.budgetMax > 0
      ? Math.max(0, 1 - listing.price_per_person / options.budgetMax)
      : 0.3;

  const bedroomFit =
    listing.bedrooms && options.roommates > 0
      ? Math.max(0, 1 - Math.abs(listing.bedrooms - options.roommates) * 0.35)
      : 0.4;

  const commuteFit =
    options.commuteMinutes != null
      ? Math.max(0, 1 - Math.min(options.commuteMinutes, 45) / 45)
      : 0.25;

  return Math.round((budgetRatio * 0.45 + bedroomFit * 0.3 + commuteFit * 0.25) * 100);
}

function listingCommuteText(minutes: number | null, building: string, mode: CommuteMode) {
  if (minutes == null) return "Commute estimate unavailable";
  return `${minutes} min ${mode} to ${building}`;
}

function maybeExtractFilters(text: string) {
  const lower = text.toLowerCase();
  const filters: Partial<{
    budget: number;
    roommates: number;
    mode: CommuteMode;
    building: string;
  }> = {};

  const priceMatch = lower.match(/\$?\s?(\d{3,4})\s*(?:\/person|each|per person|or less|under)?/);
  if (priceMatch) {
    const parsed = Number(priceMatch[1]);
    if (Number.isFinite(parsed) && parsed >= 500 && parsed <= 2500) {
      filters.budget = parsed;
    }
  }

  const bedroomMatch = lower.match(/(\d)\s*(?:br|bed|bedroom|roommates?)/);
  if (bedroomMatch) {
    const parsed = Number(bedroomMatch[1]);
    if (parsed >= 1 && parsed <= 4) {
      filters.roommates = parsed;
    }
  }

  if (lower.includes("walk")) filters.mode = "walk";
  else if (lower.includes("bus")) filters.mode = "bus";
  else if (lower.includes("bike")) filters.mode = "bike";
  else if (lower.includes("car") || lower.includes("drive")) filters.mode = "car";

  if (lower.includes("engineering") || lower.includes("rice")) filters.building = "rice";
  else if (lower.includes("law")) filters.building = "law";
  else if (lower.includes("cabell")) filters.building = "new-cabell";
  else if (lower.includes("rotunda")) filters.building = "rotunda";

  return filters;
}

function ChatPanel({
  messages,
  loading,
  input,
  onInputChange,
  onSubmit,
  onUsePrompt,
  prompts,
  chatError,
  onRetry,
}: {
  messages: ChatMessage[];
  loading: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUsePrompt: (prompt: string) => void;
  prompts: string[];
  chatError: string | null;
  onRetry: () => void;
}) {
  const canSend = input.trim().length > 0 && !loading;
  const messageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messageRef.current?.scrollTo({ top: messageRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  return (
    <section className="chat-panel">
      <div className="chat-messages" ref={messageRef}>
        {messages.map((message) => (
          <div key={message.id} className={`chat-row ${message.role === "user" ? "user" : "ai"}`}>
            <div className={`chat-bubble ${message.role === "user" ? "user" : "ai"}`}>
              {message.text}
              {message.actions?.length ? (
                <div className="chat-actions">
                  {message.actions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      className="action-chip ai"
                      onClick={action.apply}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              ) : null}
              {message.citations?.length ? (
                <div style={{ marginTop: "8px", fontSize: "12px", color: "#64748B" }}>
                  {message.citations.slice(0, 2).map((citation) =>
                    citation.source_url ? (
                      <a
                        key={citation.id}
                        href={citation.source_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: "block", color: "#1D4ED8" }}
                      >
                        {citation.topic || "Source"}
                      </a>
                    ) : null,
                  )}
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {loading ? <div className="chat-bubble ai">Thinking through UVA-specific options...</div> : null}
      </div>

      {chatError ? (
        <div className="error-card" style={{ margin: "0 12px 10px" }}>
          <p className="error-title">I couldn&apos;t load housing advice right now.</p>
          <p className="error-body">You can still browse listings and try again.</p>
          <button type="button" className="secondary-btn" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : null}

      <div style={{ padding: "0 12px 10px" }}>
        <div className="chip-row">
          {prompts.slice(0, 4).map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="uva-chip soft blue"
              onClick={() => onUsePrompt(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      <form className="chat-composer" onSubmit={onSubmit}>
        <input
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="Ask about rent, commute, neighborhoods, or tradeoffs..."
        />
        <button type="submit" className="chat-send" disabled={!canSend}>
          Go
        </button>
      </form>
    </section>
  );
}

export default function HomePage() {
  const [started, setStarted] = useState(false);

  const [budgetMax, setBudgetMax] = useState(1000);
  const [roommates, setRoommates] = useState(2);
  const [buildingInput, setBuildingInput] = useState(BUILDINGS[0].label);

  const [distanceFilter, setDistanceFilter] = useState<DistanceFilter>("any");
  const [commuteMode, setCommuteMode] = useState<CommuteMode>("bus");
  const [sortMode, setSortMode] = useState<SortMode>("best");
  const [mappedOnly, setMappedOnly] = useState(false);

  const [activeView, setActiveView] = useState<ViewMode>("explore");
  const [desktopRightMode, setDesktopRightMode] = useState<"map" | "ai">("map");

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [detailListingId, setDetailListingId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const [toast, setToast] = useState<string | null>(null);

  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [lastFailedInput, setLastFailedInput] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: createId(),
      role: "assistant",
      text: "Tell me your budget per person and where your classes are, and I can narrow this down fast.",
    },
  ]);

  const selectedBuilding = useMemo(() => parseBuilding(buildingInput), [buildingInput]);
  const isDesktop = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1025px)").matches,
    [],
  );

  async function loadListings() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/listings?limit=100", { cache: "no-store" });
      const payload = (await response.json()) as { listings?: Listing[]; error?: string };

      if (!response.ok || !payload.listings) {
        throw new Error(payload.error || "Failed to load listings.");
      }

      setListings(payload.listings);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error ? fetchError.message : "Failed to load listings.",
      );
      setListings([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!started) return;
    void loadListings();
  }, [started]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const enrichedListings = useMemo(() => {
    return listings.map<ListingWithMetrics>((listing) => {
      const hasCoordinates = listing.latitude != null && listing.longitude != null;
      const miles = hasCoordinates
        ? haversineMiles(
            listing.latitude as number,
            listing.longitude as number,
            selectedBuilding.lat,
            selectedBuilding.lng,
          )
        : null;
      const commuteMinutes = miles == null ? null : estimateCommuteMinutes(miles, commuteMode);
      const fitScore = getFitScore(listing, {
        budgetMax,
        roommates,
        commuteMinutes,
      });

      return {
        ...listing,
        neighborhood: inferNeighborhood(listing.address),
        commuteMinutes,
        fitScore,
        confidence: deriveConfidence(listing),
        hasCoordinates,
      };
    });
  }, [listings, selectedBuilding, commuteMode, budgetMax, roommates]);

  const filteredListings = useMemo(() => {
    let next = enrichedListings.filter((listing) => {
      const matchesBudget = listing.price_per_person == null || listing.price_per_person <= budgetMax;
      const matchesBeds = listing.bedrooms == null || listing.bedrooms >= roommates;

      const matchesDistance =
        distanceFilter === "any" ||
        (listing.commuteMinutes != null && listing.commuteMinutes <= Number(distanceFilter));

      const matchesMapped = !mappedOnly || listing.hasCoordinates;
      return matchesBudget && matchesBeds && matchesDistance && matchesMapped;
    });

    next = [...next].sort((a, b) => {
      if (sortMode === "price") {
        return (a.price_per_person ?? Number.MAX_SAFE_INTEGER) -
          (b.price_per_person ?? Number.MAX_SAFE_INTEGER);
      }

      if (sortMode === "commute") {
        return (a.commuteMinutes ?? Number.MAX_SAFE_INTEGER) -
          (b.commuteMinutes ?? Number.MAX_SAFE_INTEGER);
      }

      return b.fitScore - a.fitScore;
    });

    return next;
  }, [enrichedListings, budgetMax, roommates, distanceFilter, sortMode, mappedOnly]);

  const compareListings = useMemo(
    () => enrichedListings.filter((listing) => compareIds.includes(listing.id)),
    [enrichedListings, compareIds],
  );

  const detailListing = useMemo(
    () => enrichedListings.find((listing) => listing.id === detailListingId) ?? null,
    [enrichedListings, detailListingId],
  );

  const mappedCount = useMemo(
    () => filteredListings.filter((listing) => listing.hasCoordinates).length,
    [filteredListings],
  );

  const insightText = useMemo(() => {
    const under900 = filteredListings.filter(
      (listing) => listing.price_per_person != null && listing.price_per_person <= 900,
    ).length;
    const popularAreas = filteredListings.slice(0, 4).map((listing) => listing.neighborhood);
    const topArea =
      popularAreas.sort(
        (a, b) =>
          popularAreas.filter((v) => v === b).length -
          popularAreas.filter((v) => v === a).length,
      )[0] ?? "JPA + 14th St";

    return `Based on your setup, ${under900} options are at or below $900/person and most strong fits are around ${topArea}.`;
  }, [filteredListings]);

  function openAiWithPrompt(prompt: string) {
    setChatInput(prompt);
    setActiveView("ai");
    setDesktopRightMode("ai");
  }

  function toggleCompare(listingId: string) {
    setCompareIds((current) => {
      if (current.includes(listingId)) {
        return current.filter((id) => id !== listingId);
      }
      if (current.length >= 4) {
        setToast("Compare up to 4 at once");
        return current;
      }
      return [...current, listingId];
    });
  }

  function applySuggestedFilters(sourceText: string) {
    const suggested = maybeExtractFilters(sourceText);

    if (suggested.budget) setBudgetMax(suggested.budget);
    if (suggested.roommates) setRoommates(suggested.roommates);
    if (suggested.mode) setCommuteMode(suggested.mode);
    if (suggested.building) {
      const next = BUILDINGS.find((building) => building.key === suggested.building);
      if (next) setBuildingInput(next.label);
    }

    setSortMode("best");
    setDistanceFilter("any");
    setToast("Filters applied");
    setActiveView("explore");
  }

  async function sendChatMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || chatLoading) return;

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      text: trimmed,
    };

    setMessages((current) => [...current, userMessage]);
    setChatInput("");
    setChatLoading(true);
    setChatError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          top_k: 5,
        }),
      });

      const payload = (await response.json()) as {
        answer?: string;
        citations?: Citation[];
        error?: string;
      };

      if (!response.ok || !payload.answer) {
        throw new Error(payload.error || "Chat request failed.");
      }

      const actions: ChatAction[] = [];
      const hasFilterHints = Object.keys(maybeExtractFilters(`${trimmed} ${payload.answer}`)).length > 0;
      if (hasFilterHints) {
        actions.push({
          id: createId(),
          label: "Apply these filters",
          apply: () => applySuggestedFilters(`${trimmed} ${payload.answer}`),
        });
      }

      const assistantMessage: ChatMessage = {
        id: createId(),
        role: "assistant",
        text: payload.answer,
        citations: payload.citations,
        actions,
      };

      setMessages((current) => [...current, assistantMessage]);
      setLastFailedInput(null);
    } catch (requestError) {
      const errorText =
        requestError instanceof Error
          ? requestError.message
          : "Unexpected chat error.";
      setChatError(errorText);
      setLastFailedInput(trimmed);
      setChatInput(trimmed);
    } finally {
      setChatLoading(false);
    }
  }

  function handleChatSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendChatMessage(chatInput);
  }

  function handleRetryChat() {
    const retryText = lastFailedInput || chatInput;
    if (!retryText) return;
    void sendChatMessage(retryText);
  }

  function showCompareView() {
    setActiveView("compare");
  }

  function renderListings() {
    if (error) {
      return (
        <div className="error-card">
          <p className="error-title">Couldn&apos;t load listings right now.</p>
          <p className="error-body">You can retry and keep your filters in place.</p>
          <button type="button" className="secondary-btn" onClick={() => void loadListings()}>
            Retry
          </button>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="listings-stack">
          {Array.from({ length: 6 }).map((_, idx) => (
            <article key={`loading-${idx}`} className="loading-card" />
          ))}
        </div>
      );
    }

    if (!filteredListings.length) {
      return (
        <div className="empty-state">
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>No matches yet - let&apos;s loosen one filter.</h2>
          <p style={{ color: "#475569", fontSize: "0.875rem" }}>
            Try adding $100/person or allow a longer commute to unlock more options.
          </p>
          <button
            type="button"
            className="primary-btn"
            style={{ marginTop: "16px" }}
            onClick={() => openAiWithPrompt("Can you adjust my filters to find more results?")}
          >
            Ask AI to adjust for me
          </button>
        </div>
      );
    }

    return (
      <div className="listings-stack">
        {filteredListings.map((listing) => {
          const highlighted = selectedListingId === listing.id;
          const inCompare = compareIds.includes(listing.id);

          return (
            <article
              key={listing.id}
              className={`listing-card ${highlighted ? "highlighted" : ""} ${inCompare ? "in-compare" : ""}`}
              onMouseEnter={() => setSelectedListingId(listing.id)}
            >
              <div className="listing-top">
                <h3 className="listing-name">{listing.name}</h3>
                <span className="match-badge">{listing.fitScore}% fit</span>
              </div>

              <div className="listing-price" style={{ marginTop: "10px" }}>
                <span className="price-main">{formatCurrency(listing.price_per_person)}</span>
                <span className="price-suffix">/person</span>
                <span className="price-total">
                  {listing.price_total != null
                    ? `${formatCurrency(listing.price_total)} total`
                    : "Total rent uncertain"}
                </span>
              </div>

              <div className="listing-meta" style={{ marginTop: "10px" }}>
                <span>{listing.bedrooms ? `${listing.bedrooms} bedrooms` : "Bedrooms unknown"}</span>
                <span>•</span>
                <span>{listing.neighborhood}</span>
                <span className="commute-badge">
                  {listing.commuteMinutes != null ? `${listing.commuteMinutes}m ${commuteMode}` : "No estimate"}
                </span>
              </div>

              <div className="listing-commute" style={{ marginTop: "10px" }}>
                {listingCommuteText(listing.commuteMinutes, selectedBuilding.label, commuteMode)}
              </div>

              <div className="listing-badges" style={{ marginTop: "10px" }}>
                <span className={`confidence-badge ${listing.confidence}`}>
                  {listing.confidence} confidence
                </span>
                {listing.hasCoordinates ? (
                  <span className="neutral-badge">Pin available</span>
                ) : (
                  <span className="neutral-badge">No pin yet</span>
                )}
                {listing.url ? (
                  <span className="neutral-badge">Verified link</span>
                ) : (
                  <span className="neutral-badge">Source link missing</span>
                )}
              </div>

              <div className="listing-actions" style={{ marginTop: "10px" }}>
                <button
                  type="button"
                  className="action-link"
                  onClick={() => setDetailListingId(listing.id)}
                >
                  Details
                </button>
                <button
                  type="button"
                  className={`action-chip compare ${inCompare ? "active" : ""}`}
                  onClick={() => toggleCompare(listing.id)}
                >
                  {inCompare ? "In compare" : "Compare"}
                </button>
                <button
                  type="button"
                  className="action-chip ai"
                  onClick={() =>
                    openAiWithPrompt(
                      `Ask AI about ${listing.name}: is this a good fit for ${roommates} roommates near ${selectedBuilding.label}?`,
                    )
                  }
                >
                  Ask AI
                </button>
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  function renderCompareView() {
    if (!compareListings.length) {
      return (
        <div className="empty-state">
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>No listings selected for compare yet.</h2>
          <p style={{ color: "#475569", fontSize: "0.875rem" }}>
            Add 2-4 listings from Explore to compare price, commute, and confidence.
          </p>
        </div>
      );
    }

    const bestPrice = Math.min(
      ...compareListings.map((listing) => listing.price_per_person ?? Number.MAX_SAFE_INTEGER),
    );

    const bestCommute = Math.min(
      ...compareListings.map((listing) => listing.commuteMinutes ?? Number.MAX_SAFE_INTEGER),
    );

    const confidenceRank = { high: 3, medium: 2, low: 1 };
    const bestConfidence = Math.max(
      ...compareListings.map((listing) => confidenceRank[listing.confidence]),
    );

    return (
      <section className="compare-view">
        <table className="compare-table">
          <thead>
            <tr>
              <th>Criteria</th>
              {compareListings.map((listing) => (
                <th key={listing.id}>{listing.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Price per person</td>
              {compareListings.map((listing) => (
                <td
                  key={`${listing.id}-price`}
                  className={listing.price_per_person === bestPrice ? "best-value" : ""}
                >
                  {formatCurrency(listing.price_per_person)}
                </td>
              ))}
            </tr>
            <tr>
              <td>Bedrooms</td>
              {compareListings.map((listing) => (
                <td key={`${listing.id}-beds`}>{listing.bedrooms ?? "Unknown"}</td>
              ))}
            </tr>
            <tr>
              <td>Commute to {selectedBuilding.label}</td>
              {compareListings.map((listing) => (
                <td
                  key={`${listing.id}-commute`}
                  className={listing.commuteMinutes === bestCommute ? "best-value" : ""}
                >
                  {listing.commuteMinutes != null
                    ? `${listing.commuteMinutes} min ${commuteMode}`
                    : "Unavailable"}
                </td>
              ))}
            </tr>
            <tr>
              <td>Data confidence</td>
              {compareListings.map((listing) => {
                const rank = confidenceRank[listing.confidence];
                const className =
                  rank === bestConfidence
                    ? "best-value"
                    : listing.confidence === "low"
                      ? "worst-value"
                      : "";
                return (
                  <td key={`${listing.id}-confidence`} className={className}>
                    {listing.confidence}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td>Actions</td>
              {compareListings.map((listing) => (
                <td key={`${listing.id}-action`}>
                  <button
                    type="button"
                    className="action-link"
                    onClick={() => setDetailListingId(listing.id)}
                  >
                    Open details
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </section>
    );
  }

  const showDesktopNav = started;

  return (
    <div className="uva-shell">
      {showDesktopNav ? (
        <header className="uva-top-nav">
          <div className="uva-container uva-top-nav-inner">
            <div className="uva-logo">
              <span className="uva-logo-dot" />
              <span>UVA Housing Agent</span>
            </div>

            <nav className="uva-desktop-tabs" aria-label="Desktop tabs">
              <button
                type="button"
                className={`uva-tab ${activeView === "explore" ? "active" : ""}`}
                onClick={() => setActiveView("explore")}
              >
                Explore
              </button>
              <button
                type="button"
                className={`uva-tab ${activeView === "map" ? "active" : ""}`}
                onClick={() => {
                  setActiveView("map");
                  setDesktopRightMode("map");
                }}
              >
                Map
              </button>
              <button
                type="button"
                className={`uva-tab ${activeView === "compare" ? "active" : ""}`}
                onClick={() => setActiveView("compare")}
              >
                Compare
              </button>
              <button
                type="button"
                className={`uva-tab ${activeView === "ai" ? "active" : ""}`}
                onClick={() => {
                  setActiveView("ai");
                  setDesktopRightMode("ai");
                }}
              >
                Ask AI
              </button>
            </nav>

            <div className="uva-context">{selectedBuilding.label} • Budget {formatCurrency(budgetMax)}/person</div>
          </div>
        </header>
      ) : null}

      {!started ? (
        <main className="uva-container uva-onboarding-wrap">
          <section className="uva-onboarding-card">
            <h1 className="hero-heading">
              Find housing that fits <em>your</em> UVA life
            </h1>
            <p className="hero-subtext">
              Search by price per person, your class buildings, and bus/walk options.
            </p>

            <div className="section-stack">
              <label className="label" htmlFor="budget-slider">
                Budget per person/month
              </label>
              <div className="range-row">
                <input
                  id="budget-slider"
                  type="range"
                  min={500}
                  max={1800}
                  step={25}
                  value={budgetMax}
                  onChange={(event) => setBudgetMax(Number(event.target.value))}
                  style={{ width: "100%" }}
                />
                <span className="range-value">{formatCurrency(budgetMax)}</span>
              </div>
              <input
                className="uva-input"
                value={budgetMax}
                onChange={(event) => setBudgetMax(Number(event.target.value || 0))}
                inputMode="numeric"
                aria-label="Budget input"
              />
            </div>

            <div className="section-stack">
              <span className="label">Roommates / bedrooms</span>
              <div className="chip-row">
                {ROOMMATE_OPTIONS.map((count) => (
                  <button
                    key={count}
                    type="button"
                    className={`uva-chip ${roommates === count ? "active" : ""}`}
                    onClick={() => setRoommates(count)}
                  >
                    {count === 4 ? "4+" : count}
                  </button>
                ))}
              </div>
            </div>

            <div className="section-stack">
              <label className="label" htmlFor="building-input">
                Where are most of your classes?
              </label>
              <input
                id="building-input"
                className="uva-input"
                value={buildingInput}
                onChange={(event) => setBuildingInput(event.target.value)}
                list="building-options"
                placeholder="Search class building"
              />
              <datalist id="building-options">
                {BUILDINGS.map((building) => (
                  <option key={building.key} value={building.label} />
                ))}
              </datalist>
            </div>

            <div className="section-stack">
              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  setStarted(true);
                  setActiveView("explore");
                }}
              >
                See my matches
              </button>

              <div className="chip-row">
                {STARTER_PROMPTS.slice(0, 3).map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="uva-chip soft"
                    onClick={() => {
                      setStarted(true);
                      openAiWithPrompt(prompt);
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </main>
      ) : (
        <main className="uva-container explorer-grid">
          {activeView !== "compare" ? (
            <>
              <section className="filter-panel" style={{ display: isDesktop ? "flex" : "none" }}>
                <div className="surface-card filters-box">
                  <h2 className="filter-title">Filters</h2>
                  <div className="chip-row" style={{ marginBottom: "10px" }}>
                    {[800, 900, 1000, 1200].map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`uva-chip ${budgetMax === value ? "active" : ""}`}
                        onClick={() => setBudgetMax(value)}
                      >
                        {`$${value}/person`}
                      </button>
                    ))}
                  </div>

                  <h2 className="filter-title">Bedrooms</h2>
                  <div className="chip-row" style={{ marginBottom: "10px" }}>
                    {ROOMMATE_OPTIONS.map((value) => (
                      <button
                        key={`bed-${value}`}
                        type="button"
                        className={`uva-chip ${roommates === value ? "active" : ""}`}
                        onClick={() => setRoommates(value)}
                      >
                        {value === 4 ? "4+" : value}
                      </button>
                    ))}
                  </div>

                  <h2 className="filter-title">Distance to building</h2>
                  <div className="chip-row" style={{ marginBottom: "10px" }}>
                    {[
                      { key: "any", label: "Any" },
                      { key: "10", label: "≤10 min" },
                      { key: "20", label: "≤20 min" },
                      { key: "30", label: "≤30 min" },
                    ].map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        className={`uva-chip ${distanceFilter === option.key ? "active" : ""}`}
                        onClick={() => setDistanceFilter(option.key as DistanceFilter)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <h2 className="filter-title">Commute mode</h2>
                  <div className="chip-row" style={{ marginBottom: "10px" }}>
                    {(["walk", "bus", "bike", "car"] as CommuteMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={`uva-chip ${commuteMode === mode ? "active" : ""}`}
                        onClick={() => setCommuteMode(mode)}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>

                  <h2 className="filter-title">Sort</h2>
                  <select
                    className="uva-select"
                    value={sortMode}
                    onChange={(event) => setSortMode(event.target.value as SortMode)}
                  >
                    <option value="best">Best match</option>
                    <option value="price">Lowest price</option>
                    <option value="commute">Shortest commute</option>
                  </select>
                </div>
              </section>

              <section className="results-panel">
                <div className="insight-strip">
                  {insightText}
                  <button type="button" onClick={() => openAiWithPrompt("Why are these areas my best fit?") }>
                    Ask AI
                  </button>
                </div>

                <div className="surface-card" style={{ padding: "12px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>
                      {loading ? "Loading listings..." : `${filteredListings.length} matches`}
                    </h2>
                    <div className="chip-row">
                      <button
                        type="button"
                        className={`uva-chip ${mappedOnly ? "active" : ""}`}
                        onClick={() => setMappedOnly((current) => !current)}
                      >
                        {mappedOnly ? "Show all in list" : "Show mapped only"}
                      </button>
                    </div>
                  </div>
                </div>

                {renderListings()}
              </section>

              <aside
                className="side-panel"
                style={{ display: isDesktop || activeView === "map" || activeView === "ai" ? "flex" : "none" }}
              >
                <div className="side-panel-stack">
                  <div className="side-switch" style={{ display: isDesktop ? "flex" : "none" }}>
                    <button
                      type="button"
                      className={desktopRightMode === "map" ? "active" : ""}
                      onClick={() => {
                        setDesktopRightMode("map");
                        setActiveView("map");
                      }}
                    >
                      Map
                    </button>
                    <button
                      type="button"
                      className={desktopRightMode === "ai" ? "active" : ""}
                      onClick={() => {
                        setDesktopRightMode("ai");
                        setActiveView("ai");
                      }}
                    >
                      Ask AI
                    </button>
                  </div>

                  {(desktopRightMode === "map" || activeView === "map") && activeView !== "ai" ? (
                    <section className="surface-card map-wrap">
                      {mappedCount !== filteredListings.length ? (
                        <div className="map-banner">
                          {mappedCount} of {filteredListings.length} listings can be pinned.
                        </div>
                      ) : null}
                      <ListingMap
                        listings={filteredListings}
                        selectedListingId={selectedListingId}
                        onSelectListing={(listingId) => {
                          setSelectedListingId(listingId);
                          setDetailListingId(listingId);
                        }}
                      />
                    </section>
                  ) : null}

                  {(desktopRightMode === "ai" || activeView === "ai") ? (
                    <ChatPanel
                      messages={messages}
                      loading={chatLoading}
                      input={chatInput}
                      onInputChange={setChatInput}
                      onSubmit={handleChatSubmit}
                      onUsePrompt={(prompt) => {
                        setChatInput(prompt);
                        void sendChatMessage(prompt);
                      }}
                      prompts={STARTER_PROMPTS}
                      chatError={chatError}
                      onRetry={handleRetryChat}
                    />
                  ) : null}
                </div>
              </aside>
            </>
          ) : (
            <section style={{ gridColumn: "1 / -1" }}>
              {renderCompareView()}
            </section>
          )}
        </main>
      )}

      {detailListing ? (
        isDesktop ? (
          <aside className="detail-panel">
            <button type="button" className="secondary-btn" onClick={() => setDetailListingId(null)}>
              Close
            </button>
            <div className="detail-section">
              <h2 className="detail-heading">Price summary</h2>
              <p className="detail-price">{formatCurrency(detailListing.price_per_person)}/person</p>
              <p style={{ color: "#475569" }}>
                {detailListing.bedrooms ? `${detailListing.bedrooms} bedrooms` : "Bedrooms unknown"}
              </p>
            </div>
            <div className="detail-section">
              <h2 className="detail-heading">Commute</h2>
              <p>{listingCommuteText(detailListing.commuteMinutes, selectedBuilding.label, commuteMode)}</p>
            </div>
            <div className="detail-section">
              <h2 className="detail-heading">Neighborhood context</h2>
              <p>
                {detailListing.neighborhood} is commonly considered by UVA students balancing
                commute and budget tradeoffs.
              </p>
            </div>
            <div className="detail-section">
              <h2 className="detail-heading">Source links</h2>
              {detailListing.url ? (
                <a href={detailListing.url} target="_blank" rel="noreferrer" className="primary-btn" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                  Open source listing
                </a>
              ) : (
                <p style={{ color: "#64748B" }}>Source listing unavailable.</p>
              )}
            </div>
            <div className="detail-section">
              <h2 className="detail-heading">Ask AI about this place</h2>
              <div className="chip-row">
                <button
                  type="button"
                  className="uva-chip soft blue"
                  onClick={() => openAiWithPrompt(`Is ${detailListing.name} a good value for ${roommates} roommates?`)}
                >
                  Is this a good value?
                </button>
                <button
                  type="button"
                  className="uva-chip soft blue"
                  onClick={() => openAiWithPrompt(`Compare ${detailListing.name} with other options near ${selectedBuilding.label}.`)}
                >
                  Compare alternatives
                </button>
              </div>
            </div>
          </aside>
        ) : (
          <aside className="detail-sheet">
            <button type="button" className="secondary-btn" onClick={() => setDetailListingId(null)}>
              Close
            </button>
            <div className="detail-section">
              <h2 className="detail-heading">Price summary</h2>
              <p className="detail-price">{formatCurrency(detailListing.price_per_person)}/person</p>
              <p style={{ color: "#475569" }}>
                {detailListing.bedrooms ? `${detailListing.bedrooms} bedrooms` : "Bedrooms unknown"}
              </p>
            </div>
            <div className="detail-section">
              <h2 className="detail-heading">Commute</h2>
              <p>{listingCommuteText(detailListing.commuteMinutes, selectedBuilding.label, commuteMode)}</p>
            </div>
            <div className="detail-section">
              <h2 className="detail-heading">Neighborhood context</h2>
              <p>{detailListing.neighborhood} is popular with students comparing cost and access.</p>
            </div>
            <div className="detail-section">
              <h2 className="detail-heading">Source links</h2>
              {detailListing.url ? (
                <a href={detailListing.url} target="_blank" rel="noreferrer" className="primary-btn" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                  Open source listing
                </a>
              ) : (
                <p style={{ color: "#64748B" }}>Source listing unavailable.</p>
              )}
            </div>
            <div className="detail-section">
              <h2 className="detail-heading">Ask AI about this place</h2>
              <div className="chip-row">
                <button
                  type="button"
                  className="uva-chip soft blue"
                  onClick={() => openAiWithPrompt(`Should I shortlist ${detailListing.name}?`)}
                >
                  Should I shortlist this?
                </button>
              </div>
            </div>
          </aside>
        )
      ) : null}

      {compareIds.length > 0 && started ? (
        <div className="compare-tray">
          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#334155" }}>
            Compare ({compareIds.length})
          </span>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", flex: 1 }}>
            {compareListings.slice(0, 3).map((listing) => (
              <span key={listing.id} className="compare-pill">
                {listing.name}
              </span>
            ))}
          </div>
          <button type="button" className="secondary-btn" onClick={showCompareView}>
            Open
          </button>
          <button type="button" className="secondary-btn" onClick={() => setCompareIds([])}>
            Clear
          </button>
        </div>
      ) : null}

      {started ? (
        <nav className="bottom-nav">
          {[
            { key: "explore", label: "Explore" },
            { key: "map", label: "Map" },
            { key: "compare", label: "Compare" },
            { key: "ai", label: "Ask AI" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={activeView === tab.key ? "active" : ""}
              onClick={() => {
                setActiveView(tab.key as ViewMode);
                if (tab.key === "ai") setDesktopRightMode("ai");
                if (tab.key === "map") setDesktopRightMode("map");
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
