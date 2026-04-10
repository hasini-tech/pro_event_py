"""
Payment Service routes.
Creates Stripe checkout sessions, handles webhooks, and supports refunds.
"""

from __future__ import annotations

import os
import uuid
from typing import Any

import httpx
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

import sys
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from event_service.models import Event
from shared.auth import get_current_user
from shared.database import get_db
from shared.email_service import send_refund_notification
from shared.kafka_client import publish_event, TOPICS
from ticket_service.models import Ticket

from .models import Payment
from .schemas import CreateSessionRequest, PaymentResponse

router = APIRouter()

STRIPE_SECRET = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
USER_SERVICE_URL = os.getenv("USER_SERVICE_URL", "http://127.0.0.1:8001")
ATTENDEE_SERVICE_URL = os.getenv("ATTENDEE_SERVICE_URL", "http://127.0.0.1:8005")

stripe.api_key = STRIPE_SECRET


async def _sync_attendee_snapshot(ticket: Ticket, profile: dict[str, Any] | None = None) -> None:
    """Best-effort attendee sync that does not rely on Kafka."""
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
        return


@router.post("/create-session")
async def create_checkout_session(
    payload: CreateSessionRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = db.query(Event).filter(Event.id == payload.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    ticket = (
        db.query(Ticket)
        .filter(
            Ticket.ticket_ref == payload.ticket_ref,
            Ticket.user_id == current_user["user_id"],
            Ticket.event_id == payload.event_id,
        )
        .first()
    )
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found for this event")
    if ticket.status == "waitlisted":
        raise HTTPException(status_code=400, detail="Waitlisted tickets cannot be paid until approved")

    existing_payment = (
        db.query(Payment)
        .filter(Payment.ticket_ref == payload.ticket_ref, Payment.user_id == current_user["user_id"])
        .first()
    )
    if existing_payment and existing_payment.status == "succeeded":
        return {"success": True, "url": f"{FRONTEND_URL}/payment-success?session_id={existing_payment.stripe_session_id or f'dev_{ticket.ticket_ref}'}"}

    dev_mode = not STRIPE_SECRET or "your_stripe" in STRIPE_SECRET
    if dev_mode:
        session_id = f"dev_{payload.ticket_ref}_{uuid.uuid4().hex[:8]}"
        payment = Payment(
            user_id=current_user["user_id"],
            ticket_ref=payload.ticket_ref,
            event_id=payload.event_id,
            stripe_session_id=session_id,
            stripe_intent_id=f"dev_intent_{payload.ticket_ref}",
            amount=float(event.ticket_price or payload.amount),
            status="succeeded",
        )
        db.add(payment)

        ticket.status = "confirmed"
        ticket.payment_status = "completed"
        ticket.ticket_type = "paid"
        db.commit()
        db.refresh(ticket)

        profile_data: dict[str, Any] = {}
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                profile = await client.get(f"{USER_SERVICE_URL}/api/users/{ticket.user_id}")
                profile_data = profile.json() if profile.status_code == 200 else {}
        except Exception:
            profile_data = {}

        await _sync_attendee_snapshot(ticket, profile_data)

        return {"success": True, "url": f"{FRONTEND_URL}/payment-success?session_id={session_id}"}

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": "usd",
                        "product_data": {
                            "name": event.title,
                            "description": f"Ticket Ref: {payload.ticket_ref}",
                        },
                        "unit_amount": int(float(event.ticket_price or payload.amount) * 100),
                    },
                    "quantity": 1,
                }
            ],
            mode="payment",
            success_url=f"{FRONTEND_URL}/payment-success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{FRONTEND_URL}/payment-failed",
            metadata={
                "ticket_ref": payload.ticket_ref,
                "event_id": payload.event_id,
                "user_id": current_user["user_id"],
            },
        )

        payment = Payment(
            user_id=current_user["user_id"],
            ticket_ref=payload.ticket_ref,
            event_id=payload.event_id,
            stripe_session_id=session.id,
            amount=float(event.ticket_price or payload.amount),
            status="pending",
        )
        db.add(payment)
        db.commit()

        return {"success": True, "url": session.url}

    except stripe.StripeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except stripe.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid Stripe signature")
    except Exception:
        event = {"type": request.headers.get("x-stripe-event", ""), "data": {"object": {}}}

    if event["type"] == "checkout.session.completed":
        session_obj = event.get("data", {}).get("object", {})
        metadata = session_obj.get("metadata", {})
        ticket_ref = metadata.get("ticket_ref")
        event_id = metadata.get("event_id")
        user_id = metadata.get("user_id")
        amount_total = float(session_obj.get("amount_total", 0)) / 100

        payment = db.query(Payment).filter(Payment.stripe_session_id == session_obj.get("id")).first()
        if payment:
            payment.status = "succeeded"
            payment.stripe_intent_id = session_obj.get("payment_intent")
            db.commit()

        ticket = db.query(Ticket).filter(Ticket.ticket_ref == ticket_ref).first() if ticket_ref else None
        profile = {}
        if ticket:
            ticket.status = "confirmed"
            ticket.payment_status = "completed"
            ticket.ticket_type = "paid"
            if not ticket.qr_code:
                ticket.qr_code = ""
            db.commit()
            db.refresh(ticket)

            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    profile_resp = await client.get(f"{USER_SERVICE_URL}/api/users/{ticket.user_id}")
                    if profile_resp.status_code == 200:
                        profile = profile_resp.json()
            except Exception:
                profile = {}

            await _sync_attendee_snapshot(ticket, profile)

        if ticket_ref:
            await publish_event(
                TOPICS["PAYMENT_SUCCESS"],
                {
                    "ticket_ref": ticket_ref,
                    "event_id": event_id,
                    "user_id": user_id,
                    "amount": amount_total,
                },
            )

    elif event["type"] == "checkout.session.expired":
        session_obj = event["data"]["object"]
        payment = db.query(Payment).filter(Payment.stripe_session_id == session_obj.get("id")).first()
        if payment:
            payment.status = "failed"
            db.commit()

        ticket_ref = session_obj.get("metadata", {}).get("ticket_ref")
        ticket = db.query(Ticket).filter(Ticket.ticket_ref == ticket_ref).first() if ticket_ref else None
        if ticket:
            ticket.status = "cancelled"
            ticket.payment_status = "failed"
            ticket.checked_in = False
            ticket.checked_in_at = None
            db.commit()
            db.refresh(ticket)
            await _sync_attendee_snapshot(ticket, {})

        await publish_event(
            TOPICS["PAYMENT_FAILED"],
            {"ticket_ref": ticket_ref},
        )

    return {"received": True}


@router.get("/my-payments")
def get_my_payments(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    payments = db.query(Payment).filter(Payment.user_id == current_user["user_id"]).all()
    return {"success": True, "data": [PaymentResponse.model_validate(p) for p in payments]}


@router.post("/refund/{ticket_ref}")
async def refund_payment(
    ticket_ref: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    payment = (
        db.query(Payment)
        .filter(Payment.ticket_ref == ticket_ref, Payment.user_id == current_user["user_id"])
        .first()
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    if payment.status == "refunded":
        return {"success": True, "message": "Payment already refunded"}

    ticket = db.query(Ticket).filter(Ticket.ticket_ref == ticket_ref).first()
    event = db.query(Event).filter(Event.id == payment.event_id).first()

    refund = None
    if STRIPE_SECRET and "your_stripe" not in STRIPE_SECRET and payment.stripe_intent_id:
        try:
            refund = stripe.Refund.create(payment_intent=payment.stripe_intent_id)
        except stripe.StripeError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    payment.status = "refunded"
    if ticket:
        ticket.status = "cancelled"
        ticket.payment_status = "refunded"
        ticket.checked_in = False
        ticket.checked_in_at = None
    db.commit()

    if ticket:
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
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                profile = await client.get(f"{USER_SERVICE_URL}/api/users/{current_user['user_id']}")
                profile_data = profile.json() if profile.status_code == 200 else {}
            await send_refund_notification(
                profile_data.get("email", ""),
                profile_data.get("name", "there"),
                event.title,
                f"${float(payment.amount or 0):.2f}",
            )
        except Exception:
            pass

    if ticket:
        await _sync_attendee_snapshot(ticket, profile_data if "profile_data" in locals() else {})

    return {
        "success": True,
        "message": "Refund processed",
        "refund_id": getattr(refund, "id", None),
    }


@router.get("/health")
def health():
    return {"status": "ok", "service": "payment-service"}
