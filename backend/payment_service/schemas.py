from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid


class CreateSessionRequest(BaseModel):
    ticket_ref: str
    event_id: str
    amount: float
    event_title: str


class PaymentResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    ticket_ref: str
    event_id: uuid.UUID
    stripe_session_id: Optional[str]
    amount: float
    currency: str
    status: str
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}
