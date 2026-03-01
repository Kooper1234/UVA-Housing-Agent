"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import ChatDrawer from "@/components/ChatDrawer";
import type { Listing } from "@/types/listings";

const ListingMap = dynamic(() => import("@/components/ListingMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-600">
      Loading map...
    </div>
  ),
});

const ROTUNDA = {
  lat: 38.0336,
  lng: -78.508,
};

type PriceFilter = "any" | "800" | "1000" | "1200" | "1500";
type BedroomsFilter = "any" | "1" | "2" | "3" | "4plus";
type DistanceFilter = "any" | "0.5" | "1" | "2" | "3";

function formatPrice(price: number | null) {
  if (typeof price !== "number") return "Price unavailable";
  return `$${price.toLocaleString()}/person`;
}

function formatBedrooms(bedrooms: number | null) {
  if (typeof bedrooms !== "number") return "Beds unavailable";
  return `${bedrooms} BR`;
}

function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMiles * c;
}

export default function HomePage() {
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("any");
  const [bedroomsFilter, setBedroomsFilter] = useState<BedroomsFilter>("any");
  const [distanceFilter, setDistanceFilter] = useState<DistanceFilter>("any");
  const [query, setQuery] = useState("");
  const [showMap, setShowMap] = useState(true);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [highlightedListingId, setHighlightedListingId] = useState<string | null>(
    null,
  );

  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    let cancelled = false;

    async function fetchListings() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("limit", "60");

        if (priceFilter !== "any") {
          params.set("max_price", priceFilter);
        }

        if (bedroomsFilter !== "any") {
          if (bedroomsFilter === "4plus") {
            params.set("min_bedrooms", "4");
          } else {
            params.set("min_bedrooms", bedroomsFilter);
            params.set("max_bedrooms", bedroomsFilter);
          }
        }

        const response = await fetch(`/api/listings?${params.toString()}`);
        const payload = (await response.json()) as {
          listings?: Listing[];
          error?: string;
        };

        if (!response.ok || !payload.listings) {
          throw new Error(payload.error || "Failed to load listings.");
        }

        if (!cancelled) {
          setListings(payload.listings);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Failed to load listings.",
          );
          setListings([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchListings();

    return () => {
      cancelled = true;
    };
  }, [priceFilter, bedroomsFilter]);

  const filteredListings = useMemo(() => {
    return listings.filter((listing) => {
      const normalizedSearch = query.trim().toLowerCase();
      const matchesSearch =
        !normalizedSearch ||
        listing.name.toLowerCase().includes(normalizedSearch) ||
        listing.address?.toLowerCase().includes(normalizedSearch);

      if (!matchesSearch) {
        return false;
      }

      if (distanceFilter === "any") {
        return true;
      }

      if (listing.latitude == null || listing.longitude == null) {
        return false;
      }

      const miles = haversineMiles(
        listing.latitude,
        listing.longitude,
        ROTUNDA.lat,
        ROTUNDA.lng,
      );

      return miles <= Number(distanceFilter);
    });
  }, [distanceFilter, listings, query]);

  useEffect(() => {
    if (!highlightedListingId) return;

    const card = cardRefs.current[highlightedListingId];
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [highlightedListingId]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
          <div className="mr-2 flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#E57200]" />
            <span className="text-xl font-bold tracking-tight text-[#232D4B]">UVA Housing</span>
          </div>

          <div className="order-3 w-full min-w-[220px] flex-1 md:order-none md:w-auto">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by property or address"
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none ring-[#E57200] transition focus:ring-2"
            />
          </div>

          <nav className="ml-auto flex items-center gap-2 text-sm font-medium">
            <Link
              href="#"
              className="rounded-lg bg-[#232D4B] px-3 py-2 text-white"
              aria-current="page"
            >
              Listings
            </Link>
            <span className="rounded-lg px-3 py-2 text-slate-500">Roommates</span>
            <span className="rounded-lg px-3 py-2 text-slate-500">Sublets</span>
          </nav>
        </div>
      </header>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center gap-3 px-4 py-4 lg:px-6">
          <select
            value={priceFilter}
            onChange={(event) => setPriceFilter(event.target.value as PriceFilter)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="any">Price Range</option>
            <option value="800">Up to $800/person</option>
            <option value="1000">Up to $1,000/person</option>
            <option value="1200">Up to $1,200/person</option>
            <option value="1500">Up to $1,500/person</option>
          </select>

          <select
            value={bedroomsFilter}
            onChange={(event) => setBedroomsFilter(event.target.value as BedroomsFilter)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="any">Bedrooms</option>
            <option value="1">1 Bedroom</option>
            <option value="2">2 Bedrooms</option>
            <option value="3">3 Bedrooms</option>
            <option value="4plus">4+ Bedrooms</option>
          </select>

          <select
            value={distanceFilter}
            onChange={(event) => setDistanceFilter(event.target.value as DistanceFilter)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="any">Distance to Rotunda</option>
            <option value="0.5">Within 0.5 miles</option>
            <option value="1">Within 1 mile</option>
            <option value="2">Within 2 miles</option>
            <option value="3">Within 3 miles</option>
          </select>

          <button
            type="button"
            onClick={() => setShowMap((current) => !current)}
            className="ml-auto rounded-lg border border-[#232D4B] px-3 py-2 text-sm font-semibold text-[#232D4B] transition hover:bg-[#232D4B] hover:text-white"
          >
            {showMap ? "Hide Map" : "Show Map"}
          </button>
        </div>
      </section>

      <main
        className={`mx-auto grid w-full max-w-[1400px] gap-5 px-4 py-5 lg:px-6 ${
          showMap ? "lg:grid-cols-[minmax(0,1fr)_460px]" : "grid-cols-1"
        }`}
      >
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-[#232D4B]">
              {loading ? "Loading listings..." : `${filteredListings.length} listings`}
            </h1>
            <p className="text-xs text-slate-500">Sorted by lowest price/person</p>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 9 }).map((_, index) => (
                <div
                  key={`loading-card-${index}`}
                  className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white"
                />
              ))}
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-600">
              No listings match these filters yet.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredListings.map((listing) => {
                const isHighlighted = listing.id === highlightedListingId;

                return (
                  <article
                    key={listing.id}
                    ref={(element) => {
                      cardRefs.current[listing.id] = element;
                    }}
                    onMouseEnter={() => setHighlightedListingId(listing.id)}
                    className={`group rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                      isHighlighted
                        ? "border-[#E57200] ring-2 ring-[#E57200]/20"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-base font-semibold text-slate-900">{listing.name}</h2>
                        <p className="mt-1 text-xs text-slate-500">
                          {listing.address || "Address unavailable"}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#232D4B] px-2 py-1 text-xs font-semibold text-white">
                        {formatBedrooms(listing.bedrooms)}
                      </span>
                    </div>

                    <p className="text-lg font-bold text-[#E57200]">
                      {formatPrice(listing.price_per_person)}
                    </p>

                    <div className="mt-4 flex items-center gap-2">
                      {listing.url ? (
                        <a
                          href={listing.url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg bg-[#232D4B] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#1b253f]"
                        >
                          View Listing
                        </a>
                      ) : null}

                      {listing.landlord_contact_url ? (
                        <a
                          href={listing.landlord_contact_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition group-hover:border-[#232D4B] group-hover:text-[#232D4B]"
                        >
                          Contact
                        </a>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {showMap ? (
          <aside className="lg:sticky lg:top-[132px] lg:h-[calc(100vh-150px)]">
            <div className="h-full rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              <ListingMap
                listings={filteredListings}
                highlightedListingId={highlightedListingId}
                onSelectListing={setHighlightedListingId}
              />
            </div>
          </aside>
        ) : null}
      </main>

      <ChatDrawer />
    </div>
  );
}
