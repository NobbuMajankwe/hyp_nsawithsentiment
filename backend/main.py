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

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from typing import List, Literal, Optional

from nsa import get_nsa, NSAResult
from auth import (
    authenticate_user,
    create_access_token,
    create_user,
    decode_access_token,
    get_user_by_id,
)
from database import init_db

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


# ---------------------------------------------------------------------------
# Routes — NSA analysis (protected)
# ---------------------------------------------------------------------------


@app.post("/api/nsa/analyse", response_model=AnalyseResponse)
def analyse(
    request: AnalyseRequest,
    _current_user: dict = Depends(get_current_user),
):
    """
    Analyse feedback with NSA. Requires a valid Bearer token.
    """
    feedback = [line.strip() for line in request.feedback if line.strip()]
    if not feedback:
        raise HTTPException(
            status_code=422,
            detail="No feedback records provided.",
        )

    nsa = get_nsa()
    response = nsa.detect_batch(feedback)

    return AnalyseResponse(
        totalRecords=response.total_records,
        validRecords=response.valid_records,
        suspiciousRecords=response.suspicious_records,
        results=[_nsa_result_to_item(r) for r in response.results],
    )
