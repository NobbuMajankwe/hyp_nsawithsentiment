from __future__ import annotations

import threading
from dataclasses import dataclass
from typing import Any


#
# Model configuration
#
#
# The model is pinned to an exact Hugging Face revision so research results
# are reproducible. Do not silently change MODEL_REVISION between experiments.
#

MODEL_ID = "lxyuan/distilbert-base-multilingual-cased-sentiments-student"
MODEL_REVISION = "d8ed71627ce46b610c8049429358333b6a392bc0"
MODEL_NAME = f"{MODEL_ID}@{MODEL_REVISION}"

MAX_TOKEN_LENGTH = 512
BATCH_SIZE = 16

VALID_SENTIMENT_LABELS = {
    "positive",
    "neutral",
    "negative",
}


#
# Lazy-loaded model state
#

_tokenizer: Any | None = None
_model: Any | None = None
_torch: Any | None = None
_device: Any | None = None

_model_lock = threading.Lock()
_inference_lock = threading.Lock()


#
# Result model
#


@dataclass(frozen=True)
class SentimentResult:
    text: str
    label: str
    confidence: float
    model: str


#
# Model loading
#


def _load_model() -> tuple[Any, Any, Any, Any]:
    """
    Load the pinned tokenizer/model once.

    Returns:
        tokenizer
        model
        torch
        device
    """
    global _tokenizer, _model, _torch, _device

    if (
        _tokenizer is not None
        and _model is not None
        and _torch is not None
        and _device is not None
    ):
        return (
            _tokenizer,
            _model,
            _torch,
            _device,
        )

    with _model_lock:
        if _tokenizer is None or _model is None or _torch is None or _device is None:
            try:
                import torch
                from transformers import (
                    AutoModelForSequenceClassification,
                    AutoTokenizer,
                )

            except ImportError as exc:
                raise RuntimeError(
                    "Sentiment inference requires the backend dependencies "
                    "'torch' and 'transformers'."
                ) from exc

            if torch.cuda.is_available():
                device = torch.device("cuda")

            elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                device = torch.device("mps")

            else:
                device = torch.device("cpu")

            try:
                tokenizer = AutoTokenizer.from_pretrained(
                    MODEL_ID,
                    revision=MODEL_REVISION,
                )

                model = AutoModelForSequenceClassification.from_pretrained(
                    MODEL_ID,
                    revision=MODEL_REVISION,
                )

            except Exception as exc:
                raise RuntimeError(
                    "Could not load the pinned sentiment model " f"{MODEL_NAME}."
                ) from exc

            model.to(device)
            model.eval()

            _tokenizer = tokenizer
            _model = model
            _torch = torch
            _device = device

    return (
        _tokenizer,
        _model,
        _torch,
        _device,
    )


#
# Label handling
#


def _label_map(model: Any) -> dict[int, str]:
    """
    Read the checkpoint's own id2label mapping and verify that it exposes
    exactly the three sentiment classes used by this project.
    """
    raw = getattr(model.config, "id2label", None)

    if not isinstance(raw, dict):
        raise RuntimeError(f"{MODEL_NAME} does not define an id2label mapping.")

    labels: dict[int, str] = {}

    for index, value in raw.items():
        try:
            numeric_index = int(index)

        except (TypeError, ValueError) as exc:
            raise RuntimeError(f"Invalid sentiment class index: {index!r}.") from exc

        label = str(value).strip().lower()

        if label not in VALID_SENTIMENT_LABELS:
            raise RuntimeError(
                f"Unsupported label {value!r} in {MODEL_NAME}; "
                "expected positive, neutral, and negative."
            )

        labels[numeric_index] = label

    if set(labels.values()) != VALID_SENTIMENT_LABELS:
        raise RuntimeError(
            f"{MODEL_NAME} must expose exactly positive, neutral, "
            "and negative labels."
        )

    return labels


#
# Input validation
#


def _validate_texts(texts: list[str]) -> list[str]:
    """
    Validate inputs while preserving order and original text.
    """
    if not isinstance(texts, list):
        raise TypeError("texts must be a list of strings.")

    if any(not isinstance(text, str) for text in texts):
        raise TypeError("Every sentiment input must be a string.")

    if any(not text.strip() for text in texts):
        raise ValueError("Sentiment inputs cannot be blank.")

    return texts


#
# Inference
#


def _classify_batch(
    texts: list[str],
) -> list[tuple[str, float]]:
    """
    Classify one batch.
    Confidence is returned as a percentage in the range 0-100.
    """
    tokenizer, model, torch, device = _load_model()
    labels = _label_map(model)

    encoded = tokenizer(
        texts,
        padding=True,
        truncation=True,
        max_length=MAX_TOKEN_LENGTH,
        return_tensors="pt",
    )

    encoded = {key: value.to(device) for key, value in encoded.items()}

    # Keep inference for the shared model instance serialised. This avoids
    # overlapping requests mutating accelerator state while preserving the
    # single lazy-loaded model.
    with _inference_lock:
        with torch.inference_mode():
            logits = model(**encoded).logits
            probabilities = torch.softmax(
                logits,
                dim=-1,
            )

            scores, indices = torch.max(
                probabilities,
                dim=-1,
            )

    score_values = scores.detach().cpu().tolist()
    index_values = indices.detach().cpu().tolist()

    if len(score_values) != len(texts) or len(index_values) != len(texts):
        raise RuntimeError("Sentiment model returned an unexpected result count.")

    results: list[tuple[str, float]] = []

    for index, score in zip(
        index_values,
        score_values,
    ):
        try:
            label = labels[int(index)]

        except (KeyError, TypeError, ValueError) as exc:
            raise RuntimeError(
                f"Model returned unknown sentiment class {index!r}."
            ) from exc

        confidence = round(
            float(score) * 100,
            2,
        )

        results.append(
            (
                label.capitalize(),
                confidence,
            )
        )

    return results


def classify_sentiment(
    texts: list[str],
) -> list[SentimentResult]:
    """
    Run three-class sentiment analysis.
    """
    validated = _validate_texts(texts)

    if not validated:
        return []

    results: list[SentimentResult] = []

    for start in range(
        0,
        len(validated),
        BATCH_SIZE,
    ):
        batch = validated[start : start + BATCH_SIZE]

        predictions = _classify_batch(batch)

        if len(predictions) != len(batch):
            raise RuntimeError("Sentiment model returned an unexpected result count.")

        for text, (
            label,
            confidence,
        ) in zip(
            batch,
            predictions,
        ):
            if label not in {
                "Positive",
                "Neutral",
                "Negative",
            }:
                raise RuntimeError(f"Unsupported sentiment label: {label!r}.")

            results.append(
                SentimentResult(
                    text=text,
                    label=label,
                    confidence=confidence,
                    model=MODEL_NAME,
                )
            )

    return results


#
# Model status
#


def get_sentiment_model_status() -> dict[str, str | bool | int]:
    """
    Return model metadata without forcing the model to download/load.
    """
    return {
        "model": MODEL_ID,
        "revision": MODEL_REVISION,
        "modelName": MODEL_NAME,
        "device": (str(_device) if _device is not None else "not initialized"),
        "loaded": _model is not None,
        "inferenceMode": "local PyTorch",
        "maxTokenLength": MAX_TOKEN_LENGTH,
        "batchSize": BATCH_SIZE,
    }
