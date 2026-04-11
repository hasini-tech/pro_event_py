"""
User Service — Pydantic schemas for request/response validation.
"""
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime
import uuid


class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v):
        return str(v).strip().lower()

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v):
        return str(v).strip().lower()


class OtpRequest(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v):
        return str(v).strip().lower()


class OtpVerify(BaseModel):
    email: EmailStr
    code: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v):
        return str(v).strip().lower()

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v):
        code = str(v).strip()
        if len(code) != 6 or not code.isdigit():
            raise ValueError("OTP code must be 6 digits")
        return code


class UserUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    profile_image: Optional[str] = None
    password: Optional[str] = None
    links: Optional[list[str]] = None


class UserResponse(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    bio: Optional[str] = ""
    profile_image: Optional[str] = ""
    links: list[str] = Field(default_factory=list)
    role: str
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    success: bool
    token: str
    data: UserResponse


class OtpRequestResponse(BaseModel):
    success: bool
    email: str
    expires_in_seconds: int
    resend_in_seconds: int = 0
    message: Optional[str] = None
    debug_code: Optional[str] = None
