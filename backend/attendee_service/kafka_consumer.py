"""
Attendee Service Kafka Consumer.

Listens to ticket.purchased and keeps attendee snapshots in sync.
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
from shared.kafka_client import get_consumer, TOPICS, wait_for_kafka_bootstrap
from .models import Attendee

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


async def consume_ticket_purchased():
    logger.info("Attendee Service: listening on 'ticket.purchased'")
    while True:
        consumer = None
        try:
            await wait_for_kafka_bootstrap("Attendee Service")
            consumer = await get_consumer(TOPICS["TICKET_PURCHASED"], group_id="attendee-service-tickets")
            async for msg in consumer:
                data = msg.value or {}
                ticket_id = data.get("ticket_id")
                if not ticket_id:
                    await consumer.commit()
                    continue

                db = SessionLocal()
                try:
                    profile = data.get("profile") or await _fetch_user_profile(str(data.get("user_id")))
                    attendee = db.query(Attendee).filter(Attendee.ticket_id == ticket_id).first()

                    attendee_payload = {
                        "event_id": data.get("event_id"),
                        "user_id": data.get("user_id"),
                        "ticket_id": ticket_id,
                        "ticket_ref": data.get("ticket_ref", ""),
                        "status": data.get("status", "confirmed"),
                        "ticket_type": data.get("ticket_type", "free"),
                        "name": profile.get("name") or "",
                        "bio": profile.get("bio", "") or "",
                        "profile_image": profile.get("profile_image", "") or "",
                        "links": profile.get("links", []) if isinstance(profile.get("links"), list) else [],
                    }

                    if attendee:
                        for key, value in attendee_payload.items():
                            setattr(attendee, key, value)
                        if attendee.status != "confirmed":
                            attendee.checked_in = False
                            attendee.checked_in_at = None
                        db.commit()
                        logger.info("Updated attendee snapshot for ticket %s", ticket_id)
                    else:
                        attendee = Attendee(**attendee_payload)
                        if attendee.status != "confirmed":
                            attendee.checked_in = False
                            attendee.checked_in_at = None
                        db.add(attendee)
                        db.commit()
                        logger.info("Created attendee snapshot for ticket %s", ticket_id)
                finally:
                    db.close()

                await consumer.commit()
        except KafkaConnectionError as exc:
            logger.warning("Attendee consumer lost Kafka connection: %s. Waiting for broker...", exc)
            await wait_for_kafka_bootstrap("Attendee Service")
        except Exception as exc:
            logger.error("Attendee consumer error: %s. Retrying in 5s...", exc)
            await asyncio.sleep(5)
        finally:
            if consumer:
                try:
                    await asyncio.shield(consumer.stop())
                except Exception:
                    pass
