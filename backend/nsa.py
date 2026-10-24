from __future__ import annotations

import hashlib

# import json
import math
import random as _rnd
import re
import string
import time
from dataclasses import dataclass

# from typing import Optional
import nltk
from database import get_cursor

# from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer

# from nltk.tokenize import word_tokenize
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.preprocessing import Normalizer


# Default NSA parameters


NSA_DEFAULT_DETECTOR_COUNT = 200
NSA_DEFAULT_DETECTOR_RADIUS = 0.20
NSA_DEFAULT_SELF_MATCH_THRESHOLD = 0.30
NSA_DEFAULT_MAX_ATTEMPTS = 10_000
NSA_DEFAULT_RANDOM_SEED = 42

lemmatizer = WordNetLemmatizer()


# Corpus helpers


def load_normal_corpus_from_db() -> list[str]:
    """
    Legacy fallback corpus.

    Once experiment_service.py is updated, the selected SELF_CORPUS will
    normally be loaded there and passed directly to get_nsa().
    """
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT dataset_id
            FROM datasets
            WHERE source_name = 'NORMAL_FEEDBACK_SAMPLES'
              AND source_type = 'JSON'
            ORDER BY loaded_at DESC
            LIMIT 1
            """
        )
        dataset = cur.fetchone()

        if not dataset:
            raise RuntimeError("Normal feedback corpus not found in database.")

        cur.execute(
            """
            SELECT raw_text
            FROM feedback_records
            WHERE dataset_id = %s
            ORDER BY feedback_id
            """,
            (dataset["dataset_id"],),
        )
        rows = cur.fetchall()

    corpus = [
        str(row["raw_text"]).strip()
        for row in rows
        if row["raw_text"] and str(row["raw_text"]).strip()
    ]

    if not corpus:
        raise RuntimeError("Normal feedback corpus contains no usable records.")

    return corpus


def corpus_hash(corpus: list[str]) -> str:
    canonical = "\n".join(
        sorted(text.strip() for text in corpus if text and text.strip())
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


# Text preprocessing


def load_stopwords_from_db() -> set[str]:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT dataset_id
            FROM datasets
            WHERE source_name = 'STOP_WORDS_SAMPLES'
              AND source_type = 'JSON'
            ORDER BY loaded_at DESC
            LIMIT 1
            """
        )
        dataset = cur.fetchone()

        if not dataset:
            return set()

        cur.execute(
            """
            SELECT raw_text
            FROM feedback_records
            WHERE dataset_id = %s
            """,
            (dataset["dataset_id"],),
        )
        rows = cur.fetchall()

    return {
        str(row["raw_text"]).strip().lower()
        for row in rows
        if row["raw_text"] and str(row["raw_text"]).strip()
    }


def preprocess(text: str) -> str:
    text = str(text).lower()
    text = text.translate(
        str.maketrans(string.punctuation, " " * len(string.punctuation))
    )
    return re.sub(r"\s+", " ", text).strip()


def lemmatise_token(token: str) -> str:
    try:
        token = lemmatizer.lemmatize(token, pos="v")
        token = lemmatizer.lemmatize(token, pos="n")
        return token
    except LookupError as exc:
        raise RuntimeError(
            "NLTK WordNet data is missing. Run:\n"
            "python -m nltk.downloader wordnet omw-1.4"
        ) from exc


def _tokenise_with_stopwords(text: str, stop_words: set[str]) -> list[str]:
    tokens: list[str] = []

    for token in preprocess(text).split():
        if not token.isalpha() or len(token) < 2:
            continue

        lemma = lemmatise_token(token)

        if lemma in stop_words:
            continue

        tokens.append(lemma)

    return tokens


def tokenise(text: str) -> list[str]:
    """
    Public convenience tokenizer.

    NSA instances cache their stop-word set, so they do not query the DB on
    every CountVectorizer tokenizer call.
    """
    return _tokenise_with_stopwords(text, load_stopwords_from_db())


# Vector / distance helpers


def cosine_distance(v1: list[float], v2: list[float]) -> float:
    if len(v1) != len(v2):
        raise ValueError("Vectors must have the same number of dimensions.")

    dot = sum(a * b for a, b in zip(v1, v2))
    dot = max(-1.0, min(1.0, dot))
    return 1.0 - dot


def normalise_vector(vector: list[float]) -> list[float]:
    magnitude = math.sqrt(sum(value * value for value in vector))

    if magnitude == 0.0:
        return vector

    return [value / magnitude for value in vector]


# Data classes


@dataclass
class Detector:
    detector_id: int
    vector: list[float]
    radius: float
    minimum_self_distance: float

    def distance_to(self, feature_vector: list[float]) -> float:
        return cosine_distance(self.vector, feature_vector)

    def matches(self, feature_vector: list[float]) -> float | None:
        distance = self.distance_to(feature_vector)
        return distance if distance <= self.radius else None


@dataclass
class NSAResult:
    id: int
    original_text: str
    cleaned_text: str
    tokens: list[str]
    classification: str
    anomaly_score: float
    nearest_self_distance: float | None
    nearest_detector_distance: float | None
    matched_detector_id: int | None
    detector_radius: float
    detector_margin: float | None
    vocabulary_coverage: float
    out_of_vocabulary_ratio: float
    classification_reason: str


@dataclass
class TrainingStatistics:
    requested_detectors: int
    generated_detectors: int
    generation_attempts: int
    detector_acceptance_rate: float
    vocabulary_size: int
    self_corpus_size: int
    training_time_ms: float
    corpus_hash: str


@dataclass
class NSAResponse:
    total_records: int
    self_records: int
    non_self_records: int
    oov_records: int
    results: list[NSAResult]
    training_statistics: TrainingStatistics


# Negative Selection Algorithm


class NegativeSelectionAlgorithm:
    def __init__(
        self,
        detector_count: int = NSA_DEFAULT_DETECTOR_COUNT,
        detector_radius: float = NSA_DEFAULT_DETECTOR_RADIUS,
        self_match_threshold: float = NSA_DEFAULT_SELF_MATCH_THRESHOLD,
        max_attempts: int = NSA_DEFAULT_MAX_ATTEMPTS,
        random_seed: int = NSA_DEFAULT_RANDOM_SEED,
    ) -> None:
        if detector_count <= 0:
            raise ValueError("detector_count must be greater than 0.")

        if not 0.0 < detector_radius <= 1.0:
            raise ValueError("detector_radius must be in the range (0, 1].")

        if not 0.0 < self_match_threshold <= 1.0:
            raise ValueError("self_match_threshold must be in the range (0, 1].")

        if self_match_threshold < detector_radius:
            raise ValueError(
                "self_match_threshold must be >= detector_radius so accepted "
                "detectors do not overlap known SELF examples."
            )

        if max_attempts <= 0:
            raise ValueError("max_attempts must be greater than 0.")

        self.detector_count = detector_count
        self.detector_radius = detector_radius
        self.self_match_threshold = self_match_threshold
        self.max_attempts = max_attempts
        self.random_seed = random_seed

        self.vocabulary: list[str] = []
        self.self_vectors: list[list[float]] = []
        self.self_feature_counts: list[int] = []
        self.detectors: list[Detector] = []
        self.training_statistics: TrainingStatistics | None = None

        # Each NSA instance owns its own preprocessing/vectorisation state.
        self.stop_words = load_stopwords_from_db()
        self.vectorizer = CountVectorizer(
            tokenizer=self._tokenise,
            lowercase=False,
            token_pattern=None,
        )
        self.normalizer = Normalizer(norm="l2")
        self._rnd = _rnd.Random(random_seed)

    # Tokenisation / vectorisation

    def _tokenise(self, text: str) -> list[str]:
        return _tokenise_with_stopwords(text, self.stop_words)

    def _build_vocabulary(self, corpus: list[str]) -> list[str]:
        self.vectorizer.fit(corpus)
        return self.vectorizer.get_feature_names_out().tolist()

    def _text_to_vector(self, text: str) -> list[float]:
        vector = self.vectorizer.transform([text])

        if vector.nnz == 0:
            return vector.toarray()[0].tolist()

        vector = self.normalizer.transform(vector)
        return vector.toarray()[0].tolist()

    # Training

    def train(self, normal_corpus: list[str]) -> None:
        started = time.perf_counter()

        corpus = [
            str(text).strip() for text in normal_corpus if text and str(text).strip()
        ]

        if not corpus:
            raise RuntimeError("SELF corpus contains no usable text.")

        # Reset for reproducibility if the same instance is trained again.
        self._rnd = _rnd.Random(self.random_seed)

        self.vocabulary = self._build_vocabulary(corpus)

        if not self.vocabulary:
            raise RuntimeError("SELF corpus produced an empty vocabulary.")

        usable_texts: list[str] = []
        usable_vectors: list[list[float]] = []

        for text in corpus:
            vector = self._text_to_vector(text)
            non_zero_count = sum(value > 0.0 for value in vector)

            if non_zero_count == 0:
                continue

            usable_texts.append(text)
            usable_vectors.append(vector)

        if not usable_vectors:
            raise RuntimeError("SELF corpus produced no usable feature vectors.")

        self.self_vectors = usable_vectors
        self.self_feature_counts = [
            sum(value > 0.0 for value in vector) for vector in self.self_vectors
        ]

        attempts = self._generate_detectors()
        generated = len(self.detectors)

        if generated == 0:
            raise RuntimeError(
                "NSA generated zero detectors. Increase max_attempts or review "
                "self_match_threshold and detector_radius."
            )

        elapsed_ms = (time.perf_counter() - started) * 1000
        acceptance_rate = generated / attempts if attempts else 0.0

        self.training_statistics = TrainingStatistics(
            requested_detectors=self.detector_count,
            generated_detectors=generated,
            generation_attempts=attempts,
            detector_acceptance_rate=round(acceptance_rate, 6),
            vocabulary_size=len(self.vocabulary),
            self_corpus_size=len(usable_texts),
            training_time_ms=round(elapsed_ms, 3),
            corpus_hash=corpus_hash(usable_texts),
        )

    # Detector generation

    def _generate_candidate(self) -> list[float]:
        """
        Generate a SPARSE detector candidate.
        """
        dimensions = len(self.vocabulary)

        if dimensions == 0:
            raise RuntimeError("Cannot generate detectors without a vocabulary.")

        if not self.self_feature_counts:
            raise RuntimeError("Cannot generate detectors before SELF vectors exist.")

        active_features = self._rnd.choice(self.self_feature_counts)

        # Avoid degenerate one-feature detectors when possible.
        if dimensions >= 2:
            active_features = max(2, active_features)
        else:
            active_features = 1

        active_features = min(active_features, dimensions)

        selected_indices = self._rnd.sample(
            range(dimensions),
            active_features,
        )

        candidate = [0.0] * dimensions

        for index in selected_indices:
            candidate[index] = self._rnd.random()

        return normalise_vector(candidate)

    def _generate_detectors(self) -> int:
        self.detectors = []
        attempts = 0

        while (
            len(self.detectors) < self.detector_count and attempts < self.max_attempts
        ):
            attempts += 1
            candidate = self._generate_candidate()

            minimum_self_distance = min(
                cosine_distance(candidate, self_vector)
                for self_vector in self.self_vectors
            )

            # Negative selection: reject candidates that match SELF.
            if minimum_self_distance <= self.self_match_threshold:
                continue

            self.detectors.append(
                Detector(
                    detector_id=len(self.detectors) + 1,
                    vector=candidate,
                    radius=self.detector_radius,
                    minimum_self_distance=minimum_self_distance,
                )
            )

        return attempts

    # Vocabulary statistics

    def _vocabulary_statistics(self, text: str) -> tuple[float, float]:
        # Use the exact same tokenizer as CountVectorizer.
        tokens = self._tokenise(text)

        if not tokens:
            return 0.0, 1.0

        vocabulary_set = set(self.vocabulary)
        recognised = sum(token in vocabulary_set for token in tokens)
        coverage = recognised / len(tokens)

        return round(coverage, 4), round(1.0 - coverage, 4)

    # Detection

    def detect_one(self, text: str, record_id: int) -> NSAResult:
        if self.training_statistics is None:
            raise RuntimeError("NSA must be trained before detection.")

        if not self.detectors:
            raise RuntimeError("NSA has no generated detectors.")

        cleaned = preprocess(text)
        tokens = self._tokenise(text)
        feature_vector = self._text_to_vector(text)

        vocabulary_coverage, oov_ratio = self._vocabulary_statistics(text)

        # OOV is kept separate from SELF and NON_SELF.
        if all(value == 0.0 for value in feature_vector):
            return NSAResult(
                id=record_id,
                original_text=text,
                cleaned_text=cleaned,
                tokens=tokens,
                classification="OOV",
                anomaly_score=0.0,
                nearest_self_distance=None,
                nearest_detector_distance=None,
                matched_detector_id=None,
                detector_radius=self.detector_radius,
                detector_margin=None,
                vocabulary_coverage=vocabulary_coverage,
                out_of_vocabulary_ratio=oov_ratio,
                classification_reason=(
                    "No recognised tokens exist in the SELF vocabulary."
                ),
            )

        nearest_self_distance = min(
            cosine_distance(feature_vector, self_vector)
            for self_vector in self.self_vectors
        )

        nearest_detector = min(
            self.detectors,
            key=lambda detector: detector.distance_to(feature_vector),
        )
        nearest_detector_distance = nearest_detector.distance_to(feature_vector)

        detector_margin = self.detector_radius - nearest_detector_distance
        detector_matched = nearest_detector_distance <= self.detector_radius

        if detector_matched:
            detector_ratio = nearest_detector_distance / self.detector_radius
            anomaly_score = max(
                0.0,
                min(1.0, 1.0 - detector_ratio),
            )

            return NSAResult(
                id=record_id,
                original_text=text,
                cleaned_text=cleaned,
                tokens=tokens,
                classification="NON_SELF",
                anomaly_score=round(anomaly_score, 4),
                nearest_self_distance=round(nearest_self_distance, 6),
                nearest_detector_distance=round(
                    nearest_detector_distance,
                    6,
                ),
                matched_detector_id=nearest_detector.detector_id,
                detector_radius=self.detector_radius,
                detector_margin=round(detector_margin, 6),
                vocabulary_coverage=vocabulary_coverage,
                out_of_vocabulary_ratio=oov_ratio,
                classification_reason=(
                    "Input fell within the matching radius of an NSA detector."
                ),
            )

        return NSAResult(
            id=record_id,
            original_text=text,
            cleaned_text=cleaned,
            tokens=tokens,
            classification="SELF",
            anomaly_score=0.0,
            nearest_self_distance=round(nearest_self_distance, 6),
            nearest_detector_distance=round(
                nearest_detector_distance,
                6,
            ),
            matched_detector_id=None,
            detector_radius=self.detector_radius,
            detector_margin=round(detector_margin, 6),
            vocabulary_coverage=vocabulary_coverage,
            out_of_vocabulary_ratio=oov_ratio,
            classification_reason=("Input did not match any generated NSA detector."),
        )

    def detect_batch(self, feedback_list: list[str]) -> NSAResponse:
        if self.training_statistics is None:
            raise RuntimeError("NSA must be trained before running detection.")

        results = [
            self.detect_one(text, index + 1) for index, text in enumerate(feedback_list)
        ]

        return NSAResponse(
            total_records=len(results),
            self_records=sum(result.classification == "SELF" for result in results),
            non_self_records=sum(
                result.classification == "NON_SELF" for result in results
            ),
            oov_records=sum(result.classification == "OOV" for result in results),
            results=results,
            training_statistics=self.training_statistics,
        )


# Model cache


_nsa_cache: dict[tuple, NegativeSelectionAlgorithm] = {}


def get_nsa(
    detector_count: int = NSA_DEFAULT_DETECTOR_COUNT,
    detector_radius: float = NSA_DEFAULT_DETECTOR_RADIUS,
    self_match_threshold: float = NSA_DEFAULT_SELF_MATCH_THRESHOLD,
    max_attempts: int = NSA_DEFAULT_MAX_ATTEMPTS,
    random_seed: int = NSA_DEFAULT_RANDOM_SEED,
    corpus: list[str] | None = None,
) -> NegativeSelectionAlgorithm:
    """
    Return a trained NSA instance.

    The selected SELF_CORPUS should normally be passed in through `corpus`.
    The database fallback is temporary compatibility until experiment_service
    is updated in the next step.
    """
    normal_corpus = corpus if corpus is not None else load_normal_corpus_from_db()

    if not normal_corpus:
        raise RuntimeError("Cannot train NSA with an empty SELF corpus.")

    training_corpus_hash = corpus_hash(normal_corpus)

    cache_key = (
        training_corpus_hash,
        detector_count,
        round(detector_radius, 6),
        round(self_match_threshold, 6),
        max_attempts,
        random_seed,
    )

    if cache_key not in _nsa_cache:
        nsa = NegativeSelectionAlgorithm(
            detector_count=detector_count,
            detector_radius=detector_radius,
            self_match_threshold=self_match_threshold,
            max_attempts=max_attempts,
            random_seed=random_seed,
        )
        nsa.train(normal_corpus)
        _nsa_cache[cache_key] = nsa

    return _nsa_cache[cache_key]
