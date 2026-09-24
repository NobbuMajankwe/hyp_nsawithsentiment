import hashlib
import json
import logging
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
from typing import Literal
from nsa import (
    get_nsa,
    NSAResult,
    NSA_DEFAULT_DETECTOR_COUNT,
    NSA_DEFAULT_DETECTOR_RADIUS,
    NSA_DEFAULT_SELF_MATCH_THRESHOLD,
)
from auth import (
    authenticate_user,
    create_access_token,
    create_user,
    decode_access_token,
    get_user_by_id,
    reset_user_password,
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


logger = logging.getLogger(__name__)


def _feedback_hash(feedback: list[str]) -> str:
    canonical = "\n".join(sorted(line.strip() for line in feedback if line.strip()))
    return hashlib.sha256(canonical.encode()).hexdigest()


def _load_cached_session(user_id: int, input_hash: str) -> dict | None:
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
    with get_cursor(commit=True) as cur:
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
                    json.dumps(item.tokens),
                    item.nsaStatus,
                    item.anomalyScore,
                    item.anomalyReason,
                ),
            )


def _load_nsa_config(user_id: int) -> dict:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT nsa_detector_count, nsa_threshold, nsa_api_url
            FROM integration_settings
            WHERE user_id = %s
            """,
            (user_id,),
        )
        row = cur.fetchone()

    if row:
        return {
            "detectorCount": row["nsa_detector_count"] or NSA_DEFAULT_DETECTOR_COUNT,
            "detectorRadius": (
                float(row["nsa_threshold"])
                if row["nsa_threshold"] is not None
                else NSA_DEFAULT_DETECTOR_RADIUS
            ),
            "selfMatchThreshold": NSA_DEFAULT_SELF_MATCH_THRESHOLD,
            "apiUrl": row["nsa_api_url"],
        }
    return {
        "detectorCount": NSA_DEFAULT_DETECTOR_COUNT,
        "detectorRadius": NSA_DEFAULT_DETECTOR_RADIUS,
        "selfMatchThreshold": NSA_DEFAULT_SELF_MATCH_THRESHOLD,
        "apiUrl": None,
    }


def _save_nsa_config(user_id: int, config: dict) -> None:
    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO integration_settings (user_id, nsa_detector_count, nsa_threshold, nsa_api_url)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (user_id) DO UPDATE SET
                nsa_detector_count = COALESCE(EXCLUDED.nsa_detector_count, integration_settings.nsa_detector_count),
                nsa_threshold      = COALESCE(EXCLUDED.nsa_threshold,       integration_settings.nsa_threshold),
                nsa_api_url        = COALESCE(EXCLUDED.nsa_api_url,         integration_settings.nsa_api_url),
                updated_at         = CURRENT_TIMESTAMP
            """,
            (
                user_id,
                config.get("detectorCount"),
                config.get("detectorRadius"),
                config.get("apiUrl"),
            ),
        )


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
def on_startup() -> None:
    init_db()


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


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


class NsaConfigResponse(BaseModel):
    detectorCount: int
    detectorRadius: float
    selfMatchThreshold: float
    apiUrl: str | None


class NsaConfigRequest(BaseModel):
    detectorCount: int | None = None
    detectorRadius: float | None = None
    selfMatchThreshold: float | None = None
    apiUrl: str | None = None


class AnalyseRequest(BaseModel):
    feedback: list[str]
    detectorCount: int | None = None
    detectorRadius: float | None = None
    selfMatchThreshold: float | None = None


class ResultItem(BaseModel):
    id: int
    originalText: str
    cleanedText: str
    tokens: list[str]
    nsaStatus: str
    anomalyScore: int
    anomalyReason: str


class AnalyseResponse(BaseModel):
    totalRecords: int
    validRecords: int
    suspiciousRecords: int
    results: list[ResultItem]
    cached: bool = False


class DatasetInfo(BaseModel):
    id: int
    name: str
    type: str
    description: str | None
    totalRecords: int
    status: str
    uploadedAt: str | None


class DatasetListResponse(BaseModel):
    total: int
    datasets: list[DatasetInfo]


class DatasetDetailResponse(BaseModel):
    id: int
    name: str
    type: str
    description: str | None
    totalRecords: int
    status: str
    uploadedBy: str | None
    uploadedAt: str | None


class FeedbackRecord(BaseModel):
    id: int
    text: str
    cleanedText: str | None
    isValid: bool
    isAnomalous: bool
    createdAt: str | None


class DatasetFeedbackResponse(BaseModel):
    datasetId: int
    total: int
    records: list[FeedbackRecord]


class SentimentRequest(BaseModel):
    texts: list[str]


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
    results: list[SentimentItem]


def _to_result_item(r: NSAResult) -> ResultItem:
    return ResultItem(
        id=r.id,
        originalText=r.original_text,
        cleanedText=r.cleaned_text,
        tokens=r.tokens,
        nsaStatus=r.nsa_status,
        anomalyScore=r.anomaly_score,
        anomalyReason=r.anomaly_reason,
    )


@app.get("/")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "EventSense AI"}


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


@nsa_router.get("/latest-valid")
def get_latest_valid_records(current_user: dict = Depends(get_current_user)):

    user_id = current_user["sub"]

    with get_cursor() as cur:
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


@nsa_router.get("/config", response_model=NsaConfigResponse)
def get_nsa_config(current_user: dict = Depends(get_current_user)):
    return _load_nsa_config(current_user["sub"])


@nsa_router.put("/config", response_model=NsaConfigResponse)
def update_nsa_config(
    body: NsaConfigRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["sub"]

    if body.detectorCount is not None and not (1 <= body.detectorCount <= 2000):
        raise HTTPException(
            status_code=422, detail="detectorCount must be between 1 and 2000."
        )
    if body.detectorRadius is not None and not (0.01 <= body.detectorRadius <= 1.0):
        raise HTTPException(
            status_code=422, detail="detectorRadius must be between 0.01 and 1.0."
        )
    if body.selfMatchThreshold is not None and not (
        0.01 <= body.selfMatchThreshold <= 1.0
    ):
        raise HTTPException(
            status_code=422, detail="selfMatchThreshold must be between 0.01 and 1.0."
        )

    current = _load_nsa_config(user_id)
    merged = {
        "detectorCount": (
            body.detectorCount
            if body.detectorCount is not None
            else current["detectorCount"]
        ),
        "detectorRadius": (
            body.detectorRadius
            if body.detectorRadius is not None
            else current["detectorRadius"]
        ),
        "selfMatchThreshold": (
            body.selfMatchThreshold
            if body.selfMatchThreshold is not None
            else current["selfMatchThreshold"]
        ),
        "apiUrl": body.apiUrl if body.apiUrl is not None else current["apiUrl"],
    }
    _save_nsa_config(user_id, merged)
    return merged


@nsa_router.post("/analyse", response_model=AnalyseResponse)
def analyse(
    request: AnalyseRequest,
    current_user: dict = Depends(get_current_user),
):

    feedback = [line.strip() for line in request.feedback if line.strip()]
    if not feedback:
        raise HTTPException(status_code=422, detail="No feedback records provided.")

    user_id = current_user["sub"]
    input_hash = _feedback_hash(feedback)
    saved_config = _load_nsa_config(user_id)
    detector_count = (
        request.detectorCount
        if request.detectorCount is not None
        else saved_config["detectorCount"]
    )
    detector_radius = (
        request.detectorRadius
        if request.detectorRadius is not None
        else saved_config["detectorRadius"]
    )
    self_match_threshold = (
        request.selfMatchThreshold
        if request.selfMatchThreshold is not None
        else saved_config["selfMatchThreshold"]
    )
    # Session reads are disabled until token JSON handling is finalised.
    nsa = get_nsa(
        detector_count=detector_count,
        detector_radius=detector_radius,
        self_match_threshold=self_match_threshold,
    )
    response_data = nsa.detect_batch(feedback)

    result = AnalyseResponse(
        totalRecords=response_data.total_records,
        validRecords=response_data.valid_records,
        suspiciousRecords=response_data.suspicious_records,
        results=[_to_result_item(r) for r in response_data.results],
        cached=False,
    )

    try:
        _save_session(user_id, input_hash, result)
    except Exception:
        logger.exception("Could not cache NSA session")

    return result


@sentiment_router.post("/analyse", response_model=SentimentResponse)
def sentiment_analyse(
    request: SentimentRequest,
    _current_user: dict = Depends(get_current_user),
):
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


@datasets_router.post("/upload", status_code=201)
async def upload_dataset(
    file: UploadFile = File(...),
    name: str | None = Form(None),
    description: str | None = Form(None),
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["sub"]

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

    try:
        content = await file.read()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(exc)}")

    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=413, detail="File too large. Maximum size is 10MB."
        )

    try:
        if source_type == "CSV":
            feedback_texts = parse_csv_file(content)
        else:
            feedback_texts = parse_json_file(content)
    except DatasetParseError as e:
        raise HTTPException(status_code=422, detail=str(exc))

    if not feedback_texts:
        raise HTTPException(
            status_code=422, detail="No valid feedback records found in file"
        )

    dataset_name = name or file.filename

    try:
        dataset_id = save_dataset_to_db(
            user_id=user_id,
            source_name=dataset_name,
            source_type=source_type,
            feedback_texts=feedback_texts,
            file_path=file.filename,
            description=description,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to save dataset: {str(exc)}"
        )

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
    user_id = current_user["sub"]

    try:
        datasets = get_user_datasets(user_id, limit, offset)
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve datasets: {str(exc)}"
        )

    return DatasetListResponse(
        total=len(datasets), datasets=[DatasetInfo(**d) for d in datasets]
    )


@datasets_router.get("/{dataset_id}", response_model=DatasetDetailResponse)
def get_dataset(
    dataset_id: int,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["sub"]

    try:
        dataset = get_dataset_by_id(dataset_id, user_id)
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve dataset: {str(exc)}"
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
    user_id = current_user["sub"]

    try:
        dataset = get_dataset_by_id(dataset_id, user_id)
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to verify dataset: {str(exc)}"
        )

    if not dataset:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found or you don't have permission to view it",
        )

    try:
        records = get_dataset_feedback(dataset_id, limit, offset)
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve feedback records: {str(exc)}"
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
    user_id = current_user["sub"]

    try:
        success = delete_dataset(dataset_id, user_id)
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to delete dataset: {str(exc)}"
        )

    if not success:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found or you don't have permission to delete it",
        )

    return {"message": "Dataset deleted successfully", "datasetId": dataset_id}


dashboard_router = APIRouter(
    prefix="/api/dashboard",
    tags=["Dashboard"],
)


@dashboard_router.get("/summary")
def dashboard_summary(current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]

    with get_cursor() as cur:
        cur.execute(
            """
            SELECT
                COUNT(*)                        AS dataset_count,
                COALESCE(SUM(total_records), 0) AS total_feedback
            FROM datasets
            WHERE loaded_by = %s
            """,
            (user_id,),
        )
        ds = cur.fetchone()

        dataset_count = int(ds["dataset_count"])
        total_feedback = int(ds["total_feedback"])
        cur.execute(
            """
            SELECT total_records, valid_records, suspicious_records, created_at
            FROM nsa_sessions
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (user_id,),
        )
        nsa = cur.fetchone()

        nsa_total = int(nsa["total_records"]) if nsa else 0
        nsa_valid = int(nsa["valid_records"]) if nsa else 0
        nsa_suspicious = int(nsa["suspicious_records"]) if nsa else 0
        nsa_pass_rate = round((nsa_valid / nsa_total) * 100) if nsa_total else 0
        nsa_run_at = nsa["created_at"].isoformat() if nsa else None
        cur.execute(
            "SELECT COUNT(*) AS cnt FROM nsa_sessions WHERE user_id = %s",
            (user_id,),
        )
        nsa_session_count = int(cur.fetchone()["cnt"])
        cur.execute(
            """
            SELECT COUNT(*) AS cnt
            FROM sentiment_results sr
            JOIN feedback_records fr ON fr.feedback_id = sr.feedback_id
            JOIN datasets d ON d.dataset_id = fr.dataset_id
            WHERE d.loaded_by = %s
            """,
            (user_id,),
        )
        sentiment_count = int(cur.fetchone()["cnt"])
        # Pull the 8 most recent significant events for this user.
        cur.execute(
            """
            (
                SELECT
                    'nsa_scan' AS event_type,
                    'NSA scan completed' AS title,
                    total_records::TEXT AS detail,
                    created_at
                FROM nsa_sessions
                WHERE user_id = %s
                ORDER BY created_at DESC
                LIMIT 3
            )
            UNION ALL
            (
                SELECT
                    'dataset_loaded' AS event_type,
                    'Dataset loaded' AS title,
                    source_name AS detail,
                    loaded_at AS created_at
                FROM datasets
                WHERE loaded_by = %s
                ORDER BY loaded_at DESC
                LIMIT 3
            )
            UNION ALL
            (
                SELECT
                    'account_created' AS event_type,
                    'User account created' AS title,
                    full_name AS detail,
                    created_at
                FROM users
                WHERE user_id = %s
                LIMIT 1
            )
            ORDER BY created_at DESC
            LIMIT 8
            """,
            (user_id, user_id, user_id),
        )
        activity_rows = cur.fetchall()

    activity = [
        {
            "eventType": row["event_type"],
            "title": row["title"],
            "detail": row["detail"],
            "createdAt": row["created_at"].isoformat() if row["created_at"] else None,
        }
        for row in activity_rows
    ]

    return {
        # Stat cards
        "datasetCount": dataset_count,
        "totalFeedback": total_feedback,
        "nsaTotalRecords": nsa_total,
        "nsaValidRecords": nsa_valid,
        "nsaSuspiciousRecords": nsa_suspicious,
        "nsaPassRate": nsa_pass_rate,
        "nsaSessionCount": nsa_session_count,
        "sentimentCount": sentiment_count,
        # Donut chart
        "donutData": [
            {"name": "Valid (NSA Cleared)", "value": nsa_valid},
            {"name": "Suspicious (Blocked)", "value": nsa_suspicious},
        ],
        # Pipeline — derived from what the user has actually done
        "pipeline": {
            "datasetLoaded": dataset_count > 0,
            "nsaRun": nsa_session_count > 0,
            "sentimentRun": sentiment_count > 0,
        },
        "nsaRunAt": nsa_run_at,
        # Activity
        "activity": activity,
    }


app.include_router(auth_router)
app.include_router(datasets_router)
app.include_router(nsa_router)
app.include_router(sentiment_router)
app.include_router(dashboard_router)
