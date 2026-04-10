from __future__ import annotations

import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse


CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from shared.env import load_backend_env


load_backend_env()

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
BACKEND_URL = os.getenv("BACKEND_URL", "").rstrip("/")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
FRONTEND_ORIGIN = FRONTEND_URL if FRONTEND_URL.startswith("http") else "http://localhost:3000"
REQUEST_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]


if BACKEND_URL:
    # In Vercel multi-service projects, route service-to-service traffic back to
    # this single backend deployment instead of localhost-only dev ports.
    os.environ.setdefault("USER_SERVICE_URL", BACKEND_URL)
    os.environ.setdefault("EVENT_SERVICE_URL", BACKEND_URL)
    os.environ.setdefault("TICKET_SERVICE_URL", BACKEND_URL)
    os.environ.setdefault("PAYMENT_SERVICE_URL", BACKEND_URL)
    os.environ.setdefault("ATTENDEE_SERVICE_URL", BACKEND_URL)

# Kafka is optional for Vercel deployments; when it isn't configured we skip
# publishing instead of repeatedly timing out on localhost:9092.
os.environ.setdefault("KAFKA_BOOTSTRAP_SERVERS", "")


def add_cors(app: FastAPI) -> None:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[FRONTEND_ORIGIN, "http://127.0.0.1:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


if not DATABASE_URL:
    app = FastAPI(
        title="Evently Backend",
        description="Fallback backend entrypoint for Vercel deployments without database configuration.",
        version="1.0.0",
    )
    add_cors(app)

    @app.get("/")
    def root():
        return {
            "service": "evently-backend",
            "status": "not-configured",
            "detail": "Set DATABASE_URL in Vercel to enable the FastAPI backend.",
        }

    @app.get("/health")
    def health():
        return {
            "status": "not-configured",
            "configured": False,
            "detail": "DATABASE_URL is not configured.",
        }

    @app.api_route("/{path:path}", methods=REQUEST_METHODS, include_in_schema=False)
    async def backend_not_configured(path: str):
        return JSONResponse(
            {
                "detail": "Backend service is deployed, but DATABASE_URL is not configured.",
                "path": f"/{path}",
            },
            status_code=503,
        )
else:
    from attendee_service import models as attendee_models  # noqa: F401
    from attendee_service.routes import router as attendee_router
    from event_service import models as event_models  # noqa: F401
    from event_service.main import ensure_schema_backfill
    from event_service.routes import router as event_router
    from payment_service import models as payment_models  # noqa: F401
    from payment_service.routes import router as payment_router
    from shared.database import Base, engine
    from ticket_service import models as ticket_models  # noqa: F401
    from ticket_service.routes import router as ticket_router
    from user_service import models as user_models  # noqa: F401
    from user_service.routes import router as user_router

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        Base.metadata.create_all(bind=engine)
        ensure_schema_backfill()
        yield

    app = FastAPI(
        title="Evently Backend",
        description="Aggregated FastAPI backend for Vercel multi-service deployments.",
        version="1.0.0",
        lifespan=lifespan,
    )
    add_cors(app)

    app.include_router(user_router, prefix="/api/users", tags=["Users"])
    app.include_router(event_router, prefix="/api/events", tags=["Events"])
    app.include_router(ticket_router, prefix="/api/tickets", tags=["Tickets"])
    app.include_router(payment_router, prefix="/api/payments", tags=["Payments"])
    app.include_router(attendee_router, prefix="/api/attendees", tags=["Attendees"])

    @app.get("/")
    def root():
        return {"service": "evently-backend", "status": "running"}

    @app.get("/health")
    def health():
        return {"status": "ok", "configured": True}
