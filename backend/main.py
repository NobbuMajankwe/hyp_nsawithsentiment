from __future__ import annotations

# import hashlib
import csv
import io
import logging
from typing import Literal

from auth import (
    authenticate_user,
    create_access_token,
    create_user,
    decode_access_token,
    get_user_by_id,
    reset_user_password,
)
from database import get_cursor, init_db
from dataset_handler import (
    DatasetParseError,
    delete_dataset,
    get_dataset_by_id,
    get_dataset_feedback,
    get_user_datasets,
    parse_csv_file,
    parse_json_file,
    parse_labelled_csv_file,
    save_dataset_to_db,
)
from experiment_service import (
    get_experiment,
    get_experiment_results,
    list_experiments,
    run_experiment,
)
from fastapi import (
    APIRouter,
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from nsa import (
    NSA_DEFAULT_DETECTOR_COUNT,
    NSA_DEFAULT_DETECTOR_RADIUS,
    NSA_DEFAULT_MAX_ATTEMPTS,
    NSA_DEFAULT_RANDOM_SEED,
    NSA_DEFAULT_SELF_MATCH_THRESHOLD,
)
from pydantic import BaseModel

from sentiment import classify_sentiment

logger = logging.getLogger(__name__)

app = FastAPI(
    title="NSA Research Platform: EventSense AI",
    description=(
        "Experimental/Research based Negative Selection Algorithm platform "
        "for detecting non-self observations in event feedback."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()

    logger.info("NSA Research Platform started.")


bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),  # noqa: B008
) -> dict:
    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


auth_router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)
datasets_router = APIRouter(
    prefix="/api/datasets",
    tags=["Research Datasets"],
)
experiments_router = APIRouter(
    prefix="/api/experiments",
    tags=["NSA Experiments"],
)
nsa_router = APIRouter(
    prefix="/api/nsa",
    tags=["NSA Configuration"],
)
sentiment_router = APIRouter(
    prefix="/api/sentiment",
    tags=["Sentiment Analysis"],
)


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


class DatasetInfo(BaseModel):
    id: int
    name: str
    type: str
    description: str | None = None
    totalRecords: int
    status: str
    uploadedAt: str | None = None


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
    isValid: bool | None = None
    isAnomalous: bool | None = None
    createdAt: str | None


class DatasetFeedbackResponse(BaseModel):
    datasetId: int
    total: int
    records: list[FeedbackRecord]


class NsaConfigResponse(BaseModel):

    detectorCount: int
    detectorRadius: float

    selfMatchThreshold: float

    maxAttempts: int

    randomSeed: int


class NsaConfigRequest(BaseModel):

    detectorCount: int | None = None

    detectorRadius: float | None = None

    selfMatchThreshold: float | None = None

    maxAttempts: int | None = None

    randomSeed: int | None = None


class RunExperimentRequest(BaseModel):

    datasetId: int

    experimentName: str

    experimentDescription: str | None = None

    detectorCount: int = NSA_DEFAULT_DETECTOR_COUNT

    detectorRadius: float = NSA_DEFAULT_DETECTOR_RADIUS

    selfMatchThreshold: float = NSA_DEFAULT_SELF_MATCH_THRESHOLD

    maxAttempts: int = NSA_DEFAULT_MAX_ATTEMPTS

    randomSeed: int = NSA_DEFAULT_RANDOM_SEED


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
def me(current_user: dict = Depends(get_current_user)):  # noqa: B008
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


# nsa
def _load_nsa_config(
    user_id: int,
) -> dict:

    with get_cursor() as cur:

        cur.execute(
            """
            SELECT
                nsa_detector_count,
                nsa_detector_radius,
                nsa_self_match_threshold,
                nsa_max_attempts,
                nsa_random_seed

            FROM integration_settings

            WHERE user_id = %s
            """,
            (user_id,),
        )

        row = cur.fetchone()

    if not row:

        return {
            "detectorCount": NSA_DEFAULT_DETECTOR_COUNT,
            "detectorRadius": NSA_DEFAULT_DETECTOR_RADIUS,
            "selfMatchThreshold": NSA_DEFAULT_SELF_MATCH_THRESHOLD,
            "maxAttempts": NSA_DEFAULT_MAX_ATTEMPTS,
            "randomSeed": NSA_DEFAULT_RANDOM_SEED,
        }

    return {
        "detectorCount": row["nsa_detector_count"] or NSA_DEFAULT_DETECTOR_COUNT,
        "detectorRadius": float(
            row["nsa_detector_radius"] or NSA_DEFAULT_DETECTOR_RADIUS
        ),
        "selfMatchThreshold": float(
            row["nsa_self_match_threshold"] or NSA_DEFAULT_SELF_MATCH_THRESHOLD
        ),
        "maxAttempts": row["nsa_max_attempts"] or NSA_DEFAULT_MAX_ATTEMPTS,
        "randomSeed": (
            row["nsa_random_seed"]
            if row["nsa_random_seed"] is not None
            else NSA_DEFAULT_RANDOM_SEED
        ),
    }


def _save_nsa_config(
    user_id: int,
    config: dict,
) -> None:

    with get_cursor(commit=True) as cur:

        cur.execute(
            """
            INSERT INTO integration_settings
            (
                user_id,

                nsa_detector_count,
                nsa_detector_radius,
                nsa_self_match_threshold,

                nsa_max_attempts,
                nsa_random_seed
            )

            VALUES
            (
                %s,%s,%s,%s,%s,%s
            )

            ON CONFLICT (user_id)

            DO UPDATE SET

                nsa_detector_count =
                    EXCLUDED.nsa_detector_count,

                nsa_detector_radius =
                    EXCLUDED.nsa_detector_radius,

                nsa_self_match_threshold =
                    EXCLUDED.nsa_self_match_threshold,

                nsa_max_attempts =
                    EXCLUDED.nsa_max_attempts,

                nsa_random_seed =
                    EXCLUDED.nsa_random_seed,

                updated_at =
                    CURRENT_TIMESTAMP
            """,
            (
                user_id,
                config["detectorCount"],
                config["detectorRadius"],
                config["selfMatchThreshold"],
                config["maxAttempts"],
                config["randomSeed"],
            ),
        )


@nsa_router.get(
    "/config",
    response_model=NsaConfigResponse,
)
def get_nsa_config(
    current_user: dict = Depends(get_current_user),  # noqa: B008
):

    return _load_nsa_config(int(current_user["sub"]))


@nsa_router.put(
    "/config",
    response_model=NsaConfigResponse,
)
def update_nsa_config(
    body: NsaConfigRequest,
    current_user: dict = Depends(get_current_user),  # noqa: B008
):

    user_id = int(current_user["sub"])

    current = _load_nsa_config(user_id)

    config = {
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
        "maxAttempts": (
            body.maxAttempts if body.maxAttempts is not None else current["maxAttempts"]
        ),
        "randomSeed": (
            body.randomSeed if body.randomSeed is not None else current["randomSeed"]
        ),
    }

    # Validation

    if not (1 <= config["detectorCount"] <= 5000):

        raise HTTPException(
            status_code=422,
            detail=("detectorCount must be " "between 1 and 5000."),
        )

    if not (0.001 <= config["detectorRadius"] <= 2.0):

        raise HTTPException(
            status_code=422,
            detail=("detectorRadius must be " "between 0.001 and 2.0."),
        )

    if not (0.001 <= config["selfMatchThreshold"] <= 2.0):

        raise HTTPException(
            status_code=422,
            detail=("selfMatchThreshold must " "be between 0.001 and 2.0."),
        )

    if not (1 <= config["maxAttempts"] <= 1_000_000):

        raise HTTPException(
            status_code=422,
            detail=("maxAttempts must be " "between 1 and 1,000,000."),
        )

    _save_nsa_config(
        user_id,
        config,
    )

    return config


# datasets
@datasets_router.post(
    "/upload",
    status_code=201,
)
async def upload_dataset(
    file: UploadFile = File(...),  # noqa: B008
    name: str | None = Form(None),
    description: str | None = Form(None),
    researchRole: Literal[
        "SELF_CORPUS",
        "EVALUATION",
        "ANALYSIS",
        "SUPPORT",
    ] = Form("ANALYSIS"),
    current_user: dict = Depends(get_current_user),  # noqa: B008
):

    user_id = int(current_user["sub"])

    if not file.filename:

        raise HTTPException(
            status_code=400,
            detail="No file provided.",
        )

    filename = file.filename.lower()

    if filename.endswith(".csv"):

        source_type = "CSV"

    elif filename.endswith(".json"):

        source_type = "JSON"

    else:

        raise HTTPException(
            status_code=400,
            detail=("Only CSV and JSON " "files are supported."),
        )

    content = await file.read()

    if len(content) > (100 * 1024 * 1024):

        raise HTTPException(
            status_code=413,
            detail=("File too large. " "Maximum size is 100MB."),
        )

    try:

        if source_type == "CSV":

            feedback_texts = parse_csv_file(content)

        else:

            feedback_texts = parse_json_file(content)

    except DatasetParseError as exc:

        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    dataset_name = name.strip() if name else file.filename

    try:

        dataset_id = save_dataset_to_db(
            user_id=user_id,
            source_name=dataset_name,
            source_type=source_type,
            feedback_texts=feedback_texts,
            file_path=file.filename,
            description=description,
        )

        # Research role is metadata,
        # not file format information.

        with get_cursor(commit=True) as cur:

            cur.execute(
                """
                UPDATE datasets
                SET research_role = %s
                WHERE dataset_id = %s
                """,
                (
                    researchRole,
                    dataset_id,
                ),
            )

    except Exception as exc:

        logger.exception("Dataset upload failed.")

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        ) from exc

    return {
        "message": "Dataset uploaded successfully.",
        "datasetId": dataset_id,
        "name": dataset_name,
        "type": source_type,
        "researchRole": researchRole,
        "totalRecords": len(feedback_texts),
    }

    user_id = int(current_user["sub"])

    if not file.filename:

        raise HTTPException(
            status_code=400,
            detail="No file provided.",
        )

    filename = file.filename.lower()

    if filename.endswith(".csv"):

        source_type = "CSV"

    elif filename.endswith(".json"):

        source_type = "JSON"

    else:

        raise HTTPException(
            status_code=400,
            detail=("Only CSV and JSON " "files are supported."),
        )

    content = await file.read()

    if len(content) > (100 * 1024 * 1024):

        raise HTTPException(
            status_code=413,
            detail=("File too large. " "Maximum size is 100MB."),
        )

    try:

        if source_type == "CSV":

            feedback_texts = parse_csv_file(content)

        else:

            feedback_texts = parse_json_file(content)

    except DatasetParseError as exc:

        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    dataset_name = name.strip() if name else file.filename

    try:

        dataset_id = save_dataset_to_db(
            user_id=user_id,
            source_name=dataset_name,
            source_type=source_type,
            feedback_texts=feedback_texts,
            file_path=file.filename,
            description=description,
        )

        # Research role is metadata,
        # not file format information.

        with get_cursor(commit=True) as cur:

            cur.execute(
                """
                UPDATE datasets
                SET research_role = %s
                WHERE dataset_id = %s
                """,
                (
                    researchRole,
                    dataset_id,
                ),
            )

    except Exception as exc:

        logger.exception("Dataset upload failed.")

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        ) from exc

    return {
        "message": "Dataset uploaded successfully.",
        "datasetId": dataset_id,
        "name": dataset_name,
        "type": source_type,
        "researchRole": researchRole,
        "totalRecords": len(feedback_texts),
    }

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
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=400, detail=f"Failed to read file: {str(exc)}"
        )  # noqa: RUF010

    if len(content) > 100 * 1024 * 1024:
        raise HTTPException(
            status_code=413, detail="File too large. Maximum size is 100MB."
        )

    try:
        if source_type == "CSV":
            feedback_texts = parse_csv_file(content)
        else:
            feedback_texts = parse_json_file(content)
    except DatasetParseError as e:  # noqa: F841
        raise HTTPException(status_code=422, detail=str(exc))  # noqa: F821

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
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save dataset: {str(exc)}",  # noqa: RUF010
        )

    return {
        "message": "Dataset uploaded successfully",
        "datasetId": dataset_id,
        "name": dataset_name,
        "type": source_type,
        "totalRecords": len(feedback_texts),
    }


@datasets_router.post(
    "/upload-labelled",
    status_code=201,
)
async def upload_labelled_dataset(
    file: UploadFile = File(...),  # noqa: B008
    name: str | None = Form(None),
    description: str | None = Form(None),
    current_user: dict = Depends(get_current_user),  # noqa: B008
):
    """
    Upload a labelled evaluation CSV.

    Supported examples:

        text,label
        "registration was smooth",SELF
        "claim free bitcoin",NON_SELF

    Also supports datasets such as:

        v1,v2
        ham,"Hey, are you coming?"
        spam,"Congratulations! You won..."
    """

    user_id = int(current_user["sub"])

    # --------
    # Validate file
    # --------

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail=("A labelled experiment " "dataset must be CSV."),
        )

    # --------
    # Read file
    # --------

    try:
        content = await file.read()

    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to read file: {exc}",
        ) from exc

    # --------
    # File size
    # --------

    if len(content) > 100 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail=("File too large. " "Maximum size is 100MB."),
        )

    # --------
    # Parse labelled CSV
    # --------

    try:
        parsed_records = parse_labelled_csv_file(content)

    except DatasetParseError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    if not parsed_records:
        raise HTTPException(
            status_code=422,
            detail=("No valid labelled " "records found."),
        )

    # --------
    # Convert to tuple format used below
    # --------

    records = [
        (
            record["text"],
            record["label"],
        )
        for record in parsed_records
    ]

    # --------
    # Dataset name
    # --------

    dataset_name = name.strip() if name and name.strip() else file.filename

    # --------
    # Save dataset
    # --------

    try:
        with get_cursor(commit=True) as cur:

            cur.execute(
                """
                INSERT INTO datasets
                (
                    source_name,
                    source_type,
                    dataset_description,
                    file_path,
                    total_records,
                    research_role,
                    loaded_by
                )

                VALUES
                (
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    'EVALUATION',
                    %s
                )

                RETURNING dataset_id
                """,
                (
                    dataset_name,
                    "CSV",
                    description,
                    file.filename,
                    len(records),
                    user_id,
                ),
            )

            dataset_id = int(cur.fetchone()["dataset_id"])

            #
            # Save labelled records
            #

            for text, label in records:

                cur.execute(
                    """
                    INSERT INTO feedback_records
                    (
                        dataset_id,
                        raw_text,
                        ground_truth_label,
                        preprocessing_complete
                    )

                    VALUES
                    (
                        %s,
                        %s,
                        %s,
                        FALSE
                    )
                    """,
                    (
                        dataset_id,
                        text,
                        label,
                    ),
                )

    except Exception as exc:

        logger.exception("Labelled dataset upload failed.")

        raise HTTPException(
            status_code=500,
            detail=(f"Failed to save labelled " f"dataset: {exc}"),
        ) from exc

    # --------
    # Counts
    # --------

    self_count = sum(1 for _, label in records if label == "SELF")

    non_self_count = sum(1 for _, label in records if label == "NON_SELF")

    # --------
    # Response
    # --------

    return {
        "message": ("Labelled evaluation dataset " "uploaded successfully."),
        "datasetId": dataset_id,
        "name": dataset_name,
        "researchRole": "EVALUATION",
        "totalRecords": len(records),
        "selfRecords": self_count,
        "nonSelfRecords": non_self_count,
    }


@datasets_router.get("")
def list_datasets(
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),  # noqa: B008
):

    user_id = int(current_user["sub"])

    datasets = get_user_datasets(
        user_id,
        limit,
        offset,
    )

    return {
        "total": len(datasets),
        "datasets": datasets,
    }


@datasets_router.get("/{dataset_id}")
def get_dataset(
    dataset_id: int,
    current_user: dict = Depends(get_current_user),  # noqa: B008
):

    user_id = int(current_user["sub"])

    dataset = get_dataset_by_id(
        dataset_id,
        user_id,
    )

    if not dataset:

        raise HTTPException(
            status_code=404,
            detail="Dataset not found.",
        )

    return dataset


@datasets_router.get("/{dataset_id}/feedback")
def dataset_records(
    dataset_id: int,
    limit: int = 100,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),  # noqa: B008
):

    user_id = int(current_user["sub"])

    dataset = get_dataset_by_id(
        dataset_id,
        user_id,
    )

    if not dataset:

        raise HTTPException(
            status_code=404,
            detail="Dataset not found.",
        )

    records = get_dataset_feedback(
        dataset_id,
        limit,
        offset,
    )

    return {
        "datasetId": dataset_id,
        "total": len(records),
        "records": records,
    }


@datasets_router.delete("/{dataset_id}")
def remove_dataset(
    dataset_id: int,
    current_user: dict = Depends(get_current_user),  # noqa: B008
):

    user_id = int(current_user["sub"])

    success = delete_dataset(
        dataset_id,
        user_id,
    )

    if not success:

        raise HTTPException(
            status_code=404,
            detail="Dataset not found.",
        )

    return {
        "message": "Dataset deleted successfully.",
        "datasetId": dataset_id,
    }


# Experiments


@experiments_router.post(
    "/run",
    status_code=201,
)
def start_experiment(
    body: RunExperimentRequest,
    current_user: dict = Depends(get_current_user),  # noqa: B008
):

    user_id = int(current_user["sub"])

    # Research parameter validation

    if not (1 <= body.detectorCount <= 5000):

        raise HTTPException(
            status_code=422,
            detail=("detectorCount must be " "between 1 and 5000."),
        )

    if not (0.001 <= body.detectorRadius <= 2.0):

        raise HTTPException(
            status_code=422,
            detail=("detectorRadius must be " "between 0.001 and 2.0."),
        )

    if not (0.001 <= body.selfMatchThreshold <= 2.0):

        raise HTTPException(
            status_code=422,
            detail=("selfMatchThreshold must " "be between 0.001 and 2.0."),
        )

    if not (1 <= body.maxAttempts <= 1_000_000):

        raise HTTPException(
            status_code=422,
            detail=("maxAttempts must be " "between 1 and 1,000,000."),
        )

    try:

        summary = run_experiment(
            user_id=user_id,
            dataset_id=body.datasetId,
            experiment_name=(body.experimentName),
            experiment_description=(body.experimentDescription),
            detector_count=(body.detectorCount),
            detector_radius=(body.detectorRadius),
            self_match_threshold=(body.selfMatchThreshold),
            max_attempts=(body.maxAttempts),
            random_seed=(body.randomSeed),
        )

    except ValueError as exc:

        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    except RuntimeError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except Exception as exc:

        logger.exception("Experiment execution failed.")

        raise HTTPException(
            status_code=500,
            detail=("The NSA experiment failed."),
        ) from exc

    return {
        "experimentId": summary.experiment_id,
        "experimentName": summary.experiment_name,
        "totalRecords": summary.total_records,
        "selfCount": summary.self_count,
        "nonSelfCount": summary.non_self_count,
        "oovCount": summary.oov_count,
        "requestedDetectorCount": summary.requested_detector_count,
        "generatedDetectorCount": summary.generated_detector_count,
        "detectorGenerationAttempts": summary.detector_generation_attempts,
        "detectorAcceptanceRate": summary.detector_acceptance_rate,
        "trainingTimeMs": summary.training_time_ms,
        "detectionTimeMs": summary.detection_time_ms,
        "totalExecutionTimeMs": summary.total_execution_time_ms,
        "confusionMatrix": (
            {
                "truePositive": summary.confusion_matrix.true_positive,
                "trueNegative": summary.confusion_matrix.true_negative,
                "falsePositive": summary.confusion_matrix.false_positive,
                "falseNegative": summary.confusion_matrix.false_negative,
            }
            if summary.confusion_matrix
            else None
        ),
        "metrics": (
            {
                "accuracy": summary.metrics.accuracy,
                "precision": summary.metrics.precision,
                "recall": summary.metrics.recall,
                "specificity": summary.metrics.specificity,
                "f1Score": summary.metrics.f1_score,
                "detectionRate": summary.metrics.detection_rate,
                "falseAlarmRate": summary.metrics.false_alarm_rate,
                "falseNegativeRate": summary.metrics.false_negative_rate,
            }
            if summary.metrics
            else None
        ),
    }


@experiments_router.get("")
def experiment_history(
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),  # noqa: B008
):

    experiments = list_experiments(
        int(current_user["sub"]),
        limit,
        offset,
    )

    return {
        "total": len(experiments),
        "experiments": experiments,
    }


@experiments_router.get("/{experiment_id}")
def experiment_details(
    experiment_id: int,
    current_user: dict = Depends(get_current_user),  # noqa: B008
):

    experiment = get_experiment(
        experiment_id,
        int(current_user["sub"]),
    )

    if not experiment:

        raise HTTPException(
            status_code=404,
            detail=("Experiment not found."),
        )

    return experiment


@experiments_router.get("/{experiment_id}/results")
def experiment_results(
    experiment_id: int,
    current_user: dict = Depends(get_current_user),  # noqa: B008
):

    user_id = int(current_user["sub"])

    experiment = get_experiment(
        experiment_id,
        user_id,
    )

    if not experiment:

        raise HTTPException(
            status_code=404,
            detail=("Experiment not found."),
        )

    results = get_experiment_results(experiment_id)

    return {
        "experimentId": experiment_id,
        "total": len(results),
        "results": results,
    }


@experiments_router.get("/{experiment_id}/detectors")
def experiment_detectors(
    experiment_id: int,
    current_user: dict = Depends(get_current_user),  # noqa: B008
):

    user_id = int(current_user["sub"])

    experiment = get_experiment(
        experiment_id,
        user_id,
    )

    if not experiment:

        raise HTTPException(
            status_code=404,
            detail=("Experiment not found."),
        )

    with get_cursor() as cur:

        cur.execute(
            """
            SELECT
                detector_id,
                detector_index,
                radius,
                minimum_self_distance,
                created_at

            FROM nsa_detectors

            WHERE experiment_id = %s

            ORDER BY detector_index
            """,
            (experiment_id,),
        )

        detectors = cur.fetchall()

    return {
        "experimentId": experiment_id,
        "total": len(detectors),
        "detectors": detectors,
    }


@experiments_router.get("/{experiment_id}/summary")
def experiment_research_summary(
    experiment_id: int,
    current_user: dict = Depends(get_current_user),  # noqa: B008
):

    user_id = int(current_user["sub"])

    experiment = get_experiment(
        experiment_id,
        user_id,
    )

    if not experiment:

        raise HTTPException(
            status_code=404,
            detail=("Experiment not found."),
        )

    return {
        "experiment": {
            "id": experiment["experiment_id"],
            "name": experiment["experiment_name"],
            "status": experiment["status"],
        },
        "parameters": {
            "detectorCount": experiment["requested_detector_count"],
            "generatedDetectors": experiment["generated_detector_count"],
            "detectorRadius": experiment["detector_radius"],
            "selfMatchThreshold": experiment["self_match_threshold"],
            "maxAttempts": experiment["max_attempts"],
            "randomSeed": experiment["random_seed"],
        },
        "featureSpace": {
            "vocabularySize": experiment["vocabulary_size"],
            "selfCorpusSize": experiment["self_corpus_size"],
        },
        "detectorGeneration": {
            "attempts": experiment["detector_generation_attempts"],
            "acceptanceRate": experiment["detector_acceptance_rate"],
        },
        "classification": {
            "total": experiment["total_records"],
            "self": experiment["self_count"],
            "nonSelf": experiment["non_self_count"],
            "oov": experiment["oov_count"],
        },
        "confusionMatrix": {
            "tp": experiment["true_positive"],
            "tn": experiment["true_negative"],
            "fp": experiment["false_positive"],
            "fn": experiment["false_negative"],
        },
        "metrics": {
            "accuracy": experiment["accuracy"],
            "precision": experiment["precision_score"],
            "recall": experiment["recall_score"],
            "specificity": experiment["specificity"],
            "f1Score": experiment["f1_score"],
            "detectionRate": experiment["detection_rate"],
            "falseAlarmRate": experiment["false_alarm_rate"],
            "falseNegativeRate": experiment["false_negative_rate"],
        },
        "performance": {
            "trainingTimeMs": experiment["training_time_ms"],
            "detectionTimeMs": experiment["detection_time_ms"],
            "totalExecutionTimeMs": experiment["total_execution_time_ms"],
        },
    }


class SentimentAnalyseRequest(BaseModel):
    texts: list[str]


class SentimentItemOut(BaseModel):
    id: int
    originalText: str
    label: str
    confidence: float
    model: str


class SentimentAnalysisResponse(BaseModel):
    totalRecords: int
    positiveCount: int
    negativeCount: int
    neutralCount: int
    results: list[SentimentItemOut]


@sentiment_router.post(
    "/analyse",
    response_model=SentimentAnalysisResponse,
)
def analyse_sentiment(
    body: SentimentAnalyseRequest,
    current_user: dict = Depends(get_current_user),  # noqa: B008
):
    texts = [t for t in body.texts if t and t.strip()]
    if not texts:
        raise HTTPException(
            status_code=422,
            detail="No non-empty texts were provided.",
        )

    try:
        raw = classify_sentiment(texts)
    except (RuntimeError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    results = [
        SentimentItemOut(
            id=index + 1,
            originalText=result.text,
            label=result.label,
            confidence=result.confidence,
            model=result.model,
        )
        for index, result in enumerate(raw)
    ]

    return SentimentAnalysisResponse(
        totalRecords=len(results),
        positiveCount=sum(1 for r in results if r.label == "Positive"),
        negativeCount=sum(1 for r in results if r.label == "Negative"),
        neutralCount=sum(1 for r in results if r.label == "Neutral"),
        results=results,
    )


app.include_router(auth_router)
app.include_router(datasets_router)
app.include_router(nsa_router)
app.include_router(sentiment_router)
app.include_router(experiments_router)
