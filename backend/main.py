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
    parse_labelled_json_file,
    save_dataset_to_db,
    save_labelled_dataset_to_db,
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
    WORD2VEC_DEFAULT_EPOCHS,
    WORD2VEC_DEFAULT_MIN_COUNT,
    WORD2VEC_DEFAULT_VECTOR_SIZE,
    WORD2VEC_DEFAULT_WINDOW,
)
from pydantic import BaseModel

from sentiment import classify_sentiment, get_sentiment_model_status

logger = logging.getLogger(__name__)

app = FastAPI(
    title="NSA Research Platform: EventSense AI",
    description=(
        "Experimental Negative Selection Algorithm platform using Word2Vec "
        "for detecting non-self observations in unstructured user-generated text."
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

    word2vecVectorSize: int
    word2vecWindow: int
    word2vecMinCount: int
    word2vecEpochs: int


class NsaConfigRequest(BaseModel):

    detectorCount: int | None = None
    detectorRadius: float | None = None
    selfMatchThreshold: float | None = None
    maxAttempts: int | None = None
    randomSeed: int | None = None

    word2vecVectorSize: int | None = None
    word2vecWindow: int | None = None
    word2vecMinCount: int | None = None
    word2vecEpochs: int | None = None


class RunExperimentRequest(BaseModel):

    datasetId: int

    experimentName: str

    experimentDescription: str | None = None

    detectorCount: int = NSA_DEFAULT_DETECTOR_COUNT

    detectorRadius: float = NSA_DEFAULT_DETECTOR_RADIUS

    selfMatchThreshold: float = NSA_DEFAULT_SELF_MATCH_THRESHOLD

    maxAttempts: int = NSA_DEFAULT_MAX_ATTEMPTS

    randomSeed: int = NSA_DEFAULT_RANDOM_SEED

    word2vecVectorSize: int = WORD2VEC_DEFAULT_VECTOR_SIZE
    word2vecWindow: int = WORD2VEC_DEFAULT_WINDOW
    word2vecMinCount: int = WORD2VEC_DEFAULT_MIN_COUNT
    word2vecEpochs: int = WORD2VEC_DEFAULT_EPOCHS

    selfCorpusDatasetId: int | None = None


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
                nsa_random_seed,
                word2vec_vector_size,
                word2vec_window,
                word2vec_min_count,
                word2vec_epochs

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
            "word2vecVectorSize": WORD2VEC_DEFAULT_VECTOR_SIZE,
            "word2vecWindow": WORD2VEC_DEFAULT_WINDOW,
            "word2vecMinCount": WORD2VEC_DEFAULT_MIN_COUNT,
            "word2vecEpochs": WORD2VEC_DEFAULT_EPOCHS,
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
        "word2vecVectorSize": (
            row["word2vec_vector_size"]
            if row["word2vec_vector_size"] is not None
            else WORD2VEC_DEFAULT_VECTOR_SIZE
        ),
        "word2vecWindow": (
            row["word2vec_window"]
            if row["word2vec_window"] is not None
            else WORD2VEC_DEFAULT_WINDOW
        ),
        "word2vecMinCount": (
            row["word2vec_min_count"]
            if row["word2vec_min_count"] is not None
            else WORD2VEC_DEFAULT_MIN_COUNT
        ),
        "word2vecEpochs": (
            row["word2vec_epochs"]
            if row["word2vec_epochs"] is not None
            else WORD2VEC_DEFAULT_EPOCHS
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
                nsa_random_seed,
                word2vec_vector_size,
                word2vec_window,
                word2vec_min_count,
                word2vec_epochs
            )

            VALUES
            (
                %s,%s,%s,%s,%s,%s,%s,%s,%s,%s
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

                word2vec_vector_size =
                    EXCLUDED.word2vec_vector_size,

                word2vec_window =
                    EXCLUDED.word2vec_window,

                word2vec_min_count =
                    EXCLUDED.word2vec_min_count,

                word2vec_epochs =
                    EXCLUDED.word2vec_epochs,

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
                config["word2vecVectorSize"],
                config["word2vecWindow"],
                config["word2vecMinCount"],
                config["word2vecEpochs"],
            ),
        )


def _validate_nsa_parameters(
    *,
    detector_count: int,
    detector_radius: float,
    self_match_threshold: float,
    max_attempts: int,
    word2vec_vector_size: int = WORD2VEC_DEFAULT_VECTOR_SIZE,
    word2vec_window: int = WORD2VEC_DEFAULT_WINDOW,
    word2vec_min_count: int = WORD2VEC_DEFAULT_MIN_COUNT,
    word2vec_epochs: int = WORD2VEC_DEFAULT_EPOCHS,
) -> None:
    # Validate NSA parameters for config and experiment routes.
    # Radius and threshold must be in (0, 1]; threshold must be >= radius.

    if not (1 <= detector_count <= 5000):
        raise HTTPException(
            status_code=422,
            detail="detectorCount must be between 1 and 5000.",
        )

    if not (0.001 <= detector_radius <= 1.0):
        raise HTTPException(
            status_code=422,
            detail="detectorRadius must be between 0.001 and 1.0.",
        )

    if not (0.001 <= self_match_threshold <= 1.0):
        raise HTTPException(
            status_code=422,
            detail="selfMatchThreshold must be between 0.001 and 1.0.",
        )

    if self_match_threshold < detector_radius:
        raise HTTPException(
            status_code=422,
            detail=(
                "selfMatchThreshold must be greater than or equal to " "detectorRadius."
            ),
        )

    if not (1 <= max_attempts <= 1_000_000):
        raise HTTPException(
            status_code=422,
            detail="maxAttempts must be between 1 and 1,000,000.",
        )

    if not (10 <= word2vec_vector_size <= 1000):
        raise HTTPException(
            status_code=422,
            detail="word2vecVectorSize must be between 10 and 1000.",
        )

    if not (1 <= word2vec_window <= 50):
        raise HTTPException(
            status_code=422,
            detail="word2vecWindow must be between 1 and 50.",
        )

    if not (1 <= word2vec_min_count <= 100):
        raise HTTPException(
            status_code=422,
            detail="word2vecMinCount must be between 1 and 100.",
        )

    if not (1 <= word2vec_epochs <= 1000):
        raise HTTPException(
            status_code=422,
            detail="word2vecEpochs must be between 1 and 1000.",
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
        "word2vecVectorSize": (
            body.word2vecVectorSize
            if body.word2vecVectorSize is not None
            else current["word2vecVectorSize"]
        ),
        "word2vecWindow": (
            body.word2vecWindow
            if body.word2vecWindow is not None
            else current["word2vecWindow"]
        ),
        "word2vecMinCount": (
            body.word2vecMinCount
            if body.word2vecMinCount is not None
            else current["word2vecMinCount"]
        ),
        "word2vecEpochs": (
            body.word2vecEpochs
            if body.word2vecEpochs is not None
            else current["word2vecEpochs"]
        ),
    }

    _validate_nsa_parameters(
        detector_count=config["detectorCount"],
        detector_radius=config["detectorRadius"],
        self_match_threshold=config["selfMatchThreshold"],
        max_attempts=config["maxAttempts"],
        word2vec_vector_size=config["word2vecVectorSize"],
        word2vec_window=config["word2vecWindow"],
        word2vec_min_count=config["word2vecMinCount"],
        word2vec_epochs=config["word2vecEpochs"],
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
    # Upload a research dataset.
    # SELF_CORPUS: save with optional labels, all unlabelled rows treated as SELF.
    # EVALUATION: must be labelled for confusion-matrix metrics.
    # ANALYSIS / SUPPORT: unlabelled only.

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
            detail="Only CSV and JSON files are supported.",
        )

    try:
        content = await file.read()
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to read file: {exc}",
        ) from exc

    if len(content) > 100 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="File too large. Maximum size is 100MB.",
        )

    dataset_name = name.strip() if name and name.strip() else file.filename

    labelled_records: list[dict[str, str]] | None = None
    feedback_texts: list[str] | None = None

    try:
        if researchRole == "EVALUATION":
            # Evaluation must always have ground-truth labels.
            if source_type == "CSV":
                labelled_records = parse_labelled_csv_file(content)
            else:
                labelled_records = parse_labelled_json_file(content)

        elif researchRole == "SELF_CORPUS":
            # A SELF corpus may be labelled or completely unlabelled.
            #
            # First try to preserve labels. Only fall back to the unlabelled
            # parser when the file genuinely has no label field.
            try:
                if source_type == "CSV":
                    labelled_records = parse_labelled_csv_file(content)
                else:
                    labelled_records = parse_labelled_json_file(content)

            except DatasetParseError as exc:
                message = str(exc).lower()

                missing_label = (
                    "label column" in message
                    or "no ground-truth label" in message
                    or "no ground truth label" in message
                )

                if not missing_label:
                    # A label exists but is invalid/corrupt. Do not silently
                    # throw it away and turn the whole file into SELF.
                    raise

                if source_type == "CSV":
                    feedback_texts = parse_csv_file(content)
                else:
                    feedback_texts = parse_json_file(content)

        else:
            # ANALYSIS and SUPPORT are intentionally unlabelled.
            if source_type == "CSV":
                feedback_texts = parse_csv_file(content)
            else:
                feedback_texts = parse_json_file(content)

    except DatasetParseError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    try:
        if labelled_records is not None:
            dataset_id = save_labelled_dataset_to_db(
                user_id=user_id,
                source_name=dataset_name,
                source_type=source_type,
                records=labelled_records,
                file_path=file.filename,
                description=description,
                research_role=researchRole,
            )

            self_count = sum(record["label"] == "SELF" for record in labelled_records)
            non_self_count = sum(
                record["label"] == "NON_SELF" for record in labelled_records
            )
            total_records = len(labelled_records)

        else:
            if feedback_texts is None:
                raise RuntimeError("Dataset parsing produced no records.")

            dataset_id = save_dataset_to_db(
                user_id=user_id,
                source_name=dataset_name,
                source_type=source_type,
                feedback_texts=feedback_texts,
                file_path=file.filename,
                description=description,
                research_role=researchRole,
            )

            self_count = None
            non_self_count = None
            total_records = len(feedback_texts)

    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        logger.exception("Dataset upload failed.")

        raise HTTPException(
            status_code=500,
            detail=f"Failed to save dataset: {exc}",
        ) from exc

    response = {
        "message": "Dataset uploaded successfully.",
        "datasetId": dataset_id,
        "name": dataset_name,
        "type": source_type,
        "researchRole": researchRole,
        "totalRecords": total_records,
        "labelled": labelled_records is not None,
    }

    if labelled_records is not None:
        response["selfRecords"] = self_count
        response["nonSelfRecords"] = non_self_count

    return response


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
    # Backward-compatible labelled EVALUATION upload.
    # New code should use /api/datasets/upload with researchRole=EVALUATION.

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
            detail=("A labelled evaluation dataset must be CSV or JSON."),
        )

    try:
        content = await file.read()
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to read file: {exc}",
        ) from exc

    if len(content) > 100 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="File too large. Maximum size is 100MB.",
        )

    try:
        if source_type == "CSV":
            records = parse_labelled_csv_file(content)
        else:
            records = parse_labelled_json_file(content)
    except DatasetParseError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    dataset_name = name.strip() if name and name.strip() else file.filename

    try:
        dataset_id = save_labelled_dataset_to_db(
            user_id=user_id,
            source_name=dataset_name,
            source_type=source_type,
            records=records,
            file_path=file.filename,
            description=description,
            research_role="EVALUATION",
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Labelled dataset upload failed.")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save labelled dataset: {exc}",
        ) from exc

    self_count = sum(record["label"] == "SELF" for record in records)
    non_self_count = sum(record["label"] == "NON_SELF" for record in records)

    return {
        "message": "Labelled evaluation dataset uploaded successfully.",
        "datasetId": dataset_id,
        "name": dataset_name,
        "type": source_type,
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

    _validate_nsa_parameters(
        detector_count=body.detectorCount,
        detector_radius=body.detectorRadius,
        self_match_threshold=body.selfMatchThreshold,
        max_attempts=body.maxAttempts,
        word2vec_vector_size=body.word2vecVectorSize,
        word2vec_window=body.word2vecWindow,
        word2vec_min_count=body.word2vecMinCount,
        word2vec_epochs=body.word2vecEpochs,
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
            word2vec_vector_size=(body.word2vecVectorSize),
            word2vec_window=(body.word2vecWindow),
            word2vec_min_count=(body.word2vecMinCount),
            word2vec_epochs=(body.word2vecEpochs),
            self_corpus_dataset_id=(body.selfCorpusDatasetId),
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
        "textRepresentation": summary.text_representation,
        "word2vecVectorSize": summary.word2vec_vector_size,
        "word2vecWindow": summary.word2vec_window,
        "word2vecMinCount": summary.word2vec_min_count,
        "word2vecEpochs": summary.word2vec_epochs,
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


class SentimentItemOut(BaseModel):
    id: int
    feedbackId: int | None = None
    recordIndex: int
    originalText: str
    groundTruthLabel: str | None = None
    nsaClassification: str
    label: str
    confidence: float
    model: str


class ExperimentSentimentResponse(BaseModel):
    experimentId: int
    experimentName: str
    datasetId: int

    totalExperimentRecords: int
    eligibleSelfRecords: int
    excludedNonSelfRecords: int
    excludedOovRecords: int

    analysedRecords: int

    positiveCount: int
    negativeCount: int
    neutralCount: int

    results: list[SentimentItemOut]


class SentimentEligibilityResponse(BaseModel):
    experimentId: int
    experimentName: str
    status: str
    totalExperimentRecords: int
    eligibleSelfRecords: int
    excludedNonSelfRecords: int
    excludedOovRecords: int


def _get_completed_experiment_for_sentiment(
    experiment_id: int,
    user_id: int,
) -> dict:
    # Load a completed experiment owned by the user for sentiment analysis.

    experiment = get_experiment(
        experiment_id,
        user_id,
    )

    if not experiment:
        raise HTTPException(
            status_code=404,
            detail="Experiment not found.",
        )

    if experiment["status"] != "COMPLETED":
        raise HTTPException(
            status_code=409,
            detail=(
                "The NSA experiment must be completed before "
                "sentiment analysis can run."
            ),
        )

    return experiment


def _load_self_experiment_results(
    experiment_id: int,
) -> list[dict]:
    # Return only records the NSA predicted as SELF.
    # Filters by predicted_class, not ground_truth_label.

    with get_cursor() as cur:
        cur.execute(
            """
            SELECT
                result_id,
                feedback_id,
                record_index,
                original_text,
                ground_truth_label,
                predicted_class

            FROM experiment_results

            WHERE experiment_id = %s
              AND predicted_class = 'SELF'

            ORDER BY record_index
            """,
            (experiment_id,),
        )

        return cur.fetchall()


@sentiment_router.get(
    "/model-status",
)
def sentiment_model_status(
    current_user: dict = Depends(get_current_user),  # noqa: B008
):
    # Return pinned model metadata without forcing model inference.

    return get_sentiment_model_status()


@sentiment_router.get(
    "/experiments/{experiment_id}/eligibility",
    response_model=SentimentEligibilityResponse,
)
def sentiment_experiment_eligibility(
    experiment_id: int,
    current_user: dict = Depends(get_current_user),  # noqa: B008
):
    # Check how many records are eligible for sentiment before running DistilBERT.

    user_id = int(current_user["sub"])

    experiment = _get_completed_experiment_for_sentiment(
        experiment_id,
        user_id,
    )

    eligible_records = _load_self_experiment_results(experiment_id)

    return SentimentEligibilityResponse(
        experimentId=experiment_id,
        experimentName=experiment["experiment_name"],
        status=experiment["status"],
        totalExperimentRecords=int(experiment["total_records"] or 0),
        eligibleSelfRecords=len(eligible_records),
        excludedNonSelfRecords=int(experiment["non_self_count"] or 0),
        excludedOovRecords=int(experiment["oov_count"] or 0),
    )


@sentiment_router.post(
    "/experiments/{experiment_id}/analyse",
    response_model=ExperimentSentimentResponse,
)
def analyse_experiment_sentiment(
    experiment_id: int,
    current_user: dict = Depends(get_current_user),  # noqa: B008
):
    # Run DistilBERT on NSA-validated (SELF) feedback only.
    # NON_SELF and OOV records are excluded.

    user_id = int(current_user["sub"])

    experiment = _get_completed_experiment_for_sentiment(
        experiment_id,
        user_id,
    )

    eligible_records = _load_self_experiment_results(experiment_id)

    if not eligible_records:
        raise HTTPException(
            status_code=422,
            detail=(
                "No validated SELF records were returned. "
                "Run an NSA experiment with accepted SELF records first."
            ),
        )

    texts = [str(record["original_text"]).strip() for record in eligible_records]

    if any(not text for text in texts):
        raise HTTPException(
            status_code=500,
            detail=(
                "The experiment contains an empty SELF record and "
                "cannot be sent to sentiment analysis."
            ),
        )

    try:
        sentiment_results = classify_sentiment(texts)

    except (RuntimeError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        ) from exc

    if len(sentiment_results) != len(eligible_records):
        raise HTTPException(
            status_code=500,
            detail=(
                "Sentiment result count does not match the number "
                "of eligible SELF records."
            ),
        )

    results: list[SentimentItemOut] = []

    for record, sentiment_result in zip(
        eligible_records,
        sentiment_results,
    ):
        results.append(
            SentimentItemOut(
                id=int(record["result_id"]),
                feedbackId=(
                    int(record["feedback_id"])
                    if record["feedback_id"] is not None
                    else None
                ),
                recordIndex=int(record["record_index"]),
                originalText=sentiment_result.text,
                groundTruthLabel=record["ground_truth_label"],
                nsaClassification=record["predicted_class"],
                label=sentiment_result.label,
                confidence=sentiment_result.confidence,
                model=sentiment_result.model,
            )
        )

    positive_count = sum(result.label == "Positive" for result in results)

    negative_count = sum(result.label == "Negative" for result in results)

    neutral_count = sum(result.label == "Neutral" for result in results)

    return ExperimentSentimentResponse(
        experimentId=experiment_id,
        experimentName=experiment["experiment_name"],
        datasetId=int(experiment["dataset_id"]),
        totalExperimentRecords=int(experiment["total_records"] or 0),
        eligibleSelfRecords=len(eligible_records),
        excludedNonSelfRecords=int(experiment["non_self_count"] or 0),
        excludedOovRecords=int(experiment["oov_count"] or 0),
        analysedRecords=len(results),
        positiveCount=positive_count,
        negativeCount=negative_count,
        neutralCount=neutral_count,
        results=results,
    )


app.include_router(auth_router)
app.include_router(datasets_router)
app.include_router(nsa_router)
app.include_router(sentiment_router)
app.include_router(experiments_router)
