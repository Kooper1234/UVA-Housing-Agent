from pydantic import BaseModel
from typing import Optional

class OffGroundListingModel(BaseModel):
    id: str
    name: Optional[str]
    address: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    bedrooms: Optional[int]
    price_total: Optional[int]
    price_per_person: Optional[int]
    url: Optional[str]
    landlord_contact_url: Optional[str]

def listing_from_rentcast(property_json: dict, rent_estimate: Optional[int] = None) -> OffGroundListingModel:
    bedrooms = property_json.get("bedrooms")
    return OffGroundListingModel(
        id=property_json["id"],
        name=property_json.get("formattedAddress"),
        address=property_json.get("formattedAddress"),
        latitude=property_json.get("latitude"),
        longitude=property_json.get("longitude"),
        bedrooms=bedrooms,
        price_total=rent_estimate,
        price_per_person=(rent_estimate // bedrooms if rent_estimate and bedrooms else None),
        url=property_json.get("url"),
        landlord_contact_url=None
    )
