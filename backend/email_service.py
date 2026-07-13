"""
email_service.py — Mailgun email delivery for EventSense AI
=============================================================
Sends transactional emails (verification OTPs, password reset links)
via the Mailgun HTTP API.

Required environment variables:
    MAILGUN_API_KEY   — your Mailgun private API key
    MAILGUN_DOMAIN    — your verified Mailgun sending domain
    FROM_EMAIL        — sender address (default: noreply@<MAILGUN_DOMAIN>)

If MAILGUN_API_KEY is not set the service falls back to printing the
code to the terminal (useful during local development).
"""

from __future__ import annotations

import os
import urllib.request
import urllib.parse
import urllib.error
import json

MAILGUN_API_KEY: str = os.getenv("MAILGUN_API_KEY", "")
MAILGUN_DOMAIN: str = os.getenv("MAILGUN_DOMAIN", "")
FROM_EMAIL: str = os.getenv(
    "FROM_EMAIL",
    (
        f"EventSense AI <noreply@{MAILGUN_DOMAIN}>"
        if MAILGUN_DOMAIN
        else "noreply@EventSense.ai"
    ),
)


def _send_via_mailgun(to: str, subject: str, html: str, text: str) -> None:
    """POST to the Mailgun messages endpoint using only the stdlib."""
    url = f"https://api.mailgun.net/v3/{MAILGUN_DOMAIN}/messages"

    data = urllib.parse.urlencode(
        {
            "from": FROM_EMAIL,
            "to": to,
            "subject": subject,
            "html": html,
            "text": text,
        }
    ).encode()

    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
    )
    # Basic auth: "api:<key>"
    import base64

    credentials = base64.b64encode(f"api:{MAILGUN_API_KEY}".encode()).decode()
    req.add_header("Authorization", f"Basic {credentials}")

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode()
            print(f"[mailgun] Email sent to {to}: {body}")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode()
        print(f"[mailgun] ERROR sending to {to}: {exc.code} {body}")
        raise RuntimeError(f"Mailgun delivery failed: {exc.code} {body}") from exc


def _fallback_log(to: str, subject: str, text: str) -> None:
    """Print to terminal when Mailgun is not configured (dev mode)."""
    sep = "=" * 60
    print(f"\n{sep}")
    print(f"[DEV EMAIL] To: {to}")
    print(f"[DEV EMAIL] Subject: {subject}")
    print(text)
    print(f"{sep}\n")


def send_email(to: str, subject: str, html: str, text: str) -> None:
    """
    Send an email.  Falls back to console log if Mailgun is not configured.
    """
    if MAILGUN_API_KEY and MAILGUN_DOMAIN:
        _send_via_mailgun(to, subject, html, text)
    else:
        _fallback_log(to, subject, text)


# ---------------------------------------------------------------------------
# Email templates
# ---------------------------------------------------------------------------


def send_verification_email(to: str, full_name: str, otp: str) -> None:
    subject = "Verify your EventSense AI account"
    text = (
        f"Hi {full_name},\n\n"
        f"Your verification code is: {otp}\n\n"
        "This code expires in 15 minutes.\n\n"
        "If you did not create an account, please ignore this email.\n\n"
        "— The EventSense AI team"
    )
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
      <h2 style="color:#0f172a;margin-bottom:4px">EventSense AI</h2>
      <p style="color:#64748b;margin-top:0">Hybrid NSA + Sentiment Analysis Platform</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
      <p style="color:#0f172a">Hi <strong>{full_name}</strong>,</p>
      <p style="color:#475569">
        Use the code below to verify your email address.
        It expires in <strong>15 minutes</strong>.
      </p>
      <div style="background:#f1f5f9;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
        <span style="font-size:2.4rem;font-weight:900;letter-spacing:0.25em;color:#312e81;font-family:monospace">
          {otp}
        </span>
      </div>
      <p style="color:#94a3b8;font-size:0.85rem">
        If you did not create an account, you can safely ignore this email.
      </p>
    </div>
    """
    send_email(to, subject, html, text)


def send_password_reset_email(to: str, full_name: str, otp: str) -> None:
    subject = "Reset your EventSense AI password"
    text = (
        f"Hi {full_name},\n\n"
        f"Your password reset code is: {otp}\n\n"
        "This code expires in 15 minutes.\n\n"
        "If you did not request a password reset, please ignore this email.\n\n"
        "— The EventSense AI team"
    )
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
      <h2 style="color:#0f172a;margin-bottom:4px">EventSense AI</h2>
      <p style="color:#64748b;margin-top:0">Password Reset</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
      <p style="color:#0f172a">Hi <strong>{full_name}</strong>,</p>
      <p style="color:#475569">
        Use the code below to reset your password.
        It expires in <strong>15 minutes</strong>.
      </p>
      <div style="background:#fef2f2;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
        <span style="font-size:2.4rem;font-weight:900;letter-spacing:0.25em;color:#dc2626;font-family:monospace">
          {otp}
        </span>
      </div>
      <p style="color:#94a3b8;font-size:0.85rem">
        If you did not request a password reset, your account is safe — ignore this email.
      </p>
    </div>
    """
    send_email(to, subject, html, text)
