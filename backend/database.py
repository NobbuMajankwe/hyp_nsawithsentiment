from __future__ import annotations

import logging
import os
from collections.abc import Iterator
from contextlib import contextmanager

import psycopg2
from psycopg2.extensions import connection
from psycopg2.extras import RealDictCursor


# Logging

logger = logging.getLogger(__name__)


# Database configuration

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://eventsense_admin:StrongPassword123@localhost:5432/eventsense_ai",
)


# Connection helpers

def get_connection() -> connection:
    if not DATABASE_URL:
        raise RuntimeError("Set DATABASE_URL before starting the API.")
    return psycopg2.connect(DATABASE_URL)


@contextmanager
def get_cursor(
    commit: bool = False,
) -> Iterator[RealDictCursor]:

    conn = get_connection()

    try:
        with conn.cursor(
            cursor_factory=RealDictCursor
        ) as cursor:

            yield cursor

        if commit:
            conn.commit()

    except Exception:
        conn.rollback()
        raise

    finally:
        conn.close()


# USERS

CREATE_USERS_TABLE = """
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,

    full_name VARCHAR(255) NOT NULL,

    email VARCHAR(255)
        UNIQUE
        NOT NULL,

    password_hash TEXT NOT NULL,

    role VARCHAR(50) NOT NULL
        CHECK (
            role IN (
                'EVENT_ORGANISER',
                'SYSTEM_ADMIN'
            )
        ),

    is_verified BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);
"""


# DATASETS

CREATE_DATASETS_TABLE = """
CREATE TABLE IF NOT EXISTS datasets (
    dataset_id SERIAL PRIMARY KEY,

    source_name VARCHAR(255)
        NOT NULL,

    source_type VARCHAR(50)
        CHECK (
            source_type IN (
                'CSV',
                'JSON',
                'API'
            )
        ),

    dataset_description TEXT,

    file_path TEXT,

    total_records INTEGER
        DEFAULT 0,

    status VARCHAR(50)
        DEFAULT 'LOADED',

    /*
        Research role:

        SELF_CORPUS:
            Normal feedback used to train the NSA.

        EVALUATION:
            Labelled dataset used for quantitative evaluation.

        ANALYSIS:
            Unlabelled dataset used for exploratory analysis.

        SUPPORT:
            Stop-word lists or other supporting datasets.
    */

    research_role VARCHAR(50)
        DEFAULT 'ANALYSIS'
        CHECK (
            research_role IN (
                'SELF_CORPUS',
                'EVALUATION',
                'ANALYSIS',
                'SUPPORT'
            )
        ),

    loaded_by INTEGER
        REFERENCES users(user_id),

    loaded_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);
"""


# FEEDBACK RECORDS

CREATE_FEEDBACK_RECORDS_TABLE = """
CREATE TABLE IF NOT EXISTS feedback_records (
    feedback_id SERIAL PRIMARY KEY,

    dataset_id INTEGER
        REFERENCES datasets(dataset_id)
        ON DELETE CASCADE,

    raw_text TEXT
        NOT NULL,

    cleaned_text TEXT,

    tokens JSONB,

    vector JSONB,

    preprocessing_complete BOOLEAN
        DEFAULT FALSE,

    /*
        Optional ground-truth label.

        NULL means the record is unlabelled.

        SELF:
            Expected normal feedback.

        NON_SELF:
            Known anomalous / non-self feedback.
    */

    ground_truth_label VARCHAR(20)
        CHECK (
            ground_truth_label IS NULL
            OR ground_truth_label IN (
                'SELF',
                'NON_SELF'
            )
        ),

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);
"""


# PREPROCESSING LOG

CREATE_PREPROCESSING_LOG_TABLE = """
CREATE TABLE IF NOT EXISTS preprocessing_log (
    preprocessing_id SERIAL PRIMARY KEY,

    feedback_id INTEGER
        REFERENCES feedback_records(feedback_id)
        ON DELETE CASCADE,

    cleaning_applied BOOLEAN
        DEFAULT FALSE,

    stop_words_removed BOOLEAN
        DEFAULT FALSE,

    lemmatisation_applied BOOLEAN
        DEFAULT FALSE,

    tokenization_complete BOOLEAN
        DEFAULT FALSE,

    normalization_complete BOOLEAN
        DEFAULT FALSE,

    original_token_count INTEGER,

    processed_token_count INTEGER,

    vocabulary_coverage NUMERIC(10,6),

    out_of_vocabulary_ratio NUMERIC(10,6),

    preprocessing_duration_ms NUMERIC(12,3),

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);
"""


# RESEARCH EXPERIMENTS

CREATE_EXPERIMENT_RUNS_TABLE = """
CREATE TABLE IF NOT EXISTS experiment_runs (
    experiment_id SERIAL PRIMARY KEY,

    user_id INTEGER
        REFERENCES users(user_id),

    dataset_id INTEGER
        REFERENCES datasets(dataset_id),

    /*
        Dataset used to define SELF.

        This is deliberately recorded separately
        from the evaluation/analysis dataset.
    */

    training_dataset_id INTEGER
        REFERENCES datasets(dataset_id),

    experiment_name VARCHAR(255)
        NOT NULL,

    experiment_description TEXT,

    /*
        Reproducible fingerprint of the SELF corpus.
    */

    training_corpus_hash VARCHAR(64),

    /*
        NSA PARAMETERS
    */

    requested_detector_count INTEGER
        NOT NULL,

    generated_detector_count INTEGER,

    detector_radius NUMERIC(12,8)
        NOT NULL,

    self_match_threshold NUMERIC(12,8)
        NOT NULL,

    max_attempts INTEGER
        NOT NULL,

    random_seed INTEGER
        NOT NULL,

    /*
        FEATURE SPACE INFORMATION
    */

    vocabulary_size INTEGER,

    self_corpus_size INTEGER,

    /*
        DETECTOR GENERATION INFORMATION
    */

    detector_generation_attempts INTEGER,

    detector_acceptance_rate NUMERIC(12,8),

    /*
        RESULT COUNTS
    */

    total_records INTEGER,

    self_count INTEGER
        DEFAULT 0,

    non_self_count INTEGER
        DEFAULT 0,

    oov_count INTEGER
        DEFAULT 0,

    detector_match_count INTEGER
        DEFAULT 0,

    /*
        CONFUSION MATRIX

        These remain NULL when an experiment
        runs on an unlabelled dataset.
    */

    true_positive INTEGER,

    true_negative INTEGER,

    false_positive INTEGER,

    false_negative INTEGER,

    /*
        EVALUATION METRICS
    */

    accuracy NUMERIC(12,8),

    precision_score NUMERIC(12,8),

    recall_score NUMERIC(12,8),

    specificity NUMERIC(12,8),

    f1_score NUMERIC(12,8),

    detection_rate NUMERIC(12,8),

    false_alarm_rate NUMERIC(12,8),

    false_negative_rate NUMERIC(12,8),

    /*
        PERFORMANCE
    */

    training_time_ms NUMERIC(14,3),

    detection_time_ms NUMERIC(14,3),

    total_execution_time_ms NUMERIC(14,3),

    /*
        STATE
    */

    status VARCHAR(30)
        DEFAULT 'COMPLETED'
        CHECK (
            status IN (
                'RUNNING',
                'COMPLETED',
                'FAILED'
            )
        ),

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);
"""


# NSA DETECTORS

CREATE_NSA_DETECTORS_TABLE = """
CREATE TABLE IF NOT EXISTS nsa_detectors (
    detector_id SERIAL PRIMARY KEY,

    experiment_id INTEGER
        REFERENCES experiment_runs(experiment_id)
        ON DELETE CASCADE,

    /*
        Sequential detector number within
        a particular experiment.
    */

    detector_index INTEGER
        NOT NULL,

    detector_vector JSONB
        NOT NULL,

    radius NUMERIC(12,8)
        NOT NULL,

    /*
        Minimum distance between this detector
        and any SELF training sample.
    */

    minimum_self_distance NUMERIC(12,8),

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (
        experiment_id,
        detector_index
    )
);
"""


# EXPERIMENT RESULTS

CREATE_EXPERIMENT_RESULTS_TABLE = """
CREATE TABLE IF NOT EXISTS experiment_results (
    result_id SERIAL PRIMARY KEY,

    experiment_id INTEGER
        REFERENCES experiment_runs(experiment_id)
        ON DELETE CASCADE,

    feedback_id INTEGER
        REFERENCES feedback_records(feedback_id)
        ON DELETE SET NULL,

    record_index INTEGER
        NOT NULL,

    original_text TEXT
        NOT NULL,

    cleaned_text TEXT,

    tokens JSONB,

    /*
        Ground truth is optional.

        It is populated only for labelled
        evaluation datasets.
    */

    ground_truth_label VARCHAR(20)
        CHECK (
            ground_truth_label IS NULL
            OR ground_truth_label IN (
                'SELF',
                'NON_SELF'
            )
        ),

    /*
        Actual NSA prediction.
    */

    predicted_class VARCHAR(20)
        NOT NULL
        CHECK (
            predicted_class IN (
                'SELF',
                'NON_SELF',
                'OOV'
            )
        ),

    /*
        Closest SELF sample in the feature space.
    */

    nearest_self_distance NUMERIC(12,8),

    /*
        Closest NSA detector.
    */

    nearest_detector_distance NUMERIC(12,8),

    matched_detector_id INTEGER
        REFERENCES nsa_detectors(detector_id)
        ON DELETE SET NULL,

    detector_radius NUMERIC(12,8),

    detector_margin NUMERIC(12,8),

    /*
        Text representation quality.
    */

    vocabulary_coverage NUMERIC(12,8),

    out_of_vocabulary_ratio NUMERIC(12,8),

    /*
        Derived display score.

        Important:
        This is NOT the primary NSA
        classification criterion.
    */

    anomaly_score NUMERIC(12,8),

    classification_reason TEXT,

    detection_time_ms NUMERIC(14,3),

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (
        experiment_id,
        record_index
    )
);
"""


# OPTIONAL SESSION STORAGE
#
# Sessions are kept separate from research experiments.
#
# These can support the UI but should NOT be used as the
# primary source of experimental research results.

CREATE_NSA_SESSIONS_TABLE = """
CREATE TABLE IF NOT EXISTS nsa_sessions (
    session_id SERIAL PRIMARY KEY,

    user_id INTEGER
        REFERENCES users(user_id)
        ON DELETE CASCADE,

    input_hash TEXT
        NOT NULL,

    experiment_id INTEGER
        REFERENCES experiment_runs(experiment_id)
        ON DELETE SET NULL,

    total_records INTEGER
        NOT NULL,

    self_records INTEGER
        NOT NULL
        DEFAULT 0,

    non_self_records INTEGER
        NOT NULL
        DEFAULT 0,

    oov_records INTEGER
        NOT NULL
        DEFAULT 0,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);
"""


CREATE_NSA_SESSION_RESULTS_TABLE = """
CREATE TABLE IF NOT EXISTS nsa_session_results (
    result_id SERIAL PRIMARY KEY,

    session_id INTEGER
        REFERENCES nsa_sessions(session_id)
        ON DELETE CASCADE,

    record_index INTEGER
        NOT NULL,

    original_text TEXT
        NOT NULL,

    cleaned_text TEXT,

    tokens JSONB,

    classification VARCHAR(20)
        NOT NULL
        CHECK (
            classification IN (
                'SELF',
                'NON_SELF',
                'OOV'
            )
        ),

    nearest_self_distance NUMERIC(12,8),

    nearest_detector_distance NUMERIC(12,8),

    matched_detector_id INTEGER,

    detector_margin NUMERIC(12,8),

    vocabulary_coverage NUMERIC(12,8),

    out_of_vocabulary_ratio NUMERIC(12,8),

    anomaly_score NUMERIC(12,8),

    classification_reason TEXT,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);
"""


# USER NSA CONFIGURATION

CREATE_INTEGRATION_SETTINGS_TABLE = """
CREATE TABLE IF NOT EXISTS integration_settings (
    setting_id SERIAL PRIMARY KEY,

    user_id INTEGER
        REFERENCES users(user_id)
        ON DELETE CASCADE,

    /*
        External integration settings.
    */

    ext_api_url TEXT,

    ext_api_token TEXT,

    ext_data_path TEXT,

    ext_text_field VARCHAR(100)
        DEFAULT 'text',

    ext_id_field VARCHAR(100)
        DEFAULT 'id',

    webhook_url TEXT,

    webhook_secret TEXT,

    webhook_enabled BOOLEAN
        DEFAULT FALSE,

    /*
        NSA research configuration.
    */

    nsa_detector_count INTEGER
        DEFAULT 200,

    nsa_detector_radius NUMERIC(12,8)
        DEFAULT 0.40,

    nsa_self_match_threshold NUMERIC(12,8)
        DEFAULT 0.75,

    nsa_max_attempts INTEGER
        DEFAULT 10000,

    nsa_random_seed INTEGER
        DEFAULT 42,

    /*
        Optional external NSA endpoint.
    */

    nsa_api_url TEXT,

    api_key TEXT UNIQUE,

    api_key_label VARCHAR(255),

    api_key_created_at TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id)
);
"""


# OTP

CREATE_OTP_TABLE = """
CREATE TABLE IF NOT EXISTS otp_codes (
    otp_id SERIAL PRIMARY KEY,

    email TEXT
        NOT NULL,

    code TEXT
        NOT NULL,

    purpose TEXT
        NOT NULL
        CHECK (
            purpose IN (
                'verify_email',
                'reset_password'
            )
        ),

    used BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    expires_at TIMESTAMP
        NOT NULL,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);
"""


# INDEXES

CREATE_INDEXES = """

CREATE INDEX IF NOT EXISTS idx_feedback_dataset
ON feedback_records(dataset_id);


CREATE INDEX IF NOT EXISTS idx_feedback_ground_truth
ON feedback_records(ground_truth_label);


CREATE INDEX IF NOT EXISTS idx_dataset_research_role
ON datasets(research_role);


CREATE INDEX IF NOT EXISTS idx_experiment_dataset
ON experiment_runs(dataset_id);


CREATE INDEX IF NOT EXISTS idx_experiment_training_dataset
ON experiment_runs(training_dataset_id);


CREATE INDEX IF NOT EXISTS idx_experiment_user
ON experiment_runs(user_id);


CREATE INDEX IF NOT EXISTS idx_experiment_created
ON experiment_runs(created_at);


CREATE INDEX IF NOT EXISTS idx_detector_experiment
ON nsa_detectors(experiment_id);


CREATE INDEX IF NOT EXISTS idx_experiment_results_experiment
ON experiment_results(experiment_id);


CREATE INDEX IF NOT EXISTS idx_experiment_results_feedback
ON experiment_results(feedback_id);


CREATE INDEX IF NOT EXISTS idx_experiment_results_prediction
ON experiment_results(predicted_class);


CREATE INDEX IF NOT EXISTS idx_experiment_results_detector
ON experiment_results(matched_detector_id);


CREATE INDEX IF NOT EXISTS idx_nsa_sessions_user
ON nsa_sessions(user_id);


CREATE INDEX IF NOT EXISTS idx_nsa_sessions_experiment
ON nsa_sessions(experiment_id);


CREATE INDEX IF NOT EXISTS idx_nsa_session_results_session
ON nsa_session_results(session_id);


CREATE INDEX IF NOT EXISTS idx_otp_email_purpose
ON otp_codes(email, purpose);

"""


# MIGRATIONS
#
# These allow an existing development database to acquire
# the new research fields without immediately deleting all
# existing tables.

MIGRATE_DATASETS_RESEARCH_ROLE = """
ALTER TABLE datasets
ADD COLUMN IF NOT EXISTS research_role VARCHAR(50)
DEFAULT 'ANALYSIS';
"""


MIGRATE_FEEDBACK_GROUND_TRUTH = """
ALTER TABLE feedback_records
ADD COLUMN IF NOT EXISTS ground_truth_label VARCHAR(20);
"""


MIGRATE_INTEGRATION_SETTINGS = """
ALTER TABLE integration_settings
ADD COLUMN IF NOT EXISTS nsa_detector_radius NUMERIC(12,8)
DEFAULT 0.40;

ALTER TABLE integration_settings
ADD COLUMN IF NOT EXISTS nsa_self_match_threshold NUMERIC(12,8)
DEFAULT 0.75;

ALTER TABLE integration_settings
ADD COLUMN IF NOT EXISTS nsa_max_attempts INTEGER
DEFAULT 10000;

ALTER TABLE integration_settings
ADD COLUMN IF NOT EXISTS nsa_random_seed INTEGER
DEFAULT 42;

ALTER TABLE integration_settings
ADD COLUMN IF NOT EXISTS nsa_api_url TEXT;
"""


# CREATE TABLE IF NOT EXISTS does not update tables created by earlier versions.
# Keep these changes before CREATE_INDEXES, which references the new columns.
# Columns added to tables with existing rows remain nullable; new application
# writes populate them. Do not infer a training dataset from legacy dataset_id.
MIGRATE_EXISTING_RESEARCH_TABLES = """
ALTER TABLE experiment_runs
    ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(user_id),
    ADD COLUMN IF NOT EXISTS training_dataset_id INTEGER REFERENCES datasets(dataset_id),
    ADD COLUMN IF NOT EXISTS experiment_description TEXT,
    ADD COLUMN IF NOT EXISTS training_corpus_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS requested_detector_count INTEGER,
    ADD COLUMN IF NOT EXISTS generated_detector_count INTEGER,
    ADD COLUMN IF NOT EXISTS detector_radius NUMERIC(12,8),
    ADD COLUMN IF NOT EXISTS self_match_threshold NUMERIC(12,8),
    ADD COLUMN IF NOT EXISTS max_attempts INTEGER,
    ADD COLUMN IF NOT EXISTS random_seed INTEGER,
    ADD COLUMN IF NOT EXISTS vocabulary_size INTEGER,
    ADD COLUMN IF NOT EXISTS self_corpus_size INTEGER,
    ADD COLUMN IF NOT EXISTS detector_generation_attempts INTEGER,
    ADD COLUMN IF NOT EXISTS detector_acceptance_rate NUMERIC(12,8),
    ADD COLUMN IF NOT EXISTS total_records INTEGER,
    ADD COLUMN IF NOT EXISTS self_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS non_self_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS oov_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS detector_match_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS true_positive INTEGER,
    ADD COLUMN IF NOT EXISTS true_negative INTEGER,
    ADD COLUMN IF NOT EXISTS false_positive INTEGER,
    ADD COLUMN IF NOT EXISTS false_negative INTEGER,
    ADD COLUMN IF NOT EXISTS specificity NUMERIC(12,8),
    ADD COLUMN IF NOT EXISTS false_negative_rate NUMERIC(12,8),
    ADD COLUMN IF NOT EXISTS training_time_ms NUMERIC(14,3),
    ADD COLUMN IF NOT EXISTS detection_time_ms NUMERIC(14,3),
    ADD COLUMN IF NOT EXISTS total_execution_time_ms NUMERIC(14,3),
    ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'COMPLETED';

ALTER TABLE experiment_runs
    ALTER COLUMN accuracy TYPE NUMERIC(12,8),
    ALTER COLUMN precision_score TYPE NUMERIC(12,8),
    ALTER COLUMN recall_score TYPE NUMERIC(12,8),
    ALTER COLUMN f1_score TYPE NUMERIC(12,8),
    ALTER COLUMN detection_rate TYPE NUMERIC(12,8),
    ALTER COLUMN false_alarm_rate TYPE NUMERIC(12,8);

ALTER TABLE nsa_detectors
    ADD COLUMN IF NOT EXISTS experiment_id INTEGER REFERENCES experiment_runs(experiment_id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS detector_index INTEGER,
    ADD COLUMN IF NOT EXISTS minimum_self_distance NUMERIC(12,8);

ALTER TABLE nsa_detectors ALTER COLUMN radius TYPE NUMERIC(12,8);
CREATE UNIQUE INDEX IF NOT EXISTS idx_detector_experiment_index
    ON nsa_detectors(experiment_id, detector_index);

ALTER TABLE nsa_sessions
    ADD COLUMN IF NOT EXISTS experiment_id INTEGER REFERENCES experiment_runs(experiment_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS self_records INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS non_self_records INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS oov_records INTEGER DEFAULT 0;

ALTER TABLE nsa_session_results
    ADD COLUMN IF NOT EXISTS classification VARCHAR(20),
    ADD COLUMN IF NOT EXISTS nearest_self_distance NUMERIC(12,8),
    ADD COLUMN IF NOT EXISTS nearest_detector_distance NUMERIC(12,8),
    ADD COLUMN IF NOT EXISTS matched_detector_id INTEGER,
    ADD COLUMN IF NOT EXISTS detector_margin NUMERIC(12,8),
    ADD COLUMN IF NOT EXISTS vocabulary_coverage NUMERIC(12,8),
    ADD COLUMN IF NOT EXISTS out_of_vocabulary_ratio NUMERIC(12,8),
    ADD COLUMN IF NOT EXISTS classification_reason TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- These legacy columns do not exist on a freshly created research schema.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = current_schema() AND table_name = 'nsa_sessions'
                 AND column_name = 'valid_records') THEN
        ALTER TABLE nsa_sessions ALTER COLUMN valid_records SET DEFAULT 0;
        ALTER TABLE nsa_sessions ALTER COLUMN suspicious_records SET DEFAULT 0;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = current_schema() AND table_name = 'nsa_session_results'
                 AND column_name = 'nsa_status') THEN
        ALTER TABLE nsa_session_results ALTER COLUMN nsa_status DROP NOT NULL;
        ALTER TABLE nsa_session_results ALTER COLUMN anomaly_score DROP NOT NULL;
        ALTER TABLE nsa_session_results ALTER COLUMN anomaly_reason DROP NOT NULL;
    END IF;
END $$;
"""


# SCHEMA

SCHEMA_STATEMENTS = (

    CREATE_USERS_TABLE,

    CREATE_DATASETS_TABLE,

    CREATE_FEEDBACK_RECORDS_TABLE,

    CREATE_PREPROCESSING_LOG_TABLE,

    CREATE_EXPERIMENT_RUNS_TABLE,

    CREATE_NSA_DETECTORS_TABLE,

    CREATE_EXPERIMENT_RESULTS_TABLE,

    CREATE_NSA_SESSIONS_TABLE,

    CREATE_NSA_SESSION_RESULTS_TABLE,

    CREATE_INTEGRATION_SETTINGS_TABLE,

    CREATE_OTP_TABLE,

    MIGRATE_DATASETS_RESEARCH_ROLE,

    MIGRATE_FEEDBACK_GROUND_TRUTH,

    MIGRATE_INTEGRATION_SETTINGS,

    MIGRATE_EXISTING_RESEARCH_TABLES,

    CREATE_INDEXES,
)


# INITIALISATION

def init_db() -> None:

    with get_cursor(
        commit=True
    ) as cursor:

        for statement in SCHEMA_STATEMENTS:
            cursor.execute(statement)

    logger.info(
        "NSA research database schema initialised."
    )
