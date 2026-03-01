"use client";

import { useEffect } from "react";
import { divIcon, type DivIcon } from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

import type { Listing } from "@/types/listings";

type ListingMapProps = {
  listings: Listing[];
  highlightedListingId: string | null;
  onSelectListing: (listingId: string) => void;
};

const UVA_CENTER: [number, number] = [38.0336, -78.508];
const DEFAULT_ZOOM = 14;

function toMarkerIcon(price: number | null, active: boolean): DivIcon {
  const label =
    typeof price === "number"
      ? `$${Math.round(price).toLocaleString()}`
      : "View";

  return divIcon({
    className: "",
    html: `<span class="price-marker ${active ? "price-marker-active" : ""}">${label}</span>`,
    iconSize: [58, 26],
    iconAnchor: [29, 13],
  });
}

function FocusOnListing({ listing }: { listing: Listing | undefined }) {
  const map = useMap();

  useEffect(() => {
    if (!listing || listing.latitude == null || listing.longitude == null) {
      return;
    }

    map.flyTo([listing.latitude, listing.longitude], map.getZoom(), {
      duration: 0.6,
    });
  }, [listing, map]);

  return null;
}

export default function ListingMap({
  listings,
  highlightedListingId,
  onSelectListing,
}: ListingMapProps) {
  const mappableListings = listings.filter(
    (listing) => listing.latitude != null && listing.longitude != null,
  );

  const highlighted = mappableListings.find(
    (listing) => listing.id === highlightedListingId,
  );

  if (!mappableListings.length) {
    return (
      <div className="flex h-full min-h-[360px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600">
        No coordinates available for the current results.
      </div>
    );
  }

  return (
    <MapContainer
      center={UVA_CENTER}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom={true}
      className="h-full min-h-[420px] w-full rounded-2xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FocusOnListing listing={highlighted} />

      {mappableListings.map((listing) => (
        <Marker
          key={listing.id}
          position={[listing.latitude as number, listing.longitude as number]}
          icon={toMarkerIcon(
            listing.price_per_person,
            listing.id === highlightedListingId,
          )}
          eventHandlers={{
            click: () => onSelectListing(listing.id),
          }}
        >
          <Popup>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">{listing.name}</p>
              <p className="text-xs text-slate-700">
                {typeof listing.price_per_person === "number"
                  ? `$${listing.price_per_person}/person`
                  : "Price unavailable"}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
