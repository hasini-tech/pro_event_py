from datetime import datetime
from typing import Optional
import uuid

from pydantic import BaseModel, Field


class CheckInRequest(BaseModel):
    ticket_ref: str
    event_id: str


class AttendeeResponse(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    user_id: uuid.UUID
    ticket_id: uuid.UUID
    ticket_ref: str
    status: str
    ticket_type: str
    name: str = ""
    bio: str = ""
    profile_image: str = ""
    links: list[str] = Field(default_factory=list)
    checked_in: bool
    checked_in_at: Optional[datetime]
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class PublicCommunityResponse(BaseModel):
    event_id: uuid.UUID
    confirmed_count: int = 0
    waitlisted_count: int = 0
    checked_in_count: int = 0
    attendees: list[AttendeeResponse] = Field(default_factory=list)


class HostStatsResponse(BaseModel):
    total_events: int
    total_attendees: int
    confirmed_attendees: int
    waitlisted_attendees: int
    checked_in_count: int
    total_revenue: float


class TicketPurchasedPayload(BaseModel):
    ticket_id: uuid.UUID
    event_id: uuid.UUID
    user_id: uuid.UUID
    ticket_ref: Optional[str] = None
    status: str = "confirmed"
    ticket_type: str = "free"
    profile: dict = Field(default_factory=dict)
