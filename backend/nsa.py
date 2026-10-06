from __future__ import annotations

import hashlib

#import json
import math
import random as _rnd
import re
import string
import time
from dataclasses import dataclass

#from typing import Optional
import nltk
from database import get_cursor

# from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer

#from nltk.tokenize import word_tokenize
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.preprocessing import Normalizer

# Preset NSA parameters
NSA_DEFAULT_DETECTOR_COUNT = 200
NSA_DEFAULT_DETECTOR_RADIUS = 0.40
NSA_DEFAULT_SELF_MATCH_THRESHOLD = 0.75
NSA_DEFAULT_MAX_ATTEMPTS = 10_000
NSA_DEFAULT_RANDOM_SEED = 42


# Run once
nltk.download("punkt")
nltk.download("stopwords")
# added stemming
lemmatizer = WordNetLemmatizer()


# Helper function to load normal corpus from database
def load_normal_corpus_from_db() -> list[str]:
    """
    Load the SELF / normal feedback corpus used to define self-space.
    """

    with get_cursor() as cur:
        cur.execute(
            """
            SELECT dataset_id
            FROM datasets
            WHERE source_name = 'NORMAL_FEEDBACK_SAMPLES'
            AND source_type = 'JSON'
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

        records = cur.fetchall()

    if not records:
        raise RuntimeError("Normal feedback corpus contains no records.")

    return [row["raw_text"] for row in records]


def corpus_hash(corpus: list[str]) -> str:
    """
    Create a reproducible fingerprint of the training corpus.
    """

    canonical = "\n".join(sorted(text.strip() for text in corpus if text.strip()))

    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()  


# Text utilities
def load_stopwords_from_db() -> set[str]:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT dataset_id
            FROM datasets
            WHERE source_name = 'STOP_WORDS_SAMPLES'
            AND source_type = 'JSON'
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

    return {row["raw_text"].strip().lower() for row in rows}


def preprocess(text: str) -> str:
    """
    Lowercase, remove punctuation, collapse multiple whitespace into one.
    """
    text = text.lower()
    # Replace punctuation with space
    text = text.translate(
        str.maketrans(string.punctuation, " " * len(string.punctuation))
    )
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


def lemmatise_token(token: str) -> str:
    """
    Normalise word forms.

    """

    try:
        # First treat as verb:
        token = lemmatizer.lemmatize(token, pos="v")

        # Then noun:
        token = lemmatizer.lemmatize(token, pos="n")

        return token

    except LookupError as exc:
        raise RuntimeError(
            "NLTK WordNet data is missing. Run:\n"
            "python -m nltk.downloader wordnet omw-1.4"
        ) from exc


def tokenise(text: str) -> list[str]:

    stop_words = load_stopwords_from_db()

    tokens: list[str] = []

    for token in preprocess(text).split():
        if not token.isalpha():
            continue

        if len(token) < 2:
            continue

        lemma = lemmatise_token(token)

        if lemma in stop_words:
            continue

        tokens.append(lemma)

    return tokens


# using nltk
# def tokenise(text: str) -> list[str]:
#     cleaned = preprocess(text)
#     stop_words = load_stopawords_from_db()
#         #""" and token.lower() not in STOP_WORDS """

#     return [
#         token.lower()
#         for token in word_tokenize(cleaned)
#         if token.isalpha()
#         and token.lower() not in stop_words
#         and len(token) >= 2
#     ]


# Vectorisation — pure Python bag-of-words (no sklearn)
vectorizer = CountVectorizer(tokenizer=tokenise, lowercase=False, token_pattern=None)
normalizer = Normalizer(norm="l2")


def build_vocabulary(corpus: list[str]) -> list[str]:
    """
    Fits the CountVectorizer to the corpus and return the sorted vocabulary.
    """
    vectorizer.fit(corpus)
    return vectorizer.get_feature_names_out().tolist()


def text_to_vector(text: str, vocabulary: list[str] | None = None) -> list[float]:
    vector = vectorizer.transform([text])

    if vector.nnz == 0:
        # Out-of-vocabulary text -> zero vector
        return vector.toarray()[0].tolist()

    vector = normalizer.transform(vector)
    return vector.toarray()[0].tolist()


# Distance metric
def euclidean_distance(v1: list[float], v2: list[float]) -> float:
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(v1, v2)))


def normalise_vector(vector: list[float]) -> list[float]:

    magnitude = math.sqrt(sum(value * value for value in vector))

    if magnitude == 0:
        return vector

    return [value / magnitude for value in vector]


# Data classes
@dataclass
class Detector:
    

    detector_id: int
    vector: list[float]
    radius: float
    minimum_self_distance: float

    def distance_to(
        self,
        feature_vector: list[float],
    ) -> float:

        return euclidean_distance(
            self.vector,
            feature_vector,
        )

    def matches(self, feature_vector: list[float]) -> float | None:
       
        dist = euclidean_distance(self.vector, feature_vector)
        return dist if dist <= self.radius else None


@dataclass
class NSAResult:

    """ 
    nsa_status: str  # "Valid" | "Suspicious"
    anomaly_score: int  # 0–100
    anomaly_reason: str """
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
    """Aggregate response returned by the analyse() entry point."""

    total_records: int
    self_records: int
    non_self_records: int
    oov_records: int
    results: list[NSAResult]
    training_statistics: TrainingStatistics


# Core NSA class


class NegativeSelectionAlgorithm:
    def __init__(
        self,
        detector_count: int = NSA_DEFAULT_DETECTOR_COUNT,
        detector_radius: float = NSA_DEFAULT_DETECTOR_RADIUS,
        self_match_threshold: float = NSA_DEFAULT_SELF_MATCH_THRESHOLD,
        max_attempts: int = NSA_DEFAULT_MAX_ATTEMPTS,
        random_seed: int = NSA_DEFAULT_RANDOM_SEED,
    ) -> None:
        self.detector_count = detector_count
        self.detector_radius = detector_radius
        self.self_match_threshold = self_match_threshold
        self.max_attempts = max_attempts
        self.random_seed = random_seed

        self.vocabulary: list[str] = []
        self.self_vectors: list[list[float]] = []
        self.detectors: list[Detector] = []

        self._rnd = _rnd.Random(random_seed)

    # Training phase

    def train(self, normal_corpus: list[str]) -> None:
        started = time.perf_counter()  # noqa: F821

        # vocabulary from normal samples
        self.vocabulary = build_vocabulary(normal_corpus)

        # vectorise normal samples -> self space
        self.self_vectors = [text_to_vector(text) for text in normal_corpus]

        # generate detectors
        attempts = self._generate_detectors()

        elapsed_ms = (time.perf_counter() - started) * 1000  # noqa: F821

        generated = len(self.detectors)

        acceptance_rate = generated / attempts if attempts > 0 else 0.0

        self.training_statistics = TrainingStatistics(
            requested_detectors=self.detector_count,
            generated_detectors=generated,
            generation_attempts=attempts,
            detector_acceptance_rate=round(
                acceptance_rate,
                6,
            ),
            vocabulary_size=len(self.vocabulary),
            self_corpus_size=len(normal_corpus),
            training_time_ms=round(
                elapsed_ms,
                3,
            ),
            corpus_hash=corpus_hash(normal_corpus),
        )

    def _generate_candidate(
        self,
    ) -> list[float]:

        candidate = [self._rnd.random() for _ in range(len(self.vocabulary))]

        return normalise_vector(candidate)

    def _generate_detectors(self) -> None:
        
        """ dimensions = len(self.vocabulary)
        if dimensions == 0:
            return """

        self.detectors = []
        attempts = 0

        while (
            len(self.detectors) < self.detector_count and attempts < self.max_attempts
        ):
            attempts += 1

            # candidate = self._random_unit_vector(dimensions)
            candidate = self._generate_candidate()

            # Check candidate does not overlap with ANY self vector
            minimum_self_distance = min(
                euclidean_distance(
                    candidate,
                    self_vector,
                )
                for self_vector in self.self_vectors
            )

            if minimum_self_distance <= self.self_match_threshold:
                continue

            detector = Detector(
                detector_id=(len(self.detectors) + 1),
                vector=candidate,
                radius=self.detector_radius,
                minimum_self_distance=(minimum_self_distance),
            )

            self.detectors.append(detector)

        return attempts

    # Vocabulary analysis
    def _vocabulary_statistics(
        self,
        text: str,
    ) -> tuple[float, float]:

        raw_tokens = [
            lemmatise_token(token)
            for token in preprocess(text).split()
            if token.isalpha() and len(token) >= 2
        ]

        if not raw_tokens:
            return 0.0, 1.0

        vocabulary_set = set(self.vocabulary)

        recognised = sum(1 for token in raw_tokens if token in vocabulary_set)

        coverage = recognised / len(raw_tokens)

        return (
            round(coverage, 4),
            round(1 - coverage, 4),
        )

    # Detection phase

    def detect_one(self, text: str, record_id: int) -> NSAResult:
        cleaned = preprocess(text)
        tokens = tokenise(text)
        feature_vector = text_to_vector(text)

        (
            vocabulary_coverage,
            oov_ratio,
        ) = self._vocabulary_statistics(text)

        # Handle empty/OOV text before checking detectors
        if all(value == 0.0 for value in feature_vector):
            return NSAResult(
                id=record_id,
                original_text=text,
                cleaned_text=cleaned,
                tokens=tokens,
                classification="OOV",
                anomaly_score=1.0,
                nearest_self_distance=None,
                nearest_detector_distance=None,
                matched_detector_id=None,
                detector_radius=(self.detector_radius),
                detector_margin=None,
                vocabulary_coverage=(vocabulary_coverage),
                out_of_vocabulary_ratio=(oov_ratio),
                classification_reason=(
                    "No recognised tokens exist " "in the SELF vocabulary."
                ),
            )

        # Distance to the closest normal/self example
        nearest_self_distance = min(
            euclidean_distance(feature_vector, self_vector)
            for self_vector in self.self_vectors
        )

        # Detector distances
        """ detector_distances = [
            euclidean_distance(feature_vector, detector.vector)
            for detector in self.detectors
        ] """

        nearest_detector = min(
            self.detectors,
            key=lambda detector: detector.distance_to(feature_vector),
        )

        nearest_detector_distance = nearest_detector.distance_to(feature_vector)

        detector_margin = self.detector_radius - nearest_detector_distance

        # A detector matches when the input falls within its radius
        detector_matched = nearest_detector_distance <= self.detector_radius

        if detector_matched:
            detector_ratio = nearest_detector_distance / self.detector_radius

            anomaly_score = max(
                0.0,
                min(
                    1.0,
                    1.0 - detector_ratio,
                ),
            )

            return NSAResult(
                id=record_id,
                original_text=text,
                cleaned_text=cleaned,
                tokens=tokens,
                classification="NON_SELF",
                anomaly_score=round(
                    anomaly_score,
                    4,
                ),
                nearest_self_distance=round(
                    nearest_self_distance,
                    6,
                ),
                nearest_detector_distance=round(
                    nearest_detector_distance,
                    6,
                ),
                matched_detector_id=(nearest_detector.detector_id),
                detector_radius=(self.detector_radius),
                detector_margin=round(
                    detector_margin,
                    6,
                ),
                vocabulary_coverage=(vocabulary_coverage),
                out_of_vocabulary_ratio=(oov_ratio),
                classification_reason=(
                    "Input fell within the " "matching radius of an " "NSA detector."
                ),
            )

        # Variable score for valid feedback based on distance from self-space

        return NSAResult(
            id=record_id,
            original_text=text,
            cleaned_text=cleaned,
            tokens=tokens,
            classification="SELF",
            anomaly_score=0.0,
            nearest_self_distance=round(
                nearest_self_distance,
                6,
            ),
            nearest_detector_distance=round(
                nearest_detector_distance,
                6,
            ),
            matched_detector_id=None,
            detector_radius=(self.detector_radius),
            detector_margin=round(
                detector_margin,
                6,
            ),
            vocabulary_coverage=(vocabulary_coverage),
            out_of_vocabulary_ratio=(oov_ratio),
            classification_reason=(
                "Input did not match any " "generated NSA detector."
            ),
        )

    def detect_batch(self, feedback_list: list[str]) -> NSAResponse:

        results = [
            self.detect_one(
                text,
                index + 1,
            )
            for index, text in enumerate(feedback_list)
        ]

        self_count = sum(result.classification == "SELF" for result in results)

        non_self_count = sum(result.classification == "NON_SELF" for result in results)

        oov_count = sum(result.classification == "OOV" for result in results)

        if self.training_statistics is None:
            raise RuntimeError("NSA must be trained before " "running detection.")

        return NSAResponse(
            total_records=len(results),
            self_records=self_count,
            non_self_records=(non_self_count),
            oov_records=oov_count,
            results=results,
            training_statistics=(self.training_statistics),
        )


# Cache: (detector_count, detector_radius, self_match_threshold) -> instance
_nsa_cache: dict[tuple, NegativeSelectionAlgorithm] = {}


def get_nsa(
    detector_count: int = NSA_DEFAULT_DETECTOR_COUNT,
    detector_radius: float = NSA_DEFAULT_DETECTOR_RADIUS,
    self_match_threshold: float = NSA_DEFAULT_SELF_MATCH_THRESHOLD,
    max_attempts: int = NSA_DEFAULT_MAX_ATTEMPTS,
    random_seed: int = NSA_DEFAULT_RANDOM_SEED,
) -> NegativeSelectionAlgorithm:
    """
    Return a trained NSA instance for the given parameters.
    Instances are cached by (detector_count, detector_radius, self_match_threshold)
    so a re-train is only triggered when the config actually changes.
    """
    normal_corpus = load_normal_corpus_from_db()

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
            self_match_threshold=(self_match_threshold),
            max_attempts=max_attempts,
            random_seed=random_seed,
        )

        nsa.train(normal_corpus)
        _nsa_cache[cache_key] = nsa  

    return _nsa_cache[cache_key]
