from datetime import datetime
from typing import Any, Literal, Optional
import uuid

from pydantic import AnyHttpUrl, BaseModel, EmailStr, Field, field_validator


WEBHOOK_EVENT_TYPES = {
    "event.created",
    "event.updated",
    "event.deleted",
    "ticket.created",
    "ticket.updated",
}


def _normalize_webhook_event_types(values: list[str]) -> list[str]:
    if not values:
        raise ValueError("At least one event type is required")
    normalized: list[str] = []
    seen: set[str] = set()
    for item in values:
        cleaned = str(item or "").strip()
        if cleaned not in WEBHOOK_EVENT_TYPES:
            raise ValueError(f"Unsupported webhook event type: {cleaned}")
        if cleaned in seen:
            continue
        seen.add(cleaned)
        normalized.append(cleaned)
    return normalized


class SpeakerInput(BaseModel):
    name: str
    role: Optional[str] = ""
    bio: Optional[str] = ""
    avatar: Optional[str] = ""
    links: list[str] = Field(default_factory=list)


class IntegrationInput(BaseModel):
    name: str
    url: str
    kind: Optional[str] = "link"


class CalendarCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    slug: Optional[str] = None
    tint_color: Optional[str] = "#0e7678"
    location_scope: Literal["city", "global"] = "global"
    city: Optional[str] = ""
    cover_image: Optional[str] = ""

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("name is required")
        return trimmed

    @field_validator("city")
    @classmethod
    def normalize_city(cls, value: Optional[str]) -> str:
        return (value or "").strip()


class CalendarUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    slug: Optional[str] = None
    tint_color: Optional[str] = None
    location_scope: Optional[Literal["city", "global"]] = None
    city: Optional[str] = None
    cover_image: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("name is required")
        return trimmed

    @field_validator("city")
    @classmethod
    def normalize_update_city(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return value.strip()


class CalendarResponse(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    slug: str
    description: str = ""
    tint_color: str = "#0e7678"
    location_scope: str = "global"
    city: str = ""
    cover_image: str = ""
    subscriber_count: int = 1
    is_default: bool = False
    event_count: int = 0
    upcoming_event_count: int = 0
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CalendarOptionsResponse(BaseModel):
    event_visibility: Literal["public", "private"] = "public"
    public_guest_list: bool = True
    collect_feedback: bool = False
    tracking_google_enabled: bool = False
    tracking_meta_enabled: bool = False


class CalendarOptionsUpdate(BaseModel):
    event_visibility: Optional[Literal["public", "private"]] = None
    public_guest_list: Optional[bool] = None
    collect_feedback: Optional[bool] = None
    tracking_google_enabled: Optional[bool] = None
    tracking_meta_enabled: Optional[bool] = None


class CalendarAdminCreate(BaseModel):
    email: EmailStr
    role: Literal["admin", "editor"] = "admin"


class CalendarAdminResponse(BaseModel):
    id: uuid.UUID
    calendar_id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    email: str
    role: str = "admin"
    status: str = "active"
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CalendarAdminsUpdate(BaseModel):
    team_enabled: Optional[bool] = None


class CalendarAdminsResponse(BaseModel):
    team_enabled: bool = False
    owner_id: uuid.UUID
    included_admins: int = 1
    admin_limit: int = 1
    remaining_slots: int = 1
    admins: list[CalendarAdminResponse] = Field(default_factory=list)


class CalendarTagsUpdate(BaseModel):
    tags: list[str] = Field(default_factory=list)

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, value: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for item in value:
            cleaned = str(item or "").strip()
            if not cleaned:
                continue
            key = cleaned.lower()
            if key in seen:
                continue
            seen.add(key)
            normalized.append(cleaned)
        return normalized


class CalendarTagsResponse(BaseModel):
    tags: list[str] = Field(default_factory=list)


class CalendarEmbedUpdate(BaseModel):
    enabled: Optional[bool] = None
    width: Optional[str] = None
    height: Optional[str] = None
    theme: Optional[Literal["light", "dark"]] = None
    default_view: Optional[Literal["agenda", "month"]] = None

    @field_validator("width", "height")
    @classmethod
    def normalize_dimensions(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        cleaned = str(value).strip()
        return cleaned or None


class CalendarEmbedResponse(BaseModel):
    enabled: bool = True
    width: str = "500"
    height: str = "450"
    theme: str = "light"
    default_view: str = "agenda"
    src: str
    iframe_code: str


class CalendarApiKeyCreate(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("name is required")
        return trimmed


class CalendarApiKeyResponse(BaseModel):
    id: uuid.UUID
    name: str
    key_prefix: str
    preview: str
    revoked: bool = False
    created_at: Optional[datetime] = None
    token: Optional[str] = None


class CalendarWebhookCreate(BaseModel):
    label: str
    target_url: AnyHttpUrl
    event_types: list[str] = Field(default_factory=lambda: ["event.created", "event.updated"])
    secret: Optional[str] = None
    is_active: bool = True

    @field_validator("label")
    @classmethod
    def validate_label(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("label is required")
        return trimmed

    @field_validator("event_types")
    @classmethod
    def validate_event_types(cls, value: list[str]) -> list[str]:
        return _normalize_webhook_event_types(value)


class CalendarWebhookUpdate(BaseModel):
    label: Optional[str] = None
    target_url: Optional[AnyHttpUrl] = None
    event_types: Optional[list[str]] = None
    secret: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("label")
    @classmethod
    def validate_optional_label(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("label is required")
        return trimmed

    @field_validator("event_types")
    @classmethod
    def validate_optional_event_types(cls, value: Optional[list[str]]) -> Optional[list[str]]:
        if value is None:
            return value
        return _normalize_webhook_event_types(value)


class CalendarWebhookResponse(BaseModel):
    id: uuid.UUID
    label: str
    target_url: str
    event_types: list[str] = Field(default_factory=list)
    is_active: bool = True
    failure_count: int = 0
    last_triggered_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    secret: Optional[str] = None


class CalendarDeveloperResponse(BaseModel):
    calendar_id: uuid.UUID
    api_keys_enabled: bool = False
    webhooks_enabled: bool = False
    api_keys: list[CalendarApiKeyResponse] = Field(default_factory=list)
    webhooks: list[CalendarWebhookResponse] = Field(default_factory=list)


class CalendarSendLimitIncrement(BaseModel):
    count: int = 1
    kind: Literal["invite", "newsletter"] = "invite"

    @field_validator("count")
    @classmethod
    def validate_count(cls, value: int) -> int:
        if value < 1:
            raise ValueError("count must be at least 1")
        return value


class CalendarSendLimitResponse(BaseModel):
    weekly_quota: int = 15
    used: int = 0
    remaining: int = 15
    resets_on: str
    verification_status: Literal["unverified", "pending", "verified"] = "unverified"
    usage_window_label: str = "This Week"
    can_verify: bool = True


class CalendarPlanUpdate(BaseModel):
    plan_name: Optional[Literal["free", "plus"]] = None
    billing_cycle: Optional[Literal["monthly", "annual"]] = None


class CalendarPlanResponse(BaseModel):
    plan_name: Literal["free", "plus"] = "free"
    billing_cycle: Literal["monthly", "annual"] = "monthly"
    price_per_month: float = 0.0
    price_per_year: float = 0.0
    included_admins: int = 1
    additional_admin_price_per_month: float = 12.0
    api_and_zapier_access: bool = False
    priority_support: bool = False
    no_platform_fees: bool = False
    weekly_send_quota: int = 15
    benefits: list[str] = Field(default_factory=list)


class CalendarSettingsResponse(BaseModel):
    calendar: CalendarResponse
    options: CalendarOptionsResponse
    admins: CalendarAdminsResponse
    tags: CalendarTagsResponse
    embed: CalendarEmbedResponse
    developer: CalendarDeveloperResponse
    send_limit: CalendarSendLimitResponse
    plan: CalendarPlanResponse


class EventCreate(BaseModel):
    title: str
    description: str
    date: datetime
    time: str
    location: str
    is_online: bool = False
    cover_image: Optional[str] = ""
    is_paid: bool = False
    ticket_price: Optional[float] = 0.0
    max_seats: Optional[int] = 0
    status: Optional[str] = None
    calendar_id: Optional[uuid.UUID] = None
    community_enabled: bool = True
    public_guest_list: Optional[bool] = None
    collect_feedback: Optional[bool] = None
    speakers: list[SpeakerInput] = Field(default_factory=list)
    agenda: list[str] = Field(default_factory=list)
    integrations: list[IntegrationInput] = Field(default_factory=list)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        allowed = {"published", "private", "draft", "cancelled"}
        if value not in allowed:
            raise ValueError(f"status must be one of: {', '.join(sorted(allowed))}")
        return value


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    date: Optional[datetime] = None
    time: Optional[str] = None
    location: Optional[str] = None
    is_online: Optional[bool] = None
    cover_image: Optional[str] = None
    is_paid: Optional[bool] = None
    ticket_price: Optional[float] = None
    max_seats: Optional[int] = None
    status: Optional[str] = None
    calendar_id: Optional[uuid.UUID] = None
    community_enabled: Optional[bool] = None
    public_guest_list: Optional[bool] = None
    collect_feedback: Optional[bool] = None
    speakers: Optional[list[SpeakerInput]] = None
    agenda: Optional[list[str]] = None
    integrations: Optional[list[IntegrationInput]] = None
    broadcast_message: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_optional_status(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        allowed = {"published", "private", "draft", "cancelled"}
        if value not in allowed:
            raise ValueError(f"status must be one of: {', '.join(sorted(allowed))}")
        return value


class CommunityMember(BaseModel):
    id: uuid.UUID
    ticket_ref: str
    status: str
    name: str
    bio: Optional[str] = ""
    profile_image: Optional[str] = ""
    links: list[str] = Field(default_factory=list)


class CommunityResponse(BaseModel):
    event_id: uuid.UUID
    event_slug: str
    community_enabled: bool
    speakers: list[SpeakerInput] = Field(default_factory=list)
    attendees: list[CommunityMember] = Field(default_factory=list)
    confirmed_count: int = 0
    waitlisted_count: int = 0
    checked_in_count: int = 0


class EventResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    date: datetime
    time: str
    location: str
    is_online: bool
    cover_image: Optional[str]
    slug: str
    host_id: uuid.UUID
    host_name: str
    host_image: Optional[str]
    host_bio: Optional[str]
    is_paid: bool
    ticket_price: Optional[float]
    max_seats: int
    seats_left: int
    attendee_count: int
    status: str
    calendar_id: Optional[uuid.UUID] = None
    calendar_name: Optional[str] = None
    calendar_slug: Optional[str] = None
    calendar_tint_color: Optional[str] = None
    community_enabled: bool = True
    public_guest_list: bool = True
    collect_feedback: bool = False
    speakers: list[SpeakerInput] = Field(default_factory=list)
    agenda: list[str] = Field(default_factory=list)
    integrations: list[IntegrationInput] = Field(default_factory=list)
    confirmed_count: int = 0
    waitlisted_count: int = 0
    checked_in_count: int = 0
    ticket_sales: float = 0.0
    conversion_rate: float = 0.0
    share_url: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AnalyticsEventItem(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    date: datetime
    is_paid: bool
    ticket_price: float = 0.0
    max_seats: int = 0
    seats_left: int = 0
    reserved_count: int = 0
    confirmed_count: int = 0
    waitlisted_count: int = 0
    checked_in_count: int = 0
    ticket_sales: float = 0.0
    conversion_rate: float = 0.0


class AnalyticsOverviewResponse(BaseModel):
    total_events: int = 0
    published_events: int = 0
    total_reservations: int = 0
    confirmed_count: int = 0
    waitlisted_count: int = 0
    checked_in_count: int = 0
    ticket_sales: float = 0.0
    conversion_rate: float = 0.0
    events: list[AnalyticsEventItem] = Field(default_factory=list)
