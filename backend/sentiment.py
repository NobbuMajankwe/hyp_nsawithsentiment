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


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

HF_API_TOKEN: str = os.getenv("HF_API_TOKEN", "")

HF_MODEL_ID: str = "distilbert-base-uncased-finetuned-sst-2-english"

HF_API_URL: str = f"https://api-inference.huggingface.co/models/{HF_MODEL_ID}"

# Maximum texts sent in one API or PyTorch batch.
BATCH_SIZE = int(os.getenv("SENTIMENT_BATCH_SIZE", "16"))

# Maximum number of model tokens.
MAX_TOKEN_LENGTH = 512

# Scores below this threshold are treated as Neutral.
NEUTRAL_THRESHOLD = float(os.getenv("SENTIMENT_NEUTRAL_THRESHOLD", "0.65"))

# Hugging Face API request timeout.
HF_API_TIMEOUT = 30

# Delay between API requests to reduce free-tier rate-limit problems.
HF_REQUEST_DELAY = 0.3


if BATCH_SIZE < 1:
    raise ValueError("SENTIMENT_BATCH_SIZE must be at least 1.")

if not 0.5 <= NEUTRAL_THRESHOLD <= 1.0:
    raise ValueError("SENTIMENT_NEUTRAL_THRESHOLD must be between 0.5 and 1.0.")


# ---------------------------------------------------------------------------
# Result model
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class SentimentResult:
    text: str
    label: str
    confidence: float
    model: str


# ---------------------------------------------------------------------------
# PyTorch device configuration
# ---------------------------------------------------------------------------


def _get_device() -> torch.device:
    """
    Select the best available device for local PyTorch inference.

    CUDA is selected for supported NVIDIA GPUs.
    MPS is selected for supported Apple Silicon devices.
    CPU is used as the fallback.
    """
    if torch.cuda.is_available():
        return torch.device("cuda")

    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return torch.device("mps")

    return torch.device("cpu")


DEVICE = _get_device()


# ---------------------------------------------------------------------------
# Local model storage and lazy loading
# ---------------------------------------------------------------------------

_tokenizer: Optional[PreTrainedTokenizerBase] = None
_model: Optional[PreTrainedModel] = None

_model_lock = threading.Lock()


def _load_local_model() -> tuple[
    PreTrainedTokenizerBase,
    PreTrainedModel,
]:
    """
    Load the DistilBERT tokenizer and model for local PyTorch inference.

    The resources are loaded only once and are reused for later requests.
    A lock prevents multiple simultaneous requests from loading the model
    more than once.
    """
    global _tokenizer, _model

    if _tokenizer is not None and _model is not None:
        return _tokenizer, _model

    with _model_lock:
        if _tokenizer is None:
            logger.info(
                "Loading local sentiment tokenizer: %s",
                HF_MODEL_ID,
            )

            _tokenizer = AutoTokenizer.from_pretrained(HF_MODEL_ID)

        if _model is None:
            logger.info(
                "Loading local sentiment model on device: %s",
                DEVICE,
            )

            _model = AutoModelForSequenceClassification.from_pretrained(HF_MODEL_ID)

            _model.to(DEVICE)
            _model.eval()

    return _tokenizer, _model


# ---------------------------------------------------------------------------
# Shared label conversion
# ---------------------------------------------------------------------------


def _sentiment_label_to_standard(
    model_label: str,
    score: float,
) -> tuple[str, float]:
    """
    Convert the binary SST-2 output to the application's label format.

    SST-2 predicts only POSITIVE and NEGATIVE. When the strongest class
    confidence is below NEUTRAL_THRESHOLD, the result is treated as
    Neutral according to the application's confidence rule.
    """
    normalized_label = model_label.upper()

    if score < NEUTRAL_THRESHOLD:
        neutral_confidence = _calculate_neutral_confidence(score)

        return "Neutral", neutral_confidence

    confidence = round(score * 100, 2)

    if normalized_label == "POSITIVE":
        return "Positive", confidence

    if normalized_label == "NEGATIVE":
        return "Negative", confidence

    return "Neutral", confidence


def _calculate_neutral_confidence(score: float) -> float:
    """
    Calculate a derived Neutral confidence.

    A binary confidence close to 0.5 represents uncertainty between
    Positive and Negative and is therefore treated as stronger evidence
    for the application's derived Neutral category.
    """
    uncertainty_range = NEUTRAL_THRESHOLD - 0.5

    if uncertainty_range <= 0:
        return 0.0

    distance_from_uncertainty = abs(score - 0.5)

    neutral_score = 1 - distance_from_uncertainty / uncertainty_range

    neutral_score = max(
        0.0,
        min(neutral_score, 1.0),
    )

    return round(neutral_score * 100, 2)


# ---------------------------------------------------------------------------
# Hugging Face Inference API
# ---------------------------------------------------------------------------


def _hf_classify_batch(
    texts: list[str],
) -> list[dict[str, str | float]]:
    """
    Send a batch of texts to the Hugging Face Inference API.

    Returns one dictionary for every input text:

        {
            "label": "POSITIVE" | "NEGATIVE",
            "score": float
        }
    """
    payload = json.dumps(
        {
            "inputs": texts,
            "options": {
                "wait_for_model": True,
            },
        }
    ).encode("utf-8")

    request = urllib.request.Request(
        HF_API_URL,
        data=payload,
        method="POST",
    )

    request.add_header(
        "Authorization",
        f"Bearer {HF_API_TOKEN}",
    )

    request.add_header(
        "Content-Type",
        "application/json",
    )

    with urllib.request.urlopen(
        request,
        timeout=HF_API_TIMEOUT,
    ) as response:
        raw_response = json.loads(response.read().decode("utf-8"))

    if isinstance(raw_response, dict):
        error_message = raw_response.get("error")

        if error_message:
            raise RuntimeError(f"Hugging Face API error: {error_message}")

    if not isinstance(raw_response, list):
        raise RuntimeError("Unexpected response received from Hugging Face API.")

    results: list[dict[str, str | float]] = []

    for item in raw_response:
        if isinstance(item, list):
            if not item:
                raise RuntimeError("Hugging Face returned an empty prediction.")

            best_prediction = max(
                item,
                key=lambda prediction: float(prediction["score"]),
            )

        elif isinstance(item, dict):
            best_prediction = item

        else:
            raise RuntimeError("Unexpected Hugging Face prediction format.")

        results.append(
            {
                "label": str(best_prediction["label"]),
                "score": float(best_prediction["score"]),
            }
        )

    if len(results) != len(texts):
        raise RuntimeError(
            "Hugging Face prediction count does not match " "the number of input texts."
        )

    return results


def _classify_via_hf(
    texts: list[str],
) -> list[SentimentResult]:
    """
    Classify texts through the Hugging Face Inference API.

    Texts are divided into batches to reduce request size and support
    the Hugging Face free-tier API.
    """
    all_results: list[SentimentResult] = []

    for start in range(0, len(texts), BATCH_SIZE):
        batch = texts[start : start + BATCH_SIZE]

        raw_predictions = _hf_classify_batch(batch)

        for text, prediction in zip(
            batch,
            raw_predictions,
        ):
            label, confidence = _sentiment_label_to_standard(
                model_label=str(prediction["label"]),
                score=float(prediction["score"]),
            )

            all_results.append(
                SentimentResult(
                    text=text,
                    label=label,
                    confidence=confidence,
                    model="distilbert-sst2-api",
                )
            )

        if start + BATCH_SIZE < len(texts):
            time.sleep(HF_REQUEST_DELAY)

    if len(all_results) != len(texts):
        raise RuntimeError(
            "API classification result count does not " "match the input count."
        )

    return all_results


# ---------------------------------------------------------------------------
# Local PyTorch DistilBERT classification
# ---------------------------------------------------------------------------


def _pytorch_classify_batch(
    texts: list[str],
) -> list[tuple[str, float]]:
    """
    Classify one batch locally using DistilBERT and PyTorch.

    Returns a list containing:

        [
            ("POSITIVE", 0.98),
            ("NEGATIVE", 0.91)
        ]
    """
    tokenizer, model = _load_local_model()

    encoded_inputs = tokenizer(
        texts,
        padding=True,
        truncation=True,
        max_length=MAX_TOKEN_LENGTH,
        return_tensors="pt",
    )

    encoded_inputs = {key: value.to(DEVICE) for key, value in encoded_inputs.items()}

    with torch.inference_mode():
        outputs = model(**encoded_inputs)

        probabilities = torch.softmax(
            outputs.logits,
            dim=-1,
        )

        confidence_scores, predicted_indices = torch.max(
            probabilities,
            dim=-1,
        )

    predictions: list[tuple[str, float]] = []

    predicted_index_values = predicted_indices.detach().cpu().tolist()

    confidence_values = confidence_scores.detach().cpu().tolist()

    for predicted_index, confidence_score in zip(
        predicted_index_values,
        confidence_values,
    ):
        model_label = model.config.id2label[predicted_index]

        predictions.append(
            (
                str(model_label),
                float(confidence_score),
            )
        )

    if len(predictions) != len(texts):
        raise RuntimeError(
            "PyTorch prediction count does not match " "the number of input texts."
        )

    return predictions


def _classify_via_pytorch(
    texts: list[str],
) -> list[SentimentResult]:
    """
    Classify texts locally using PyTorch and DistilBERT.
    """
    all_results: list[SentimentResult] = []

    for start in range(0, len(texts), BATCH_SIZE):
        batch = texts[start : start + BATCH_SIZE]

        predictions = _pytorch_classify_batch(batch)

        for text, prediction in zip(
            batch,
            predictions,
        ):
            model_label, model_score = prediction

            label, confidence = _sentiment_label_to_standard(
                model_label=model_label,
                score=model_score,
            )

            all_results.append(
                SentimentResult(
                    text=text,
                    label=label,
                    confidence=confidence,
                    model="distilbert-sst2-pytorch",
                )
            )

    if len(all_results) != len(texts):
        raise RuntimeError(
            "PyTorch classification result count does not " "match the input count."
        )

    return all_results


# ---------------------------------------------------------------------------
# Lexicon fallback
# ---------------------------------------------------------------------------

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

_NEGATION_WORDS = {
    "not",
    "never",
    "no",
    "hardly",
    "barely",
    "neither",
}


def _normalise_words(text: str) -> list[str]:
    """
    Convert text to lowercase alphabetic tokens.

    Punctuation surrounding words is removed so that values such as
    'excellent!' and 'terrible,' can still match the lexicon.
    """
    return re.findall(
        r"[a-zA-Z']+",
        text.lower(),
    )


def _lexicon_classify(
    text: str,
) -> tuple[str, float]:
    """
    Classify a text using a small sentiment lexicon.

    Backup if the Hugging Face API and local PyTorch
    inference are both unavailable.
    """
    words = _normalise_words(text)

    positive_score = 0
    negative_score = 0

    for index, word in enumerate(words):
        previous_words = words[max(0, index - 3) : index]

        is_negated = any(
            previous_word in _NEGATION_WORDS for previous_word in previous_words
        )

        if word in _POSITIVE_WORDS:
            if is_negated:
                negative_score += 1
            else:
                positive_score += 1

        elif word in _NEGATIVE_WORDS:
            if is_negated:
                positive_score += 1
            else:
                negative_score += 1

    total = positive_score + negative_score

    if total == 0:
        return "Neutral", 55.0

    if positive_score > negative_score:
        ratio = positive_score / total

        confidence = min(
            60 + ratio * 38,
            98,
        )

        return (
            "Positive",
            round(confidence, 2),
        )

    if negative_score > positive_score:
        ratio = negative_score / total

        confidence = min(
            60 + ratio * 38,
            98,
        )

        return (
            "Negative",
            round(confidence, 2),
        )

    return "Neutral", 52.0


def _classify_via_lexicon(
    texts: list[str],
) -> list[SentimentResult]:
    """
    Classify multiple texts through the lexicon fallback.
    """
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


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def classify_sentiment(
    texts: list[str],
) -> list[SentimentResult]:

    if not isinstance(texts, list):
        raise TypeError("texts must be provided as a list.")

    placeholders: list[Optional[SentimentResult]] = [None] * len(texts)

    non_empty_indices: list[int] = []
    non_empty_texts: list[str] = []

    for index, text in enumerate(texts):
        if not isinstance(text, str):
            placeholders[index] = SentimentResult(
                text=str(text),
                label="Neutral",
                confidence=0.0,
                model="skipped",
            )

            continue

        if not text.strip():
            placeholders[index] = SentimentResult(
                text=text,
                label="Neutral",
                confidence=0.0,
                model="skipped",
            )

            continue

        non_empty_indices.append(index)
        non_empty_texts.append(text)

    if not non_empty_texts:
        return [result for result in placeholders if result is not None]

    classified_results: list[SentimentResult]

    if HF_API_TOKEN:
        try:
            logger.info(
                "Classifying sentiment through " "the Hugging Face Inference API."
            )

            classified_results = _classify_via_hf(non_empty_texts)

        except (
            urllib.error.URLError,
            urllib.error.HTTPError,
            TimeoutError,
            RuntimeError,
            json.JSONDecodeError,
        ) as api_error:
            logger.warning(
                "Hugging Face API inference failed. "
                "Attempting local PyTorch inference. Error: %s",
                api_error,
            )

            classified_results = _classify_with_local_fallback(non_empty_texts)

    else:
        logger.info("HF_API_TOKEN is not configured. " "Using local PyTorch inference.")

        classified_results = _classify_with_local_fallback(non_empty_texts)

    if len(classified_results) != len(non_empty_indices):
        raise RuntimeError(
            "Sentiment classification result count does not "
            "match the number of valid inputs."
        )

    for index, result in zip(
        non_empty_indices,
        classified_results,
    ):
        placeholders[index] = result

    return [result for result in placeholders if result is not None]


def _classify_with_local_fallback(
    texts: list[str],
) -> list[SentimentResult]:
    """
    Attempt local PyTorch classification.
    """
    try:
        logger.info(
            "Classifying sentiment locally with " "PyTorch on device: %s",
            DEVICE,
        )

        return _classify_via_pytorch(texts)

    except (
        OSError,
        RuntimeError,
        ValueError,
    ) as pytorch_error:
        logger.exception(
            "Local PyTorch inference failed. " "Using lexicon fallback. Error: %s",
            pytorch_error,
        )

        return _classify_via_lexicon(texts)


def get_sentiment_model_status() -> dict[
    str,
    str | bool | float,
]:
    if HF_API_TOKEN:
        primary_method = "hugging-face-api"
    else:
        primary_method = "local-pytorch"

    return {
        "model": HF_MODEL_ID,
        "primaryMethod": primary_method,
        "apiTokenConfigured": bool(HF_API_TOKEN),
        "localModelLoaded": _model is not None,
        "pytorchAvailable": True,
        "device": str(DEVICE),
        "neutralThreshold": NEUTRAL_THRESHOLD,
        "batchSize": float(BATCH_SIZE),
    }
