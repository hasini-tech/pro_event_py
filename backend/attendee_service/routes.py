"""
Attendee Service routes.

This service stores attendee snapshots for community pages, exports, and check-in.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from event_service.models import Event
from shared.auth import get_current_user
from shared.database import get_db
from shared.kafka_client import publish_event, TOPICS
from ticket_service.models import Ticket
from .models import Attendee
from .schemas import (
    AttendeeResponse,
    CheckInRequest,
    HostStatsResponse,
    PublicCommunityResponse,
    TicketPurchasedPayload,
)

router = APIRouter()

TICKET_SERVICE_URL = os.getenv("TICKET_SERVICE_URL", "http://127.0.0.1:8003")
USER_SERVICE_URL = os.getenv("USER_SERVICE_URL", "http://127.0.0.1:8001")


async def _fetch_user_profile(user_id: str) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{USER_SERVICE_URL}/api/users/{user_id}")
            if response.status_code == 200:
                return response.json()
    except Exception:
        pass
    return {}


async def _get_ticket_by_ref(ticket_ref: str) -> dict[str, Any] | None:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{TICKET_SERVICE_URL}/api/tickets/by-ref/{ticket_ref}")
            if resp.status_code != 200:
                return None
            return resp.json()
    except Exception:
        return None


def _assert_host_for_event(event_id: str, current_user: dict[str, Any], db: Session) -> Event:
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if str(event.host_id) != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to manage this event")
    return event


def _build_attendee_response(attendee: Attendee) -> AttendeeResponse:
    return AttendeeResponse.model_validate(attendee)


@router.get("/health")
def health():
    return {"status": "ok", "service": "attendee-service"}


@router.get("/event/{event_id}", response_model=list[AttendeeResponse])
def get_attendees(
    event_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_host_for_event(event_id, current_user, db)
    attendees = (
        db.query(Attendee)
        .filter(Attendee.event_id == event_id)
        .order_by(Attendee.created_at.desc())
        .all()
    )
    return [_build_attendee_response(attendee) for attendee in attendees]


@router.get("/event/{event_id}/checked-in", response_model=list[AttendeeResponse])
def get_checked_in_attendees(
    event_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_host_for_event(event_id, current_user, db)
    attendees = (
        db.query(Attendee)
        .filter(Attendee.event_id == event_id, Attendee.checked_in == True)  # noqa: E712
        .order_by(Attendee.checked_in_at.asc())
        .all()
    )
    return [_build_attendee_response(attendee) for attendee in attendees]


@router.get("/public/event/{event_id}", response_model=PublicCommunityResponse)
def get_public_community(
    event_id: str,
    db: Session = Depends(get_db),
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    attendees = (
        db.query(Attendee)
        .filter(Attendee.event_id == event_id, Attendee.status == "confirmed")
        .order_by(Attendee.created_at.asc())
        .limit(8)
        .all()
    )
    waitlisted_count = (
        db.query(Attendee)
        .filter(Attendee.event_id == event_id, Attendee.status == "waitlisted")
        .count()
    )
    checked_in_count = (
        db.query(Attendee)
        .filter(Attendee.event_id == event_id, Attendee.checked_in == True)  # noqa: E712
        .count()
    )

    return PublicCommunityResponse(
        event_id=event.id,
        confirmed_count=db.query(Attendee).filter(Attendee.event_id == event_id, Attendee.status == "confirmed").count(),
        waitlisted_count=waitlisted_count,
        checked_in_count=checked_in_count,
        attendees=[_build_attendee_response(attendee) for attendee in attendees],
    )


@router.get("/{attendee_id}", response_model=AttendeeResponse)
def get_attendee(
    attendee_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    attendee = db.query(Attendee).filter(Attendee.id == attendee_id).first()
    if not attendee:
        raise HTTPException(status_code=404, detail="Attendee not found")
    _assert_host_for_event(str(attendee.event_id), current_user, db)
    return _build_attendee_response(attendee)


@router.post("/check-in")
async def check_in(
    payload: CheckInRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Check in an attendee using their ticket reference."""
    event = _assert_host_for_event(payload.event_id, current_user, db)
    ticket = await _get_ticket_by_ref(payload.ticket_ref)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    attendee = db.query(Attendee).filter(
        Attendee.event_id == payload.event_id,
        Attendee.ticket_id == ticket["id"],
    ).first()
    if not attendee:
        profile = await _fetch_user_profile(str(ticket["user_id"]))
        if ticket.get("status") != "confirmed":
            raise HTTPException(status_code=404, detail="Attendee record not found for this event")

        attendee = Attendee(
            event_id=payload.event_id,
            user_id=ticket["user_id"],
            ticket_id=ticket["id"],
            ticket_ref=ticket.get("ticket_ref", payload.ticket_ref),
            status=ticket.get("status", "confirmed"),
            ticket_type=ticket.get("ticket_type", "free"),
            name=profile.get("name") or "",
            bio=profile.get("bio", "") or "",
            profile_image=profile.get("profile_image", "") or "",
            links=profile.get("links", []) if isinstance(profile.get("links"), list) else [],
            checked_in=False,
            checked_in_at=None,
        )
        db.add(attendee)
        db.commit()
        db.refresh(attendee)

    if attendee.status != "confirmed":
        raise HTTPException(status_code=400, detail="Only confirmed attendees can be checked in")
    if attendee.checked_in:
        raise HTTPException(status_code=400, detail="Attendee already checked in")

    attendee.checked_in = True
    attendee.checked_in_at = datetime.now(timezone.utc)

    ticket_row = db.query(Ticket).filter(Ticket.id == ticket["id"]).first()
    if ticket_row:
        ticket_row.checked_in = True
        ticket_row.checked_in_at = attendee.checked_in_at

    db.commit()
    db.refresh(attendee)

    await publish_event(
        TOPICS["ATTENDEE_CHECKED_IN"],
        {
            "attendee_id": str(attendee.id),
            "event_id": str(attendee.event_id),
            "user_id": str(attendee.user_id),
            "ticket_ref": payload.ticket_ref,
            "checked_in_at": attendee.checked_in_at.isoformat(),
        },
    )

    return {
        "success": True,
        "message": "Attendee checked in successfully",
        "event_title": event.title,
        "attendee_id": str(attendee.id),
        "checked_in_at": attendee.checked_in_at.isoformat(),
    }


@router.post("/check-out")
async def check_out(
    payload: CheckInRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Undo a check-in."""
    _assert_host_for_event(payload.event_id, current_user, db)
    ticket = await _get_ticket_by_ref(payload.ticket_ref)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    attendee = db.query(Attendee).filter(
        Attendee.event_id == payload.event_id,
        Attendee.ticket_id == ticket["id"],
    ).first()
    if not attendee:
        raise HTTPException(status_code=404, detail="Attendee not found")

    if not attendee.checked_in:
        raise HTTPException(status_code=400, detail="Attendee is not checked in")

    attendee.checked_in = False
    attendee.checked_in_at = None

    ticket_row = db.query(Ticket).filter(Ticket.id == ticket["id"]).first()
    if ticket_row:
        ticket_row.checked_in = False
        ticket_row.checked_in_at = None

    db.commit()

    return {"success": True, "message": "Attendee checked out successfully"}


@router.get("/export/{event_id}")
def export_attendees(
    event_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export full attendee list as JSON (frontend can convert to CSV)."""
    _assert_host_for_event(event_id, current_user, db)
    attendees = (
        db.query(Attendee)
        .filter(Attendee.event_id == event_id)
        .order_by(Attendee.created_at.asc())
        .all()
    )
    data = [
        {
            "attendee_id": str(a.id),
            "user_id": str(a.user_id),
            "name": a.name,
            "bio": a.bio,
            "profile_image": a.profile_image,
            "links": a.links or [],
            "ticket_id": str(a.ticket_id),
            "ticket_ref": a.ticket_ref,
            "ticket_type": a.ticket_type,
            "status": a.status,
            "checked_in": a.checked_in,
            "checked_in_at": a.checked_in_at.isoformat() if a.checked_in_at else None,
            "registered_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in attendees
    ]
    return {"success": True, "data": data, "total": len(data)}


@router.get("/stats", response_model=HostStatsResponse)
def get_host_stats(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Aggregate attendee stats for the current host across all their events."""
    host_events = db.query(Event).filter(Event.host_id == current_user["user_id"]).all()
    event_ids = [event.id for event in host_events]
    attendees = db.query(Attendee).filter(Attendee.event_id.in_(event_ids)).all() if event_ids else []

    total = len(attendees)
    confirmed = [attendee for attendee in attendees if attendee.status == "confirmed"]
    waitlisted = [attendee for attendee in attendees if attendee.status == "waitlisted"]
    checked_in = sum(1 for attendee in attendees if attendee.checked_in)

    revenue = 0.0
    event_price_map = {str(event.id): float(event.ticket_price or 0) for event in host_events}
    for attendee in confirmed:
        if attendee.ticket_type == "paid":
            revenue += event_price_map.get(str(attendee.event_id), 0.0)

    return HostStatsResponse(
        total_events=len(host_events),
        total_attendees=total,
        confirmed_attendees=len(confirmed),
        waitlisted_attendees=len(waitlisted),
        checked_in_count=checked_in,
        total_revenue=revenue,
    )


@router.post("/internal/on-ticket-purchased")
async def on_ticket_purchased(
    payload: TicketPurchasedPayload,
    db: Session = Depends(get_db),
):
    """
    Called internally by the Kafka consumer when a ticket event fires.
    This upserts the attendee snapshot so community pages and exports stay fresh.
    """
    existing = db.query(Attendee).filter(Attendee.ticket_id == payload.ticket_id).first()

    profile = payload.profile or await _fetch_user_profile(str(payload.user_id))
    attendee_payload = {
        "event_id": payload.event_id,
        "user_id": payload.user_id,
        "ticket_id": payload.ticket_id,
        "ticket_ref": payload.ticket_ref or "",
        "status": payload.status,
        "ticket_type": payload.ticket_type,
        "name": profile.get("name") or "",
        "bio": profile.get("bio", "") or "",
        "profile_image": profile.get("profile_image", "") or "",
        "links": profile.get("links", []) if isinstance(profile.get("links"), list) else [],
    }

    if existing:
        for key, value in attendee_payload.items():
            setattr(existing, key, value)
        if payload.status != "confirmed":
            existing.checked_in = False
            existing.checked_in_at = None
        db.commit()
        db.refresh(existing)
        return {"ok": True, "message": "Attendee updated", "attendee_id": str(existing.id)}

    attendee = Attendee(**attendee_payload)
    if payload.status != "confirmed":
        attendee.checked_in = False
        attendee.checked_in_at = None
    db.add(attendee)
    db.commit()
    db.refresh(attendee)
    return {"ok": True, "attendee_id": str(attendee.id)}
