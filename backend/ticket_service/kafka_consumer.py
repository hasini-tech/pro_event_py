"""
Ticket Service Kafka consumer.

Listens for payment success/failure events and keeps ticket status in sync.
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from typing import Any

import httpx
from aiokafka.errors import KafkaConnectionError

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from shared.database import SessionLocal
from shared.email_service import send_ticket_confirmation
from shared.kafka_client import get_consumer, publish_event, TOPICS, wait_for_kafka_bootstrap
from event_service.models import Event
from .models import Ticket

logger = logging.getLogger(__name__)
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


async def consume_payment_events():
    """
    Listens for payment.success and payment.failed messages and updates the
    ticket lifecycle accordingly.
    """
    logger.info("Ticket Service Kafka consumer starting for payment updates")
    while True:
        consumer = None
        try:
            await wait_for_kafka_bootstrap("Ticket Service")
            consumer = await get_consumer(
                [TOPICS["PAYMENT_SUCCESS"], TOPICS["PAYMENT_FAILED"]],
                group_id="ticket-service-payments",
            )
            async for msg in consumer:
                data = msg.value or {}
                ticket_ref = data.get("ticket_ref")
                if not ticket_ref:
                    await consumer.commit()
                    continue

                db = SessionLocal()
                try:
                    ticket = db.query(Ticket).filter(Ticket.ticket_ref == ticket_ref).first()
                    if not ticket:
                        logger.warning("Ticket not found for ref %s", ticket_ref)
                        await consumer.commit()
                        continue

                    event = db.query(Event).filter(Event.id == ticket.event_id).first()
                    profile = await _fetch_user_profile(str(ticket.user_id))

                    if msg.topic == TOPICS["PAYMENT_SUCCESS"]:
                        ticket.status = "confirmed"
                        ticket.payment_status = "completed"
                        ticket.ticket_type = "paid"
                        db.commit()
                        db.refresh(ticket)

                        if event:
                            await send_ticket_confirmation(
                                profile.get("email", ""),
                                profile.get("name", "there"),
                                event.title,
                                ticket.ticket_ref,
                                ticket.qr_code or "",
                            )

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
                        logger.info("Confirmed ticket %s after payment", ticket_ref)

                    elif msg.topic == TOPICS["PAYMENT_FAILED"]:
                        ticket.status = "cancelled"
                        ticket.payment_status = "failed"
                        ticket.checked_in = False
                        ticket.checked_in_at = None
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
                        logger.info("Cancelled ticket %s after payment failure", ticket_ref)

                finally:
                    db.close()

                await consumer.commit()
        except KafkaConnectionError as exc:
            logger.warning("Ticket consumer lost Kafka connection: %s. Waiting for broker...", exc)
            await wait_for_kafka_bootstrap("Ticket Service")

        except Exception as exc:
            logger.error("Ticket consumer error: %s. Retrying in 5s...", exc)
            await asyncio.sleep(5)
        finally:
            if consumer:
                try:
                    await asyncio.shield(consumer.stop())
                except Exception:
                    pass
