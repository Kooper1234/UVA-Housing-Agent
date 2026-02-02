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


