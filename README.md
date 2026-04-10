# pro_event_py

A full-stack event management platform with a Next.js frontend and Python microservices backend.

## Stack

- Frontend: Next.js 14, React 18, TypeScript
- Backend: FastAPI, SQLAlchemy, PostgreSQL
- Messaging: Kafka
- Payments: Stripe
- Reverse proxy: Nginx
- Local orchestration: Docker Compose

## App Structure

- `frontend/` - Next.js app for discovery, event creation, management, calendars, auth, and check-in
- `backend/` - FastAPI services for users, events, tickets, payments, attendees, and shared utilities
- `docker-compose.yml` - local multi-service environment
- `nginx.conf` - API gateway routing

## Local Development

### Frontend

```powershell
cd frontend
npm install
npm run build
npm run dev
```

### Backend

Create `backend/.env` with your local configuration, then use the included virtual environment or create a new one with Python 3.12.

```powershell
cd backend
.\start_services.ps1
```

To stop local backend services:

```powershell
cd backend
.\stop_services.ps1
```

## Docker

To run the full stack with Docker Compose:

```powershell
docker compose up --build
```

## Environment Notes

- `backend/.env` is required for backend secrets and service settings.
- `frontend/.env.local` can be used for frontend-only overrides.
- Both env files are gitignored and should not be committed.

## Verification

The frontend production build passes with:

```powershell
cd frontend
npm run build
```

The backend services were syntax-checked with Python `compileall`.
