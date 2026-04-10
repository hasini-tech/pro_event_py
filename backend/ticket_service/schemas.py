from datetime import datetime
from typing import Optional
import uuid

from pydantic import BaseModel, Field, field_validator


class TicketBook(BaseModel):
    event_id: str


class TicketManage(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        allowed = {
            "confirmed",
            "waitlisted",
            "cancelled",
            "rejected",
            "pending_payment",
            "pending_approval",
        }
        if value not in allowed:
            raise ValueError(f"status must be one of: {', '.join(sorted(allowed))}")
        return value


class TicketResponse(BaseModel):
    id: uuid.UUID
    ticket_ref: str
    event_id: uuid.UUID
    user_id: uuid.UUID
    status: str
    ticket_type: str
    payment_status: str
    stripe_session_id: Optional[str] = None
    qr_code: Optional[str] = None
    checked_in: bool
    checked_in_at: Optional[datetime]
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TicketDetailResponse(TicketResponse):
    event_title: str = ""
    event_slug: str = ""
    event_date: Optional[datetime] = None
    event_time: str = ""
    event_location: str = ""
    event_description: str = ""
    event_cover_image: str = ""
    event_is_online: bool = False
    event_status: str = ""
    host_name: str = ""
    user_name: str = ""
    user_email: str = ""
    user_bio: str = ""
    user_profile_image: str = ""
    user_links: list[str] = Field(default_factory=list)
