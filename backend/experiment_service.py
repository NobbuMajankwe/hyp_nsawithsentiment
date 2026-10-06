from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass

from database import get_cursor
from nsa import (
    NegativeSelectionAlgorithm,
    NSAResponse,
    NSAResult,
    get_nsa,
)

logger = logging.getLogger(__name__)


# Research models


@dataclass
class ConfusionMatrix:
    true_positive: int = 0
    true_negative: int = 0
    false_positive: int = 0
    false_negative: int = 0


@dataclass
class EvaluationMetrics:
    accuracy: float | None
    precision: float | None
    recall: float | None
    specificity: float | None
    f1_score: float | None
    detection_rate: float | None
    false_alarm_rate: float | None
    false_negative_rate: float | None


@dataclass
class ExperimentSummary:
    experiment_id: int
    experiment_name: str

    total_records: int
    self_count: int
    non_self_count: int
    oov_count: int

    requested_detector_count: int
    generated_detector_count: int

    detector_generation_attempts: int
    detector_acceptance_rate: float

    confusion_matrix: ConfusionMatrix | None
    metrics: EvaluationMetrics | None

    training_time_ms: float
    detection_time_ms: float
    total_execution_time_ms: float


# Metric helpers


def _safe_divide(
    numerator: float,
    denominator: float,
) -> float | None:

    if denominator == 0:
        return None

    return numerator / denominator


def calculate_confusion_matrix(
    ground_truth: list[str],
    predictions: list[str],
) -> ConfusionMatrix:
    """
    Calculate the confusion matrix.

    NON_SELF is treated as the positive class.

    SELF     -> negative class
    NON_SELF -> positive class

    OOV predictions are treated as NON_SELF for
    binary evaluation because the system was unable
    to represent the input as SELF.
    """

    if len(ground_truth) != len(predictions):
        raise ValueError("Ground truth and prediction lengths do not match.")

    matrix = ConfusionMatrix()

    for truth, prediction in zip(
        ground_truth,
        predictions,
    ):

        if truth not in {
            "SELF",
            "NON_SELF",
        }:
            continue

        binary_prediction = "NON_SELF" if prediction == "OOV" else prediction

        if truth == "NON_SELF" and binary_prediction == "NON_SELF":
            matrix.true_positive += 1

        elif truth == "SELF" and binary_prediction == "SELF":
            matrix.true_negative += 1

        elif truth == "SELF" and binary_prediction == "NON_SELF":
            matrix.false_positive += 1

        elif truth == "NON_SELF" and binary_prediction == "SELF":
            matrix.false_negative += 1

    return matrix


def calculate_metrics(
    matrix: ConfusionMatrix,
) -> EvaluationMetrics:

    tp = matrix.true_positive
    tn = matrix.true_negative
    fp = matrix.false_positive
    fn = matrix.false_negative

    total = tp + tn + fp + fn

    accuracy = _safe_divide(
        tp + tn,
        total,
    )

    precision = _safe_divide(
        tp,
        tp + fp,
    )

    recall = _safe_divide(
        tp,
        tp + fn,
    )

    specificity = _safe_divide(
        tn,
        tn + fp,
    )

    if precision is not None and recall is not None and precision + recall > 0:
        f1_score = 2 * precision * recall / (precision + recall)
    else:
        f1_score = None

    false_alarm_rate = _safe_divide(
        fp,
        fp + tn,
    )

    false_negative_rate = _safe_divide(
        fn,
        fn + tp,
    )

    # For this project detection rate == recall.
    detection_rate = recall

    return EvaluationMetrics(
        accuracy=accuracy,
        precision=precision,
        recall=recall,
        specificity=specificity,
        f1_score=f1_score,
        detection_rate=detection_rate,
        false_alarm_rate=false_alarm_rate,
        false_negative_rate=false_negative_rate,
    )


# Dataset loading


def load_dataset_records(
    dataset_id: int,
) -> list[dict]:
    """
    Load the feedback records belonging to an experiment dataset.
    """

    with get_cursor() as cur:
        cur.execute(
            """
            SELECT
                feedback_id,
                raw_text,
                ground_truth_label
            FROM feedback_records
            WHERE dataset_id = %s
            ORDER BY feedback_id
            """,
            (dataset_id,),
        )

        return cur.fetchall()


def get_dataset_info(
    dataset_id: int,
) -> dict:
    """
    Retrieve dataset metadata.
    """

    with get_cursor() as cur:
        cur.execute(
            """
            SELECT
                dataset_id,
                source_name,
                source_type,
                research_role,
                total_records
            FROM datasets
            WHERE dataset_id = %s
            LIMIT 1
            """,
            (dataset_id,),
        )

        dataset = cur.fetchone()

    if not dataset:
        raise ValueError(f"Dataset {dataset_id} was not found.")

    return dataset


def get_self_dataset_id() -> int | None:
    """
    Return the configured SELF corpus dataset.

    The research database should ideally contain exactly
    one active SELF_CORPUS dataset.
    """

    with get_cursor() as cur:
        cur.execute(
            """
            SELECT dataset_id
            FROM datasets
            WHERE research_role = 'SELF_CORPUS'
            ORDER BY loaded_at DESC
            LIMIT 1
            """
        )

        row = cur.fetchone()

    return int(row["dataset_id"]) if row else None


# Experiment persistence


def create_experiment(
    *,
    user_id: int,
    dataset_id: int,
    training_dataset_id: int | None,
    experiment_name: str,
    experiment_description: str | None,
    nsa: NegativeSelectionAlgorithm,
) -> int:
    """
    Create the experiment record before detection begins.
    """

    stats = nsa.training_statistics

    if stats is None:
        raise RuntimeError("NSA training statistics are unavailable.")

    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO experiment_runs
            (
                user_id,
                dataset_id,
                training_dataset_id,
                experiment_name,
                experiment_description,
                training_corpus_hash,

                requested_detector_count,
                generated_detector_count,
                detector_radius,
                self_match_threshold,
                max_attempts,
                random_seed,

                vocabulary_size,
                self_corpus_size,

                detector_generation_attempts,
                detector_acceptance_rate,

                training_time_ms,
                status
            )
            VALUES
            (
                %s,%s,%s,%s,%s,%s,
                %s,%s,%s,%s,%s,%s,
                %s,%s,
                %s,%s,
                %s,'RUNNING'
            )
            RETURNING experiment_id
            """,
            (
                user_id,
                dataset_id,
                training_dataset_id,
                experiment_name,
                experiment_description,
                stats.corpus_hash,
                stats.requested_detectors,
                stats.generated_detectors,
                nsa.detector_radius,
                nsa.self_match_threshold,
                nsa.max_attempts,
                nsa.random_seed,
                stats.vocabulary_size,
                stats.self_corpus_size,
                stats.generation_attempts,
                stats.detector_acceptance_rate,
                stats.training_time_ms,
            ),
        )

        row = cur.fetchone()

    return int(row["experiment_id"])


def save_detectors(
    experiment_id: int,
    nsa: NegativeSelectionAlgorithm,
) -> dict[int, int]:
    """
    Save every generated detector.

    Returns:
        Mapping of NSA detector_index -> database detector_id.

    The mapping is important because nsa.py works with detector
    IDs local to a model instance while the database has its
    own primary keys.
    """

    detector_map: dict[int, int] = {}

    with get_cursor(commit=True) as cur:

        for detector in nsa.detectors:

            cur.execute(
                """
                INSERT INTO nsa_detectors
                (
                    experiment_id,
                    detector_index,
                    detector_vector,
                    radius,
                    minimum_self_distance
                )
                VALUES
                (
                    %s,%s,%s,%s,%s
                )
                RETURNING detector_id
                """,
                (
                    experiment_id,
                    detector.detector_id,
                    json.dumps(detector.vector),
                    detector.radius,
                    detector.minimum_self_distance,
                ),
            )

            row = cur.fetchone()

            detector_map[detector.detector_id] = int(row["detector_id"])

    return detector_map


def save_experiment_results(
    *,
    experiment_id: int,
    dataset_records: list[dict],
    results: list[NSAResult],
    detector_map: dict[int, int],
    detection_times: list[float],
) -> None:
    """
    Save record-level NSA research measurements.
    """

    if len(dataset_records) != len(results):
        raise ValueError(
            "Dataset records and NSA results " "do not have matching lengths."
        )

    with get_cursor(commit=True) as cur:

        for record, result, detection_time in zip(
            dataset_records,
            results,
            detection_times,
        ):

            database_detector_id = None

            if result.matched_detector_id is not None:
                database_detector_id = detector_map.get(result.matched_detector_id)

            cur.execute(
                """
                INSERT INTO experiment_results
                (
                    experiment_id,
                    feedback_id,
                    record_index,

                    original_text,
                    cleaned_text,
                    tokens,

                    ground_truth_label,
                    predicted_class,

                    nearest_self_distance,
                    nearest_detector_distance,

                    matched_detector_id,
                    detector_radius,
                    detector_margin,

                    vocabulary_coverage,
                    out_of_vocabulary_ratio,

                    anomaly_score,
                    classification_reason,
                    detection_time_ms
                )
                VALUES
                (
                    %s,%s,%s,
                    %s,%s,%s,
                    %s,%s,
                    %s,%s,
                    %s,%s,%s,
                    %s,%s,
                    %s,%s,%s
                )
                """,
                (
                    experiment_id,
                    record["feedback_id"],
                    result.id,
                    result.original_text,
                    result.cleaned_text,
                    json.dumps(result.tokens),
                    record["ground_truth_label"],
                    result.classification,
                    result.nearest_self_distance,
                    result.nearest_detector_distance,
                    database_detector_id,
                    result.detector_radius,
                    result.detector_margin,
                    result.vocabulary_coverage,
                    result.out_of_vocabulary_ratio,
                    result.anomaly_score,
                    result.classification_reason,
                    round(
                        detection_time,
                        3,
                    ),
                ),
            )


# Complete experiment


def complete_experiment(
    *,
    experiment_id: int,
    response: NSAResponse,
    confusion_matrix: ConfusionMatrix | None,
    metrics: EvaluationMetrics | None,
    detection_time_ms: float,
    total_execution_time_ms: float,
) -> None:

    with get_cursor(commit=True) as cur:

        cur.execute(
            """
            UPDATE experiment_runs
            SET
                total_records = %s,

                self_count = %s,
                non_self_count = %s,
                oov_count = %s,

                detector_match_count = %s,

                true_positive = %s,
                true_negative = %s,
                false_positive = %s,
                false_negative = %s,

                accuracy = %s,
                precision_score = %s,
                recall_score = %s,
                specificity = %s,
                f1_score = %s,
                detection_rate = %s,
                false_alarm_rate = %s,
                false_negative_rate = %s,

                detection_time_ms = %s,
                total_execution_time_ms = %s,

                status = 'COMPLETED'

            WHERE experiment_id = %s
            """,
            (
                response.total_records,
                response.self_records,
                response.non_self_records,
                response.oov_records,
                response.non_self_records,
                (confusion_matrix.true_positive if confusion_matrix else None),
                (confusion_matrix.true_negative if confusion_matrix else None),
                (confusion_matrix.false_positive if confusion_matrix else None),
                (confusion_matrix.false_negative if confusion_matrix else None),
                metrics.accuracy if metrics else None,
                metrics.precision if metrics else None,
                metrics.recall if metrics else None,
                metrics.specificity if metrics else None,
                metrics.f1_score if metrics else None,
                metrics.detection_rate if metrics else None,
                metrics.false_alarm_rate if metrics else None,
                metrics.false_negative_rate if metrics else None,
                detection_time_ms,
                total_execution_time_ms,
                experiment_id,
            ),
        )


def fail_experiment(
    experiment_id: int,
) -> None:

    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            UPDATE experiment_runs
            SET status = 'FAILED'
            WHERE experiment_id = %s
            """,
            (experiment_id,),
        )


# Evaluation


def evaluate_results(
    dataset_records: list[dict],
    results: list[NSAResult],
) -> tuple[
    ConfusionMatrix | None,
    EvaluationMetrics | None,
]:
    """
    Calculate metrics only when labelled records exist.

    Unlabelled ANALYSIS datasets intentionally return
    no accuracy/precision/recall values.
    """

    labelled_pairs = [
        (
            record["ground_truth_label"],
            result.classification,
        )
        for record, result in zip(
            dataset_records,
            results,
        )
        if record["ground_truth_label"]
        in {
            "SELF",
            "NON_SELF",
        }
    ]

    if not labelled_pairs:
        return None, None

    ground_truth = [pair[0] for pair in labelled_pairs]

    predictions = [pair[1] for pair in labelled_pairs]

    matrix = calculate_confusion_matrix(
        ground_truth,
        predictions,
    )

    metrics = calculate_metrics(matrix)

    return matrix, metrics


# Main research experiment


def run_experiment(
    *,
    user_id: int,
    dataset_id: int,
    experiment_name: str,
    experiment_description: str | None = None,
    detector_count: int = 200,
    detector_radius: float = 0.40,
    self_match_threshold: float = 0.75,
    max_attempts: int = 10_000,
    random_seed: int = 42,
) -> ExperimentSummary:

    experiment_started = time.perf_counter()

    # Dataset

    dataset = get_dataset_info(dataset_id)  # noqa: F841

    records = load_dataset_records(dataset_id)

    if not records:
        raise ValueError("The selected dataset contains " "no feedback records.")

    texts = [row["raw_text"] for row in records]

    # Training dataset

    training_dataset_id = get_self_dataset_id()

    if training_dataset_id is None:
        raise RuntimeError("No SELF_CORPUS dataset has " "been configured.")

    # NSA

    nsa = get_nsa(
        detector_count=detector_count,
        detector_radius=detector_radius,
        self_match_threshold=(self_match_threshold),
        max_attempts=max_attempts,
        random_seed=random_seed,
    )

    # Experiment metadata

    experiment_id = create_experiment(
        user_id=user_id,
        dataset_id=dataset_id,
        training_dataset_id=(training_dataset_id),
        experiment_name=(experiment_name),
        experiment_description=(experiment_description),
        nsa=nsa,
    )

    try:

        # Persist detector population

        detector_map = save_detectors(
            experiment_id,
            nsa,
        )

        # Detection

        detection_started = time.perf_counter()

        results: list[NSAResult] = []
        detection_times: list[float] = []

        for index, text in enumerate(
            texts,
            start=1,
        ):

            item_started = time.perf_counter()

            result = nsa.detect_one(
                text,
                index,
            )

            item_time_ms = (time.perf_counter() - item_started) * 1000

            results.append(result)

            detection_times.append(item_time_ms)

        detection_time_ms = (time.perf_counter() - detection_started) * 1000

        # Aggregate NSA response

        self_count = sum(result.classification == "SELF" for result in results)

        non_self_count = sum(result.classification == "NON_SELF" for result in results)

        oov_count = sum(result.classification == "OOV" for result in results)

        if nsa.training_statistics is None:
            raise RuntimeError("Training statistics " "are unavailable.")

        response = NSAResponse(
            total_records=len(results),
            self_records=self_count,
            non_self_records=(non_self_count),
            oov_records=oov_count,
            results=results,
            training_statistics=(nsa.training_statistics),
        )

        # Save record-level results

        save_experiment_results(
            experiment_id=(experiment_id),
            dataset_records=records,
            results=results,
            detector_map=detector_map,
            detection_times=(detection_times),
        )

        # Evaluation

        (
            confusion_matrix,
            metrics,
        ) = evaluate_results(
            records,
            results,
        )

        # Complete experiment

        total_execution_time_ms = (time.perf_counter() - experiment_started) * 1000

        complete_experiment(
            experiment_id=(experiment_id),
            response=response,
            confusion_matrix=(confusion_matrix),
            metrics=metrics,
            detection_time_ms=round(
                detection_time_ms,
                3,
            ),
            total_execution_time_ms=round(
                total_execution_time_ms,
                3,
            ),
        )

        # Return research summary

        return ExperimentSummary(
            experiment_id=(experiment_id),
            experiment_name=(experiment_name),
            total_records=(response.total_records),
            self_count=(response.self_records),
            non_self_count=(response.non_self_records),
            oov_count=(response.oov_records),
            requested_detector_count=(nsa.training_statistics.requested_detectors),
            generated_detector_count=(nsa.training_statistics.generated_detectors),
            detector_generation_attempts=(nsa.training_statistics.generation_attempts),
            detector_acceptance_rate=(nsa.training_statistics.detector_acceptance_rate),
            confusion_matrix=(confusion_matrix),
            metrics=metrics,
            training_time_ms=(nsa.training_statistics.training_time_ms),
            detection_time_ms=round(
                detection_time_ms,
                3,
            ),
            total_execution_time_ms=round(
                total_execution_time_ms,
                3,
            ),
        )

    except Exception:

        logger.exception(
            "NSA experiment %s failed.",
            experiment_id,
        )

        fail_experiment(experiment_id)

        raise


# Experiment retrieval


def get_experiment(
    experiment_id: int,
    user_id: int | None = None,
) -> dict | None:

    query = """
        SELECT *
        FROM experiment_runs
        WHERE experiment_id = %s
    """

    params: list = [experiment_id]

    if user_id is not None:
        query += """
            AND user_id = %s
        """

        params.append(user_id)

    with get_cursor() as cur:
        cur.execute(
            query,
            params,
        )

        return cur.fetchone()


def get_experiment_results(
    experiment_id: int,
) -> list[dict]:

    with get_cursor() as cur:
        cur.execute(
            """
            SELECT
                result_id,
                record_index,

                original_text,

                ground_truth_label,
                predicted_class,

                nearest_self_distance,
                nearest_detector_distance,

                matched_detector_id,
                detector_radius,
                detector_margin,

                vocabulary_coverage,
                out_of_vocabulary_ratio,

                anomaly_score,

                classification_reason,
                detection_time_ms

            FROM experiment_results

            WHERE experiment_id = %s

            ORDER BY record_index
            """,
            (experiment_id,),
        )

        return cur.fetchall()


def list_experiments(
    user_id: int,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:

    with get_cursor() as cur:
        cur.execute(
            """
            SELECT
                e.experiment_id,
                e.experiment_name,
                e.status,

                e.dataset_id,
                d.source_name
                    AS dataset_name,

                e.requested_detector_count,
                e.generated_detector_count,

                e.detector_radius,
                e.self_match_threshold,

                e.random_seed,

                e.total_records,
                e.self_count,
                e.non_self_count,
                e.oov_count,

                e.accuracy,
                e.precision_score,
                e.recall_score,
                e.f1_score,
                e.false_alarm_rate,

                e.total_execution_time_ms,

                e.created_at

            FROM experiment_runs e

            LEFT JOIN datasets d
                ON d.dataset_id
                = e.dataset_id

            WHERE e.user_id = %s

            ORDER BY
                e.created_at DESC

            LIMIT %s
            OFFSET %s
            """,
            (
                user_id,
                limit,
                offset,
            ),
        )

        return cur.fetchall()
