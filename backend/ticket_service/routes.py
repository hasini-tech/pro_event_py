"""
Ticket Service routes.

This service owns RSVP / ticket records and exposes host management views.
It also notifies attendee-service through Kafka so attendee snapshots stay in sync.
"""

from __future__ import annotations

import asyncio
import base64
import os
import random
import string
from datetime import datetime, timezone
from io import BytesIO
from typing import Any

import httpx
import qrcode
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import sys
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from event_service.models import Event
from shared.auth import get_current_user
from shared.database import get_db
from shared.email_service import (
    send_rsvp_confirmation,
    send_ticket_confirmation,
    send_waitlist_notification,
)
from shared.kafka_client import publish_event, TOPICS
from .models import Ticket
from .schemas import TicketBook, TicketDetailResponse, TicketManage, TicketResponse

router = APIRouter()

USER_SERVICE_URL = os.getenv("USER_SERVICE_URL", "http://127.0.0.1:8001")
ATTENDEE_SERVICE_URL = os.getenv("ATTENDEE_SERVICE_URL", "http://127.0.0.1:8005")

ACTIVE_STATUSES = {"confirmed", "pending_payment", "pending_approval"}
FINAL_STATUSES = {"confirmed", "waitlisted", "cancelled", "rejected", "pending_payment", "pending_approval"}


def generate_ticket_ref() -> str:
    chars = "".join(random.choices(string.ascii_uppercase + string.digits, k=8))
    return f"EVTLY-{chars}"


def build_qr_code(ticket_ref: str, event_id: str, user_id: str) -> str:
    """Generate a QR code as a base64 data URL."""
    data = f"ticket:{ticket_ref}|event:{event_id}|user:{user_id}"
    img = qrcode.make(data)
    buf = BytesIO()
    img.save(buf, format="PNG")
    encoded = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/png;base64,{encoded}"


async def _fetch_user_profile(user_id: str) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{USER_SERVICE_URL}/api/users/{user_id}")
            if response.status_code == 200:
                return response.json()
    except Exception:
        pass
    return {}


async def _sync_attendee_snapshot(ticket: Ticket, event: Event, profile: dict[str, Any] | None = None) -> None:
    """Keep attendee-service in sync even when Kafka is unavailable."""
    payload = {
        "ticket_id": str(ticket.id),
        "event_id": str(ticket.event_id),
        "user_id": str(ticket.user_id),
        "ticket_ref": ticket.ticket_ref,
        "status": ticket.status,
        "ticket_type": ticket.ticket_type,
        "profile": profile or {},
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(f"{ATTENDEE_SERVICE_URL}/api/attendees/internal/on-ticket-purchased", json=payload)
    except Exception:
        # The Kafka consumer is still the primary sync path; this is a best-effort fallback.
        return


def _get_event(db: Session, event_id: str) -> Event | None:
    return db.query(Event).filter(Event.id == event_id).first()


def _reserved_count(db: Session, event_id: str) -> int:
    return (
        db.query(Ticket)
        .filter(Ticket.event_id == event_id, Ticket.status.in_(ACTIVE_STATUSES))
        .count()
    )


def _build_ticket_detail(ticket: Ticket, event: Event | None = None, profile: dict[str, Any] | None = None) -> dict[str, Any]:
    profile = profile or {}
    return {
        "id": ticket.id,
        "ticket_ref": ticket.ticket_ref,
        "event_id": ticket.event_id,
        "user_id": ticket.user_id,
        "status": ticket.status,
        "ticket_type": ticket.ticket_type,
        "payment_status": ticket.payment_status,
        "stripe_session_id": ticket.stripe_session_id,
        "qr_code": ticket.qr_code,
        "checked_in": ticket.checked_in,
        "checked_in_at": ticket.checked_in_at,
        "created_at": ticket.created_at,
        "event_title": event.title if event else "",
        "event_slug": event.slug if event else "",
        "event_date": event.date if event else None,
        "event_time": event.time if event else "",
        "event_location": event.location if event else "",
        "event_description": event.description if event else "",
        "event_cover_image": event.cover_image if event else "",
        "event_is_online": event.is_online if event else False,
        "event_status": event.status if event else "",
        "host_name": event.host_name if event else "",
        "user_name": profile.get("name") or "",
        "user_email": profile.get("email") or "",
        "user_bio": profile.get("bio", "") or "",
        "user_profile_image": profile.get("profile_image", "") or "",
        "user_links": profile.get("links", []) if isinstance(profile.get("links"), list) else [],
    }


async def _notify_user(profile: dict[str, Any], subject: str, body: str) -> None:
    # Emails are already handled by the shared templates in the more specific flows.
    # This helper exists so we can centralize future notification fallbacks.
    if not profile.get("email"):
        return


@router.post("/book", response_model=TicketResponse, status_code=201)
async def book_ticket(
    payload: TicketBook,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user["user_id"]
    event = _get_event(db, payload.event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    existing = (
        db.query(Ticket)
        .filter(
            Ticket.event_id == payload.event_id,
            Ticket.user_id == user_id,
            Ticket.status.notin_(["cancelled", "rejected"]),
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail="You already have a ticket or waitlist entry for this event",
        )

    reserved_count = _reserved_count(db, payload.event_id)
    sold_out = bool(event.max_seats and event.max_seats > 0 and reserved_count >= event.max_seats)

    ticket_type = "paid" if event.is_paid else "free"
    ticket_ref = generate_ticket_ref()
    if sold_out:
        status = "waitlisted"
        payment_status = "none"
        qr_code = ""
    elif event.is_paid:
        status = "pending_payment"
        payment_status = "pending"
        qr_code = build_qr_code(ticket_ref, payload.event_id, user_id)
    else:
        status = "confirmed"
        payment_status = "none"
        qr_code = build_qr_code(ticket_ref, payload.event_id, user_id)

    ticket = Ticket(
        ticket_ref=ticket_ref,
        event_id=payload.event_id,
        user_id=user_id,
        status=status,
        ticket_type=ticket_type,
        payment_status=payment_status,
        qr_code=qr_code if status != "waitlisted" else "",
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    await publish_event(
        TOPICS["TICKET_PURCHASED"],
        {
            "ticket_id": str(ticket.id),
            "ticket_ref": ticket.ticket_ref,
            "event_id": str(ticket.event_id),
            "user_id": str(ticket.user_id),
            "status": ticket.status,
            "ticket_type": ticket.ticket_type,
        },
    )

    profile = await _fetch_user_profile(user_id)
    user_name = profile.get("name") or "there"
    event_url = f"{os.getenv('FRONTEND_URL', 'http://localhost:3000').rstrip('/')}/events/{event.slug}"

    if ticket.status == "confirmed" and not event.is_paid:
        await send_ticket_confirmation(
            profile.get("email", ""),
            user_name,
            event.title,
            ticket.ticket_ref,
            ticket.qr_code or "",
        )
    elif ticket.status == "confirmed":
        await send_rsvp_confirmation(
            profile.get("email", ""),
            user_name,
            event.title,
            event.date.strftime("%B %d, %Y"),
            event.time,
            event_url,
        )
    elif ticket.status == "waitlisted":
        await send_waitlist_notification(
            profile.get("email", ""),
            user_name,
            event.title,
            event_url,
        )

    await _sync_attendee_snapshot(ticket, event, profile)

    return TicketResponse.model_validate(ticket)


@router.get("/by-ref/{ticket_ref}", response_model=TicketResponse)
def get_ticket_by_ref(ticket_ref: str, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.ticket_ref == ticket_ref).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return TicketResponse.model_validate(ticket)


@router.get("/my-tickets", response_model=list[TicketDetailResponse])
async def get_my_tickets(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tickets = (
        db.query(Ticket)
        .filter(Ticket.user_id == current_user["user_id"])
        .order_by(Ticket.created_at.desc())
        .all()
    )
    profile = await _fetch_user_profile(current_user["user_id"])
    details: list[dict[str, Any]] = []
    for ticket in tickets:
        event = _get_event(db, str(ticket.event_id))
        details.append(_build_ticket_detail(ticket, event, profile))
    return details


@router.get("/event/{event_id}", response_model=list[TicketDetailResponse])
async def get_event_tickets(
    event_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = _get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if str(event.host_id) != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to view this event")

    tickets = (
        db.query(Ticket)
        .filter(Ticket.event_id == event_id)
        .order_by(Ticket.created_at.desc())
        .all()
    )
    profiles = await asyncio.gather(*[_fetch_user_profile(str(ticket.user_id)) for ticket in tickets]) if tickets else []
    return [_build_ticket_detail(ticket, event, profile) for ticket, profile in zip(tickets, profiles, strict=False)]


@router.get("/event/{event_id}/summary")
def get_event_summary(
    event_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = _get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if str(event.host_id) != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to view this event")

    tickets = db.query(Ticket).filter(Ticket.event_id == event_id).all()
    confirmed = sum(1 for ticket in tickets if ticket.status == "confirmed")
    waitlisted = sum(1 for ticket in tickets if ticket.status == "waitlisted")
    checked_in = sum(1 for ticket in tickets if ticket.checked_in)
    paid = sum(1 for ticket in tickets if ticket.ticket_type == "paid" and ticket.status == "confirmed")
    reserved = sum(1 for ticket in tickets if ticket.status in ACTIVE_STATUSES)

    return {
        "event_id": str(event.id),
        "title": event.title,
        "slug": event.slug,
        "confirmed": confirmed,
        "waitlisted": waitlisted,
        "checked_in": checked_in,
        "ticket_sales": float(event.ticket_price or 0) * paid,
        "reserved": reserved,
    }


@router.put("/manage/{ticket_id}", response_model=TicketResponse)
async def manage_ticket(
    ticket_id: str,
    payload: TicketManage,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    event = _get_event(db, str(ticket.event_id))
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if str(event.host_id) != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to manage this ticket")

    previous_status = ticket.status
    ticket.status = payload.status
    if payload.status in {"cancelled", "rejected"}:
        ticket.checked_in = False
        ticket.checked_in_at = None
        ticket.payment_status = "failed" if ticket.payment_status == "pending" else ticket.payment_status
    if payload.status == "confirmed" and ticket.payment_status == "pending":
        ticket.payment_status = "completed"

    db.commit()
    db.refresh(ticket)

    await publish_event(
        TOPICS["TICKET_PURCHASED"],
        {
            "ticket_id": str(ticket.id),
            "ticket_ref": ticket.ticket_ref,
            "event_id": str(ticket.event_id),
            "user_id": str(ticket.user_id),
            "status": ticket.status,
            "ticket_type": ticket.ticket_type,
            "previous_status": previous_status,
        },
    )

    profile = await _fetch_user_profile(str(ticket.user_id))
    event_url = f"{os.getenv('FRONTEND_URL', 'http://localhost:3000').rstrip('/')}/events/{event.slug}"
    if ticket.status == "confirmed" and (ticket.ticket_type == "free" or ticket.payment_status == "completed"):
        await send_ticket_confirmation(
            profile.get("email", ""),
            profile.get("name", "there"),
            event.title,
            ticket.ticket_ref,
            ticket.qr_code or "",
        )
    elif ticket.status == "waitlisted":
        await send_waitlist_notification(
            profile.get("email", ""),
            profile.get("name", "there"),
            event.title,
            event_url,
        )

    await _sync_attendee_snapshot(ticket, event, profile)

    return TicketResponse.model_validate(ticket)


@router.put("/confirm-by-ref/{ticket_ref}", response_model=TicketResponse)
async def confirm_ticket_by_ref(ticket_ref: str, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.ticket_ref == ticket_ref).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    event = _get_event(db, str(ticket.event_id))
    ticket.status = "confirmed"
    ticket.payment_status = "completed"
    ticket.ticket_type = "paid"
    db.commit()
    db.refresh(ticket)

    await publish_event(
        TOPICS["TICKET_PURCHASED"],
        {
            "ticket_id": str(ticket.id),
            "ticket_ref": ticket.ticket_ref,
            "event_id": str(ticket.event_id),
            "user_id": str(ticket.user_id),
            "status": ticket.status,
            "ticket_type": ticket.ticket_type,
        },
    )

    if event:
        profile = await _fetch_user_profile(str(ticket.user_id))
        await send_ticket_confirmation(
            profile.get("email", ""),
            profile.get("name", "there"),
            event.title,
            ticket.ticket_ref,
            ticket.qr_code or "",
        )
        await _sync_attendee_snapshot(ticket, event, profile)

    return TicketResponse.model_validate(ticket)


@router.get("/health")
def health():
    return {"status": "ok", "service": "ticket-service"}
