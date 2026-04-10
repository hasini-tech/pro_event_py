"""
Event Service — SQLAlchemy models.
Replaces the Mongoose Event schema.
"""
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Integer, Text, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from shared.database import Base


class Event(Base):
    __tablename__ = "events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    date = Column(DateTime(timezone=True), nullable=False)
    time = Column(String(50), nullable=False)        # e.g. "6:00 PM"
    location = Column(Text, nullable=False)          # URL or address
    is_online = Column(Boolean, default=False)
    cover_image = Column(Text, default="")
    slug = Column(String(300), unique=True, nullable=False, index=True)
    calendar_id = Column(
        UUID(as_uuid=True),
        ForeignKey("owner_calendars.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Host info (denormalized for read-perf; host_id is the cross-service ref)
    host_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    host_name = Column(String(255), nullable=False)
    host_image = Column(Text, default="")
    host_bio = Column(Text, default="")

    # Ticketing
    is_paid = Column(Boolean, default=False)
    ticket_price = Column(Numeric(10, 2), default=0)
    max_seats = Column(Integer, default=0)           # 0 = unlimited
    seats_left = Column(Integer, default=0)
    attendee_count = Column(Integer, default=0)

    status = Column(String(50), default="published") # 'draft'|'published'|'cancelled'
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class EventSettings(Base):
    __tablename__ = "event_settings"

    event_id = Column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        primary_key=True,
    )
    speakers = Column(JSON, nullable=False, default=list)
    agenda = Column(JSON, nullable=False, default=list)
    integrations = Column(JSON, nullable=False, default=list)
    community_enabled = Column(Boolean, default=True)
    public_guest_list = Column(Boolean, default=True)
    collect_feedback = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class OwnerCalendar(Base):
    __tablename__ = "owner_calendars"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    owner_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text, default="")
    tint_color = Column(String(32), default="#0e7678")
    location_scope = Column(String(20), default="global")
    city = Column(String(120), default="")
    cover_image = Column(Text, default="")
    subscriber_count = Column(Integer, default=1)
    is_default = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class CalendarSettings(Base):
    __tablename__ = "calendar_settings"

    calendar_id = Column(
        UUID(as_uuid=True),
        ForeignKey("owner_calendars.id", ondelete="CASCADE"),
        primary_key=True,
    )
    event_visibility = Column(String(20), default="public", nullable=False)
    public_guest_list = Column(Boolean, default=True, nullable=False)
    collect_feedback = Column(Boolean, default=False, nullable=False)
    tracking_google_enabled = Column(Boolean, default=False, nullable=False)
    tracking_meta_enabled = Column(Boolean, default=False, nullable=False)
    team_enabled = Column(Boolean, default=False, nullable=False)
    tags = Column(JSON, nullable=False, default=list)
    embed_enabled = Column(Boolean, default=True, nullable=False)
    embed_width = Column(String(32), default="500", nullable=False)
    embed_height = Column(String(32), default="450", nullable=False)
    embed_theme = Column(String(20), default="light", nullable=False)
    embed_default_view = Column(String(20), default="agenda", nullable=False)
    send_quota_used = Column(Integer, default=0, nullable=False)
    verification_status = Column(String(20), default="unverified", nullable=False)
    plan_name = Column(String(20), default="free", nullable=False)
    billing_cycle = Column(String(20), default="monthly", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class CalendarAdmin(Base):
    __tablename__ = "calendar_admins"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    calendar_id = Column(
        UUID(as_uuid=True),
        ForeignKey("owner_calendars.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    email = Column(String(255), nullable=False, index=True)
    role = Column(String(20), default="admin", nullable=False)
    status = Column(String(20), default="active", nullable=False)
    invited_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class CalendarApiKey(Base):
    __tablename__ = "calendar_api_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    calendar_id = Column(
        UUID(as_uuid=True),
        ForeignKey("owner_calendars.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    key_prefix = Column(String(48), nullable=False)
    last_four = Column(String(4), nullable=False)
    secret_hash = Column(Text, nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class CalendarWebhook(Base):
    __tablename__ = "calendar_webhooks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    calendar_id = Column(
        UUID(as_uuid=True),
        ForeignKey("owner_calendars.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    label = Column(String(255), nullable=False)
    target_url = Column(Text, nullable=False)
    event_types = Column(JSON, nullable=False, default=list)
    secret_token = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    failure_count = Column(Integer, default=0, nullable=False)
    last_triggered_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
