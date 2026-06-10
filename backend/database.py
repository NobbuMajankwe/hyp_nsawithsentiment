"""
database.py — PostgreSQL connection and schema management
=========================================================
Uses psycopg2 (synchronous) to keep the stack simple with FastAPI's
default thread-pool execution model.

The DATABASE_URL is read from the environment variable of the same name,
falling back to the local development value if not set.
"""

from __future__ import annotations

import os
import psycopg2
import psycopg2.extras
from contextlib import contextmanager
from typing import Generator

# ---------------------------------------------------------------------------
# Connection string
# ---------------------------------------------------------------------------

DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql://signal_admin:StrongPassword123@localhost:5432/signalcheck_ai",
)

# ---------------------------------------------------------------------------
# Connection helper
# ---------------------------------------------------------------------------

def get_connection() -> psycopg2.extensions.connection:
    """Open and return a new psycopg2 connection."""
    return psycopg2.connect(DATABASE_URL)


@contextmanager
def get_cursor(
    commit: bool = False,
) -> Generator[psycopg2.extras.RealDictCursor, None, None]:
    """
    Context manager that yields a RealDictCursor.

    Usage:
        with get_cursor(commit=True) as cur:
            cur.execute("INSERT INTO ...")

    Automatically commits if `commit=True` and rolls back on exception.
    """
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            yield cur
            if commit:
                conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Schema initialisation
# ---------------------------------------------------------------------------

CREATE_USERS_TABLE = """
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name       TEXT        NOT NULL,
    email           TEXT        NOT NULL UNIQUE,
    role            TEXT        NOT NULL CHECK (role IN ('event_organiser', 'system_admin')),
    hashed_password TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""


def init_db() -> None:
    """
    Create the database schema if it does not already exist.
    Called once at application startup from main.py.
    """
    with get_cursor(commit=True) as cur:
        cur.execute(CREATE_USERS_TABLE)
    print("[db] Schema initialised.")
