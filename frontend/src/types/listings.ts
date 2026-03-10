export type Listing = {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  bedrooms: number | null;
  price_total: number | null;
  price_per_person: number | null;
  url: string | null;
  landlord_contact_url: string | null;
};

export type Citation = {
  id: string;
  topic: string | null;
  scope: string | null;
  source_url: string | null;
};
