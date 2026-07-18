"""
main.py — FastAPI entry point for EventSense AI backend
=========================================================
Endpoints:
  POST /api/auth/register  — create a new account
  POST /api/auth/login     — obtain a JWT
  GET  /api/auth/me        — return current user from token
  POST /api/nsa/analyse    — run NSA analysis (requires valid JWT)
  POST /api/datasets/upload — upload CSV/JSON dataset
  GET  /api/datasets       — list user's datasets
  GET  /api/datasets/{id}  — get dataset details
  DELETE /api/datasets/{id} — delete a dataset

Run with:
    uvicorn main:app --reload --port 8000
"""

import hashlib
import json as _json
from fastapi import (
    APIRouter,
    Depends,
    FastAPI,
    HTTPException,
    status,
    UploadFile,
    File,
    Form,
)
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
from dataset_handler import (
    parse_csv_file,
    parse_json_file,
    save_dataset_to_db,
    get_user_datasets,
    get_dataset_by_id,
    get_dataset_feedback,
    delete_dataset,
    DatasetParseError,
)


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

auth_router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)
datasets_router = APIRouter(
    prefix="/api/datasets",
    tags=["Datasets"],
)
nsa_router = APIRouter(
    prefix="/api/nsa",
    tags=["NSA Analysis"],
)

sentiment_router = APIRouter(
    prefix="/api/sentiment",
    tags=["Sentiment Analysis"],
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
# Datasets schemas
# ---------------------------------------------------------------------------
class DatasetInfo(BaseModel):
    id: int
    name: str
    type: str
    description: Optional[str]
    totalRecords: int
    status: str
    uploadedAt: Optional[str]


class DatasetListResponse(BaseModel):
    total: int
    datasets: List[DatasetInfo]


class DatasetDetailResponse(BaseModel):
    id: int
    name: str
    type: str
    description: Optional[str]
    totalRecords: int
    status: str
    uploadedBy: Optional[str]
    uploadedAt: Optional[str]


class FeedbackRecord(BaseModel):
    id: int
    text: str
    cleanedText: Optional[str]
    isValid: bool
    isAnomalous: bool
    createdAt: Optional[str]


class DatasetFeedbackResponse(BaseModel):
    datasetId: int
    total: int
    records: List[FeedbackRecord]


# ---------------------------------------------------------------------------
# Sentiment schemas
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


@auth_router.post("/register", response_model=AuthResponse, status_code=201)
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


@auth_router.post("/login", response_model=AuthResponse)
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


@auth_router.get("/me", response_model=UserOut)
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


@auth_router.post("/reset-password")
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


@nsa_router.get("/latest-valid")
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


@nsa_router.post("/analyse", response_model=AnalyseResponse)
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


@sentiment_router.post("/analyse", response_model=SentimentResponse)
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


# ---------------------------------------------------------------------------
# Routes — Dataset management (protected)
# ---------------------------------------------------------------------------


@datasets_router.post("/upload", status_code=201)
async def upload_dataset(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    """
    Upload a dataset file (CSV or JSON) containing feedback records.

    File formats supported:

    CSV:
    - Must have headers
    - Looks for columns: 'feedback', 'text', 'comment', 'review', etc.
    - Falls back to first column if no standard column found

    JSON:
    - Array of strings: ["feedback 1", "feedback 2"]
    - Array of objects: [{"text": "feedback 1"}, ...]
    - Object with array: {"feedback": ["text 1", "text 2"]}

    Returns:
        Dataset ID and summary information
    """
    user_id = current_user["sub"]

    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    filename = file.filename.lower()

    if filename.endswith(".csv"):
        source_type = "CSV"
    elif filename.endswith(".json"):
        source_type = "JSON"
    else:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Please upload a CSV or JSON file.",
        )

    # Read file content
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")

    # Validate file size (max 10MB)
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=413, detail="File too large. Maximum size is 10MB."
        )

    # Parse the file
    try:
        if source_type == "CSV":
            feedback_texts = parse_csv_file(content)
        else:  # JSON
            feedback_texts = parse_json_file(content)
    except DatasetParseError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Validate we have feedback
    if not feedback_texts:
        raise HTTPException(
            status_code=422, detail="No valid feedback records found in file"
        )

    # Use provided name or default to filename
    dataset_name = name or file.filename

    # Save to database
    try:
        dataset_id = save_dataset_to_db(
            user_id=user_id,
            source_name=dataset_name,
            source_type=source_type,
            feedback_texts=feedback_texts,
            file_path=file.filename,
            description=description,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save dataset: {str(e)}")

    return {
        "message": "Dataset uploaded successfully",
        "datasetId": dataset_id,
        "name": dataset_name,
        "type": source_type,
        "totalRecords": len(feedback_texts),
    }


@datasets_router.get("", response_model=DatasetListResponse)
def list_datasets(
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
):
    """
    List all datasets uploaded by the current user.

    Query parameters:
    - limit: Maximum number of datasets to return (default: 50)
    - offset: Number of datasets to skip for pagination (default: 0)
    """
    user_id = current_user["sub"]

    try:
        datasets = get_user_datasets(user_id, limit, offset)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve datasets: {str(e)}"
        )

    return DatasetListResponse(
        total=len(datasets), datasets=[DatasetInfo(**d) for d in datasets]
    )


@datasets_router.get("/{dataset_id}", response_model=DatasetDetailResponse)
def get_dataset(
    dataset_id: int,
    current_user: dict = Depends(get_current_user),
):
    """
    Get detailed information about a specific dataset.

    Only the user who uploaded the dataset can view it.
    """
    user_id = current_user["sub"]

    try:
        dataset = get_dataset_by_id(dataset_id, user_id)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve dataset: {str(e)}"
        )

    if not dataset:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found or you don't have permission to view it",
        )

    return DatasetDetailResponse(**dataset)


@datasets_router.get("/{dataset_id}/feedback", response_model=DatasetFeedbackResponse)
def get_dataset_feedback_records(
    dataset_id: int,
    limit: int = 100,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
):
    """
    Get feedback records from a specific dataset.

    Query parameters:
    - limit: Maximum number of records to return (default: 100)
    - offset: Number of records to skip for pagination (default: 0)

    Only the user who uploaded the dataset can view its records.
    """
    user_id = current_user["sub"]

    # Verify user owns this dataset
    try:
        dataset = get_dataset_by_id(dataset_id, user_id)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to verify dataset: {str(e)}"
        )

    if not dataset:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found or you don't have permission to view it",
        )

    # Get feedback records
    try:
        records = get_dataset_feedback(dataset_id, limit, offset)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve feedback records: {str(e)}"
        )

    return DatasetFeedbackResponse(
        datasetId=dataset_id,
        total=len(records),
        records=[FeedbackRecord(**r) for r in records],
    )


@datasets_router.delete("/{dataset_id}")
def delete_dataset_endpoint(
    dataset_id: int,
    current_user: dict = Depends(get_current_user),
):
    """
    Delete a dataset and all its associated feedback records.

    Only the user who uploaded the dataset can delete it.
    """
    user_id = current_user["sub"]

    try:
        success = delete_dataset(dataset_id, user_id)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to delete dataset: {str(e)}"
        )

    if not success:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found or you don't have permission to delete it",
        )

    return {"message": "Dataset deleted successfully", "datasetId": dataset_id}


# ---------------------------------------------------------------------------
# Register routers
# ---------------------------------------------------------------------------

app.include_router(auth_router)
app.include_router(datasets_router)
app.include_router(nsa_router)
app.include_router(sentiment_router)
