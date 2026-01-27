from typing import List, Optional, Dict, Any

from db import get_pool


async def search_off_grounds_listings(
    max_rent_per_person: Optional[int] = None,
    min_bedrooms: Optional[int] = None,
    max_bedrooms: Optional[int] = None,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """
    Query off_grounds_listings in Supabase with simple filters.

    - max_rent_per_person: only return listings with price_per_person <= this
    - min_bedrooms: only return listings with bedrooms >= this
    - max_bedrooms: only return listings with bedrooms <= this
    """
    pool = await get_pool()

    where_clauses = []
    params: list[Any] = []

    if max_rent_per_person is not None:
        where_clauses.append("price_per_person <= $" + str(len(params) + 1))
        params.append(max_rent_per_person)

    if min_bedrooms is not None:
        where_clauses.append("bedrooms >= $" + str(len(params) + 1))
        params.append(min_bedrooms)

    if max_bedrooms is not None:
        where_clauses.append("bedrooms <= $" + str(len(params) + 1))
        params.append(max_bedrooms)

    where_sql = ""
    if where_clauses:
        where_sql = "WHERE " + " AND ".join(where_clauses)

    query = f"""
        SELECT
            id,
            name,
            address,
            latitude,
            longitude,
            bedrooms,
            price_total,
            price_per_person,
            url,
            landlord_contact_url
        FROM off_grounds_listings
        {where_sql}
        ORDER BY price_per_person ASC NULLS LAST
        LIMIT ${len(params) + 1};
    """

    params.append(limit)

    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)

    return [dict(row) for row in rows]