"""
main.py — FastAPI entry point for EventSense AI backend
=========================================================
Endpoints:
  POST /api/auth/register  — create a new account
  POST /api/auth/login     — obtain a JWT
  GET  /api/auth/me        — return current user from token
  POST /api/nsa/analyse    — run NSA analysis (requires valid JWT)

Run with:
    uvicorn main:app --reload --port 8000
"""

import hashlib
import json as _json
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from typing import List, Literal, Optional
from auth import reset_user_password
from nsa import get_nsa, NSAResult
from auth import (
    authenticate_user,
    create_access_token,
    create_user,
    decode_access_token,
    get_user_by_id,
)
from database import init_db, get_cursor
from sentiment import classify_sentiment


# ---------------------------------------------------------------------------
# Cache helpers
# ---------------------------------------------------------------------------


def _feedback_hash(feedback: list[str]) -> str:
    """Stable SHA-256 of the sorted+joined feedback lines."""
    canonical = "\n".join(sorted(line.strip() for line in feedback if line.strip()))
    return hashlib.sha256(canonical.encode()).hexdigest()


def _load_cached_session(user_id: int, input_hash: str) -> dict | None:
    """Return the cached AnalyseResponse dict if it exists, else None."""
    with get_cursor() as cur:
        cur.execute(
            "SELECT * FROM nsa_sessions WHERE user_id = %s AND input_hash = %s LIMIT 1",
            (user_id, input_hash),
        )
        session = cur.fetchone()
        if not session:
            return None

        cur.execute(
            "SELECT * FROM nsa_session_results WHERE session_id = %s ORDER BY record_index",
            (session["session_id"],),
        )
        rows = cur.fetchall()

    results = [
        {
            "id": r["record_index"],
            "originalText": r["original_text"],
            "cleanedText": r["cleaned_text"],
            "tokens": r["tokens"],
            "nsaStatus": r["nsa_status"],
            "anomalyScore": r["anomaly_score"],
            "anomalyReason": r["anomaly_reason"],
        }
        for r in rows
    ]
    return {
        "totalRecords": session["total_records"],
        "validRecords": session["valid_records"],
        "suspiciousRecords": session["suspicious_records"],
        "results": results,
        "cached": True,
    }


def _save_session(user_id: int, input_hash: str, response: "AnalyseResponse") -> None:
    """Persist an analysis response to the DB, replacing any prior run for the same hash."""
    with get_cursor(commit=True) as cur:
        # Upsert the session summary
        cur.execute(
            """
            INSERT INTO nsa_sessions (user_id, input_hash, total_records, valid_records, suspicious_records)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (user_id, input_hash)
            DO UPDATE SET
                total_records      = EXCLUDED.total_records,
                valid_records      = EXCLUDED.valid_records,
                suspicious_records = EXCLUDED.suspicious_records,
                created_at         = CURRENT_TIMESTAMP
            RETURNING session_id
            """,
            (
                user_id,
                input_hash,
                response.totalRecords,
                response.validRecords,
                response.suspiciousRecords,
            ),
        )
        session_id = cur.fetchone()["session_id"]

        # Delete old per-record rows and re-insert fresh ones
        cur.execute(
            "DELETE FROM nsa_session_results WHERE session_id = %s", (session_id,)
        )
        for item in response.results:
            cur.execute(
                """
                INSERT INTO nsa_session_results
                    (session_id, record_index, original_text, cleaned_text,
                     tokens, nsa_status, anomaly_score, anomaly_reason)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    session_id,
                    item.id,
                    item.originalText,
                    item.cleanedText,
                    _json.dumps(item.tokens),
                    item.nsaStatus,
                    item.anomalyScore,
                    item.anomalyReason,
                ),
            )


# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="EventSense AI",
    description="NSA anomaly detection with JWT authentication.",
    version="0.3.0",
)


@app.on_event("startup")
def on_startup():
    init_db()


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

bearer_scheme = HTTPBearer()


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """
    Decode the Bearer token and return the payload.
    Raises 401 if missing, invalid, or expired.
    """
    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


# ---------------------------------------------------------------------------
# Auth schemas
# ---------------------------------------------------------------------------


class RegisterRequest(BaseModel):
    fullName: str
    email: str
    password: str
    role: Literal["EVENT_ORGANISER", "SYSTEM_ADMIN"]


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    fullName: str
    email: str
    role: str


class AuthResponse(BaseModel):
    token: str
    user: UserOut


class ResetPasswordRequest(BaseModel):
    email: str
    newPassword: str


# ---------------------------------------------------------------------------
# NSA schemas
# ---------------------------------------------------------------------------


class AnalyseRequest(BaseModel):
    feedback: List[str]


class ResultItem(BaseModel):
    id: int
    originalText: str
    cleanedText: str
    tokens: List[str]
    nsaStatus: str
    anomalyScore: int
    anomalyReason: str


class AnalyseResponse(BaseModel):
    totalRecords: int
    validRecords: int
    suspiciousRecords: int
    results: List[ResultItem]
    cached: bool = False


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _nsa_result_to_item(r: NSAResult) -> ResultItem:
    return ResultItem(
        id=r.id,
        originalText=r.original_text,
        cleanedText=r.cleaned_text,
        tokens=r.tokens,
        nsaStatus=r.nsa_status,
        anomalyScore=r.anomaly_score,
        anomalyReason=r.anomaly_reason,
    )


# ---------------------------------------------------------------------------
# Routes — health
# ---------------------------------------------------------------------------


@app.get("/")
def health_check():
    return {"status": "ok", "service": "EventSense AI"}


# ---------------------------------------------------------------------------
# Routes — auth
# ---------------------------------------------------------------------------


@app.post("/api/auth/register", response_model=AuthResponse, status_code=201)
def register(body: RegisterRequest):
    try:
        user = create_user(
            full_name=body.fullName,
            email=body.email,
            password=body.password,
            role=body.role,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    token = create_access_token(user)

    return AuthResponse(
        token=token,
        user=UserOut(
            id=user.user_id,
            fullName=user.full_name,
            email=user.email,
            role=user.role,
        ),
    )


@app.post("/api/auth/login", response_model=AuthResponse)
def login(body: LoginRequest):
    user = authenticate_user(body.email, body.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    token = create_access_token(user)

    return AuthResponse(
        token=token,
        user=UserOut(
            id=user.user_id,
            fullName=user.full_name,
            email=user.email,
            role=user.role,
        ),
    )


@app.get("/api/auth/me", response_model=UserOut)
def me(current_user: dict = Depends(get_current_user)):
    user = get_user_by_id(current_user["sub"])

    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    return UserOut(
        id=user.user_id,
        fullName=user.full_name,
        email=user.email,
        role=user.role,
    )


@app.post("/api/auth/reset-password")
def reset_password(body: ResetPasswordRequest):
    try:
        success = reset_user_password(
            email=body.email,
            new_password=body.newPassword,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    if not success:
        raise HTTPException(
            status_code=404,
            detail="No account found with this email address.",
        )

    return {
        "message": "Password reset successfully. You can now log in with your new password."
    }


# ---------------------------------------------------------------------------
# Routes — NSA analysis (protected)
# ---------------------------------------------------------------------------


@app.get("/api/nsa/latest-valid")
def get_latest_valid_records(current_user: dict = Depends(get_current_user)):
    """
    Return the Valid (non-suspicious) records from the user's most recent
    NSA session. Used by the Sentiment page to auto-load input without
    requiring the user to paste text again.
    """
    user_id = current_user["sub"]

    with get_cursor() as cur:
        # Get the most recent session for this user
        cur.execute(
            """
            SELECT session_id, created_at, total_records, valid_records, suspicious_records
            FROM nsa_sessions
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (user_id,),
        )
        session = cur.fetchone()

        if not session:
            return {"found": False, "records": [], "sessionInfo": None}

        # Fetch only the Valid records from that session
        cur.execute(
            """
            SELECT record_index, original_text, nsa_status
            FROM nsa_session_results
            WHERE session_id = %s AND nsa_status = 'Valid'
            ORDER BY record_index
            """,
            (session["session_id"],),
        )
        rows = cur.fetchall()

    return {
        "found": True,
        "sessionInfo": {
            "totalRecords": session["total_records"],
            "validRecords": session["valid_records"],
            "suspiciousRecords": session["suspicious_records"],
            "createdAt": (
                session["created_at"].isoformat() if session["created_at"] else None
            ),
        },
        "records": [
            {"id": r["record_index"], "text": r["original_text"]} for r in rows
        ],
    }


@app.post("/api/nsa/analyse", response_model=AnalyseResponse)
def analyse(
    request: AnalyseRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Analyse feedback with NSA.

    - If the exact same feedback set has been analysed before (for this user),
      the cached result is returned immediately — the NSA algorithm is not re-run.
    - Otherwise the algorithm runs, results are saved to the DB, and returned.
    """
    feedback = [line.strip() for line in request.feedback if line.strip()]
    if not feedback:
        raise HTTPException(status_code=422, detail="No feedback records provided.")

    user_id = current_user["sub"]
    input_hash = _feedback_hash(feedback)

    # ── Cache hit ──────────────────────────────────────────────────────────
    cached = _load_cached_session(user_id, input_hash)
    if cached:
        return AnalyseResponse(**cached)

    # ── Cache miss — run NSA ───────────────────────────────────────────────
    nsa = get_nsa()
    response_data = nsa.detect_batch(feedback)

    result = AnalyseResponse(
        totalRecords=response_data.total_records,
        validRecords=response_data.valid_records,
        suspiciousRecords=response_data.suspicious_records,
        results=[_nsa_result_to_item(r) for r in response_data.results],
        cached=False,
    )

    # Save to DB (non-fatal if it fails)
    try:
        _save_session(user_id, input_hash, result)
    except Exception as exc:
        print(f"[warn] Could not cache NSA session: {exc}")

    return result


# ---------------------------------------------------------------------------
# Routes — Sentiment analysis (protected)
# ---------------------------------------------------------------------------


class SentimentRequest(BaseModel):
    """
    Accepts a list of feedback strings that have already passed the NSA filter.
    Only Valid records should be sent here.
    """

    texts: List[str]


class SentimentItem(BaseModel):
    id: int
    originalText: str
    label: str  # "Positive" | "Negative" | "Neutral"
    confidence: float  # 0–100
    model: str  # which classifier was used


class SentimentResponse(BaseModel):
    totalRecords: int
    positiveCount: int
    negativeCount: int
    neutralCount: int
    results: List[SentimentItem]


@app.post("/api/sentiment/analyse", response_model=SentimentResponse)
def sentiment_analyse(
    request: SentimentRequest,
    _current_user: dict = Depends(get_current_user),
):
    """
    Run sentiment classification on a list of pre-filtered (Valid) feedback texts.

    Each text is classified as Positive, Negative, or Neutral with a
    confidence score. Uses HuggingFace DistilBERT when HF_API_TOKEN is set,
    otherwise falls back to a lexicon-based classifier.
    """
    texts = [t.strip() for t in request.texts if t.strip()]
    if not texts:
        raise HTTPException(status_code=422, detail="No texts provided.")

    classifications = classify_sentiment(texts)

    results = [
        SentimentItem(
            id=idx + 1,
            originalText=c.text,
            label=c.label,
            confidence=c.confidence,
            model=c.model,
        )
        for idx, c in enumerate(classifications)
    ]

    return SentimentResponse(
        totalRecords=len(results),
        positiveCount=sum(1 for r in results if r.label == "Positive"),
        negativeCount=sum(1 for r in results if r.label == "Negative"),
        neutralCount=sum(1 for r in results if r.label == "Neutral"),
        results=results,
    )
