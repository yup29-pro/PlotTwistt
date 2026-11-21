from __future__ import annotations
from typing import List, Optional, Literal
from pydantic import BaseModel, Field

# Supported Intents
IntentType = Literal["warehouse", "retail", "plot"]

# Risk Levels
RiskLevel = Literal["low", "medium", "high"]

# Friction Categories
CategoryType = Literal[
    "flooding_drainage",
    "zoning_buffer_row",
    "civic_neighbor_friction"
]


class AnalyzeRequest(BaseModel):
    """Incoming request payload to scan a location for civic & land friction."""
    location: str = Field(..., description="Target locality, landmark, or address.")
    lat: Optional[float] = Field(None, description="Latitude coordinate.")
    lng: Optional[float] = Field(None, description="Longitude coordinate.")
    intent: str = Field(
        default="warehouse",
        description="Intended land use: 'warehouse', 'retail', or 'plot'."
    )


class FrictionFlag(BaseModel):
    """A single verified friction point with supporting evidence trail."""
    id: str = Field(..., description="Unique flag identifier (e.g. flag-1).")
    category: str = Field(
        ...,
        description="flooding_drainage | zoning_buffer_row | civic_neighbor_friction"
    )
    severity: str = Field(..., description="low | medium | high")
    headline: str = Field(..., description="Concise 6-8 word risk title.")
    explanation: str = Field(..., description="Plain-English explanation of impact on intent.")
    quote: str = Field(..., description="Exact quoted snippet from verified source.")
    source_title: str = Field(..., description="Title of government notice, court order, or article.")
    url: str = Field(..., description="External verification URL.")


class AnalyzeResponse(BaseModel):
    """Complete synthesized friction radar response."""
    location: str = Field(..., description="Echoed normalized location.")
    overall_risk: str = Field(..., description="low | medium | high")
    summary: str = Field(..., description="2-sentence overview of hidden site friction.")
    flags: List[FrictionFlag] = Field(default_factory=list, description="Array of detected friction flags.")


class PresetLocation(BaseModel):
    """Preset contrasting demo location for one-click testing."""
    id: str
    name: str
    lat: float
    lng: float
    intent: str
    description: str
