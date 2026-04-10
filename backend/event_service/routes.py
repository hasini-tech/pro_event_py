"""
Event Service routes.

This service owns event creation and public event data, while reading ticket and
attendee status from the shared database so the dashboard and event pages always
reflect the latest RSVP state.
"""

from __future__ import annotations

import asyncio
import hashlib
import os
import random
import secrets
import string
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable

import httpx
from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException
from sqlalchemy.orm import Session

import sys
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from shared.database import get_db
from shared.auth import get_current_user, require_role
from shared.email_service import send_event_update_email, send_event_creation_confirmation
from shared.kafka_client import publish_event, TOPICS
from ticket_service.models import Ticket
from user_service.models import User  # for admin stats when using shared DBs (optional safety)

from .models import (
    CalendarAdmin,
    CalendarApiKey,
    CalendarSettings,
    CalendarWebhook,
    Event,
    EventSettings,
    OwnerCalendar,
)
from .schemas import (
    CalendarAdminResponse,
    AnalyticsEventItem,
    AnalyticsOverviewResponse,
    CalendarAdminCreate,
    CalendarAdminsResponse,
    CalendarAdminsUpdate,
    CalendarApiKeyCreate,
    CalendarApiKeyResponse,
    CalendarCreate,
    CalendarDeveloperResponse,
    CalendarEmbedResponse,
    CalendarEmbedUpdate,
    CalendarOptionsResponse,
    CalendarOptionsUpdate,
    CalendarPlanResponse,
    CalendarPlanUpdate,
    CalendarUpdate,
    CalendarResponse,
    CalendarSendLimitIncrement,
    CalendarSendLimitResponse,
    CalendarSettingsResponse,
    CalendarTagsResponse,
    CalendarTagsUpdate,
    CalendarWebhookCreate,
    CalendarWebhookResponse,
    CalendarWebhookUpdate,
    CommunityMember,
    CommunityResponse,
    EventCreate,
    EventResponse,
    EventUpdate,
)

router = APIRouter()

USER_SERVICE_URL = os.getenv("USER_SERVICE_URL", "http://127.0.0.1:8001")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
DEFAULT_EVENT_COVER = "/default-event-cover.svg"

RESERVED_STATUSES = {"confirmed", "pending_payment", "pending_approval"}
CONFIRMED_STATUSES = {"confirmed"}
WAITLIST_STATUSES = {"waitlisted"}
FINAL_STATUSES = {"confirmed", "waitlisted", "pending_payment", "pending_approval"}
PLUS_PLAN_BENEFITS = [
    "No platform fees",
    "Priority support",
    "5 admins included",
    "API and Zapier access",
    "5,000 event invites per week",
]
WEBHOOK_EVENT_TYPES = [
    "event.created",
    "event.updated",
    "event.deleted",
    "ticket.created",
    "ticket.updated",
]


@router.get("/health")
def health():
    return {"status": "ok", "service": "event-service"}


def generate_slug(title: str) -> str:
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=5))
    slug = title.lower().replace(" ", "-")
    slug = "".join(c for c in slug if c.isalnum() or c == "-")
    return f"{slug}-{suffix}"


def _slugify_value(value: str, fallback: str = "calendar") -> str:
    base = value.strip().lower().replace(" ", "-")
    base = "".join(c for c in base if c.isalnum() or c == "-").strip("-")
    return base or fallback


def _build_unique_calendar_slug(db: Session, raw_value: str) -> str:
    base = _slugify_value(raw_value)
    candidate = base
    suffix = 1

    while db.query(OwnerCalendar).filter(OwnerCalendar.slug == candidate).first():
        suffix += 1
        candidate = f"{base}-{suffix}"

    return candidate


def _calendar_event_counts(db: Session, calendar_id: uuid.UUID) -> tuple[int, int]:
    now = datetime.now(timezone.utc)
    total_events = db.query(Event).filter(Event.calendar_id == calendar_id).count()
    upcoming_events = (
        db.query(Event)
        .filter(Event.calendar_id == calendar_id, Event.date >= now)
        .count()
    )
    return total_events, upcoming_events


def _serialize_calendar(calendar: OwnerCalendar, db: Session) -> dict[str, Any]:
    event_count, upcoming_event_count = _calendar_event_counts(db, calendar.id)
    return {
        "id": calendar.id,
        "owner_id": calendar.owner_id,
        "name": calendar.name,
        "slug": calendar.slug,
        "description": calendar.description or "",
        "tint_color": calendar.tint_color or "#0e7678",
        "location_scope": calendar.location_scope or "global",
        "city": calendar.city or "",
        "cover_image": calendar.cover_image or "",
        "subscriber_count": calendar.subscriber_count or 1,
        "is_default": bool(calendar.is_default),
        "event_count": event_count,
        "upcoming_event_count": upcoming_event_count,
        "created_at": calendar.created_at,
    }


def _assert_calendar_owner(calendar: OwnerCalendar, current_user: dict[str, Any]) -> None:
    if str(calendar.owner_id) != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to manage this calendar")


def _get_owned_calendar(slug: str, current_user: dict[str, Any], db: Session) -> OwnerCalendar:
    calendar = db.query(OwnerCalendar).filter(OwnerCalendar.slug == slug).first()
    if not calendar:
        raise HTTPException(status_code=404, detail="Calendar not found")
    _assert_calendar_owner(calendar, current_user)
    return calendar


def _ensure_calendar_settings(db: Session, calendar_id: uuid.UUID) -> CalendarSettings:
    settings = db.query(CalendarSettings).filter(CalendarSettings.calendar_id == calendar_id).first()
    if settings:
        return settings

    settings = CalendarSettings(
        calendar_id=calendar_id,
        event_visibility="public",
        public_guest_list=True,
        collect_feedback=False,
        tracking_google_enabled=False,
        tracking_meta_enabled=False,
        team_enabled=False,
        tags=[],
        embed_enabled=True,
        embed_width="500",
        embed_height="450",
        embed_theme="light",
        embed_default_view="agenda",
        send_quota_used=0,
        verification_status="unverified",
        plan_name="free",
        billing_cycle="monthly",
    )
    db.add(settings)
    db.flush()
    return settings


def _default_calendar_visibility_status(settings: CalendarSettings) -> str:
    return "private" if settings.event_visibility == "private" else "published"


def _admin_limit(settings: CalendarSettings) -> int:
    return 5 if settings.plan_name == "plus" else 1


def _effective_send_quota(settings: CalendarSettings) -> int:
    if settings.plan_name == "plus":
        return 5000
    if settings.verification_status == "verified":
        return 500
    return 15


def _next_send_limit_reset_date() -> str:
    now = datetime.now(timezone.utc)
    days_until_monday = (7 - now.weekday()) % 7 or 7
    return (now + timedelta(days=days_until_monday)).date().isoformat()


def _build_embed_src(calendar: OwnerCalendar, settings: CalendarSettings) -> str:
    base = FRONTEND_URL.rstrip("/")
    return (
        f"{base}/calendars/{calendar.slug}"
        f"?embed=1&theme={settings.embed_theme or 'light'}&view={settings.embed_default_view or 'agenda'}"
    )


def _build_embed_iframe_code(calendar: OwnerCalendar, settings: CalendarSettings) -> str:
    src = _build_embed_src(calendar, settings)
    width = settings.embed_width or "500"
    height = settings.embed_height or "450"
    return (
        f'<iframe src="{src}" '
        f'width="{width}" height="{height}" frameborder="0" '
        f'style="border: 1px solid #e2e8f0; border-radius: 12px;" '
        'allowfullscreen="" aria-hidden="false" tabindex="0"></iframe>'
    )


def _serialize_calendar_options(settings: CalendarSettings) -> dict[str, Any]:
    return {
        "event_visibility": settings.event_visibility or "public",
        "public_guest_list": bool(settings.public_guest_list),
        "collect_feedback": bool(settings.collect_feedback),
        "tracking_google_enabled": bool(settings.tracking_google_enabled),
        "tracking_meta_enabled": bool(settings.tracking_meta_enabled),
    }


def _serialize_calendar_admin(admin: CalendarAdmin) -> dict[str, Any]:
    return {
        "id": admin.id,
        "calendar_id": admin.calendar_id,
        "user_id": admin.user_id,
        "email": admin.email,
        "role": admin.role or "admin",
        "status": admin.status or "active",
        "created_at": admin.created_at,
    }


def _serialize_calendar_admins(
    calendar: OwnerCalendar,
    settings: CalendarSettings,
    db: Session,
) -> dict[str, Any]:
    admins = (
        db.query(CalendarAdmin)
        .filter(CalendarAdmin.calendar_id == calendar.id)
        .order_by(CalendarAdmin.created_at.asc())
        .all()
    )
    limit = _admin_limit(settings)
    return {
        "team_enabled": bool(settings.team_enabled),
        "owner_id": calendar.owner_id,
        "included_admins": limit,
        "admin_limit": limit,
        "remaining_slots": max(limit - len(admins), 0),
        "admins": [_serialize_calendar_admin(admin) for admin in admins],
    }


def _serialize_calendar_tags(settings: CalendarSettings) -> dict[str, Any]:
    return {
        "tags": list(settings.tags or []),
    }


def _serialize_calendar_embed(calendar: OwnerCalendar, settings: CalendarSettings) -> dict[str, Any]:
    return {
        "enabled": bool(settings.embed_enabled),
        "width": settings.embed_width or "500",
        "height": settings.embed_height or "450",
        "theme": settings.embed_theme or "light",
        "default_view": settings.embed_default_view or "agenda",
        "src": _build_embed_src(calendar, settings),
        "iframe_code": _build_embed_iframe_code(calendar, settings),
    }


def _serialize_calendar_api_key(api_key: CalendarApiKey, token: str | None = None) -> dict[str, Any]:
    preview = f"{api_key.key_prefix}...{api_key.last_four}"
    return {
        "id": api_key.id,
        "name": api_key.name,
        "key_prefix": api_key.key_prefix,
        "preview": preview,
        "revoked": bool(api_key.revoked),
        "created_at": api_key.created_at,
        "token": token,
    }


def _serialize_calendar_webhook(webhook: CalendarWebhook, secret: str | None = None) -> dict[str, Any]:
    return {
        "id": webhook.id,
        "label": webhook.label,
        "target_url": webhook.target_url,
        "event_types": list(webhook.event_types or []),
        "is_active": bool(webhook.is_active),
        "failure_count": webhook.failure_count or 0,
        "last_triggered_at": webhook.last_triggered_at,
        "created_at": webhook.created_at,
        "secret": secret,
    }


def _serialize_calendar_developer(
    calendar: OwnerCalendar,
    settings: CalendarSettings,
    db: Session,
) -> dict[str, Any]:
    api_keys = (
        db.query(CalendarApiKey)
        .filter(CalendarApiKey.calendar_id == calendar.id)
        .order_by(CalendarApiKey.created_at.desc())
        .all()
    )
    webhooks = (
        db.query(CalendarWebhook)
        .filter(CalendarWebhook.calendar_id == calendar.id)
        .order_by(CalendarWebhook.created_at.desc())
        .all()
    )
    developer_enabled = settings.plan_name == "plus"
    return {
        "calendar_id": calendar.id,
        "api_keys_enabled": developer_enabled,
        "webhooks_enabled": developer_enabled,
        "api_keys": [_serialize_calendar_api_key(api_key) for api_key in api_keys],
        "webhooks": [_serialize_calendar_webhook(webhook) for webhook in webhooks],
    }


def _serialize_calendar_send_limit(settings: CalendarSettings) -> dict[str, Any]:
    weekly_quota = _effective_send_quota(settings)
    used = int(settings.send_quota_used or 0)
    return {
        "weekly_quota": weekly_quota,
        "used": used,
        "remaining": max(weekly_quota - used, 0),
        "resets_on": _next_send_limit_reset_date(),
        "verification_status": settings.verification_status or "unverified",
        "usage_window_label": "This Week",
        "can_verify": settings.plan_name != "plus" and settings.verification_status != "verified",
    }


def _serialize_calendar_plan(settings: CalendarSettings) -> dict[str, Any]:
    is_plus = settings.plan_name == "plus"
    return {
        "plan_name": "plus" if is_plus else "free",
        "billing_cycle": "annual" if settings.billing_cycle == "annual" else "monthly",
        "price_per_month": 69.0 if is_plus else 0.0,
        "price_per_year": 690.0 if is_plus else 0.0,
        "included_admins": 5 if is_plus else 1,
        "additional_admin_price_per_month": 12.0,
        "api_and_zapier_access": is_plus,
        "priority_support": is_plus,
        "no_platform_fees": is_plus,
        "weekly_send_quota": _effective_send_quota(settings),
        "benefits": PLUS_PLAN_BENEFITS if is_plus else ["Create public calendars", "Host unlimited events"],
    }


def _serialize_calendar_settings_bundle(calendar: OwnerCalendar, db: Session) -> dict[str, Any]:
    settings = _ensure_calendar_settings(db, calendar.id)
    return {
        "calendar": _serialize_calendar(calendar, db),
        "options": _serialize_calendar_options(settings),
        "admins": _serialize_calendar_admins(calendar, settings, db),
        "tags": _serialize_calendar_tags(settings),
        "embed": _serialize_calendar_embed(calendar, settings),
        "developer": _serialize_calendar_developer(calendar, settings, db),
        "send_limit": _serialize_calendar_send_limit(settings),
        "plan": _serialize_calendar_plan(settings),
    }


def _generate_calendar_api_token() -> tuple[str, str, str]:
    token = f"evtcal_{secrets.token_urlsafe(24)}"
    return token, token[:12], token[-4:]


def _hash_secret(secret: str) -> str:
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


def _ensure_plus_plan(settings: CalendarSettings) -> None:
    if settings.plan_name != "plus":
        raise HTTPException(status_code=403, detail="Upgrade to Calendar Plus to access developer tools")


async def _ensure_owner_calendar(current_user: dict[str, Any], db: Session) -> OwnerCalendar:
    owner_id = uuid.UUID(str(current_user["user_id"]))
    default_calendar = (
        db.query(OwnerCalendar)
        .filter(OwnerCalendar.owner_id == owner_id, OwnerCalendar.is_default == True)  # noqa: E712
        .first()
    )
    if default_calendar:
        return default_calendar

    existing_calendar = (
        db.query(OwnerCalendar)
        .filter(OwnerCalendar.owner_id == owner_id)
        .order_by(OwnerCalendar.created_at.asc())
        .first()
    )
    if existing_calendar:
        existing_calendar.is_default = True
        db.commit()
        db.refresh(existing_calendar)
        return existing_calendar

    profile = await _fetch_user_profile(current_user["user_id"])
    display_name = profile.get("name") or "Personal Calendar"

    calendar = OwnerCalendar(
        owner_id=owner_id,
        name=display_name,
        slug=_build_unique_calendar_slug(db, display_name),
        description=f"Events hosted by {display_name}.",
        tint_color="#0e7678",
        location_scope="global",
        city="",
        cover_image="",
        subscriber_count=1,
        is_default=True,
    )
    db.add(calendar)
    db.flush()
    _ensure_calendar_settings(db, calendar.id)
    db.commit()
    db.refresh(calendar)
    return calendar


def _normalize_speakers(raw_speakers: Iterable[Any] | None) -> list[dict[str, Any]]:
    speakers: list[dict[str, Any]] = []
    for speaker in raw_speakers or []:
        if hasattr(speaker, "model_dump"):
            speakers.append(speaker.model_dump())
        elif isinstance(speaker, dict):
            speakers.append(speaker)
    return speakers


def _normalize_integrations(raw_integrations: Iterable[Any] | None) -> list[dict[str, Any]]:
    integrations: list[dict[str, Any]] = []
    for integration in raw_integrations or []:
        if hasattr(integration, "model_dump"):
            integrations.append(integration.model_dump())
        elif isinstance(integration, dict):
            integrations.append(integration)
    return integrations


def _load_settings(db: Session, event_id) -> EventSettings:
    settings = db.query(EventSettings).filter(EventSettings.event_id == event_id).first()
    if settings:
        return settings
    return EventSettings(
        event_id=event_id,
        speakers=[],
        agenda=[],
        integrations=[],
        community_enabled=True,
        public_guest_list=True,
        collect_feedback=False,
    )


def _ticket_metrics(db: Session, event: Event) -> dict[str, Any]:
    base_query = db.query(Ticket).filter(Ticket.event_id == event.id)

    total_tickets = base_query.count()
    confirmed_count = base_query.filter(Ticket.status.in_(CONFIRMED_STATUSES)).count()
    reserved_count = base_query.filter(Ticket.status.in_(RESERVED_STATUSES)).count()
    waitlisted_count = base_query.filter(Ticket.status.in_(WAITLIST_STATUSES)).count()
    checked_in_count = base_query.filter(Ticket.checked_in == True).count()  # noqa: E712
    paid_confirmed_count = base_query.filter(
        Ticket.status.in_(CONFIRMED_STATUSES),
        Ticket.ticket_type == "paid",
        Ticket.payment_status == "completed",
    ).count()

    seats_left = 0
    if event.max_seats and event.max_seats > 0:
        seats_left = max(event.max_seats - reserved_count, 0)

    revenue = float(paid_confirmed_count) * float(event.ticket_price or 0)
    conversion_rate = 0.0
    if total_tickets:
        conversion_rate = round((confirmed_count / total_tickets) * 100, 2)

    return {
        "attendee_count": reserved_count,
        "confirmed_count": confirmed_count,
        "waitlisted_count": waitlisted_count,
        "checked_in_count": checked_in_count,
        "ticket_sales": revenue,
        "conversion_rate": conversion_rate,
        "seats_left": seats_left,
    }


def _serialize_event(event: Event, db: Session) -> dict[str, Any]:
    settings = _load_settings(db, event.id)
    metrics = _ticket_metrics(db, event)
    calendar = None
    if event.calendar_id:
        calendar = db.query(OwnerCalendar).filter(OwnerCalendar.id == event.calendar_id).first()

    return {
        "id": event.id,
        "title": event.title,
        "description": event.description,
        "date": event.date,
        "time": event.time,
        "location": event.location,
        "is_online": event.is_online,
        "cover_image": event.cover_image,
        "slug": event.slug,
        "host_id": event.host_id,
        "host_name": event.host_name,
        "host_image": event.host_image,
        "host_bio": event.host_bio,
        "is_paid": event.is_paid,
        "ticket_price": float(event.ticket_price or 0),
        "max_seats": event.max_seats or 0,
        "seats_left": metrics["seats_left"],
        "attendee_count": metrics["attendee_count"],
        "status": event.status,
        "calendar_id": event.calendar_id,
        "calendar_name": calendar.name if calendar else None,
        "calendar_slug": calendar.slug if calendar else None,
        "calendar_tint_color": calendar.tint_color if calendar else None,
        "community_enabled": settings.community_enabled,
        "public_guest_list": bool(settings.public_guest_list),
        "collect_feedback": bool(settings.collect_feedback),
        "speakers": settings.speakers or [],
        "agenda": settings.agenda or [],
        "integrations": settings.integrations or [],
        "confirmed_count": metrics["confirmed_count"],
        "waitlisted_count": metrics["waitlisted_count"],
        "checked_in_count": metrics["checked_in_count"],
        "ticket_sales": metrics["ticket_sales"],
        "conversion_rate": metrics["conversion_rate"],
        "share_url": f"{FRONTEND_URL.rstrip('/')}/events/{event.slug}",
        "created_at": event.created_at,
    }


async def _fetch_user_profile(user_id: str) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{USER_SERVICE_URL}/api/users/{user_id}")
            if response.status_code == 200:
                return response.json()
    except Exception:
        pass
    return {}


async def _send_update_notifications(db: Session, event: Event, message: str) -> int:
    tickets = (
        db.query(Ticket)
        .filter(Ticket.event_id == event.id, Ticket.status.in_(CONFIRMED_STATUSES))
        .order_by(Ticket.created_at.asc())
        .all()
    )

    if not tickets:
        return 0

    recipients = await asyncio.gather(*[_fetch_user_profile(str(ticket.user_id)) for ticket in tickets])
    sent = 0
    for profile in recipients:
        email = profile.get("email")
        if not email:
            continue
        name = profile.get("name") or "there"
        await send_event_update_email(
            email,
            name,
            event.title,
            message,
            f"{FRONTEND_URL.rstrip('/')}/events/{event.slug}",
        )
        sent += 1
    return sent


def _assert_host(event: Event, current_user: dict[str, Any]) -> None:
    if str(event.host_id) != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to manage this event")


@router.get("/calendars", response_model=list[CalendarResponse])
async def get_owner_calendars(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    owner_id = uuid.UUID(str(current_user["user_id"]))
    await _ensure_owner_calendar(current_user, db)
    calendars = (
        db.query(OwnerCalendar)
        .filter(OwnerCalendar.owner_id == owner_id)
        .order_by(OwnerCalendar.is_default.desc(), OwnerCalendar.created_at.asc())
        .all()
    )
    return [_serialize_calendar(calendar, db) for calendar in calendars]


@router.post("/calendars", response_model=CalendarResponse, status_code=201)
async def create_owner_calendar(
    payload: CalendarCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    owner_id = uuid.UUID(str(current_user["user_id"]))
    requested_slug = _slugify_value(payload.slug or payload.name)

    if payload.slug:
        existing = db.query(OwnerCalendar).filter(OwnerCalendar.slug == requested_slug).first()
        if existing:
            raise HTTPException(status_code=400, detail="Public URL is already in use")
        calendar_slug = requested_slug
    else:
        calendar_slug = _build_unique_calendar_slug(db, requested_slug)

    if payload.location_scope == "city" and not payload.city:
        raise HTTPException(status_code=400, detail="City is required for city calendars")

    is_first_calendar = db.query(OwnerCalendar).filter(OwnerCalendar.owner_id == owner_id).count() == 0
    calendar = OwnerCalendar(
        owner_id=owner_id,
        name=payload.name.strip(),
        slug=calendar_slug,
        description=(payload.description or "").strip(),
        tint_color=(payload.tint_color or "#0e7678").strip() or "#0e7678",
        location_scope=payload.location_scope,
        city=payload.city or "",
        cover_image=(payload.cover_image or "").strip(),
        subscriber_count=1,
        is_default=is_first_calendar,
    )
    db.add(calendar)
    db.flush()
    _ensure_calendar_settings(db, calendar.id)
    db.commit()
    db.refresh(calendar)
    return _serialize_calendar(calendar, db)


@router.get("/calendars/{slug}", response_model=CalendarResponse)
async def get_owner_calendar_by_slug(
    slug: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    calendar = db.query(OwnerCalendar).filter(OwnerCalendar.slug == slug).first()
    if not calendar:
        raise HTTPException(status_code=404, detail="Calendar not found")
    if str(calendar.owner_id) != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to view this calendar")
    return _serialize_calendar(calendar, db)


@router.put("/calendars/{slug}", response_model=CalendarResponse)
async def update_owner_calendar(
    slug: str,
    payload: CalendarUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    calendar = db.query(OwnerCalendar).filter(OwnerCalendar.slug == slug).first()
    if not calendar:
        raise HTTPException(status_code=404, detail="Calendar not found")
    if str(calendar.owner_id) != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to update this calendar")

    if payload.name is not None:
        calendar.name = payload.name

    if payload.description is not None:
        calendar.description = payload.description.strip()

    if payload.tint_color is not None:
        calendar.tint_color = (payload.tint_color or "#0e7678").strip() or "#0e7678"

    next_location_scope = payload.location_scope or calendar.location_scope or "global"
    next_city = calendar.city or ""
    if payload.city is not None:
        next_city = payload.city
    if next_location_scope == "city" and not next_city:
        raise HTTPException(status_code=400, detail="City is required for city calendars")
    calendar.location_scope = next_location_scope
    calendar.city = next_city if next_location_scope == "city" else ""

    if payload.cover_image is not None:
        calendar.cover_image = (payload.cover_image or "").strip()

    if payload.slug is not None:
        requested_slug = _slugify_value(payload.slug or calendar.name, fallback=_slugify_value(calendar.name))
        existing = (
            db.query(OwnerCalendar)
            .filter(OwnerCalendar.slug == requested_slug, OwnerCalendar.id != calendar.id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="Public URL is already in use")
        calendar.slug = requested_slug

    db.commit()
    db.refresh(calendar)
    return _serialize_calendar(calendar, db)


@router.get("/calendars/{slug}/events", response_model=list[EventResponse])
async def get_owner_calendar_events(
    slug: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    calendar = db.query(OwnerCalendar).filter(OwnerCalendar.slug == slug).first()
    if not calendar:
        raise HTTPException(status_code=404, detail="Calendar not found")
    if str(calendar.owner_id) != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to view this calendar")

    events = (
        db.query(Event)
        .filter(Event.calendar_id == calendar.id, Event.host_id == current_user["user_id"])
        .order_by(Event.date.asc())
        .all()
    )
    return [_serialize_event(event, db) for event in events]


@router.get("/calendars/{slug}/settings", response_model=CalendarSettingsResponse)
async def get_owner_calendar_settings(
    slug: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    calendar = _get_owned_calendar(slug, current_user, db)
    return _serialize_calendar_settings_bundle(calendar, db)


@router.put("/calendars/{slug}/settings/options", response_model=CalendarOptionsResponse)
async def update_owner_calendar_options(
    slug: str,
    payload: CalendarOptionsUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    calendar = _get_owned_calendar(slug, current_user, db)
    settings = _ensure_calendar_settings(db, calendar.id)

    if payload.event_visibility is not None:
        settings.event_visibility = payload.event_visibility
    if payload.public_guest_list is not None:
        settings.public_guest_list = payload.public_guest_list
    if payload.collect_feedback is not None:
        settings.collect_feedback = payload.collect_feedback
    if payload.tracking_google_enabled is not None:
        settings.tracking_google_enabled = payload.tracking_google_enabled
    if payload.tracking_meta_enabled is not None:
        settings.tracking_meta_enabled = payload.tracking_meta_enabled

    db.commit()
    db.refresh(settings)
    return _serialize_calendar_options(settings)


@router.get("/calendars/{slug}/settings/admins", response_model=CalendarAdminsResponse)
async def get_owner_calendar_admins(
    slug: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    calendar = _get_owned_calendar(slug, current_user, db)
    settings = _ensure_calendar_settings(db, calendar.id)
    return _serialize_calendar_admins(calendar, settings, db)


@router.put("/calendars/{slug}/settings/admins", response_model=CalendarAdminsResponse)
async def update_owner_calendar_admins(
    slug: str,
    payload: CalendarAdminsUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    calendar = _get_owned_calendar(slug, current_user, db)
    settings = _ensure_calendar_settings(db, calendar.id)

    if payload.team_enabled is not None:
        settings.team_enabled = payload.team_enabled

    db.commit()
    db.refresh(settings)
    return _serialize_calendar_admins(calendar, settings, db)


@router.post("/calendars/{slug}/settings/admins", response_model=CalendarAdminResponse, status_code=201)
async def create_owner_calendar_admin(
    slug: str,
    payload: CalendarAdminCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    calendar = _get_owned_calendar(slug, current_user, db)
    settings = _ensure_calendar_settings(db, calendar.id)

    current_admin_count = (
        db.query(CalendarAdmin)
        .filter(CalendarAdmin.calendar_id == calendar.id)
        .count()
    )
    if current_admin_count >= _admin_limit(settings):
        raise HTTPException(status_code=400, detail="Admin limit reached for the current plan")

    email = payload.email.lower().strip()
    existing_admin = (
        db.query(CalendarAdmin)
        .filter(CalendarAdmin.calendar_id == calendar.id, CalendarAdmin.email == email)
        .first()
    )
    if existing_admin:
        raise HTTPException(status_code=400, detail="Admin already added to this calendar")

    owner_user = db.query(User).filter(User.id == calendar.owner_id).first()
    if owner_user and owner_user.email.lower() == email:
        raise HTTPException(status_code=400, detail="Calendar owner is already an admin")

    invited_user = db.query(User).filter(User.email == email).first()
    admin = CalendarAdmin(
        calendar_id=calendar.id,
        user_id=invited_user.id if invited_user else None,
        email=email,
        role=payload.role,
        status="active" if invited_user else "pending",
        invited_by=uuid.UUID(str(current_user["user_id"])),
    )
    settings.team_enabled = True
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return _serialize_calendar_admin(admin)


@router.delete("/calendars/{slug}/settings/admins/{admin_id}", response_model=CalendarAdminsResponse)
async def delete_owner_calendar_admin(
    slug: str,
    admin_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    calendar = _get_owned_calendar(slug, current_user, db)
    settings = _ensure_calendar_settings(db, calendar.id)

    admin = (
        db.query(CalendarAdmin)
        .filter(CalendarAdmin.calendar_id == calendar.id, CalendarAdmin.id == admin_id)
        .first()
    )
    if not admin:
        raise HTTPException(status_code=404, detail="Calendar admin not found")

    db.delete(admin)
    db.commit()
    return _serialize_calendar_admins(calendar, settings, db)


@router.get("/calendars/{slug}/settings/tags", response_model=CalendarTagsResponse)
async def get_owner_calendar_tags(
    slug: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    calendar = _get_owned_calendar(slug, current_user, db)
    settings = _ensure_calendar_settings(db, calendar.id)
    return _serialize_calendar_tags(settings)


@router.put("/calendars/{slug}/settings/tags", response_model=CalendarTagsResponse)
async def update_owner_calendar_tags(
    slug: str,
    payload: CalendarTagsUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    calendar = _get_owned_calendar(slug, current_user, db)
    settings = _ensure_calendar_settings(db, calendar.id)
    settings.tags = payload.tags
    db.commit()
    db.refresh(settings)
    return _serialize_calendar_tags(settings)


@router.get("/calendars/{slug}/settings/embed", response_model=CalendarEmbedResponse)
async def get_owner_calendar_embed_settings(
    slug: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    calendar = _get_owned_calendar(slug, current_user, db)
    settings = _ensure_calendar_settings(db, calendar.id)
    return _serialize_calendar_embed(calendar, settings)


@router.put("/calendars/{slug}/settings/embed", response_model=CalendarEmbedResponse)
async def update_owner_calendar_embed_settings(
    slug: str,
    payload: CalendarEmbedUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    calendar = _get_owned_calendar(slug, current_user, db)
    settings = _ensure_calendar_settings(db, calendar.id)

    if payload.enabled is not None:
        settings.embed_enabled = payload.enabled
    if payload.width is not None:
        settings.embed_width = payload.width
    if payload.height is not None:
        settings.embed_height = payload.height
    if payload.theme is not None:
        settings.embed_theme = payload.theme
    if payload.default_view is not None:
        settings.embed_default_view = payload.default_view

    db.commit()
    db.refresh(settings)
    return _serialize_calendar_embed(calendar, settings)


@router.get("/calendars/{slug}/settings/developer", response_model=CalendarDeveloperResponse)
async def get_owner_calendar_developer_settings(
    slug: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    calendar = _get_owned_calendar(slug, current_user, db)
    settings = _ensure_calendar_settings(db, calendar.id)
    return _serialize_calendar_developer(calendar, settings, db)


@router.post(
    "/calendars/{slug}/settings/developer/api-keys",
    response_model=CalendarApiKeyResponse,
    status_code=201,
)
async def create_owner_calendar_api_key(
    slug: str,
    payload: CalendarApiKeyCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    calendar = _get_owned_calendar(slug, current_user, db)
    settings = _ensure_calendar_settings(db, calendar.id)
    _ensure_plus_plan(settings)

    token, key_prefix, last_four = _generate_calendar_api_token()
    api_key = CalendarApiKey(
        calendar_id=calendar.id,
        name=payload.name,
        key_prefix=key_prefix,
        last_four=last_four,
        secret_hash=_hash_secret(token),
        revoked=False,
    )
    db.add(api_key)
    db.commit()
    db.refresh(api_key)
    return _serialize_calendar_api_key(api_key, token=token)


@router.delete(
    "/calendars/{slug}/settings/developer/api-keys/{key_id}",
    response_model=CalendarDeveloperResponse,
)
async def revoke_owner_calendar_api_key(
    slug: str,
    key_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    calendar = _get_owned_calendar(slug, current_user, db)
    settings = _ensure_calendar_settings(db, calendar.id)
    _ensure_plus_plan(settings)

    api_key = (
        db.query(CalendarApiKey)
        .filter(CalendarApiKey.calendar_id == calendar.id, CalendarApiKey.id == key_id)
        .first()
    )
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")

    api_key.revoked = True
    db.commit()
    return _serialize_calendar_developer(calendar, settings, db)


@router.post(
    "/calendars/{slug}/settings/developer/webhooks",
    response_model=CalendarWebhookResponse,
    status_code=201,
)
async def create_owner_calendar_webhook(
    slug: str,
    payload: CalendarWebhookCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    calendar = _get_owned_calendar(slug, current_user, db)
    settings = _ensure_calendar_settings(db, calendar.id)
    _ensure_plus_plan(settings)

    secret = (payload.secret or secrets.token_hex(16)).strip()
    webhook = CalendarWebhook(
        calendar_id=calendar.id,
        label=payload.label,
        target_url=str(payload.target_url),
        event_types=list(payload.event_types or WEBHOOK_EVENT_TYPES[:2]),
        secret_token=secret,
        is_active=payload.is_active,
        failure_count=0,
    )
    db.add(webhook)
    db.commit()
    db.refresh(webhook)
    return _serialize_calendar_webhook(webhook, secret=secret)


@router.patch(
    "/calendars/{slug}/settings/developer/webhooks/{webhook_id}",
    response_model=CalendarWebhookResponse,
)
async def update_owner_calendar_webhook(
    slug: str,
    webhook_id: str,
    payload: CalendarWebhookUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    calendar = _get_owned_calendar(slug, current_user, db)
    settings = _ensure_calendar_settings(db, calendar.id)
    _ensure_plus_plan(settings)

    webhook = (
        db.query(CalendarWebhook)
        .filter(CalendarWebhook.calendar_id == calendar.id, CalendarWebhook.id == webhook_id)
        .first()
    )
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    if payload.label is not None:
        webhook.label = payload.label
    if payload.target_url is not None:
        webhook.target_url = str(payload.target_url)
    if payload.event_types is not None:
        webhook.event_types = list(payload.event_types)
    if payload.secret is not None:
        webhook.secret_token = payload.secret.strip()
    if payload.is_active is not None:
        webhook.is_active = payload.is_active

    db.commit()
    db.refresh(webhook)
    return _serialize_calendar_webhook(webhook)


@router.delete(
    "/calendars/{slug}/settings/developer/webhooks/{webhook_id}",
    response_model=CalendarDeveloperResponse,
)
async def delete_owner_calendar_webhook(
    slug: str,
    webhook_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    calendar = _get_owned_calendar(slug, current_user, db)
    settings = _ensure_calendar_settings(db, calendar.id)
    _ensure_plus_plan(settings)

    webhook = (
        db.query(CalendarWebhook)
        .filter(CalendarWebhook.calendar_id == calendar.id, CalendarWebhook.id == webhook_id)
        .first()
    )
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    db.delete(webhook)
    db.commit()
    return _serialize_calendar_developer(calendar, settings, db)


@router.get("/calendars/{slug}/settings/send-limit", response_model=CalendarSendLimitResponse)
async def get_owner_calendar_send_limit(
    slug: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    calendar = _get_owned_calendar(slug, current_user, db)
    settings = _ensure_calendar_settings(db, calendar.id)
    return _serialize_calendar_send_limit(settings)


@router.post("/calendars/{slug}/settings/send-limit/verify", response_model=CalendarSendLimitResponse)
async def verify_owner_calendar_send_limit(
    slug: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    calendar = _get_owned_calendar(slug, current_user, db)
    settings = _ensure_calendar_settings(db, calendar.id)
    settings.verification_status = "verified"
    db.commit()
    db.refresh(settings)
    return _serialize_calendar_send_limit(settings)


@router.post("/calendars/{slug}/settings/send-limit/usage", response_model=CalendarSendLimitResponse)
async def increment_owner_calendar_send_limit_usage(
    slug: str,
    payload: CalendarSendLimitIncrement,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    calendar = _get_owned_calendar(slug, current_user, db)
    settings = _ensure_calendar_settings(db, calendar.id)

    weekly_quota = _effective_send_quota(settings)
    next_used = int(settings.send_quota_used or 0) + payload.count
    if next_used > weekly_quota:
        raise HTTPException(status_code=400, detail="Weekly send limit exceeded")

    settings.send_quota_used = next_used
    db.commit()
    db.refresh(settings)
    return _serialize_calendar_send_limit(settings)


@router.get("/calendars/{slug}/settings/plan", response_model=CalendarPlanResponse)
async def get_owner_calendar_plan(
    slug: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    calendar = _get_owned_calendar(slug, current_user, db)
    settings = _ensure_calendar_settings(db, calendar.id)
    return _serialize_calendar_plan(settings)


@router.put("/calendars/{slug}/settings/plan", response_model=CalendarPlanResponse)
async def update_owner_calendar_plan(
    slug: str,
    payload: CalendarPlanUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    calendar = _get_owned_calendar(slug, current_user, db)
    settings = _ensure_calendar_settings(db, calendar.id)

    if payload.plan_name is not None:
        settings.plan_name = payload.plan_name
    if payload.billing_cycle is not None:
        settings.billing_cycle = payload.billing_cycle

    db.commit()
    db.refresh(settings)
    return _serialize_calendar_plan(settings)


@router.post("", response_model=EventResponse, status_code=201, include_in_schema=False)
@router.post("/", response_model=EventResponse, status_code=201)
async def create_event(
    payload: EventCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    host_profile = await _fetch_user_profile(current_user["user_id"])
    if payload.calendar_id:
        selected_calendar = (
            db.query(OwnerCalendar)
            .filter(OwnerCalendar.id == payload.calendar_id)
            .first()
        )
        if not selected_calendar:
            raise HTTPException(status_code=404, detail="Calendar not found")
        if str(selected_calendar.owner_id) != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Not authorized to use this calendar")
    else:
        selected_calendar = await _ensure_owner_calendar(current_user, db)

    calendar_settings = _ensure_calendar_settings(db, selected_calendar.id)
    event = Event(
        title=payload.title,
        description=payload.description,
        date=payload.date,
        time=payload.time,
        location=payload.location,
        is_online=payload.is_online,
        cover_image=payload.cover_image or DEFAULT_EVENT_COVER,
        slug=generate_slug(payload.title),
        calendar_id=selected_calendar.id,
        host_id=current_user["user_id"],
        host_name=host_profile.get("name") or "Event Host",
        host_image=host_profile.get("profile_image", "") or "",
        host_bio=host_profile.get("bio", "") or "",
        is_paid=payload.is_paid,
        ticket_price=payload.ticket_price or 0,
        max_seats=payload.max_seats or 0,
        seats_left=payload.max_seats or 0,
        attendee_count=0,
        status=payload.status or _default_calendar_visibility_status(calendar_settings),
    )
    db.add(event)
    db.flush()

    settings = EventSettings(
        event_id=event.id,
        speakers=_normalize_speakers(payload.speakers),
        agenda=list(payload.agenda or []),
        integrations=_normalize_integrations(payload.integrations),
        community_enabled=payload.community_enabled,
        public_guest_list=(
            payload.public_guest_list
            if payload.public_guest_list is not None
            else bool(calendar_settings.public_guest_list)
        ),
        collect_feedback=(
            payload.collect_feedback
            if payload.collect_feedback is not None
            else bool(calendar_settings.collect_feedback)
        ),
    )
    db.add(settings)
    db.commit()
    db.refresh(event)

    background_tasks.add_task(
        publish_event,
        TOPICS["EVENT_CREATED"],
        {
            "event_id": str(event.id),
            "title": event.title,
            "host_id": str(event.host_id),
        },
    )

    # Send host confirmation email (best-effort)
    host_email = host_profile.get("email")
    if host_email:
        ticket_summary = (
            f"Paid registration / Rs {float(event.ticket_price or 0):g}"
            if event.is_paid
            else "Free registration"
        )
        capacity_summary = f"{event.max_seats} seats" if event.max_seats else "Unlimited seats"
        background_tasks.add_task(
            send_event_creation_confirmation,
            host_email,
            host_profile.get("name") or "Host",
            event.title,
            event.date.strftime("%b %d, %Y"),
            event.time,
            event.location or ("Online event" if event.is_online else "Venue to be announced"),
            f"{FRONTEND_URL.rstrip('/')}/manage/{event.slug}",
            event.description,
            ticket_summary,
            capacity_summary,
            (event.status or "published").title(),
        )

    return _serialize_event(event, db)


@router.get("", response_model=list[EventResponse], include_in_schema=False)
@router.get("/", response_model=list[EventResponse])
def get_events(db: Session = Depends(get_db)):
    events = (
        db.query(Event)
        .filter(Event.status == "published")
        .order_by(Event.date.asc())
        .all()
    )
    return [_serialize_event(event, db) for event in events]


@router.get("/my-events", response_model=list[EventResponse])
def get_my_events(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    events = (
        db.query(Event)
        .filter(Event.host_id == current_user["user_id"])
        .order_by(Event.created_at.desc())
        .all()
    )
    return [_serialize_event(event, db) for event in events]


@router.get("/id/{event_id}", response_model=EventResponse)
def get_event_by_id(event_id: str, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return _serialize_event(event, db)


@router.get("/{slug}/community", response_model=CommunityResponse)
async def get_event_community(slug: str, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.slug == slug).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    settings = _load_settings(db, event.id)
    attendees: list[CommunityMember] = []
    if settings.public_guest_list:
        tickets = (
            db.query(Ticket)
            .filter(Ticket.event_id == event.id, Ticket.status.in_(CONFIRMED_STATUSES))
            .order_by(Ticket.created_at.asc())
            .limit(8)
            .all()
        )

        attendee_profiles = await asyncio.gather(*[_fetch_user_profile(str(ticket.user_id)) for ticket in tickets])
        for ticket, profile in zip(tickets, attendee_profiles, strict=False):
            attendees.append(
                CommunityMember(
                    id=ticket.id,
                    ticket_ref=ticket.ticket_ref,
                    status=ticket.status,
                    name=profile.get("name") or "Event Guest",
                    bio=profile.get("bio", "") or "",
                    profile_image=profile.get("profile_image", "") or "",
                    links=profile.get("links", []) if isinstance(profile.get("links"), list) else [],
                )
            )

    confirmed_count = (
        db.query(Ticket)
        .filter(Ticket.event_id == event.id, Ticket.status.in_(CONFIRMED_STATUSES))
        .count()
    )
    waitlisted_count = (
        db.query(Ticket)
        .filter(Ticket.event_id == event.id, Ticket.status == "waitlisted")
        .count()
    )
    checked_in_count = (
        db.query(Ticket)
        .filter(Ticket.event_id == event.id, Ticket.checked_in == True)  # noqa: E712
        .count()
    )

    return CommunityResponse(
        event_id=event.id,
        event_slug=event.slug,
        community_enabled=settings.community_enabled,
        speakers=settings.speakers or [],
        attendees=attendees,
        confirmed_count=confirmed_count,
        waitlisted_count=waitlisted_count,
        checked_in_count=checked_in_count,
    )


@router.get("/manage/{slug}", response_model=EventResponse)
def get_manage_event_by_slug(
    slug: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = db.query(Event).filter(Event.slug == slug).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    _assert_host(event, current_user)
    return _serialize_event(event, db)


@router.get("/{slug}", response_model=EventResponse)
def get_event_by_slug(slug: str, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.slug == slug).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return _serialize_event(event, db)


@router.get("/admin/all", response_model=list[EventResponse])
def admin_all_events(
    current_user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Admin view: return all events regardless of status."""
    events = db.query(Event).order_by(Event.created_at.desc()).all()
    return [_serialize_event(event, db) for event in events]


@router.get("/admin/stats")
def admin_stats(
    current_user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Aggregated metrics for admin dashboard."""
    events_q = db.query(Event)
    total_events = events_q.count()
    published_events = events_q.filter(Event.status == "published").count()

    tickets_q = db.query(Ticket)
    total_tickets = tickets_q.count()
    confirmed = tickets_q.filter(Ticket.status == "confirmed").count()
    waitlisted = tickets_q.filter(Ticket.status == "waitlisted").count()
    pending_payment = tickets_q.filter(Ticket.payment_status != "completed").count()
    payments_completed = tickets_q.filter(Ticket.payment_status == "completed").count()

    return {
        "total_events": total_events,
        "published_events": published_events,
        "total_tickets": total_tickets,
        "confirmed_tickets": confirmed,
        "waitlisted_tickets": waitlisted,
        "payments_completed": payments_completed,
        "payments_pending": pending_payment,
    }


@router.put("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: str,
    payload: EventUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    _assert_host(event, current_user)

    updates = payload.model_dump(
        exclude_unset=True,
        exclude={
            "speakers",
            "agenda",
            "integrations",
            "community_enabled",
            "public_guest_list",
            "collect_feedback",
            "broadcast_message",
            "calendar_id",
        },
    )
    for field, value in updates.items():
        if field == "cover_image" and not value:
            value = DEFAULT_EVENT_COVER
        setattr(event, field, value)

    if payload.calendar_id is not None:
        selected_calendar = (
            db.query(OwnerCalendar)
            .filter(OwnerCalendar.id == payload.calendar_id)
            .first()
        )
        if not selected_calendar:
            raise HTTPException(status_code=404, detail="Calendar not found")
        if str(selected_calendar.owner_id) != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Not authorized to use this calendar")
        event.calendar_id = selected_calendar.id

    settings = db.query(EventSettings).filter(EventSettings.event_id == event.id).first()
    if not settings:
        settings = EventSettings(
            event_id=event.id,
            speakers=[],
            agenda=[],
            integrations=[],
            community_enabled=True,
            public_guest_list=True,
            collect_feedback=False,
        )
        db.add(settings)

    if payload.speakers is not None:
        settings.speakers = _normalize_speakers(payload.speakers)
    if payload.agenda is not None:
        settings.agenda = list(payload.agenda)
    if payload.integrations is not None:
        settings.integrations = _normalize_integrations(payload.integrations)
    if payload.community_enabled is not None:
        settings.community_enabled = payload.community_enabled
    if payload.public_guest_list is not None:
        settings.public_guest_list = payload.public_guest_list
    if payload.collect_feedback is not None:
        settings.collect_feedback = payload.collect_feedback

    if payload.max_seats is not None:
        reserved_count = (
            db.query(Ticket)
            .filter(Ticket.event_id == event.id, Ticket.status.in_(RESERVED_STATUSES))
            .count()
        )
        event.seats_left = 0 if payload.max_seats == 0 else max(payload.max_seats - reserved_count, 0)

    db.commit()
    db.refresh(event)

    if getattr(payload, "broadcast_message", None):
        await _send_update_notifications(db, event, payload.broadcast_message)

    return _serialize_event(event, db)


@router.delete("/{event_id}")
def delete_event(
    event_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    _assert_host(event, current_user)

    db.delete(event)
    db.commit()
    return {"success": True, "message": "Event deleted"}


@router.get("/analytics/overview", response_model=AnalyticsOverviewResponse)
def analytics_overview(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    events = (
        db.query(Event)
        .filter(Event.host_id == current_user["user_id"])
        .order_by(Event.created_at.desc())
        .all()
    )

    items: list[AnalyticsEventItem] = []
    totals = {
        "total_events": len(events),
        "published_events": 0,
        "total_reservations": 0,
        "confirmed_count": 0,
        "waitlisted_count": 0,
        "checked_in_count": 0,
        "ticket_sales": 0.0,
        "conversion_rate": 0.0,
    }

    for event in events:
        metrics = _ticket_metrics(db, event)
        if event.status == "published":
            totals["published_events"] += 1
        totals["total_reservations"] += metrics["attendee_count"]
        totals["confirmed_count"] += metrics["confirmed_count"]
        totals["waitlisted_count"] += metrics["waitlisted_count"]
        totals["checked_in_count"] += metrics["checked_in_count"]
        totals["ticket_sales"] += metrics["ticket_sales"]

        items.append(
            AnalyticsEventItem(
                id=event.id,
                slug=event.slug,
                title=event.title,
                date=event.date,
                is_paid=event.is_paid,
                ticket_price=float(event.ticket_price or 0),
                max_seats=event.max_seats or 0,
                seats_left=metrics["seats_left"],
                reserved_count=metrics["attendee_count"],
                confirmed_count=metrics["confirmed_count"],
                waitlisted_count=metrics["waitlisted_count"],
                checked_in_count=metrics["checked_in_count"],
                ticket_sales=metrics["ticket_sales"],
                conversion_rate=metrics["conversion_rate"],
            )
        )

    if totals["total_reservations"]:
        totals["conversion_rate"] = round(
            (totals["confirmed_count"] / totals["total_reservations"]) * 100, 2
        )

    return AnalyticsOverviewResponse(events=items, **totals)
