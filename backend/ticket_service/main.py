import asyncio
import sys, os
from contextlib import asynccontextmanager, suppress
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from shared.database import engine, Base
from .routes import router
from .kafka_consumer import consume_payment_events

load_dotenv()
FRONTEND_ORIGIN = os.getenv("FRONTEND_URL", "http://localhost:3000")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    print("Ticket Service: DB tables ready")
    # Start Kafka consumer as background task
    consumer_task = asyncio.create_task(consume_payment_events())
    yield
    consumer_task.cancel()
    with suppress(asyncio.CancelledError):
        await consumer_task
    print("Ticket Service: shutting down")


app = FastAPI(title="Ticket Service", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router, prefix="/api/tickets", tags=["Tickets"])

@app.get("/")
def root():
    return {"service": "ticket-service", "status": "running"}
