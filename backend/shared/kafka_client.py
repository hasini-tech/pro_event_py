"""
Shared Kafka client helpers.
Uses aiokafka for async producer/consumer operations.
"""
import asyncio
import json
import logging
import os
from contextlib import suppress

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from aiokafka.errors import KafkaConnectionError
from shared.env import load_backend_env

load_backend_env()

logger = logging.getLogger(__name__)

KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")

TOPICS = {
    "TICKET_PURCHASED": "ticket.purchased",
    "PAYMENT_SUCCESS": "payment.success",
    "PAYMENT_FAILED": "payment.failed",
    "EVENT_CREATED": "event.created",
    "ATTENDEE_CHECKED_IN": "attendee.checked_in",
    "NOTIFICATION_EMAIL": "notification.email",
}


async def wait_for_kafka_bootstrap(service_name: str, retry_delay: float = 5.0, probe_timeout: float = 2.0):
    """
    Wait until the first Kafka bootstrap server can accept TCP connections.

    This keeps services from spamming stack traces during local development
    when Kafka is not running yet. Once the broker is reachable, consumers can
    start normally.
    """
    warned = False
    server = KAFKA_BOOTSTRAP.split(",")[0].strip()

    while True:
        try:
            host, port_text = server.rsplit(":", 1)
            port = int(port_text)
            reader, writer = await asyncio.wait_for(asyncio.open_connection(host, port), timeout=probe_timeout)
            writer.close()
            with suppress(Exception):
                await writer.wait_closed()
            return
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            if not warned:
                logger.warning(
                    "%s: Kafka broker %s is unavailable (%s). Waiting before starting the consumer...",
                    service_name,
                    KAFKA_BOOTSTRAP,
                    exc,
                )
                warned = True
            await asyncio.sleep(retry_delay)


async def get_producer() -> AIOKafkaProducer:
    producer = AIOKafkaProducer(
        bootstrap_servers=KAFKA_BOOTSTRAP,
        value_serializer=lambda value: json.dumps(value).encode("utf-8"),
        acks="all",
        retry_backoff_ms=200,
    )
    try:
        await producer.start()
        return producer
    except Exception:
        await producer.stop()
        raise


async def publish_event(topic: str, payload: dict, retries: int = 3):
    """Publish a message to a Kafka topic with retry logic."""
    for attempt in range(retries):
        try:
            producer = await asyncio.wait_for(get_producer(), timeout=5)
            try:
                await asyncio.wait_for(producer.send_and_wait(topic, payload), timeout=5)
                logger.info(f"Published to {topic}: {payload}")
                return
            finally:
                await producer.stop()
        except (KafkaConnectionError, asyncio.TimeoutError, Exception) as exc:
            logger.warning(f"Kafka publish attempt {attempt + 1} failed: {exc}")
            if attempt < retries - 1:
                await asyncio.sleep(2 ** attempt)
            else:
                logger.error(f"Failed to publish to {topic} after {retries} attempts")
                return


async def get_consumer(topic: str | list[str], group_id: str) -> AIOKafkaConsumer:
    topics = [topic] if isinstance(topic, str) else list(topic)
    consumer = AIOKafkaConsumer(
        *topics,
        bootstrap_servers=KAFKA_BOOTSTRAP,
        group_id=group_id,
        value_deserializer=lambda value: json.loads(value.decode("utf-8")),
        auto_offset_reset="earliest",
        enable_auto_commit=False,
    )
    try:
        await consumer.start()
        return consumer
    except Exception:
        await consumer.stop()
        raise
