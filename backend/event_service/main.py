import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from sqlalchemy import inspect, text
from shared.database import engine, Base
from .routes import router

load_dotenv()
FRONTEND_ORIGIN = os.getenv("FRONTEND_URL", "http://localhost:3000")


def ensure_schema_backfill():
    inspector = inspect(engine)
    if not inspector.has_table("events"):
        return

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE events ADD COLUMN IF NOT EXISTS calendar_id UUID"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_events_calendar_id ON events (calendar_id)"))

    if inspector.has_table("event_settings"):
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS public_guest_list BOOLEAN DEFAULT TRUE")
            )
            connection.execute(
                text("ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS collect_feedback BOOLEAN DEFAULT FALSE")
            )

    inspector = inspect(engine)
    calendar_fk_exists = any(
        fk.get("constrained_columns") == ["calendar_id"]
        for fk in inspector.get_foreign_keys("events")
    )

    if not calendar_fk_exists:
        with engine.begin() as connection:
            connection.execute(
                text(
                    """
                    ALTER TABLE events
                    ADD CONSTRAINT fk_events_calendar_id
                    FOREIGN KEY (calendar_id)
                    REFERENCES owner_calendars(id)
                    ON DELETE SET NULL
                    """
                )
            )


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_schema_backfill()
    print("Event Service: DB tables ready")
    yield


app = FastAPI(title="Event Service", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router, prefix="/api/events", tags=["Events"])

@app.get("/")
def root():
    return {"service": "event-service", "status": "running"}
