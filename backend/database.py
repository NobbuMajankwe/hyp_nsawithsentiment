"""
database.py — PostgreSQL connection and schema management
=========================================================
Uses psycopg2 for PostgreSQL connection and schema creation.

Database:
    eventsense_ai

Main tables:
    users
    datasets
    feedback_records
    preprocessing_log
    nsa_detectors
    anomaly_results
    sentiment_results
    reports
    system_configuration
    experiment_runs
"""

from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Generator

import psycopg2
import psycopg2.extras


DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql://eventsense_admin:StrongPassword123@localhost:5432/eventsense_ai",
)


def get_connection() -> psycopg2.extensions.connection:
    """Open and return a new PostgreSQL connection."""
    return psycopg2.connect(DATABASE_URL)


@contextmanager
def get_cursor(
    commit: bool = False,
) -> Generator[psycopg2.extras.RealDictCursor, None, None]:
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


CREATE_USERS_TABLE = """
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (
        role IN ('EVENT_ORGANISER', 'SYSTEM_ADMIN')
    ),
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


CREATE_DATASETS_TABLE = """
CREATE TABLE IF NOT EXISTS datasets (
    dataset_id SERIAL PRIMARY KEY,
    source_name VARCHAR(255) NOT NULL,
    source_type VARCHAR(50) CHECK (
        source_type IN ('CSV', 'JSON', 'API')
    ),
    dataset_description TEXT,
    file_path TEXT,
    total_records INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'LOADED',
    loaded_by INTEGER REFERENCES users(user_id),
    loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


CREATE_FEEDBACK_RECORDS_TABLE = """
CREATE TABLE IF NOT EXISTS feedback_records (
    feedback_id SERIAL PRIMARY KEY,
    dataset_id INTEGER REFERENCES datasets(dataset_id) ON DELETE CASCADE,
    raw_text TEXT NOT NULL,
    cleaned_text TEXT,
    tokens JSONB,
    vector JSONB,
    preprocessing_complete BOOLEAN DEFAULT FALSE,
    is_valid BOOLEAN DEFAULT TRUE,
    is_anomalous BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


CREATE_PREPROCESSING_LOG_TABLE = """
CREATE TABLE IF NOT EXISTS preprocessing_log (
    preprocessing_id SERIAL PRIMARY KEY,
    feedback_id INTEGER REFERENCES feedback_records(feedback_id) ON DELETE CASCADE,
    cleaning_applied BOOLEAN DEFAULT FALSE,
    stop_words_removed BOOLEAN DEFAULT FALSE,
    tokenization_complete BOOLEAN DEFAULT FALSE,
    normalization_complete BOOLEAN DEFAULT FALSE,
    preprocessing_duration_ms NUMERIC(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


CREATE_NSA_DETECTORS_TABLE = """
CREATE TABLE IF NOT EXISTS nsa_detectors (
    detector_id SERIAL PRIMARY KEY,
    dataset_id INTEGER REFERENCES datasets(dataset_id) ON DELETE CASCADE,
    detector_vector JSONB,
    radius NUMERIC(10,4),
    threshold NUMERIC(10,4),
    detector_version VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


CREATE_ANOMALY_RESULTS_TABLE = """
CREATE TABLE IF NOT EXISTS anomaly_results (
    anomaly_id SERIAL PRIMARY KEY,
    feedback_id INTEGER REFERENCES feedback_records(feedback_id) ON DELETE CASCADE,
    detector_id INTEGER REFERENCES nsa_detectors(detector_id),
    is_anomalous BOOLEAN NOT NULL,
    anomaly_score NUMERIC(6,2),
    anomaly_reason TEXT,
    detection_time_ms NUMERIC(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


CREATE_SENTIMENT_RESULTS_TABLE = """
CREATE TABLE IF NOT EXISTS sentiment_results (
    sentiment_id SERIAL PRIMARY KEY,
    feedback_id INTEGER REFERENCES feedback_records(feedback_id) ON DELETE CASCADE,
    sentiment_label VARCHAR(50) CHECK (
        sentiment_label IN ('POSITIVE', 'NEGATIVE', 'NEUTRAL')
    ),
    confidence_score NUMERIC(6,2),
    model_name VARCHAR(100) DEFAULT 'DistilBERT',
    inference_time_ms NUMERIC(10,2),
    classified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


CREATE_REPORTS_TABLE = """
CREATE TABLE IF NOT EXISTS reports (
    report_id SERIAL PRIMARY KEY,
    dataset_id INTEGER REFERENCES datasets(dataset_id),
    generated_by INTEGER REFERENCES users(user_id),
    report_title VARCHAR(255),
    report_summary TEXT,
    total_feedback INTEGER,
    suspicious_feedback INTEGER,
    valid_feedback INTEGER,
    positive_count INTEGER,
    negative_count INTEGER,
    neutral_count INTEGER,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


CREATE_SYSTEM_CONFIGURATION_TABLE = """
CREATE TABLE IF NOT EXISTS system_configuration (
    config_id SERIAL PRIMARY KEY,
    nsa_threshold NUMERIC(10,4),
    detector_count INTEGER,
    sentiment_model VARCHAR(100),
    updated_by INTEGER REFERENCES users(user_id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


CREATE_EXPERIMENT_RUNS_TABLE = """
CREATE TABLE IF NOT EXISTS experiment_runs (
    experiment_id SERIAL PRIMARY KEY,
    dataset_id INTEGER REFERENCES datasets(dataset_id),
    experiment_name VARCHAR(255),
    accuracy NUMERIC(6,2),
    precision_score NUMERIC(6,2),
    recall_score NUMERIC(6,2),
    f1_score NUMERIC(6,2),
    roc_auc NUMERIC(6,2),
    detection_rate NUMERIC(6,2),
    false_alarm_rate NUMERIC(6,2),
    execution_time_seconds NUMERIC(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


CREATE_INDEXES = """
CREATE INDEX IF NOT EXISTS idx_feedback_dataset
ON feedback_records(dataset_id);

CREATE INDEX IF NOT EXISTS idx_anomaly_feedback
ON anomaly_results(feedback_id);

CREATE INDEX IF NOT EXISTS idx_sentiment_feedback
ON sentiment_results(feedback_id);

CREATE INDEX IF NOT EXISTS idx_detector_dataset
ON nsa_detectors(dataset_id);

CREATE INDEX IF NOT EXISTS idx_report_dataset
ON reports(dataset_id);
"""

# ---------------------------------------------------------------------------
# NSA analysis session caching
# ---------------------------------------------------------------------------

CREATE_NSA_SESSIONS_TABLE = """
CREATE TABLE IF NOT EXISTS nsa_sessions (
    session_id   SERIAL PRIMARY KEY,
    user_id      INTEGER REFERENCES users(user_id),
    input_hash   TEXT NOT NULL,
    total_records     INTEGER NOT NULL,
    valid_records     INTEGER NOT NULL,
    suspicious_records INTEGER NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_nsa_sessions_user_hash
ON nsa_sessions(user_id, input_hash);
"""

CREATE_NSA_SESSION_RESULTS_TABLE = """
CREATE TABLE IF NOT EXISTS nsa_session_results (
    result_id      SERIAL PRIMARY KEY,
    session_id     INTEGER REFERENCES nsa_sessions(session_id) ON DELETE CASCADE,
    record_index   INTEGER NOT NULL,
    original_text  TEXT NOT NULL,
    cleaned_text   TEXT NOT NULL,
    tokens         JSONB NOT NULL,
    nsa_status     TEXT NOT NULL,
    anomaly_score  INTEGER NOT NULL,
    anomaly_reason TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_nsa_session_results_session
ON nsa_session_results(session_id);
"""

CREATE_INTEGRATION_SETTINGS_TABLE = """
CREATE TABLE IF NOT EXISTS integration_settings (
    setting_id      SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(user_id) ON DELETE CASCADE,

    -- External data source
    ext_api_url     TEXT,
    ext_api_token   TEXT,
    ext_data_path   TEXT,
    ext_text_field  VARCHAR(100) DEFAULT 'text',
    ext_id_field    VARCHAR(100) DEFAULT 'id',

    -- Webhook / push results back
    webhook_url     TEXT,
    webhook_secret  TEXT,
    webhook_enabled BOOLEAN DEFAULT FALSE,

    -- NSA engine overrides (per-user; falls back to system_configuration)
    nsa_threshold   NUMERIC(10,4),
    nsa_detector_count INTEGER,

    -- API key for external systems calling EventSense
    api_key         TEXT UNIQUE,
    api_key_label   VARCHAR(255),
    api_key_created_at TIMESTAMP,

    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);
"""

CREATE_OTP_TABLE = """
CREATE TABLE IF NOT EXISTS otp_codes (
    otp_id      SERIAL PRIMARY KEY,
    email       TEXT NOT NULL,
    code        TEXT NOT NULL,
    purpose     TEXT NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
    used        BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at  TIMESTAMP NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_otp_email_purpose
ON otp_codes(email, purpose);
"""


def init_db() -> None:
    """
    Create the full EventSense AI database schema if it does not already exist.
    Called once at application startup from main.py.
    """
    statements = [
        CREATE_USERS_TABLE,
        CREATE_DATASETS_TABLE,
        CREATE_FEEDBACK_RECORDS_TABLE,
        CREATE_PREPROCESSING_LOG_TABLE,
        CREATE_NSA_DETECTORS_TABLE,
        CREATE_ANOMALY_RESULTS_TABLE,
        CREATE_SENTIMENT_RESULTS_TABLE,
        CREATE_REPORTS_TABLE,
        CREATE_SYSTEM_CONFIGURATION_TABLE,
        CREATE_EXPERIMENT_RUNS_TABLE,
        CREATE_INDEXES,
        CREATE_NSA_SESSIONS_TABLE,
        CREATE_NSA_SESSION_RESULTS_TABLE,
        CREATE_OTP_TABLE,
        CREATE_INTEGRATION_SETTINGS_TABLE,
    ]

    with get_cursor(commit=True) as cur:
        for statement in statements:
            cur.execute(statement)

    print("[db] EventSense AI schema initialised.")
