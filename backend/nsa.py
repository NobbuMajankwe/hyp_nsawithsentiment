"""
nsa.py — Negative Selection Algorithm (NSA) for Feedback Anomaly Detection
===========================================================================
Part 1 of the Hybrid Sentiment Analysis + NSA Feedback Analysis System.

HOW THE ALGORITHM WORKS
------------------------
Biological inspiration:
  In the immune system, T-cells are trained to ignore "self" (normal body
  cells). Any cell that is NOT recognised as self triggers an immune response.
  NSA mimics this: we define "normal" feedback as the self-space, generate
  random detectors that cover the non-self space, then flag any feedback that
  matches a detector as anomalous.

Pipeline:
  1. Preprocess   → lowercase, strip punctuation, collapse whitespace
  2. Tokenise     → split on whitespace, remove stopwords
  3. Vectorise    → build a simple bag-of-words vocabulary; each text becomes
                    a fixed-length binary/frequency vector (no sklearn)
  4. Self space   → normal training samples define the self region
  5. Detectors    → random candidates rejected if they land inside self space
                    (distance < self_match_threshold)
  6. Detection    → each input vector is tested against all detectors;
                    if ANY detector matches (distance <= detector_radius) the
                    record is flagged as Suspicious
  7. Scoring      → anomaly score = max(0, 1 − closest_detector_distance),
                    scaled to 0–100 integer
"""

from __future__ import annotations

import math
import re
import string
from dataclasses import dataclass, field
from typing import List, Optional

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

STOP_WORDS: set[str] = {
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "was", "are", "were", "be", "been",
    "has", "have", "had", "do", "did", "does", "will", "would", "could",
    "should", "may", "might", "it", "its", "this", "that", "these", "those",
    "i", "we", "you", "he", "she", "they", "me", "us", "him", "her", "them",
    "my", "our", "your", "his", "their", "what", "which", "who", "whom",
    "not", "no", "so", "as", "if", "than", "then", "very", "just", "also",
}

# "Normal" feedback samples used to define the self space during training.
# These represent genuine, well-formed event feedback patterns.
NORMAL_FEEDBACK_CORPUS: list[str] = [
    "The event was well organised and the speakers were informative.",
    "I enjoyed the networking session and the venue was comfortable.",
    "The workshop was useful and the registration process was smooth.",
    "The event content was relevant and professionally delivered.",
    "The panel discussion was helpful and the staff were friendly.",
    "The session started on time and the information was clear.",
    "Really good presentations and well managed schedule.",
    "The keynote speaker was excellent and the venue was accessible.",
    "Registration was quick and the sessions were well structured.",
    "Enjoyed the interactive segments and the quality of the presenters.",
]


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class Detector:
    """
    A single NSA detector.

    Represents a point in feature-vector space that lies OUTSIDE the self
    region. Any input whose distance to this detector is <= radius triggers
    a match (anomaly signal).
    """
    detector_id: int
    vector: list[float]
    radius: float

    def matches(self, feature_vector: list[float]) -> Optional[float]:
        """
        Return the Euclidean distance if this detector matches the vector,
        otherwise return None.
        """
        dist = euclidean_distance(self.vector, feature_vector)
        return dist if dist <= self.radius else None


@dataclass
class NSAResult:
    """Per-record output returned to the API layer."""
    id: int
    original_text: str
    cleaned_text: str
    tokens: list[str]
    nsa_status: str          # "Valid" | "Suspicious"
    anomaly_score: int       # 0–100
    anomaly_reason: str


@dataclass
class NSAResponse:
    """Aggregate response returned by the analyse() entry point."""
    total_records: int
    valid_records: int
    suspicious_records: int
    results: list[NSAResult]


# ---------------------------------------------------------------------------
# Text utilities
# ---------------------------------------------------------------------------

def preprocess(text: str) -> str:
    """
    Lowercase, remove punctuation, collapse multiple whitespace into one.

    Example:
        "BUY NOW!! CLICK FREE$$$" → "buy now  click free"
    """
    text = text.lower()
    # Replace punctuation with space so "free!" → "free "
    text = text.translate(str.maketrans(string.punctuation, " " * len(string.punctuation)))
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


def tokenise(text: str) -> list[str]:
    """
    Split preprocessed text into tokens, remove stopwords, and filter
    tokens shorter than 2 characters.
    """
    cleaned = preprocess(text)
    tokens = [
        token for token in cleaned.split()
        if token not in STOP_WORDS and len(token) >= 2
    ]
    return tokens


# ---------------------------------------------------------------------------
# Vectorisation — pure Python bag-of-words (no sklearn)
# ---------------------------------------------------------------------------

def build_vocabulary(corpus: list[str]) -> list[str]:
    """
    Build a sorted vocabulary list from a list of raw text strings.
    Each unique token across the corpus becomes one dimension.
    """
    vocab: set[str] = set()
    for text in corpus:
        vocab.update(tokenise(text))
    return sorted(vocab)


def text_to_vector(text: str, vocabulary: list[str]) -> list[float]:
    """
    Convert text to a normalised term-frequency vector over the vocabulary.

    Steps:
      1. Tokenise the text.
      2. Count how often each vocabulary term appears (term frequency).
      3. L2-normalise so all vectors have unit length (enables meaningful
         cosine / Euclidean distance comparisons).

    If all counts are zero (out-of-vocabulary text), return a zero vector.
    """
    tokens = tokenise(text)
    token_count = len(tokens)

    # Raw count vector
    raw: list[float] = [float(tokens.count(term)) for term in vocabulary]

    # L2 normalisation
    norm = math.sqrt(sum(v * v for v in raw))
    if norm == 0:
        return raw  # zero vector — text has no known tokens (suspicious by design)

    return [v / norm for v in raw]


# ---------------------------------------------------------------------------
# Distance metric
# ---------------------------------------------------------------------------

def euclidean_distance(v1: list[float], v2: list[float]) -> float:
    """Standard Euclidean distance between two equal-length vectors."""
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(v1, v2)))


# ---------------------------------------------------------------------------
# Core NSA class
# ---------------------------------------------------------------------------

class NegativeSelectionAlgorithm:
    """
    Implements V-detector–style Negative Selection.

    Parameters
    ----------
    detector_count       : how many non-self detectors to generate
    detector_radius      : detection radius (r); a vector within this
                           distance of a detector is flagged
    self_match_threshold : minimum distance a candidate must have from ALL
                           self vectors to be accepted as a detector
    max_attempts         : cap on random candidates tried during generation
    random_seed          : reproducibility seed
    """

    def __init__(
        self,
        detector_count: int = 50,
        detector_radius: float = 0.55,
        self_match_threshold: float = 0.40,
        max_attempts: int = 5000,
        random_seed: int = 42,
    ) -> None:
        self.detector_count = detector_count
        self.detector_radius = detector_radius
        self.self_match_threshold = self_match_threshold
        self.max_attempts = max_attempts
        self.random_seed = random_seed

        self.vocabulary: list[str] = []
        self.self_vectors: list[list[float]] = []
        self.detectors: list[Detector] = []

        # Seed the PRNG once
        import random as _rnd
        self._rnd = _rnd.Random(random_seed)

    # ------------------------------------------------------------------
    # Training phase
    # ------------------------------------------------------------------

    def train(self, normal_corpus: list[str]) -> None:
        """
        Build vocabulary from the normal corpus, vectorise it, then
        generate detectors that avoid the self space.
        """
        # Step 1 — vocabulary from normal samples
        self.vocabulary = build_vocabulary(normal_corpus)

        # Step 2 — vectorise normal samples → self space
        self.self_vectors = [
            text_to_vector(text, self.vocabulary) for text in normal_corpus
        ]

        # Step 3 — generate detectors
        self._generate_detectors()

    def _generate_detectors(self) -> None:
        """
        Randomly sample candidate vectors in [0, 1]^d.
        Accept a candidate only if its minimum distance to every self vector
        exceeds self_match_threshold (i.e., it does NOT match self).

        This is the NSA "censoring" step.
        """
        dimensions = len(self.vocabulary)
        if dimensions == 0:
            return

        self.detectors = []
        attempts = 0

        while len(self.detectors) < self.detector_count and attempts < self.max_attempts:
            attempts += 1

            # Sample a random candidate in the unit hypercube
            candidate = [self._rnd.random() for _ in range(dimensions)]

            # Check candidate does not overlap with ANY self vector
            min_dist_to_self = min(
                euclidean_distance(candidate, sv) for sv in self.self_vectors
            )

            if min_dist_to_self > self.self_match_threshold:
                # Candidate is in non-self space → accept as detector
                self.detectors.append(
                    Detector(
                        detector_id=len(self.detectors) + 1,
                        vector=candidate,
                        radius=self.detector_radius,
                    )
                )

    # ------------------------------------------------------------------
    # Detection phase
    # ------------------------------------------------------------------

    def detect_one(self, text: str, record_id: int) -> NSAResult:
        """
        Run a single feedback string through the detection pipeline.

        Returns an NSAResult with status, score and reason.
        """
        cleaned = preprocess(text)
        tokens = tokenise(text)
        feature_vector = text_to_vector(text, self.vocabulary)

        # Check against all detectors; collect matching distances
        matched_distances: list[float] = []
        for detector in self.detectors:
            dist = detector.matches(feature_vector)
            if dist is not None:
                matched_distances.append(dist)

        if matched_distances:
            closest = min(matched_distances)
            # Score: closer to detector centre → higher anomaly score
            raw_score = max(0.0, 1.0 - closest)
            anomaly_score = round(raw_score * 100)
            return NSAResult(
                id=record_id,
                original_text=text,
                cleaned_text=cleaned,
                tokens=tokens,
                nsa_status="Suspicious",
                anomaly_score=anomaly_score,
                anomaly_reason="Matched NSA detector — pattern deviates from normal feedback",
            )

        # No detector matched → check for zero-vector (fully OOV text)
        if all(v == 0.0 for v in feature_vector):
            return NSAResult(
                id=record_id,
                original_text=text,
                cleaned_text=cleaned,
                tokens=tokens,
                nsa_status="Suspicious",
                anomaly_score=85,
                anomaly_reason="No known vocabulary tokens — likely gibberish or bot text",
            )

        return NSAResult(
            id=record_id,
            original_text=text,
            cleaned_text=cleaned,
            tokens=tokens,
            nsa_status="Valid",
            anomaly_score=0,
            anomaly_reason="No detector match",
        )

    def detect_batch(self, feedback_list: list[str]) -> NSAResponse:
        """
        Analyse a list of feedback strings and return an NSAResponse.
        """
        results: list[NSAResult] = [
            self.detect_one(text, idx + 1)
            for idx, text in enumerate(feedback_list)
        ]

        suspicious = sum(1 for r in results if r.nsa_status == "Suspicious")
        valid = len(results) - suspicious

        return NSAResponse(
            total_records=len(results),
            valid_records=valid,
            suspicious_records=suspicious,
            results=results,
        )


# ---------------------------------------------------------------------------
# Module-level singleton (trained once on import)
# ---------------------------------------------------------------------------

_nsa_instance: Optional[NegativeSelectionAlgorithm] = None


def get_nsa() -> NegativeSelectionAlgorithm:
    """
    Return a trained NSA singleton. Trains on first call using the built-in
    normal feedback corpus. Subsequent calls return the cached instance.
    """
    global _nsa_instance
    if _nsa_instance is None:
        _nsa_instance = NegativeSelectionAlgorithm(
            detector_count=60,
            detector_radius=0.55,
            self_match_threshold=0.40,
            max_attempts=5000,
            random_seed=42,
        )
        _nsa_instance.train(NORMAL_FEEDBACK_CORPUS)
    return _nsa_instance
