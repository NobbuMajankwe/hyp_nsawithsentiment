from __future__ import annotations

import threading
from dataclasses import dataclass
from typing import Any

MODEL_ID = "lxyuan/distilbert-base-multilingual-cased-sentiments-student"
MODEL_REVISION = "d8ed71627ce46b610c8049429358333b6a392bc0"
MODEL_NAME = f"{MODEL_ID}@{MODEL_REVISION}"
MAX_TOKEN_LENGTH = 512
BATCH_SIZE = 16

_tokenizer: Any | None = None
_model: Any | None = None
_torch: Any | None = None
_device: Any | None = None
_model_lock = threading.Lock()


@dataclass(frozen=True)
class SentimentResult:
    text: str
    label: str
    confidence: float
    model: str


def _load_model() -> tuple[Any, Any, Any]:
    """Load the pinned model once, on first inference."""
    global _tokenizer, _model, _torch, _device

    if _tokenizer is not None and _model is not None and _torch is not None:
        return _tokenizer, _model, _torch

    with _model_lock:
        if _tokenizer is None or _model is None or _torch is None:
            try:
                import torch
                from transformers import (
                    AutoModelForSequenceClassification,
                    AutoTokenizer,
                )
            except ImportError as exc:
                raise RuntimeError(
                    "Sentiment inference requires the backend dependencies "
                    "'torch' and 'transformers'. Install upload/requirements.txt."
                ) from exc

            device = torch.device(
                "cuda"
                if torch.cuda.is_available()
                else (
                    "mps"
                    if (
                        hasattr(torch.backends, "mps")
                        and torch.backends.mps.is_available()
                    )
                    else "cpu"
                )
            )
            tokenizer = AutoTokenizer.from_pretrained(
                MODEL_ID,
                revision=MODEL_REVISION,
            )
            model = AutoModelForSequenceClassification.from_pretrained(
                MODEL_ID,
                revision=MODEL_REVISION,
            )
            model.to(device)
            model.eval()

            _tokenizer, _model, _torch, _device = (
                tokenizer,
                model,
                torch,
                device,
            )

    return _tokenizer, _model, _torch


def _label_map(model: Any) -> dict[int, str]:
    """Read and validate the checkpoint's own class labels."""
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
        if label not in {"positive", "neutral", "negative"}:
            raise RuntimeError(
                f"Unsupported label {value!r} in {MODEL_NAME}; expected "
                "positive, neutral, and negative."
            )
        labels[numeric_index] = label

    if set(labels.values()) != {"positive", "neutral", "negative"}:
        raise RuntimeError(
            f"{MODEL_NAME} must expose exactly positive, neutral, and negative labels."
        )
    return labels


def _classify_batch(texts: list[str]) -> list[tuple[str, float]]:
    tokenizer, model, torch = _load_model()
    labels = _label_map(model)
    device = _device

    encoded = tokenizer(
        texts,
        padding=True,
        truncation=True,
        max_length=MAX_TOKEN_LENGTH,
        return_tensors="pt",
    )
    encoded = {key: value.to(device) for key, value in encoded.items()}

    with torch.inference_mode():
        probabilities = torch.softmax(model(**encoded).logits, dim=-1)
        scores, indices = torch.max(probabilities, dim=-1)

    score_values = scores.detach().cpu().tolist()
    index_values = indices.detach().cpu().tolist()
    if len(score_values) != len(texts) or len(index_values) != len(texts):
        raise RuntimeError("Sentiment model returned an unexpected result count.")

    results: list[tuple[str, float]] = []
    for index, score in zip(index_values, score_values):
        try:
            label = labels[int(index)]
        except (KeyError, ValueError, TypeError) as exc:
            raise RuntimeError(
                f"Model returned unknown sentiment class {index!r}."
            ) from exc
        results.append((label.capitalize(), round(float(score) * 100, 2)))
    return results


def classify_sentiment(texts: list[str]) -> list[SentimentResult]:
    """Classify non-empty strings and preserve input order.

    Invalid or blank items are rejected instead of being assigned a made-up
    sentiment. The API route already removes blank entries before calling us.
    """
    if not isinstance(texts, list):
        raise TypeError("texts must be a list of strings.")
    if any(not isinstance(text, str) for text in texts):
        raise TypeError("Every sentiment input must be a string.")
    if any(not text.strip() for text in texts):
        raise ValueError("Sentiment inputs cannot be blank.")
    if not texts:
        return []

    results: list[SentimentResult] = []
    for start in range(0, len(texts), BATCH_SIZE):
        batch = texts[start : start + BATCH_SIZE]
        predictions = _classify_batch(batch)
        if len(predictions) != len(batch):
            raise RuntimeError("Sentiment model returned an unexpected result count.")

        for text, (label, confidence) in zip(batch, predictions):
            if label not in {"Positive", "Negative", "Neutral"}:
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


def get_sentiment_model_status() -> dict[str, str | bool]:
    """Return model metadata without triggering a download."""
    return {
        "model": MODEL_ID,
        "revision": MODEL_REVISION,
        "device": str(_device) if _device is not None else "not initialized",
        "loaded": _model is not None,
        "inferenceMode": "local PyTorch",
    }
