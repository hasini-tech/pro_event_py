"""
Shared email service using aiosmtplib (async SMTP).
Replaces the Node.js nodemailer utility.
"""
import logging
import os
from html import escape
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import aiosmtplib  # type: ignore
from shared.env import load_backend_env

load_backend_env()
logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "").strip().lower()
SMTP_PASS = "".join(os.getenv("SMTP_PASS", "").split())
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "").strip() or SMTP_USER
FROM_NAME = os.getenv("FROM_NAME", "Evently Platform")
_LAST_EMAIL_ERROR: Optional[str] = None


def _set_last_email_error(message: Optional[str]) -> None:
    global _LAST_EMAIL_ERROR
    _LAST_EMAIL_ERROR = message


def get_last_email_error() -> Optional[str]:
    return _LAST_EMAIL_ERROR


def get_email_configuration_error() -> Optional[str]:
    if SMTP_USER in {"", "your@gmail.com"}:
        return "Email service is not configured. Set SMTP_USER to a real email address."
    if SMTP_PASS in {"", "your-app-password"}:
        return "Email service is not configured. Set SMTP_PASS to a valid SMTP app password."
    return None


def _smtp_is_configured() -> bool:
    return get_email_configuration_error() is None


def is_email_configured() -> bool:
    return _smtp_is_configured()


async def send_email(to: str, subject: str, html_body: str) -> bool:
    """Send an HTML email asynchronously."""
    _set_last_email_error(None)

    if not to:
        _set_last_email_error("Recipient email address is required.")
        logger.warning("Email send skipped because recipient address is empty")
        return False

    configuration_error = get_email_configuration_error()
    if configuration_error:
        _set_last_email_error(configuration_error)
        logger.warning(configuration_error)
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{FROM_NAME} <{SMTP_FROM_EMAIL}>"
    msg["To"] = to
    msg.attach(MIMEText(html_body, "html"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            username=SMTP_USER,
            password=SMTP_PASS,
            start_tls=True,
        )
        _set_last_email_error(None)
        logger.info(f"Email sent to {to}: {subject}")
        return True
    except aiosmtplib.errors.SMTPAuthenticationError as exc:
        _set_last_email_error(
            "Email service authentication failed. Update SMTP_USER and SMTP_PASS with valid SMTP credentials."
        )
        logger.error(f"Failed to authenticate SMTP sender {SMTP_USER}: {exc}")
        return False
    except Exception as exc:
        _set_last_email_error(
            "Could not connect to the email service. Check SMTP_HOST, SMTP_PORT, and network access."
        )
        logger.error(f"Failed to send email to {to}: {exc}")
        return False


async def send_ticket_confirmation(
    to: str,
    name: str,
    event_title: str,
    ticket_id: str,
    qr_code_url: str,
):
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h2 style="color: #6c63ff;">Your Ticket is Confirmed!</h2>
      <p>Hi <strong>{name}</strong>,</p>
      <p>You're registered for <strong>{event_title}</strong>.</p>
      <p><strong>Ticket ID:</strong> {ticket_id}</p>
      <img src="{qr_code_url}" alt="QR Code" style="width:200px;" />
      <p style="color: #666;">Show this QR code at the event entrance.</p>
      <hr/>
      <p style="font-size:12px; color:#999;">Copyright 2026 Evently Platform</p>
    </div>
    """
    return await send_email(to, f"Your ticket for {event_title}", html)


async def send_rsvp_confirmation(
    to: str,
    name: str,
    event_title: str,
    event_date: str,
    event_time: str,
    event_url: str,
):
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h2 style="color: #1f6a52;">You're in for {event_title}</h2>
      <p>Hi <strong>{name}</strong>,</p>
      <p>Your RSVP is confirmed for <strong>{event_title}</strong>.</p>
      <p><strong>Date:</strong> {event_date}<br/>
      <strong>Time:</strong> {event_time}</p>
      <p><a href="{event_url}" style="color:#1f6a52;">View event details</a></p>
      <p style="color:#666;">We will keep you updated with reminders and host messages.</p>
      <hr/>
      <p style="font-size:12px; color:#999;">Copyright 2026 Evently Platform</p>
    </div>
    """
    return await send_email(to, f"RSVP confirmed for {event_title}", html)


async def send_waitlist_notification(
    to: str,
    name: str,
    event_title: str,
    event_url: str,
):
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h2 style="color: #f06f4f;">You're on the waitlist for {event_title}</h2>
      <p>Hi <strong>{name}</strong>,</p>
      <p>We added you to the waitlist for <strong>{event_title}</strong>.</p>
      <p>We will notify you if a seat opens up.</p>
      <p><a href="{event_url}" style="color:#1f6a52;">View event page</a></p>
      <hr/>
      <p style="font-size:12px; color:#999;">Copyright 2026 Evently Platform</p>
    </div>
    """
    return await send_email(to, f"Waitlist update for {event_title}", html)


async def send_event_update_email(
    to: str,
    name: str,
    event_title: str,
    message: str,
    event_url: str,
):
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h2 style="color: #1f6a52;">Update for {event_title}</h2>
      <p>Hi <strong>{name}</strong>,</p>
      <p>{message}</p>
      <p><a href="{event_url}" style="color:#1f6a52;">Open the event page</a></p>
      <hr/>
      <p style="font-size:12px; color:#999;">Copyright 2026 Evently Platform</p>
    </div>
    """
    return await send_email(to, f"Update from {event_title}", html)


async def send_event_creation_confirmation(
    to: str,
    name: str,
    event_title: str,
    event_date: str,
    event_time: str,
    event_location: str,
    event_url: str,
    event_description: str = "",
    ticket_summary: str = "Free registration",
    capacity_summary: str = "Unlimited seats",
    visibility: str = "Published",
):
    """Send the host a confirmation when they create an event."""
    safe_name = escape(name or "Host")
    safe_title = escape(event_title or "Your event")
    safe_date = escape(event_date or "TBA")
    safe_time = escape(event_time or "TBA")
    safe_location = escape(event_location or "Online")
    safe_description = escape(event_description or "").replace("\n", "<br/>")
    safe_ticket_summary = escape(ticket_summary or "Free registration")
    safe_capacity_summary = escape(capacity_summary or "Unlimited seats")
    safe_visibility = escape(visibility or "Published")
    subject_title = (event_title or "Your event").replace("\r", " ").replace("\n", " ").strip()
    normalized_visibility = (visibility or "Published").strip().lower()
    if normalized_visibility == "draft":
        hero_title = "Your draft is ready"
        hero_copy = "We saved your event details in Evently. Finish editing anytime and publish when you are ready."
        cta_label = "Continue Editing"
    elif normalized_visibility == "private":
        hero_title = "Your private event is ready"
        hero_copy = "Your Evently page is set up and only invited guests with the link can access it."
        cta_label = "Manage Private Event"
    else:
        hero_title = "Your event is ready"
        hero_copy = "Your Evently page is set up and the key details are already saved below."
        cta_label = "Manage Event"

    description_block = (
        f"""
        <div style="margin-top: 20px; padding: 20px 22px; background: #ffffff; border: 1px solid #d8eceb; border-radius: 18px;">
          <div style="font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #6f8f90; margin-bottom: 10px;">Description</div>
          <div style="color:#244047; line-height:1.7; font-size: 14px;">{safe_description}</div>
        </div>
        """
        if safe_description
        else ""
    )

    html = f"""
    <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 640px; margin: 24px auto; padding: 0 12px;">
      <div style="background: linear-gradient(180deg, #ffffff 0%, #f4fbfb 100%); border: 1px solid #d7eceb; border-radius: 28px; overflow: hidden; box-shadow: 0 18px 50px rgba(17,39,45,0.08);">
        <div style="background: linear-gradient(135deg, #0e7678 0%, #169295 100%); padding: 28px 28px 24px;">
          <div style="display: inline-block; padding: 7px 12px; border-radius: 999px; background: rgba(255,255,255,0.16); color: #ffffff; font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;">Evently</div>
          <h1 style="color: #ffffff; margin: 16px 0 8px; font-size: 30px; line-height: 1.1; font-weight: 800; letter-spacing: -0.03em;">{hero_title}</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 15px; line-height: 1.6;">{hero_copy}</p>
        </div>

        <div style="padding: 28px;">
          <p style="color: #48636a; font-size: 15px; margin: 0 0 12px;">Hi <strong>{safe_name}</strong>,</p>
          <h2 style="margin: 0; font-size: 32px; line-height: 1.05; font-weight: 800; color: #11272d; letter-spacing: -0.05em;">{safe_title}</h2>

          <div style="margin-top: 18px; display: inline-block; padding: 8px 14px; border-radius: 999px; background: #dff3f2; color: #0e7678; font-size: 12px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase;">
            {safe_visibility}
          </div>

          <div style="margin-top: 22px; padding: 22px; background: rgba(255,255,255,0.84); border: 1px solid #d8eceb; border-radius: 22px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 0 0 14px; color: #6f8f90; font-size: 13px; font-weight: 700; width: 108px;">Date</td>
                <td style="padding: 0 0 14px; color: #11272d; font-size: 15px; font-weight: 700;">{safe_date}</td>
              </tr>
              <tr>
                <td style="padding: 14px 0; color: #6f8f90; font-size: 13px; font-weight: 700; border-top: 1px solid #e5f2f1;">Time</td>
                <td style="padding: 14px 0; color: #11272d; font-size: 15px; font-weight: 700; border-top: 1px solid #e5f2f1;">{safe_time}</td>
              </tr>
              <tr>
                <td style="padding: 14px 0; color: #6f8f90; font-size: 13px; font-weight: 700; border-top: 1px solid #e5f2f1;">Location</td>
                <td style="padding: 14px 0; color: #11272d; font-size: 15px; font-weight: 700; border-top: 1px solid #e5f2f1;">{safe_location}</td>
              </tr>
              <tr>
                <td style="padding: 14px 0; color: #6f8f90; font-size: 13px; font-weight: 700; border-top: 1px solid #e5f2f1;">Tickets</td>
                <td style="padding: 14px 0; color: #11272d; font-size: 15px; font-weight: 700; border-top: 1px solid #e5f2f1;">{safe_ticket_summary}</td>
              </tr>
              <tr>
                <td style="padding: 14px 0 0; color: #6f8f90; font-size: 13px; font-weight: 700; border-top: 1px solid #e5f2f1;">Capacity</td>
                <td style="padding: 14px 0 0; color: #11272d; font-size: 15px; font-weight: 700; border-top: 1px solid #e5f2f1;">{safe_capacity_summary}</td>
              </tr>
            </table>
          </div>

          {description_block}

          <div style="text-align: center; margin: 28px 0 18px;">
            <a href="{event_url}" style="display: inline-block; min-width: 220px; background: #0e7678; color: #ffffff; padding: 15px 28px; border-radius: 14px; font-weight: 800; text-decoration: none; font-size: 15px; box-shadow: 0 14px 28px rgba(14,118,120,0.18);">{cta_label}</a>
          </div>

          <p style="color: #5f7a81; font-size: 13px; text-align: center; line-height: 1.7; margin: 0;">
            You will keep getting attendee updates in Evently and over email.<br/>
            Need help? Just reply to this message.
          </p>
        </div>

        <div style="padding: 18px 28px 24px; border-top: 1px solid #dfeeed; background: rgba(255,255,255,0.72); text-align: center; color: #8aa4a8; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;">
          Sent via Evently Platform | 2026
        </div>
      </div>
    </div>
    """
    return await send_email(to, f"Event created: {subject_title}", html)


async def send_refund_notification(
    to: str,
    name: str,
    event_title: str,
    amount: str,
):
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h2 style="color: #1f6a52;">Refund processed</h2>
      <p>Hi <strong>{name}</strong>,</p>
      <p>Your refund for <strong>{event_title}</strong> has been processed.</p>
      <p><strong>Amount:</strong> {amount}</p>
      <hr/>
      <p style="font-size:12px; color:#999;">Copyright 2026 Evently Platform</p>
    </div>
    """
    return await send_email(to, f"Refund for {event_title}", html)


async def send_welcome_email(to: str, name: str):
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h2 style="color: #6c63ff;">Welcome to Evently!</h2>
      <p>Hi <strong>{name}</strong>, your account has been created successfully.</p>
      <p>Start exploring events or host your own!</p>
      <hr/>
      <p style="font-size:12px; color:#999;">Copyright 2026 Evently Platform</p>
    </div>
    """
    return await send_email(to, "Welcome to Evently!", html)


async def send_login_otp_email(to: str, code: str):
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h2 style="color: #0f172a;">Your Evently sign-in code</h2>
      <p>Use this 6-digit code to continue signing in:</p>
      <div
        style="
          margin: 24px 0;
          padding: 18px 22px;
          border-radius: 14px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          font-size: 32px;
          font-weight: 700;
          letter-spacing: 10px;
          text-align: center;
        "
      >
        {code}
      </div>
      <p style="color: #475569;">This code expires in 10 minutes.</p>
      <hr/>
      <p style="font-size:12px; color:#999;">Copyright 2026 Evently Platform</p>
    </div>
    """
    return await send_email(to, "Your Evently code", html)
