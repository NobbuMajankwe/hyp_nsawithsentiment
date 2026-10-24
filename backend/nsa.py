from __future__ import annotations

import hashlib
import math
import random as _rnd
import re
import string
import time
from dataclasses import dataclass
from typing import Any

from database import get_cursor
from nltk.corpus import stopwords as nltk_stopwords
from nltk.stem import WordNetLemmatizer


# Default NSA parameters


NSA_DEFAULT_DETECTOR_COUNT = 200
NSA_DEFAULT_DETECTOR_RADIUS = 0.20
NSA_DEFAULT_SELF_MATCH_THRESHOLD = 0.30
NSA_DEFAULT_MAX_ATTEMPTS = 10_000
NSA_DEFAULT_RANDOM_SEED = 42

WORD2VEC_DEFAULT_VECTOR_SIZE = 100
WORD2VEC_DEFAULT_WINDOW = 5
WORD2VEC_DEFAULT_MIN_COUNT = 1
WORD2VEC_DEFAULT_EPOCHS = 50

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


def load_stopwords_from_library() -> set[str]:
    """Load the standard English stopword list from NLTK.

    Stopwords are no longer read from STOP_WORDS_SAMPLES in the database.
    """
    try:
        return {word.lower() for word in nltk_stopwords.words("english")}
    except LookupError as exc:
        raise RuntimeError(
            "NLTK stopwords data is missing. Run:\n"
            "python -m nltk.downloader stopwords wordnet omw-1.4"
        ) from exc


def load_stopwords_from_db() -> set[str]:
    """Backward-compatible alias; no database query is performed."""
    return load_stopwords_from_library()


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

    NSA instances cache their stop-word set so preprocessing does not query
    the database for every comment.
    """
    return _tokenise_with_stopwords(text, load_stopwords_from_library())


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


def stable_word_hash(word: str) -> int:
    """
    Stable hash used by Word2Vec so initial vectors are reproducible across
    Python processes.
    """
    digest = hashlib.sha256(word.encode("utf-8")).digest()
    return int.from_bytes(digest[:8], byteorder="little", signed=False)


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
        word2vec_vector_size: int = WORD2VEC_DEFAULT_VECTOR_SIZE,
        word2vec_window: int = WORD2VEC_DEFAULT_WINDOW,
        word2vec_min_count: int = WORD2VEC_DEFAULT_MIN_COUNT,
        word2vec_epochs: int = WORD2VEC_DEFAULT_EPOCHS,
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

        if word2vec_vector_size <= 0:
            raise ValueError("word2vec_vector_size must be greater than 0.")

        if word2vec_window <= 0:
            raise ValueError("word2vec_window must be greater than 0.")

        if word2vec_min_count <= 0:
            raise ValueError("word2vec_min_count must be greater than 0.")

        if word2vec_epochs <= 0:
            raise ValueError("word2vec_epochs must be greater than 0.")

        self.detector_count = detector_count
        self.detector_radius = detector_radius
        self.self_match_threshold = self_match_threshold
        self.max_attempts = max_attempts
        self.random_seed = random_seed
        self.word2vec_vector_size = word2vec_vector_size
        self.word2vec_window = word2vec_window
        self.word2vec_min_count = word2vec_min_count
        self.word2vec_epochs = word2vec_epochs

        self.vocabulary: list[str] = []
        self.self_vectors: list[list[float]] = []
        self.detectors: list[Detector] = []
        self.training_statistics: TrainingStatistics | None = None
        self.word2vec_model: Any | None = None

        # Use the standard NLTK English stopword list. No stopwords are
        # loaded from STOP_WORDS_SAMPLES or any other database table.
        self.stop_words: set[str] = load_stopwords_from_library()
        self._rnd = _rnd.Random(random_seed)

    # ------------------------------------------------------------------
    # Tokenisation / vectorisation
    # ------------------------------------------------------------------

    def _tokenise(self, text: str) -> list[str]:
        return _tokenise_with_stopwords(text, self.stop_words)

    @property
    def feature_dimension(self) -> int:
        if self.word2vec_model is not None:
            return int(self.word2vec_model.wv.vector_size)
        return self.word2vec_vector_size

    def _train_word2vec(self, corpus: list[str]) -> list[str]:
        try:
            from gensim.models import Word2Vec
        except ImportError as exc:
            raise RuntimeError(
                "Word2Vec representation requires gensim. Install it with: "
                "pip install gensim"
            ) from exc

        tokenised_corpus = [self._tokenise(text) for text in corpus]
        tokenised_corpus = [tokens for tokens in tokenised_corpus if tokens]

        if not tokenised_corpus:
            raise RuntimeError("SELF corpus produced no usable tokens for Word2Vec.")

        # workers=1 and a stable hash function improve reproducibility.
        # Word2Vec is trained only on the selected SELF corpus so the held-out
        # evaluation dataset does not leak into the text representation.
        self.word2vec_model = Word2Vec(
            sentences=tokenised_corpus,
            vector_size=self.word2vec_vector_size,
            window=self.word2vec_window,
            min_count=self.word2vec_min_count,
            workers=1,
            sg=1,
            seed=self.random_seed,
            epochs=self.word2vec_epochs,
            hashfxn=stable_word_hash,
        )

        vocabulary = list(self.word2vec_model.wv.index_to_key)
        if not vocabulary:
            raise RuntimeError("Word2Vec training produced an empty vocabulary.")

        return vocabulary

    def _text_to_word2vec_vector(self, text: str) -> list[float]:
        if self.word2vec_model is None:
            raise RuntimeError(
                "Word2Vec model has not been trained. Call train() first."
            )

        tokens = self._tokenise(text)
        known_tokens = [
            token for token in tokens if token in self.word2vec_model.wv.key_to_index
        ]

        if not known_tokens:
            return [0.0] * int(self.word2vec_model.wv.vector_size)

        vector_size = int(self.word2vec_model.wv.vector_size)
        averaged = [0.0] * vector_size

        for token in known_tokens:
            word_vector = self.word2vec_model.wv[token]
            for index, value in enumerate(word_vector):
                averaged[index] += float(value)

        count = float(len(known_tokens))
        averaged = [value / count for value in averaged]
        return normalise_vector(averaged)

    def _text_to_vector(self, text: str) -> list[float]:
        return self._text_to_word2vec_vector(text)

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def train(self, normal_corpus: list[str]) -> None:
        started = time.perf_counter()

        corpus = [
            str(text).strip() for text in normal_corpus if text and str(text).strip()
        ]

        if not corpus:
            raise RuntimeError("SELF corpus contains no usable text.")

        # Reset for reproducibility if the same instance is trained again.
        self._rnd = _rnd.Random(self.random_seed)

        self.vocabulary = self._train_word2vec(corpus)

        if not self.vocabulary:
            raise RuntimeError("SELF corpus produced an empty vocabulary.")

        usable_texts: list[str] = []
        usable_vectors: list[list[float]] = []

        for text in corpus:
            vector = self._text_to_vector(text)
            if all(abs(value) < 1e-12 for value in vector):
                continue

            usable_texts.append(text)
            usable_vectors.append(vector)

        if not usable_vectors:
            raise RuntimeError("SELF corpus produced no usable feature vectors.")

        self.self_vectors = usable_vectors

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

    # ------------------------------------------------------------------
    # Detector generation
    # ------------------------------------------------------------------

    def _generate_candidate(self) -> list[float]:
        """
        Generate a dense detector candidate in the Word2Vec vector space.

        A candidate starts near a randomly selected SELF vector and is moved
        toward a random dense direction. Negative selection then rejects any
        candidate that still falls inside the SELF region.
        """
        if not self.self_vectors:
            raise RuntimeError("Cannot generate detectors before SELF vectors exist.")

        dimensions = self.feature_dimension
        if dimensions <= 0:
            raise RuntimeError("Cannot generate detectors without Word2Vec dimensions.")

        base = self._rnd.choice(self.self_vectors)
        random_direction = normalise_vector(
            [self._rnd.gauss(0.0, 1.0) for _ in range(dimensions)]
        )

        alpha = self._rnd.uniform(0.50, 0.85)
        candidate = [
            ((1.0 - alpha) * base_value) + (alpha * random_value)
            for base_value, random_value in zip(base, random_direction)
        ]

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

    # ------------------------------------------------------------------
    # Vocabulary statistics
    # ------------------------------------------------------------------

    def _vocabulary_statistics(self, text: str) -> tuple[float, float]:
        # The vocabulary is learned by Word2Vec from the selected SELF corpus.
        tokens = self._tokenise(text)

        if not tokens:
            return 0.0, 1.0

        vocabulary_set = set(self.vocabulary)
        recognised = sum(token in vocabulary_set for token in tokens)
        coverage = recognised / len(tokens)

        return round(coverage, 4), round(1.0 - coverage, 4)

    # ------------------------------------------------------------------
    # Detection
    # ------------------------------------------------------------------

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
                    "No recognised tokens exist in the SELF Word2Vec vocabulary."
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
    word2vec_vector_size: int = WORD2VEC_DEFAULT_VECTOR_SIZE,
    word2vec_window: int = WORD2VEC_DEFAULT_WINDOW,
    word2vec_min_count: int = WORD2VEC_DEFAULT_MIN_COUNT,
    word2vec_epochs: int = WORD2VEC_DEFAULT_EPOCHS,
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
        word2vec_vector_size,
        word2vec_window,
        word2vec_min_count,
        word2vec_epochs,
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
            word2vec_vector_size=word2vec_vector_size,
            word2vec_window=word2vec_window,
            word2vec_min_count=word2vec_min_count,
            word2vec_epochs=word2vec_epochs,
        )
        nsa.train(normal_corpus)
        _nsa_cache[cache_key] = nsa

    return _nsa_cache[cache_key]
