import { NextRequest, NextResponse } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parseNumber(value: string | null): number | undefined {
  if (!value) return undefined;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;

  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const maxPrice = parseNumber(searchParams.get("max_price"));
    const minBedrooms = parseNumber(searchParams.get("min_bedrooms"));
    const maxBedrooms = parseNumber(searchParams.get("max_bedrooms"));

    const parsedLimit = parseNumber(searchParams.get("limit"));
    const limit =
      parsedLimit && parsedLimit > 0
        ? Math.min(Math.floor(parsedLimit), MAX_LIMIT)
        : DEFAULT_LIMIT;

    const supabase = createServiceRoleClient();

    let query = supabase
      .from("off_grounds_listings")
      .select(
        "id,name,address,latitude,longitude,bedrooms,price_total,price_per_person,url,landlord_contact_url",
      )
      .order("price_per_person", { ascending: true, nullsFirst: false })
      .limit(limit);

    if (typeof maxPrice === "number") {
      query = query.lte("price_per_person", maxPrice);
    }

    if (typeof minBedrooms === "number") {
      query = query.gte("bedrooms", minBedrooms);
    }

    if (typeof maxBedrooms === "number") {
      query = query.lte("bedrooms", maxBedrooms);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch listings." },
        { status: 500 },
      );
    }

    return NextResponse.json({ listings: data ?? [] });
  } catch {
    return NextResponse.json(
      { error: "Unexpected server error while fetching listings." },
      { status: 500 },
    );
  }
}
