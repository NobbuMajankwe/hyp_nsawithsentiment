from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import time
from dataclasses import dataclass

from database import get_cursor


JWT_SECRET = os.getenv("JWT_SECRET", "eventsense-dev-secret-change-in-prod")
JWT_EXPIRY_SECONDS = 8 * 60 * 60
VALID_ROLES = {"EVENT_ORGANISER", "SYSTEM_ADMIN"}
PBKDF2_ITERATIONS = 260_000


@dataclass
class UserRecord:
    user_id: int
    full_name: str
    email: str
    role: str
    password_hash: str
    created_at: float


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _create_jwt(payload: dict) -> str:
    header = _b64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode("utf-8"))
    body = _b64url_encode(json.dumps(payload).encode("utf-8"))

    signature = hmac.new(
        JWT_SECRET.encode("utf-8"),
        f"{header}.{body}".encode("utf-8"),
        hashlib.sha256,
    ).digest()

    return f"{header}.{body}.{_b64url_encode(signature)}"


def _verify_jwt(token: str) -> dict | None:
    try:
        header, body, signature = token.split(".")

        expected_signature = hmac.new(
            JWT_SECRET.encode("utf-8"),
            f"{header}.{body}".encode("utf-8"),
            hashlib.sha256,
        ).digest()

        if not hmac.compare_digest(
            _b64url_decode(signature),
            expected_signature,
        ):
            return None

        payload = json.loads(_b64url_decode(body))

        if payload.get("exp", 0) < time.time():
            return None

        return payload
    except (ValueError, TypeError, json.JSONDecodeError):
        return None


def create_access_token(user: UserRecord) -> str:
    now = int(time.time())

    return _create_jwt(
        {
            "sub": str(user.user_id),
            "email": user.email,
            "role": user.role,
            "name": user.full_name,
            "iat": now,
            "exp": now + JWT_EXPIRY_SECONDS,
        }
    )


def decode_access_token(token: str) -> dict | None:
    return _verify_jwt(token)


try:
    import bcrypt
except ImportError:
    bcrypt = None


def hash_password(password: str) -> str:
    if bcrypt is not None:
        return bcrypt.hashpw(
            password.encode("utf-8"),
            bcrypt.gensalt(rounds=12),
        ).decode("utf-8")

    salt = os.urandom(16).hex()
    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PBKDF2_ITERATIONS,
    )

    return f"pbkdf2:{salt}:{password_hash.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    if stored_hash.startswith("pbkdf2:"):
        try:
            _, salt, expected_hash = stored_hash.split(":", 2)
        except ValueError:
            return False

        password_hash = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            PBKDF2_ITERATIONS,
        )

        return hmac.compare_digest(password_hash.hex(), expected_hash)

    if bcrypt is None:
        return False

    try:
        return bcrypt.checkpw(
            password.encode("utf-8"),
            stored_hash.encode("utf-8"),
        )
    except ValueError:
        return False


def _validate_password(password: str) -> None:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters.")

    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain at least one uppercase letter.")

    if not re.search(r"[a-z]", password):
        raise ValueError("Password must contain at least one lowercase letter.")

    if not re.search(r"\d", password):
        raise ValueError("Password must contain at least one number.")


def _normalise_role(role: str) -> str:
    normalised_role = role.strip().upper()

    if normalised_role not in VALID_ROLES:
        raise ValueError("Role must be EVENT_ORGANISER or SYSTEM_ADMIN.")

    return normalised_role


def _row_to_user(row: dict) -> UserRecord:
    created_at = row["created_at"]

    if hasattr(created_at, "timestamp"):
        created_at = created_at.timestamp()
    else:
        created_at = float(created_at)

    return UserRecord(
        user_id=int(row["user_id"]),
        full_name=row["full_name"],
        email=row["email"],
        role=row["role"],
        password_hash=row["password_hash"],
        created_at=created_at,
    )


def get_user_by_email(email: str) -> UserRecord | None:
    with get_cursor() as cursor:
        cursor.execute(
            """
            SELECT *
            FROM users
            WHERE LOWER(email) = LOWER(%s)
            LIMIT 1
            """,
            (email.strip(),),
        )
        row = cursor.fetchone()

    return _row_to_user(row) if row else None


def get_user_by_id(user_id: int | str) -> UserRecord | None:
    with get_cursor() as cursor:
        cursor.execute(
            """
            SELECT *
            FROM users
            WHERE user_id = %s
            LIMIT 1
            """,
            (int(user_id),),
        )
        row = cursor.fetchone()

    return _row_to_user(row) if row else None


def create_user(
    full_name: str,
    email: str,
    password: str,
    role: str,
) -> UserRecord:
    full_name = full_name.strip()
    email = email.strip().lower()
    role = _normalise_role(role)

    if len(full_name) < 2:
        raise ValueError("Full name must be at least 2 characters.")

    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise ValueError("Invalid email address.")

    _validate_password(password)

    if get_user_by_email(email):
        raise ValueError("An account with this email already exists.")

    with get_cursor(commit=True) as cursor:
        cursor.execute(
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
            (
                full_name,
                email,
                hash_password(password),
                role,
            ),
        )
        row = cursor.fetchone()

    return _row_to_user(row)


def authenticate_user(email: str, password: str) -> UserRecord | None:
    user = get_user_by_email(email)

    if not user or not verify_password(password, user.password_hash):
        return None

    return user


def reset_user_password(email: str, new_password: str) -> bool:
    user = get_user_by_email(email.strip().lower())

    if not user:
        return False

    _validate_password(new_password)

    with get_cursor(commit=True) as cursor:
        cursor.execute(
            """
            UPDATE users
            SET password_hash = %s
            WHERE user_id = %s
            """,
            (
                hash_password(new_password),
                user.user_id,
            ),
        )

    return True
