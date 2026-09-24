from __future__ import annotations

import base64
import logging
import os
import urllib.error
import urllib.parse
import urllib.request


logger = logging.getLogger(__name__)

MAILGUN_API_KEY = os.getenv("MAILGUN_API_KEY", "")
MAILGUN_DOMAIN = os.getenv("MAILGUN_DOMAIN", "")
FROM_EMAIL = os.getenv(
    "FROM_EMAIL",
    (
        f"EventSense AI <noreply@{MAILGUN_DOMAIN}>"
        if MAILGUN_DOMAIN
        else "noreply@eventsense.ai"
    ),
)


def _send_via_mailgun(
    recipient: str,
    subject: str,
    html: str,
    text: str,
) -> None:
    url = f"https://api.mailgun.net/v3/{MAILGUN_DOMAIN}/messages"
    payload = urllib.parse.urlencode(
        {
            "from": FROM_EMAIL,
            "to": recipient,
            "subject": subject,
            "html": html,
            "text": text,
        }
    ).encode("utf-8")

    request = urllib.request.Request(url, data=payload, method="POST")
    credentials = base64.b64encode(f"api:{MAILGUN_API_KEY}".encode("utf-8")).decode(
        "utf-8"
    )

    request.add_header("Authorization", f"Basic {credentials}")

    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            response_body = response.read().decode("utf-8")
            logger.info(
                "Email sent to %s through Mailgun: %s",
                recipient,
                response_body,
            )
    except urllib.error.HTTPError as exc:
        response_body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"Mailgun delivery failed: {exc.code} {response_body}"
        ) from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Could not connect to Mailgun: {exc.reason}") from exc


def _log_email(recipient: str, subject: str, text: str) -> None:
    logger.warning(
        "Mailgun is not configured. Development email:\n" "To: %s\nSubject: %s\n\n%s",
        recipient,
        subject,
        text,
    )


def send_email(
    recipient: str,
    subject: str,
    html: str,
    text: str,
) -> None:
    if MAILGUN_API_KEY and MAILGUN_DOMAIN:
        _send_via_mailgun(recipient, subject, html, text)
        return

    _log_email(recipient, subject, text)


def send_verification_email(
    recipient: str,
    full_name: str,
    otp: str,
) -> None:
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
      <p style="color:#64748b;margin-top:0">
        Hybrid NSA + Sentiment Analysis Platform
      </p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
      <p style="color:#0f172a">Hi <strong>{full_name}</strong>,</p>
      <p style="color:#475569">
        Use the code below to verify your email address.
        It expires in <strong>15 minutes</strong>.
      </p>
      <div style="background:#f1f5f9;border-radius:12px;padding:24px;
                  text-align:center;margin:24px 0">
        <span style="font-size:2.4rem;font-weight:900;letter-spacing:0.25em;
                     color:#312e81;font-family:monospace">
          {otp}
        </span>
      </div>
      <p style="color:#94a3b8;font-size:0.85rem">
        If you did not create an account, you can safely ignore this email.
      </p>
    </div>
    """

    send_email(recipient, subject, html, text)


def send_password_reset_email(
    recipient: str,
    full_name: str,
    otp: str,
) -> None:
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
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
      <p style="color:#0f172a">Hi <strong>{full_name}</strong>,</p>
      <p style="color:#475569">
        Use the code below to reset your password.
        It expires in <strong>15 minutes</strong>.
      </p>
      <div style="background:#fef2f2;border-radius:12px;padding:24px;
                  text-align:center;margin:24px 0">
        <span style="font-size:2.4rem;font-weight:900;letter-spacing:0.25em;
                     color:#dc2626;font-family:monospace">
          {otp}
        </span>
      </div>
      <p style="color:#94a3b8;font-size:0.85rem">
        If you did not request a password reset, your account is safe.
        You can ignore this email.
      </p>
    </div>
    """

    send_email(recipient, subject, html, text)
