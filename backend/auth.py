"""
auth.py — Authentication layer for SignalCheck AI
==================================================
Provides:
  - Password hashing with bcrypt
  - JWT creation and verification (HS256)
  - A simple JSON file-based user store (no external DB required for the prototype)
  - Role definitions: event_organiser | system_admin

User records are persisted to users.json in the backend directory.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import time
import uuid
import base64
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Secret key used to sign JWTs.  In production this MUST come from an env var.
JWT_SECRET: str = os.getenv("JWT_SECRET", "signalcheck-dev-secret-change-in-prod")
JWT_ALGORITHM: str = "HS256"
JWT_EXPIRY_SECONDS: int = 60 * 60 * 8  # 8 hours

USERS_FILE: Path = Path(__file__).parent / "users.json"

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
    hashed_password: str   # bcrypt or fallback hash
    created_at: float      # Unix timestamp


# ---------------------------------------------------------------------------
# Simple JWT implementation (no external library)
# ---------------------------------------------------------------------------
# We implement a minimal HS256 JWT so the only extra dependency is bcrypt
# (for password hashing).  Structure: header.payload.signature, base64url-encoded.

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(data: str) -> bytes:
    padding = 4 - len(data) % 4
    return base64.urlsafe_b64decode(data + "=" * padding)


def _create_jwt(payload: dict) -> str:
    header = _b64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body = _b64url_encode(json.dumps(payload).encode())
    signing_input = f"{header}.{body}".encode()
    signature = hmac.new(JWT_SECRET.encode(), signing_input, hashlib.sha256).digest()
    return f"{header}.{body}.{_b64url_encode(signature)}"


def _verify_jwt(token: str) -> Optional[dict]:
    try:
        header, body, sig = token.split(".")
        signing_input = f"{header}.{body}".encode()
        expected_sig = hmac.new(JWT_SECRET.encode(), signing_input, hashlib.sha256).digest()
        if not hmac.compare_digest(_b64url_decode(sig), expected_sig):
            return None
        payload = json.loads(_b64url_decode(body))
        if payload.get("exp", 0) < time.time():
            return None   # expired
        return payload
    except Exception:
        return None


def create_access_token(user: UserRecord) -> str:
    payload = {
        "sub": user.id,
        "email": user.email,
        "role": user.role,
        "name": user.full_name,
        "iat": int(time.time()),
        "exp": int(time.time()) + JWT_EXPIRY_SECONDS,
    }
    return _create_jwt(payload)


def decode_access_token(token: str) -> Optional[dict]:
    return _verify_jwt(token)


# ---------------------------------------------------------------------------
# Password hashing — prefer bcrypt, fall back to PBKDF2-HMAC-SHA256
# ---------------------------------------------------------------------------

try:
    import bcrypt as _bcrypt  # type: ignore

    def hash_password(plain: str) -> str:
        return _bcrypt.hashpw(plain.encode(), _bcrypt.gensalt(12)).decode()

    def verify_password(plain: str, hashed: str) -> bool:
        return _bcrypt.checkpw(plain.encode(), hashed.encode())

except ImportError:
    # Fallback: PBKDF2-HMAC-SHA256 — available in the Python stdlib
    import hashlib as _hashlib

    _ITERATIONS = 260_000

    def hash_password(plain: str) -> str:  # type: ignore[misc]
        salt = os.urandom(16).hex()
        dk = _hashlib.pbkdf2_hmac("sha256", plain.encode(), salt.encode(), _ITERATIONS)
        return f"pbkdf2:{salt}:{dk.hex()}"

    def verify_password(plain: str, hashed: str) -> bool:  # type: ignore[misc]
        if not hashed.startswith("pbkdf2:"):
            return False
        _, salt, stored = hashed.split(":", 2)
        dk = _hashlib.pbkdf2_hmac("sha256", plain.encode(), salt.encode(), _ITERATIONS)
        return hmac.compare_digest(dk.hex(), stored)


# ---------------------------------------------------------------------------
# User store (JSON file)
# ---------------------------------------------------------------------------

def _load_users() -> dict[str, UserRecord]:
    if not USERS_FILE.exists():
        return {}
    try:
        raw = json.loads(USERS_FILE.read_text())
        return {uid: UserRecord(**data) for uid, data in raw.items()}
    except Exception:
        return {}


def _save_users(users: dict[str, UserRecord]) -> None:
    USERS_FILE.write_text(json.dumps({uid: asdict(u) for uid, u in users.items()}, indent=2))


def get_user_by_email(email: str) -> Optional[UserRecord]:
    users = _load_users()
    for user in users.values():
        if user.email.lower() == email.lower():
            return user
    return None


def get_user_by_id(user_id: str) -> Optional[UserRecord]:
    return _load_users().get(user_id)


def create_user(full_name: str, email: str, password: str, role: str) -> UserRecord:
    """
    Create and persist a new user.
    Raises ValueError on validation failures.
    """
    # --- Validation ---
    full_name = full_name.strip()
    email = email.strip().lower()

    if not full_name or len(full_name) < 2:
        raise ValueError("Full name must be at least 2 characters.")

    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise ValueError("Invalid email address.")

    if role not in VALID_ROLES:
        raise ValueError(f"Role must be one of: {', '.join(sorted(VALID_ROLES))}.")

    _validate_password_strength(password)

    if get_user_by_email(email):
        raise ValueError("An account with this email already exists.")

    # --- Create record ---
    user = UserRecord(
        id=str(uuid.uuid4()),
        full_name=full_name,
        email=email,
        role=role,
        hashed_password=hash_password(password),
        created_at=time.time(),
    )
    users = _load_users()
    users[user.id] = user
    _save_users(users)
    return user


def _validate_password_strength(password: str) -> None:
    """
    Enforce minimum password requirements:
      - At least 8 characters
      - At least one uppercase letter
      - At least one lowercase letter
      - At least one digit
    """
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters.")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain at least one uppercase letter.")
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must contain at least one lowercase letter.")
    if not re.search(r"\d", password):
        raise ValueError("Password must contain at least one number.")


def authenticate_user(email: str, password: str) -> Optional[UserRecord]:
    user = get_user_by_email(email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user
