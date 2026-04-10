"""
Ticket Service — SQLAlchemy models.
Replaces the Mongoose Ticket schema.
"""
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from shared.database import Base


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    ticket_ref = Column(String(50), unique=True, nullable=False, index=True)  # e.g. EVTLY-AB12CD
    event_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    status = Column(String(50), default="confirmed")        # 'confirmed'|'waitlisted'|'cancelled'
    ticket_type = Column(String(20), default="free")        # 'free' | 'paid'
    payment_status = Column(String(20), default="none")     # 'none'|'pending'|'completed'
    stripe_session_id = Column(Text, default="")
    qr_code = Column(Text, default="")                      # base64 data URL
    checked_in = Column(Boolean, default=False)
    checked_in_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
