"""Shared Pydantic models for the PlotTwistt API contract (see SPEC.md)."""

from enum import Enum
from typing import Annotated, Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field, StringConstraints


class IntentType(str, Enum):
    WAREHOUSE = "warehouse"
    RETAIL = "retail"
    PLOT = "plot"


class FrictionCategory(str, Enum):
    FLOODING_DRAINAGE = "flooding_drainage"
    ZONING_BUFFER_ROW = "zoning_buffer_row"
    CIVIC_NEIGHBOR_FRICTION = "civic_neighbor_friction"
    ACCESS_INFRASTRUCTURE = "access_infrastructure"


class SeverityLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


Latitude = Annotated[float, Field(ge=-90, le=90)]
Longitude = Annotated[float, Field(ge=-180, le=180)]
LocationText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class LocationInput(BaseModel):
    lat: Optional[Latitude] = None
    lng: Optional[Longitude] = None
    address: Optional[LocationText] = None
    locality: Optional[LocationText] = None
    city: Optional[LocationText] = "Bengaluru"


class AnalyzeRequest(BaseModel):
    location: Union[LocationText, LocationInput]
    lat: Optional[Latitude] = None
    lng: Optional[Longitude] = None
    intent: IntentType = IntentType.WAREHOUSE


class Flag(BaseModel):
    id: str
    category: FrictionCategory
    severity: SeverityLevel
    headline: str
    explanation: str
    quote: str
    source_title: str
    url: str
    distance_km: Optional[float] = None
    distance_label: str
    proximity_tier: str


class AnalyzeResponse(BaseModel):
    location: str
    hierarchy: Dict[str, Any] = Field(default_factory=dict)
    overall_risk: SeverityLevel
    summary: str
    flags: List[Flag]
    total_flags: int
    data_source: Literal["live", "cache", "demo"]
    degraded: bool
    analyzed_at: str = Field(..., description="ISO 8601 UTC timestamp")


class Preset(BaseModel):
    id: str
    name: str
    lat: float
    lng: float
    intent: IntentType
    description: str


class HealthResponse(BaseModel):
    status: str
    service: str
    timestamp: str
