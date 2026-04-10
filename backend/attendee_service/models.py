"""
Attendee Service SQLAlchemy model.
Tracks confirmed and waitlisted attendees, profile snapshots, and check-in status.
"""

import uuid

from sqlalchemy import Boolean, Column, DateTime, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from shared.database import Base


class Attendee(Base):
    __tablename__ = "attendees"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    ticket_id = Column(UUID(as_uuid=True), nullable=False, unique=True, index=True)
    ticket_ref = Column(String(50), nullable=False, index=True)
    status = Column(String(50), default="confirmed")
    ticket_type = Column(String(20), default="free")
    name = Column(String(255), default="")
    bio = Column(Text, default="")
    profile_image = Column(Text, default="")
    links = Column(JSON, default=list)
    checked_in = Column(Boolean, default=False)
    checked_in_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
