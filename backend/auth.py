"""
auth.py — Authentication layer for SignalCheck AI
==================================================
Provides:
  - Password hashing with bcrypt (stdlib PBKDF2 fallback)
  - JWT creation / verification (HS256, pure stdlib)
  - User CRUD backed by PostgreSQL via database.py
  - Role definitions: event_organiser | system_admin
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import time
import uuid
from dataclasses import dataclass
from typing import Optional

from database import get_cursor

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

JWT_SECRET: str = os.getenv("JWT_SECRET", "signalcheck-dev-secret-change-in-prod")
JWT_EXPIRY_SECONDS: int = 60 * 60 * 8   # 8 hours

VALID_ROLES = {"event_organiser", "system_admin"}


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class UserRecord:
    id: str
    full_name: str
    email: str
    role: str
    hashed_password: str
    created_at: float   # Unix timestamp (converted from pg TIMESTAMPTZ)


# ---------------------------------------------------------------------------
# JWT (pure stdlib HS256)
# ---------------------------------------------------------------------------

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(s: str) -> bytes:
    pad = 4 - len(s) % 4
    return base64.urlsafe_b64decode(s + "=" * pad)


def _create_jwt(payload: dict) -> str:
    header = _b64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body   = _b64url_encode(json.dumps(payload).encode())
    sig    = hmac.new(JWT_SECRET.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest()
    return f"{header}.{body}.{_b64url_encode(sig)}"


def _verify_jwt(token: str) -> Optional[dict]:
    try:
        header, body, sig = token.split(".")
        expected = hmac.new(
            JWT_SECRET.encode(), f"{header}.{body}".encode(), hashlib.sha256
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
        "sub":   user.id,
        "email": user.email,
        "role":  user.role,
        "name":  user.full_name,
        "iat":   int(time.time()),
        "exp":   int(time.time()) + JWT_EXPIRY_SECONDS,
    })


def decode_access_token(token: str) -> Optional[dict]:
    return _verify_jwt(token)


# ---------------------------------------------------------------------------
# Password hashing — bcrypt preferred, PBKDF2 fallback
# ---------------------------------------------------------------------------

try:
    import bcrypt as _bcrypt  # type: ignore

    def hash_password(plain: str) -> str:
        return _bcrypt.hashpw(plain.encode(), _bcrypt.gensalt(12)).decode()

    def verify_password(plain: str, hashed: str) -> bool:
        return _bcrypt.checkpw(plain.encode(), hashed.encode())

except ImportError:
    _ITER = 260_000

    def hash_password(plain: str) -> str:   # type: ignore[misc]
        salt = os.urandom(16).hex()
        dk = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt.encode(), _ITER)
        return f"pbkdf2:{salt}:{dk.hex()}"

    def verify_password(plain: str, hashed: str) -> bool:   # type: ignore[misc]
        if not hashed.startswith("pbkdf2:"):
            return False
        _, salt, stored = hashed.split(":", 2)
        dk = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt.encode(), _ITER)
        return hmac.compare_digest(dk.hex(), stored)


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def _validate_password_strength(password: str) -> None:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters.")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain at least one uppercase letter.")
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must contain at least one lowercase letter.")
    if not re.search(r"\d", password):
        raise ValueError("Password must contain at least one number.")


# ---------------------------------------------------------------------------
# Row → UserRecord helper
# ---------------------------------------------------------------------------

def _row_to_user(row: dict) -> UserRecord:
    """Convert a psycopg2 RealDictRow to a UserRecord dataclass."""
    return UserRecord(
        id=str(row["id"]),
        full_name=row["full_name"],
        email=row["email"],
        role=row["role"],
        hashed_password=row["hashed_password"],
        created_at=row["created_at"].timestamp() if hasattr(row["created_at"], "timestamp") else float(row["created_at"]),
    )


# ---------------------------------------------------------------------------
# User CRUD — PostgreSQL
# ---------------------------------------------------------------------------

def get_user_by_email(email: str) -> Optional[UserRecord]:
    with get_cursor() as cur:
        cur.execute(
            "SELECT * FROM users WHERE LOWER(email) = LOWER(%s) LIMIT 1",
            (email.strip(),),
        )
        row = cur.fetchone()
    return _row_to_user(row) if row else None


def get_user_by_id(user_id: str) -> Optional[UserRecord]:
    with get_cursor() as cur:
        cur.execute("SELECT * FROM users WHERE id = %s LIMIT 1", (user_id,))
        row = cur.fetchone()
    return _row_to_user(row) if row else None


def create_user(full_name: str, email: str, password: str, role: str) -> UserRecord:
    """
    Validate and insert a new user into PostgreSQL.
    Raises ValueError on validation failures or duplicate email.
    """
    full_name = full_name.strip()
    email     = email.strip().lower()

    if not full_name or len(full_name) < 2:
        raise ValueError("Full name must be at least 2 characters.")
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise ValueError("Invalid email address.")
    if role not in VALID_ROLES:
        raise ValueError(f"Role must be one of: {', '.join(sorted(VALID_ROLES))}.")
    _validate_password_strength(password)

    if get_user_by_email(email):
        raise ValueError("An account with this email already exists.")

    user_id = str(uuid.uuid4())
    pw_hash = hash_password(password)

    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO users (id, full_name, email, role, hashed_password)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING *
            """,
            (user_id, full_name, email, role, pw_hash),
        )
        row = cur.fetchone()

    return _row_to_user(row)


def authenticate_user(email: str, password: str) -> Optional[UserRecord]:
    user = get_user_by_email(email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user
