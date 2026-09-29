from __future__ import annotations

import json
import logging
import os
import re
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Optional

import torch
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    PreTrainedModel,
    PreTrainedTokenizerBase,
)

logger = logging.getLogger(__name__)

HF_API_TOKEN = os.getenv("HF_API_TOKEN", "")
HF_MODEL_ID = "distilbert-base-uncased-finetuned-sst-2-english"
HF_API_URL = f"https://api-inference.huggingface.co/models/{HF_MODEL_ID}"

BATCH_SIZE = int(os.getenv("SENTIMENT_BATCH_SIZE", "16"))
MAX_TOKEN_LENGTH = 512
NEUTRAL_THRESHOLD = float(os.getenv("SENTIMENT_NEUTRAL_THRESHOLD", "0.65"))
HF_API_TIMEOUT = 30
HF_REQUEST_DELAY = 0.3

if BATCH_SIZE < 1:
    raise ValueError("SENTIMENT_BATCH_SIZE must be at least 1.")

if not 0.5 <= NEUTRAL_THRESHOLD <= 1.0:
    raise ValueError("SENTIMENT_NEUTRAL_THRESHOLD must be between 0.5 and 1.0.")


@dataclass(frozen=True)
class SentimentResult:
    text: str
    label: str
    confidence: float
    model: str


def _get_device() -> torch.device:
    if torch.cuda.is_available():
        return torch.device("cuda")

    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return torch.device("mps")

    return torch.device("cpu")


DEVICE = _get_device()
_tokenizer: Optional[PreTrainedTokenizerBase] = None  # noqa: UP045
_model: Optional[PreTrainedModel] = None  # noqa: UP045
_model_lock = threading.Lock()


def _load_local_model() -> tuple[PreTrainedTokenizerBase, PreTrainedModel]:
    """Load and cache the local tokenizer and model."""
    global _tokenizer, _model

    if _tokenizer is not None and _model is not None:
        return _tokenizer, _model

    with _model_lock:
        if _tokenizer is None:
            logger.info("Loading sentiment tokenizer (%s)", HF_MODEL_ID)
            _tokenizer = AutoTokenizer.from_pretrained(HF_MODEL_ID)

        if _model is None:
            logger.info("Loading sentiment model on %s", DEVICE)
            _model = AutoModelForSequenceClassification.from_pretrained(HF_MODEL_ID)
            _model.to(DEVICE)
            _model.eval()

    return _tokenizer, _model


def _calculate_neutral_confidence(score: float) -> float:
    """Estimate confidence for the derived Neutral class."""
    margin = NEUTRAL_THRESHOLD - 0.5
    if margin <= 0:
        return 0.0

    confidence = 1 - abs(score - 0.5) / margin
    confidence = max(0.0, min(confidence, 1.0))
    return round(confidence * 100, 2)


def _standardise_label(model_label: str, score: float) -> tuple[str, float]:
    """Convert the binary SST-2 result into the application's labels."""
    if score < NEUTRAL_THRESHOLD:
        return "Neutral", _calculate_neutral_confidence(score)

    confidence = round(score * 100, 2)
    label = model_label.upper()

    if label == "POSITIVE":
        return "Positive", confidence
    if label == "NEGATIVE":
        return "Negative", confidence

    return "Neutral", confidence


def _hf_classify_batch(texts: list[str]) -> list[dict[str, str | float]]:
    payload = json.dumps(
        {
            "inputs": texts,
            "options": {"wait_for_model": True},
        }
    ).encode("utf-8")

    request = urllib.request.Request(HF_API_URL, data=payload, method="POST")
    request.add_header("Authorization", f"Bearer {HF_API_TOKEN}")
    request.add_header("Content-Type", "application/json")

    with urllib.request.urlopen(request, timeout=HF_API_TIMEOUT) as response:
        data = json.loads(response.read().decode("utf-8"))

    if isinstance(data, dict) and data.get("error"):
        raise RuntimeError(f"Hugging Face API error: {data['error']}")

    if not isinstance(data, list):
        raise RuntimeError("Unexpected response received from Hugging Face API.")  # noqa: TRY004

    results: list[dict[str, str | float]] = []

    for item in data:
        if isinstance(item, list):
            if not item:
                raise RuntimeError("Hugging Face returned an empty prediction.")
            prediction = max(item, key=lambda value: float(value["score"]))
        elif isinstance(item, dict):
            prediction = item
        else:
            raise RuntimeError("Unexpected Hugging Face prediction format.")  # noqa: TRY004

        results.append(
            {
                "label": str(prediction["label"]),
                "score": float(prediction["score"]),
            }
        )

    if len(results) != len(texts):
        raise RuntimeError(
            "Hugging Face prediction count does not match the input count."
        )

    return results


def _classify_via_hf(texts: list[str]) -> list[SentimentResult]:
    results: list[SentimentResult] = []

    for start in range(0, len(texts), BATCH_SIZE):
        batch = texts[start : start + BATCH_SIZE]
        predictions = _hf_classify_batch(batch)

        for text, prediction in zip(batch, predictions):
            label, confidence = _standardise_label(
                str(prediction["label"]),
                float(prediction["score"]),
            )
            results.append(
                SentimentResult(
                    text=text,
                    label=label,
                    confidence=confidence,
                    model="distilbert-sst2-api",
                )
            )

        if start + BATCH_SIZE < len(texts):
            time.sleep(HF_REQUEST_DELAY)

    return results


def _pytorch_classify_batch(texts: list[str]) -> list[tuple[str, float]]:
    tokenizer, model = _load_local_model()

    inputs = tokenizer(
        texts,
        padding=True,
        truncation=True,
        max_length=MAX_TOKEN_LENGTH,
        return_tensors="pt",
    )
    inputs = {key: value.to(DEVICE) for key, value in inputs.items()}

    with torch.inference_mode():
        logits = model(**inputs).logits
        probabilities = torch.softmax(logits, dim=-1)
        scores, indices = torch.max(probabilities, dim=-1)

    predictions: list[tuple[str, float]] = []

    for index, score in zip(
        indices.detach().cpu().tolist(),
        scores.detach().cpu().tolist(),
    ):
        predictions.append((str(model.config.id2label[index]), float(score)))

    return predictions


def _classify_via_pytorch(texts: list[str]) -> list[SentimentResult]:
    results: list[SentimentResult] = []

    for start in range(0, len(texts), BATCH_SIZE):
        batch = texts[start : start + BATCH_SIZE]

        for text, (model_label, score) in zip(batch, _pytorch_classify_batch(batch)):
            label, confidence = _standardise_label(model_label, score)
            results.append(
                SentimentResult(
                    text=text,
                    label=label,
                    confidence=confidence,
                    model="distilbert-sst2-pytorch",
                )
            )

    return results


_POSITIVE_WORDS = {
    "well",
    "organised",
    "informative",
    "enjoyed",
    "comfortable",
    "useful",
    "smooth",
    "relevant",
    "helpful",
    "friendly",
    "clear",
    "excellent",
    "good",
    "great",
    "professional",
    "accessible",
    "quick",
    "fast",
    "interesting",
    "engaging",
    "insightful",
    "valuable",
    "fantastic",
    "amazing",
    "impressed",
    "satisfied",
    "happy",
    "pleased",
    "wonderful",
}

_NEGATIVE_WORDS = {
    "terrible",
    "poor",
    "delayed",
    "late",
    "bad",
    "worst",
    "disappointing",
    "slow",
    "confusing",
    "unclear",
    "boring",
    "irrelevant",
    "unhelpful",
    "disorganised",
    "crowded",
    "noisy",
    "frustrating",
    "annoying",
    "awful",
    "broken",
    "failed",
    "wrong",
    "difficult",
    "complicated",
}

_NEGATION_WORDS = {"not", "never", "no", "hardly", "barely", "neither"}


def _normalise_words(text: str) -> list[str]:
    # Remove punctuation so words such as "excellent!" still match.
    return re.findall(r"[a-zA-Z']+", text.lower())


def _lexicon_classify(text: str) -> tuple[str, float]:
    positive = 0
    negative = 0
    words = _normalise_words(text)

    for index, word in enumerate(words):
        recent_words = words[max(0, index - 3) : index]
        is_negated = any(item in _NEGATION_WORDS for item in recent_words)

        if word in _POSITIVE_WORDS:
            negative += 1 if is_negated else 0
            positive += 0 if is_negated else 1
        elif word in _NEGATIVE_WORDS:
            positive += 1 if is_negated else 0
            negative += 0 if is_negated else 1

    total = positive + negative
    if total == 0:
        return "Neutral", 55.0

    if positive > negative:
        return "Positive", round(min(60 + (positive / total) * 38, 98), 2)

    if negative > positive:
        return "Negative", round(min(60 + (negative / total) * 38, 98), 2)

    return "Neutral", 52.0


def _classify_via_lexicon(texts: list[str]) -> list[SentimentResult]:
    results: list[SentimentResult] = []

    for text in texts:
        label, confidence = _lexicon_classify(text)
        results.append(
            SentimentResult(
                text=text,
                label=label,
                confidence=confidence,
                model="lexicon-fallback",
            )
        )

    return results


def _classify_with_local_fallback(texts: list[str]) -> list[SentimentResult]:
    try:
        logger.info("Classifying sentiment locally on %s", DEVICE)
        return _classify_via_pytorch(texts)
    except (OSError, RuntimeError, ValueError) as error:
        logger.exception(
            "Local PyTorch inference failed; using lexicon fallback: %s",
            error,  # noqa: TRY401
        )
        return _classify_via_lexicon(texts)


def classify_sentiment(texts: list[str]) -> list[SentimentResult]:
    if not isinstance(texts, list):
        raise TypeError("texts must be provided as a list.")

    results: list[SentimentResult | None] = [None] * len(texts)
    valid_indices: list[int] = []
    valid_texts: list[str] = []

    for index, text in enumerate(texts):
        if not isinstance(text, str):
            results[index] = SentimentResult(
                text=str(text),
                label="Neutral",
                confidence=0.0,
                model="skipped",
            )
        elif not text.strip():
            results[index] = SentimentResult(
                text=text,
                label="Neutral",
                confidence=0.0,
                model="skipped",
            )
        else:
            valid_indices.append(index)
            valid_texts.append(text)

    if not valid_texts:
        return [result for result in results if result is not None]

    if HF_API_TOKEN:
        try:
            logger.info("Classifying sentiment through the Hugging Face API")
            classified = _classify_via_hf(valid_texts)
        except (
            urllib.error.URLError,
            urllib.error.HTTPError,
            TimeoutError,
            RuntimeError,
            json.JSONDecodeError,
        ) as error:
            logger.warning(
                "Hugging Face API failed; trying local inference: %s",
                error,
            )
            classified = _classify_with_local_fallback(valid_texts)
    else:
        logger.info("HF_API_TOKEN is not configured; using local inference")
        classified = _classify_with_local_fallback(valid_texts)

    if len(classified) != len(valid_indices):
        raise RuntimeError(
            "Sentiment result count does not match the valid input count."
        )

    for index, result in zip(valid_indices, classified):
        results[index] = result

    return [result for result in results if result is not None]


def get_sentiment_model_status() -> dict[str, str | bool | float]:
    return {
        "model": HF_MODEL_ID,
        "primaryMethod": "hugging-face-api" if HF_API_TOKEN else "local-pytorch",
        "apiTokenConfigured": bool(HF_API_TOKEN),
        "localModelLoaded": _model is not None,
        "pytorchAvailable": True,
        "device": str(DEVICE),
        "neutralThreshold": NEUTRAL_THRESHOLD,
        "batchSize": float(BATCH_SIZE),
    }
