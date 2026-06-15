"""
auth.py — Authentication layer for EventSense AI
==================================================
Provides:
  - Password hashing with bcrypt or PBKDF2 fallback
  - JWT creation / verification
  - User CRUD backed by PostgreSQL via database.py
  - Role definitions: EVENT_ORGANISER | SYSTEM_ADMIN
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import time
from dataclasses import dataclass
from typing import Optional

from database import get_cursor


JWT_SECRET: str = os.getenv("JWT_SECRET", "eventsense-dev-secret-change-in-prod")
JWT_EXPIRY_SECONDS: int = 60 * 60 * 8

VALID_ROLES = {"EVENT_ORGANISER", "SYSTEM_ADMIN"}


@dataclass
class UserRecord:
    user_id: int
    full_name: str
    email: str
    role: str
    password_hash: str
    created_at: float


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(s: str) -> bytes:
    pad = 4 - len(s) % 4
    return base64.urlsafe_b64decode(s + "=" * pad)


def _create_jwt(payload: dict) -> str:
    header = _b64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body = _b64url_encode(json.dumps(payload).encode())
    sig = hmac.new(
        JWT_SECRET.encode(),
        f"{header}.{body}".encode(),
        hashlib.sha256,
    ).digest()
    return f"{header}.{body}.{_b64url_encode(sig)}"


def _verify_jwt(token: str) -> Optional[dict]:
    try:
        header, body, sig = token.split(".")
        expected = hmac.new(
            JWT_SECRET.encode(),
            f"{header}.{body}".encode(),
            hashlib.sha256,
        ).digest()

        if not hmac.compare_digest(_b64url_decode(sig), expected):
            return None

        payload = json.loads(_b64url_decode(body))

        if payload.get("exp", 0) < time.time():
            return None

        return payload

    except Exception:
        return None


def create_access_token(user: UserRecord) -> str:
    return _create_jwt({
        "sub": str(user.user_id),
        "email": user.email,
        "role": user.role,
        "name": user.full_name,
        "iat": int(time.time()),
        "exp": int(time.time()) + JWT_EXPIRY_SECONDS,
    })


def decode_access_token(token: str) -> Optional[dict]:
    return _verify_jwt(token)


try:
    import bcrypt as _bcrypt

    def hash_password(plain: str) -> str:
        return _bcrypt.hashpw(plain.encode(), _bcrypt.gensalt(12)).decode()

    def verify_password(plain: str, hashed: str) -> bool:
        return _bcrypt.checkpw(plain.encode(), hashed.encode())

except ImportError:
    _ITER = 260_000

    def hash_password(plain: str) -> str:
        salt = os.urandom(16).hex()
        dk = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt.encode(), _ITER)
        return f"pbkdf2:{salt}:{dk.hex()}"

    def verify_password(plain: str, hashed: str) -> bool:
        if not hashed.startswith("pbkdf2:"):
            return False

        _, salt, stored = hashed.split(":", 2)
        dk = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt.encode(), _ITER)
        return hmac.compare_digest(dk.hex(), stored)


def _validate_password_strength(password: str) -> None:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters.")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain at least one uppercase letter.")
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must contain at least one lowercase letter.")
    if not re.search(r"\d", password):
        raise ValueError("Password must contain at least one number.")


def _normalize_role(role: str) -> str:
    role = role.strip().upper()

    if role == "EVENT_ORGANISER":
        return "EVENT_ORGANISER"

    if role == "SYSTEM_ADMIN":
        return "SYSTEM_ADMIN"

    raise ValueError("Role must be EVENT_ORGANISER or SYSTEM_ADMIN.")


def _row_to_user(row: dict) -> UserRecord:
    return UserRecord(
        user_id=int(row["user_id"]),
        full_name=row["full_name"],
        email=row["email"],
        role=row["role"],
        password_hash=row["password_hash"],
        created_at=(
            row["created_at"].timestamp()
            if hasattr(row["created_at"], "timestamp")
            else float(row["created_at"])
        ),
    )


def get_user_by_email(email: str) -> Optional[UserRecord]:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM users
            WHERE LOWER(email) = LOWER(%s)
            LIMIT 1
            """,
            (email.strip(),),
        )
        row = cur.fetchone()

    return _row_to_user(row) if row else None


def get_user_by_id(user_id: int | str) -> Optional[UserRecord]:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM users
            WHERE user_id = %s
            LIMIT 1
            """,
            (int(user_id),),
        )
        row = cur.fetchone()

    return _row_to_user(row) if row else None


def create_user(
    full_name: str,
    email: str,
    password: str,
    role: str,
) -> UserRecord:
    full_name = full_name.strip()
    email = email.strip().lower()
    role = _normalize_role(role)

    if not full_name or len(full_name) < 2:
        raise ValueError("Full name must be at least 2 characters.")

    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise ValueError("Invalid email address.")

    if role not in VALID_ROLES:
        raise ValueError("Role must be EVENT_ORGANISER or SYSTEM_ADMIN.")

    _validate_password_strength(password)

    if get_user_by_email(email):
        raise ValueError("An account with this email already exists.")

    password_hash = hash_password(password)

    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO users (
                full_name,
                email,
                password_hash,
                role
            )
            VALUES (%s, %s, %s, %s)
            RETURNING *
            """,
            (full_name, email, password_hash, role),
        )
        row = cur.fetchone()

    return _row_to_user(row)


def authenticate_user(email: str, password: str) -> Optional[UserRecord]:
    user = get_user_by_email(email)

    if not user:
        return None

    if not verify_password(password, user.password_hash):
        return None

    return user

def reset_user_password(email: str, new_password: str) -> bool:
    """
    Reset a user's password using their registered email address.

    Prototype note:
    In a production system, this should use an emailed reset token.
    For this prototype, the function directly resets the password after
    validating the email and new password.
    """
    email = email.strip().lower()

    user = get_user_by_email(email)

    if not user:
        return False

    _validate_password_strength(new_password)

    new_password_hash = hash_password(new_password)

    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            UPDATE users
            SET password_hash = %s
            WHERE user_id = %s
            """,
            (
                new_password_hash,
                user.user_id,
            ),
        )

    return True