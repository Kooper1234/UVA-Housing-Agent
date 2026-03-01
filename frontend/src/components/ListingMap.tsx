"use client";

import { useEffect } from "react";
import { divIcon, type DivIcon } from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

import type { Listing } from "@/types/listings";

type ListingMapProps = {
  listings: Listing[];
  selectedListingId: string | null;
  onSelectListing: (listingId: string) => void;
};

const UVA_CENTER: [number, number] = [38.0336, -78.508];
const DEFAULT_ZOOM = 13;

function toMarkerIcon(price: number | null, active: boolean): DivIcon {
  const label =
    typeof price === "number" ? `$${Math.round(price).toLocaleString()}` : "View";

  return divIcon({
    className: "",
    html: `<span class="price-marker ${active ? "price-marker-active" : ""}">${label}</span>`,
    iconSize: [64, 36],
    iconAnchor: [32, 34],
    popupAnchor: [0, -30],
  });
}

function FocusOnListing({ listing }: { listing: Listing | undefined }) {
  const map = useMap();

  useEffect(() => {
    if (!listing || listing.latitude == null || listing.longitude == null) {
      return;
    }

    map.flyTo([listing.latitude, listing.longitude], Math.max(map.getZoom(), 14), {
      duration: 0.5,
    });
  }, [listing, map]);

  return null;
}

export default function ListingMap({
  listings,
  selectedListingId,
  onSelectListing,
}: ListingMapProps) {
  const mappableListings = listings.filter(
    (listing) => listing.latitude != null && listing.longitude != null,
  );

  const selectedListing = mappableListings.find(
    (listing) => listing.id === selectedListingId,
  );

  if (!mappableListings.length) {
    return (
      <div className="map-empty-state">
        Most listings don&apos;t include exact coordinates yet. You can still compare all
        listings in list view.
      </div>
    );
  }

  return (
    <MapContainer
      center={UVA_CENTER}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
      className="uva-map"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FocusOnListing listing={selectedListing} />

      {mappableListings.map((listing) => (
        <Marker
          key={listing.id}
          position={[listing.latitude as number, listing.longitude as number]}
          icon={toMarkerIcon(
            listing.price_per_person,
            selectedListingId === listing.id,
          )}
          eventHandlers={{
            click: () => onSelectListing(listing.id),
          }}
        >
          <Popup>
            <p style={{ margin: 0, fontWeight: 600 }}>{listing.name}</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#475569" }}>
              {typeof listing.price_per_person === "number"
                ? `$${listing.price_per_person}/person`
                : "Price unavailable"}
            </p>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
