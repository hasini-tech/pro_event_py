"""
Payment Service — SQLAlchemy model.
"""
import uuid
from sqlalchemy import Column, String, Numeric, DateTime, Text  # type: ignore
from sqlalchemy.dialects.postgresql import UUID  # type: ignore
from sqlalchemy.sql import func  # type: ignore
import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from shared.database import Base  # type: ignore


class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    ticket_ref = Column(String(50), nullable=False, index=True)   # EVTLY-XXXXXXXX
    event_id = Column(UUID(as_uuid=True), nullable=False)
    stripe_session_id = Column(Text, unique=True, nullable=True)
    stripe_intent_id = Column(Text, nullable=True)
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(10), default="usd")
    status = Column(String(50), default="pending")   # 'pending'|'succeeded'|'failed'
    created_at = Column(DateTime(timezone=True), server_default=func.now())
