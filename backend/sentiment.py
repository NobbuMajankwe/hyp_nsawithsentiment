"""
sentiment.py — HuggingFace Inference API sentiment classifier
=============================================================
Uses the free HuggingFace Inference API with DistilBERT fine-tuned
on SST-2 (distilbert-base-uncased-finetuned-sst-2-english).

Required environment variable:
    HF_API_TOKEN  — your HuggingFace API token (free account is fine)

If HF_API_TOKEN is not set, a simple lexicon-based fallback runs
locally so the endpoint still works during development.

Response for each text:
    {
        "label": "Positive" | "Negative" | "Neutral",
        "confidence": 0.0–100.0,   # percentage, 2 dp
        "model": "distilbert-sst2" | "lexicon-fallback"
    }
"""

from __future__ import annotations

import os
import json
import urllib.request
import urllib.error
import time
from dataclasses import dataclass
from typing import Optional

HF_API_TOKEN: str = os.getenv("HF_API_TOKEN", "")
HF_MODEL_ID: str = "distilbert-base-uncased-finetuned-sst-2-english"
HF_API_URL: str = f"https://api-inference.huggingface.co/models/{HF_MODEL_ID}"

# Maximum texts per HuggingFace batch request
_HF_BATCH_SIZE = 16


@dataclass
class SentimentResult:
    text: str
    label: str  # "Positive" | "Negative" | "Neutral"
    confidence: float  # 0–100
    model: str


# ---------------------------------------------------------------------------
# HuggingFace Inference API
# ---------------------------------------------------------------------------


def _hf_classify_batch(texts: list[str]) -> list[dict]:
    """
    Call HuggingFace Inference API for a batch of texts.
    Returns a list of {"label": ..., "score": ...} dicts.
    """
    payload = json.dumps(
        {"inputs": texts, "options": {"wait_for_model": True}}
    ).encode()
    req = urllib.request.Request(HF_API_URL, data=payload, method="POST")
    req.add_header("Authorization", f"Bearer {HF_API_TOKEN}")
    req.add_header("Content-Type", "application/json")

    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = json.loads(resp.read().decode())

    # HuggingFace returns a list of lists: [[{label, score}, ...], ...]
    # Each inner list has one entry per class; pick the highest score.
    results = []
    for item in raw:
        if isinstance(item, list):
            best = max(item, key=lambda x: x["score"])
        else:
            best = item
        results.append(best)
    return results


def _hf_label_to_standard(hf_label: str, score: float) -> tuple[str, float]:
    """
    Map HuggingFace SST-2 labels (POSITIVE / NEGATIVE) to our three-class scheme.
    Scores close to 0.5 on either side are treated as Neutral.
    """
    hf_label = hf_label.upper()
    if hf_label == "POSITIVE":
        if score >= 0.65:
            return "Positive", round(score * 100, 2)
        return "Neutral", round((1 - abs(score - 0.5) * 2) * 100, 2)
    elif hf_label == "NEGATIVE":
        if score >= 0.65:
            return "Negative", round(score * 100, 2)
        return "Neutral", round((1 - abs(score - 0.5) * 2) * 100, 2)
    return "Neutral", round(score * 100, 2)


# ---------------------------------------------------------------------------
# Lexicon fallback (no API key needed)
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


def _lexicon_classify(text: str) -> tuple[str, float]:
    words = set(text.lower().split())
    pos = len(words & _POSITIVE_WORDS)
    neg = len(words & _NEGATIVE_WORDS)
    total = pos + neg
    if total == 0:
        return "Neutral", 55.0
    if pos > neg:
        return "Positive", round(60 + min(pos / total * 40, 38), 2)
    if neg > pos:
        return "Negative", round(60 + min(neg / total * 40, 38), 2)
    return "Neutral", 52.0


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def classify_sentiment(texts: list[str]) -> list[SentimentResult]:
    """
    Classify a list of texts.  Uses HuggingFace Inference API when
    HF_API_TOKEN is set, otherwise falls back to the lexicon classifier.

    Only accepts non-empty strings; empty strings get label Neutral / 0%.
    """
    results: list[SentimentResult] = []

    # Separate empty texts (skip the API for them)
    non_empty_indices = [i for i, t in enumerate(texts) if t.strip()]
    non_empty_texts = [texts[i] for i in non_empty_indices]

    # Placeholder results for all texts
    placeholders: list[Optional[SentimentResult]] = [None] * len(texts)

    # Mark empty texts
    for i, t in enumerate(texts):
        if not t.strip():
            placeholders[i] = SentimentResult(
                text=t, label="Neutral", confidence=0.0, model="skipped"
            )

    if non_empty_texts:
        if HF_API_TOKEN:
            try:
                classified = _classify_via_hf(non_empty_texts)
                for idx, res in zip(non_empty_indices, classified):
                    placeholders[idx] = res
            except Exception as exc:
                print(
                    f"[sentiment] HuggingFace API error, using lexicon fallback: {exc}"
                )
                for idx, text in zip(non_empty_indices, non_empty_texts):
                    label, conf = _lexicon_classify(text)
                    placeholders[idx] = SentimentResult(
                        text=text,
                        label=label,
                        confidence=conf,
                        model="lexicon-fallback",
                    )
        else:
            print("[sentiment] HF_API_TOKEN not set — using lexicon fallback")
            for idx, text in zip(non_empty_indices, non_empty_texts):
                label, conf = _lexicon_classify(text)
                placeholders[idx] = SentimentResult(
                    text=text, label=label, confidence=conf, model="lexicon-fallback"
                )

    return [r for r in placeholders if r is not None]


def _classify_via_hf(texts: list[str]) -> list[SentimentResult]:
    """Batch classify via HuggingFace, respecting batch size limits."""
    all_results: list[SentimentResult] = []

    for start in range(0, len(texts), _HF_BATCH_SIZE):
        batch = texts[start : start + _HF_BATCH_SIZE]
        raw = _hf_classify_batch(batch)

        for text, item in zip(batch, raw):
            label, conf = _hf_label_to_standard(item["label"], item["score"])
            all_results.append(
                SentimentResult(
                    text=text, label=label, confidence=conf, model="distilbert-sst2"
                )
            )

        # Respect HuggingFace rate limits for free tier
        if start + _HF_BATCH_SIZE < len(texts):
            time.sleep(0.3)

    return all_results
