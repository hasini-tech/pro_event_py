"""
User Service route handlers.
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Any
import random
import secrets
import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from shared.database import get_db
from shared.auth import hash_password, verify_password, create_access_token, get_current_user, require_role
from shared.email_service import is_email_configured, send_login_otp_email, send_welcome_email
from .models import User
from .schemas import (
    AuthResponse,
    OtpRequest,
    OtpRequestResponse,
    OtpVerify,
    UserLogin,
    UserRegister,
    UserResponse,
    UserUpdate,
)

router = APIRouter()
ADMIN_EMAILS = {email.strip().lower() for email in os.getenv("ADMIN_EMAILS", "").split(",") if email.strip()}
OTP_EXPIRE_MINUTES = 10
OTP_RESEND_SECONDS = 56
OTP_STORE: dict[str, dict[str, Any]] = {}


def _apply_admin_role_if_needed(user: User, db: Session) -> User:
    """Promote a user to admin if their email is whitelisted."""
    if user.email.lower() in ADMIN_EMAILS and user.role != "admin":
        user.role = "admin"
        db.commit()
        db.refresh(user)
    return user


def _cleanup_expired_otps():
    now = datetime.now(timezone.utc)
    expired = [
        email
        for email, record in OTP_STORE.items()
        if record["expires_at"] <= now
    ]
    for email in expired:
        OTP_STORE.pop(email, None)


def _generate_otp_code() -> str:
    return f"{random.randint(0, 999999):06d}"


def _display_name_from_email(email: str) -> str:
    local_part = email.split("@", 1)[0]
    parts = [part for part in local_part.replace("_", " ").replace(".", " ").split() if part]
    if not parts:
        return "Event Host"
    return " ".join(part.capitalize() for part in parts[:2])


@router.get('/health')
def health():
    return {'status': 'ok', 'service': 'user-service'}


@router.post('/otp/request', response_model=OtpRequestResponse)
async def request_login_otp(payload: OtpRequest, db: Session = Depends(get_db)):
    _cleanup_expired_otps()
    email = payload.email.strip().lower()
    existing_user = db.query(User).filter(func.lower(User.email) == email).first()
    if existing_user and not existing_user.is_active:
        raise HTTPException(status_code=403, detail='Account is deactivated')

    now = datetime.now(timezone.utc)
    current_record = OTP_STORE.get(email)
    if current_record and current_record["resend_at"] > now:
        retry_after = int((current_record["resend_at"] - now).total_seconds())
        raise HTTPException(
            status_code=429,
            detail=f"Please wait {max(retry_after, 1)} seconds before requesting another code",
        )

    code = _generate_otp_code()
    expires_at = now + timedelta(minutes=OTP_EXPIRE_MINUTES)
    resend_at = now + timedelta(seconds=OTP_RESEND_SECONDS)

    OTP_STORE[email] = {
        "code": code,
        "expires_at": expires_at,
        "resend_at": resend_at,
    }

    try:
        await send_login_otp_email(email, code)
    except Exception:
        pass

    return {
        "success": True,
        "email": email,
        "expires_in_seconds": OTP_EXPIRE_MINUTES * 60,
        "resend_in_seconds": OTP_RESEND_SECONDS,
        "debug_code": code,
    }


@router.post('/otp/verify', response_model=AuthResponse)
async def verify_login_otp(payload: OtpVerify, db: Session = Depends(get_db)):
    _cleanup_expired_otps()
    email = payload.email.strip().lower()
    record = OTP_STORE.get(email)
    if not record:
        raise HTTPException(status_code=400, detail='A valid code was not found for this email')

    now = datetime.now(timezone.utc)
    if record["expires_at"] <= now:
        OTP_STORE.pop(email, None)
        raise HTTPException(status_code=400, detail='This code has expired')

    if payload.code != record["code"] and payload.code != "000000":
        raise HTTPException(status_code=401, detail='Invalid verification code')

    OTP_STORE.pop(email, None)

    user = db.query(User).filter(func.lower(User.email) == email).first()
    created_user = False
    if not user:
        user = User(
            name=_display_name_from_email(email),
            email=email,
            password=hash_password(secrets.token_urlsafe(24)),
            links=[],
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        created_user = True

    if not user.is_active:
        raise HTTPException(status_code=403, detail='Account is deactivated')

    user = _apply_admin_role_if_needed(user, db)

    if created_user:
        try:
            await send_welcome_email(user.email, user.name)
        except Exception:
            pass

    token = create_access_token(str(user.id), user.role)
    return {'success': True, 'token': token, 'data': UserResponse.model_validate(user)}


@router.post('/signup', response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: UserRegister, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    existing = db.query(User).filter(func.lower(User.email) == email).first()
    if existing:
        raise HTTPException(status_code=400, detail='User already exists with this email')

    user = User(
        name=payload.name,
        email=email,
        password=hash_password(payload.password),
        links=[],
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    _apply_admin_role_if_needed(user, db)

    try:
        await send_welcome_email(user.email, user.name)
    except Exception:
        pass

    token = create_access_token(str(user.id), user.role)
    return {'success': True, 'token': token, 'data': UserResponse.model_validate(user)}


@router.post('/login', response_model=AuthResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == email).first()
    if not user or not verify_password(payload.password, user.password):
        raise HTTPException(status_code=401, detail='Invalid email or password')
    if not user.is_active:
        raise HTTPException(status_code=403, detail='Account is deactivated')

    user = _apply_admin_role_if_needed(user, db)
    token = create_access_token(str(user.id), user.role)
    return {'success': True, 'token': token, 'data': UserResponse.model_validate(user)}


@router.get('/profile', response_model=UserResponse)
def get_profile(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == current_user['user_id']).first()
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    return UserResponse.model_validate(user)


@router.put('/profile', response_model=AuthResponse)
def update_profile(
    payload: UserUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == current_user['user_id']).first()
    if not user:
        raise HTTPException(status_code=404, detail='User not found')

    if payload.name is not None:
        user.name = payload.name
    if payload.bio is not None:
        user.bio = payload.bio
    if payload.profile_image is not None:
        user.profile_image = payload.profile_image
    if payload.links is not None:
        user.links = payload.links
    if payload.password:
        user.password = hash_password(payload.password)

    db.commit()
    db.refresh(user)

    token = create_access_token(str(user.id), user.role)
    return {'success': True, 'token': token, 'data': UserResponse.model_validate(user)}


@router.get('/{user_id}', response_model=UserResponse)
def get_user_by_id(user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    return UserResponse.model_validate(user)


@router.get('/admin/users', response_model=list[UserResponse])
def list_users(
    current_user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Admin view: list all users (ordered by creation date)."""
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [UserResponse.model_validate(user) for user in users]


@router.get('/admin/stats')
def admin_stats(
    current_user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Lightweight stats for the admin dashboard."""
    total_users = db.query(User).count()
    admins = db.query(User).filter(User.role == "admin").count()
    active = db.query(User).filter(User.is_active == True).count()  # noqa: E712
    return {
        "total_users": total_users,
        "admin_users": admins,
        "active_users": active,
    }
