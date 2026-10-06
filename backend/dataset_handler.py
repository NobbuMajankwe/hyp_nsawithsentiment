from __future__ import annotations

import csv
import io
import json

# from collections.abc import Iterable
from typing import Any, Literal

from database import get_cursor

ResearchRole = Literal[
    "SELF_CORPUS",
    "EVALUATION",
    "ANALYSIS",
    "SUPPORT",
]

GroundTruthLabel = Literal[
    "SELF",
    "NON_SELF",
]

TEXT_FIELD_NAMES = (
    "text",
    "feedback",
    "comment",
    "comment_text",
    "review",
    "review_text",
    "message",
    "content",
    "sentence",
    "tweet",
    "post",
    "body",
    "description",
    "utterance",
    "dialogue",
    "v2",
)

LABEL_FIELD_NAMES = ("label", "ground_truth", "target", "class", "category", "v1", "id")

VALID_RESEARCH_ROLES = {
    "SELF_CORPUS",
    "EVALUATION",
    "ANALYSIS",
    "SUPPORT",
}

VALID_GROUND_TRUTH_LABELS = {
    "SELF",
    "NON_SELF",
    "NORMAL",
    "ANOMALY",
    "HAM",
    "SPAM",
}


def _normalise_headers(
    fieldnames: list[str],
) -> dict[str, str]:
    """
    Map lowercase header names to their original
    case-sensitive column names.
    """

    return {field.strip().lower(): field for field in fieldnames if field}


def _find_field(
    fieldnames: list[str],
    candidates: tuple[str, ...],
) -> str | None:
    """
    Find the first matching column name.
    """

    lookup = _normalise_headers(fieldnames)

    for candidate in candidates:

        if candidate in lookup:
            return lookup[candidate]

    return None


def _validate_research_role(
    research_role: str,
) -> str:

    role = research_role.strip().upper()

    if role not in VALID_RESEARCH_ROLES:
        raise ValueError(
            "research_role must be one of: "
            "SELF_CORPUS, EVALUATION, "
            "ANALYSIS or SUPPORT."
        )

    return role


def _normalise_ground_truth(
    label: str | None,
) -> str | None:

    if label is None:
        return None

    normalised = str(label).strip().upper().replace("-", "_").replace(" ", "_")

    if not normalised:
        return None

    label_map = {
        "SELF": "SELF",
        "NORMAL": "SELF",
        "HAM": "SELF",
        "NON_SELF": "NON_SELF",
        "NONSELF": "NON_SELF",
        "ANOMALY": "NON_SELF",
        "SPAM": "NON_SELF",
    }

    if normalised not in label_map:
        raise DatasetParseError(
            f"Invalid ground-truth label "
            f"'{label}'. Expected one of: "
            f"SELF, NON_SELF, NORMAL, "
            f"ANOMALY, HAM, SPAM."
        )

    return label_map[normalised]


class DatasetParseError(Exception):
    """Raised when a dataset file cannot be parsed."""


def parse_csv_file(
    file_content: bytes,
    encoding: str = "utf-8",
) -> list[str]:
    """
    Parse an unlabelled CSV dataset and return
    the detected text records.
    """

    # Decode file

    text_content = None
    used_encoding = None

    encodings_to_try = [
        encoding,
        "utf-8-sig",
        "cp1252",
        "latin-1",
    ]

    # Remove duplicates while preserving order
    encodings_to_try = list(dict.fromkeys(encodings_to_try))

    for candidate_encoding in encodings_to_try:
        try:
            text_content = file_content.decode(candidate_encoding)

            used_encoding = candidate_encoding
            break

        except UnicodeDecodeError:
            continue

    if text_content is None:
        raise DatasetParseError(
            "Could not decode CSV file. "
            "Tried UTF-8, UTF-8-SIG, "
            "CP1252 and Latin-1."
        )

    # Detect delimiter

    try:
        sample = text_content[:10000]

        dialect = csv.Sniffer().sniff(
            sample,
            delimiters=",;\t|",
        )

        delimiter = dialect.delimiter

    except csv.Error:
        delimiter = ","

    # Parse CSV

    try:
        reader = csv.DictReader(
            io.StringIO(text_content),
            delimiter=delimiter,
        )

        raw_fieldnames = reader.fieldnames

        if not raw_fieldnames:
            raise DatasetParseError("CSV file is empty or has no headers.")

        # Remove empty/blank headers.
        
        fieldnames = [
            str(field).strip()
            for field in raw_fieldnames
            if field is not None and str(field).strip()
        ]

        if not fieldnames:
            raise DatasetParseError("CSV contains no usable headers.")

        rows = list(reader)

        if not rows:
            raise DatasetParseError("CSV contains no data rows.")

        # Find known text column

        text_column = _find_field(
            fieldnames,
            TEXT_FIELD_NAMES,
        )

        # Fall back to automatic text detection

        if text_column is None:

            candidates: list[tuple[str, float]] = []

            for field in fieldnames:

                values: list[str] = []

                for row in rows[:100]:

                    value = row.get(field)

                    if value is None:
                        continue

                    value = str(value).strip()

                    if not value:
                        continue

                    values.append(value)

                if not values:
                    continue

                #
                # Ignore mostly numeric columns
                #

                numeric_count = 0

                for value in values:
                    try:
                        float(value)
                        numeric_count += 1

                    except ValueError:
                        pass

                numeric_ratio = numeric_count / len(values)

                if numeric_ratio > 0.8:
                    continue

                #
                # Calculate average text length
                #

                average_length = sum(len(value) for value in values) / len(values)

                candidates.append(
                    (
                        field,
                        average_length,
                    )
                )

            # Pick column with longest average text
            if candidates:

                candidates.sort(
                    key=lambda item: item[1],
                    reverse=True,
                )

                text_column = candidates[0][0]

        # No text column found

        if text_column is None:

            raise DatasetParseError(
                "Could not identify a text column. " f"Available columns: {fieldnames}"
            )

        # Extract text records

        records: list[str] = []

        for row in rows:

            value = row.get(text_column)

            if value is None:
                continue

            text = str(value).strip()

            if text:
                records.append(text)

        if not records:
            raise DatasetParseError(
                "No text records were found " f"in column '{text_column}'."
            )

        return records

    except DatasetParseError:
        # Important:
        # don't convert our useful parsing errors
        # into a generic "Could not parse CSV".
        raise

    except csv.Error as exc:
        raise DatasetParseError(f"CSV parsing error: {exc}") from exc

    except Exception as exc:
        raise DatasetParseError(f"Unexpected CSV parsing error: {exc}") from exc


def parse_labelled_csv_file(
    file_content: bytes,
    encoding: str = "utf-8",
) -> list[dict[str, str]]:
    """
    Parse a labelled evaluation dataset.
    """

    # Decode file

    text_content = None

    encodings_to_try = [
        encoding,
        "utf-8-sig",
        "cp1252",
        "latin-1",
    ]

    encodings_to_try = list(dict.fromkeys(encodings_to_try))

    for candidate_encoding in encodings_to_try:
        try:
            text_content = file_content.decode(candidate_encoding)
            break

        except UnicodeDecodeError:
            continue

    if text_content is None:
        raise DatasetParseError(
            "Could not decode CSV file. "
            "Tried UTF-8, UTF-8-SIG, "
            "CP1252 and Latin-1."
        )

    # Detect delimiter

    try:
        sample = text_content[:10000]

        dialect = csv.Sniffer().sniff(
            sample,
            delimiters=",;\t|",
        )

        delimiter = dialect.delimiter

    except csv.Error:
        delimiter = ","

    # Parse CSV

    try:
        reader = csv.DictReader(
            io.StringIO(text_content),
            delimiter=delimiter,
        )

        raw_fieldnames = reader.fieldnames

        if not raw_fieldnames:
            raise DatasetParseError("CSV file is empty or has no headers.")

        # Remove empty headers such as:
        # v1,v2,,,
        fieldnames = [
            str(field).strip()
            for field in raw_fieldnames
            if field is not None and str(field).strip()
        ]

        if not fieldnames:
            raise DatasetParseError("CSV contains no usable headers.")

        # Find text and label columns

        text_column = _find_field(
            fieldnames,
            TEXT_FIELD_NAMES,
        )

        label_column = _find_field(
            fieldnames,
            LABEL_FIELD_NAMES,
        )

        if text_column is None:
            raise DatasetParseError(
                "No recognised text column was found. "
                f"Available columns: {fieldnames}"
            )

        if label_column is None:
            raise DatasetParseError(
                "Evaluation datasets must contain "
                "a label column. "
                f"Available columns: {fieldnames}"
            )

        # Parse records

        records: list[dict[str, str]] = []

        for row_number, row in enumerate(
            reader,
            start=2,
        ):
            raw_text = row.get(text_column)

            raw_label = row.get(label_column)

            text = str(raw_text).strip() if raw_text is not None else ""

            if not text:
                continue

            try:
                label = _normalise_ground_truth(raw_label)

            except DatasetParseError as exc:
                raise DatasetParseError(f"Row {row_number}: {exc}") from exc

            if label is None:
                raise DatasetParseError(
                    f"Row {row_number}: " "ground-truth label is missing."
                )

            records.append(
                {
                    "text": text,
                    "label": label,
                }
            )

        if not records:
            raise DatasetParseError("No valid labelled records " "were found.")

        return records

    except DatasetParseError:
        raise

    except csv.Error as exc:
        raise DatasetParseError(f"CSV parsing error: {exc}") from exc


def parse_json_file(
    file_content: bytes,
    encoding: str = "utf-8",
) -> list[str]:
    """
    Parse unlabelled JSON feedback.

    Supported forms include:

        [
            "feedback one",
            "feedback two"
        ]

    or:

        [
            {"text": "feedback one"}
        ]

    or:

        {
            "records": [
                {"text": "feedback one"}
            ]
        }
    """

    try:

        text_content = file_content.decode(encoding)

        data = json.loads(text_content)

    except UnicodeDecodeError as exc:

        raise DatasetParseError(
            f"Cannot decode JSON file " f"using {encoding}."
        ) from exc

    except json.JSONDecodeError as exc:

        raise DatasetParseError(f"Invalid JSON format: {exc}") from exc

    records: list[str] = []

    def extract_item(
        item: Any,
    ) -> None:

        if isinstance(
            item,
            str,
        ):

            text = item.strip()

            if text:
                records.append(text)

            return

        if isinstance(
            item,
            dict,
        ):

            for key in TEXT_FIELD_NAMES:

                if key not in item:
                    continue

                value = item[key]

                if value is None:
                    return

                text = str(value).strip()

                if text:
                    records.append(text)

                return

    if isinstance(
        data,
        list,
    ):

        for item in data:
            extract_item(item)

    elif isinstance(
        data,
        dict,
    ):

        collection = None

        for key in (
            "feedback",
            "texts",
            "data",
            "records",
            "comments",
            "reviews",
        ):

            value = data.get(key)

            if isinstance(
                value,
                list,
            ):

                collection = value
                break

        if collection is not None:

            for item in collection:
                extract_item(item)

        else:

            # Support a single JSON object.
            extract_item(data)

    if not records:

        raise DatasetParseError("No feedback text found " "in JSON file.")

    return records


def parse_labelled_json_file(
    file_content: bytes,
    encoding: str = "utf-8",
) -> list[dict[str, str]]:
    """
    Parse labelled JSON evaluation data.

    Example:

        [
            {
                "text": "registration was easy",
                "label": "SELF"
            },
            {
                "text": "free prize click here",
                "label": "NON_SELF"
            }
        ]
    """

    try:

        data = json.loads(file_content.decode(encoding))

    except UnicodeDecodeError as exc:

        raise DatasetParseError(
            f"Cannot decode JSON file " f"using {encoding}."
        ) from exc

    except json.JSONDecodeError as exc:

        raise DatasetParseError(f"Invalid JSON format: {exc}") from exc

    if isinstance(
        data,
        dict,
    ):

        collection = None

        for key in (
            "records",
            "data",
            "feedback",
            "reviews",
        ):

            value = data.get(key)

            if isinstance(
                value,
                list,
            ):

                collection = value
                break

        if collection is None:
            collection = [data]

    elif isinstance(
        data,
        list,
    ):

        collection = data

    else:

        raise DatasetParseError(
            "Labelled JSON must contain " "objects with text and label."
        )

    records: list[dict[str, str]] = []

    for index, item in enumerate(
        collection,
        start=1,
    ):

        if not isinstance(
            item,
            dict,
        ):

            raise DatasetParseError(f"Record {index} is not " "a JSON object.")

        text = None

        for key in TEXT_FIELD_NAMES:

            if key in item:

                text = str(item[key]).strip()

                break

        label = None

        for key in LABEL_FIELD_NAMES:

            if key in item:

                label = _normalise_ground_truth(item[key])

                break

        if not text:

            raise DatasetParseError(f"Record {index} has no " "feedback text.")

        if label is None:

            raise DatasetParseError(f"Record {index} has no " "ground-truth label.")

        records.append(
            {
                "text": text,
                "label": label,
            }
        )

    if not records:

        raise DatasetParseError("No labelled feedback " "records found.")

    return records


def save_dataset_to_db(
    user_id: int,
    source_name: str,
    source_type: str,
    feedback_texts: list[str],
    file_path: str | None = None,
    description: str | None = None,
    research_role: ResearchRole = "ANALYSIS",
) -> int:
    """
    Save an unlabelled dataset.

    Typical roles:

        SELF_CORPUS
        ANALYSIS
        SUPPORT
    """

    role = _validate_research_role(research_role)

    if role == "EVALUATION":

        raise ValueError(
            "Use save_labelled_dataset_to_db() " "for EVALUATION datasets."
        )

    cleaned_feedback = [
        text.strip() for text in feedback_texts if text and text.strip()
    ]

    if not cleaned_feedback:

        raise ValueError("Dataset contains no " "feedback records.")

    with get_cursor(commit=True) as cur:

        cur.execute(
            """
            INSERT INTO datasets
            (
                source_name,
                source_type,
                dataset_description,
                file_path,
                total_records,
                status,
                research_role,
                loaded_by
            )
            VALUES
            (
                %s,%s,%s,%s,
                %s,'LOADED',%s,%s
            )
            RETURNING dataset_id
            """,
            (
                source_name,
                source_type,
                description,
                file_path,
                len(cleaned_feedback),
                role,
                user_id,
            ),
        )

        row = cur.fetchone()

        dataset_id = int(row["dataset_id"])

        for text in cleaned_feedback:

            cur.execute(
                """
                INSERT INTO feedback_records
                (
                    dataset_id,
                    raw_text,
                    ground_truth_label,
                    preprocessing_complete
                )
                VALUES
                (
                    %s,%s,NULL,FALSE
                )
                """,
                (
                    dataset_id,
                    text,
                ),
            )

    return dataset_id


def save_labelled_dataset_to_db(
    user_id: int,
    source_name: str,
    source_type: str,
    records: list[dict[str, str]],
    file_path: str | None = None,
    description: str | None = None,
) -> int:
    """
    Persist a labelled EVALUATION dataset.

    Expected records:

        {
            "text": "...",
            "label": "SELF"
        }
    """

    if not records:

        raise ValueError("Evaluation dataset " "contains no records.")

    validated: list[dict[str, str]] = []

    for record in records:

        text = str(record.get("text", "")).strip()

        if not text:
            continue

        label = _normalise_ground_truth(record.get("label"))

        if label is None:

            raise ValueError(
                "Every evaluation record " "must have a ground-truth " "label."
            )

        validated.append(
            {
                "text": text,
                "label": label,
            }
        )

    if not validated:

        raise ValueError("Evaluation dataset contains " "no valid records.")

    with get_cursor(commit=True) as cur:

        cur.execute(
            """
            INSERT INTO datasets
            (
                source_name,
                source_type,
                dataset_description,
                file_path,
                total_records,
                status,
                research_role,
                loaded_by
            )
            VALUES
            (
                %s,%s,%s,%s,
                %s,'LOADED',
                'EVALUATION',
                %s
            )
            RETURNING dataset_id
            """,
            (
                source_name,
                source_type,
                description,
                file_path,
                len(validated),
                user_id,
            ),
        )

        dataset_id = int(cur.fetchone()["dataset_id"])

        for record in validated:

            cur.execute(
                """
                INSERT INTO feedback_records
                (
                    dataset_id,
                    raw_text,
                    ground_truth_label,
                    preprocessing_complete
                )
                VALUES
                (
                    %s,%s,%s,FALSE
                )
                """,
                (
                    dataset_id,
                    record["text"],
                    record["label"],
                ),
            )

    return dataset_id


def get_user_datasets(
    user_id: int,
    limit: int = 50,
    offset: int = 0,
    research_role: str | None = None,
) -> list[dict[str, Any]]:
    """
    Return datasets belonging to a user.

    Optionally filter by research role.
    """

    query = """
        SELECT
            dataset_id,
            source_name,
            source_type,
            dataset_description,
            research_role,
            total_records,
            status,
            loaded_at
        FROM datasets
        WHERE loaded_by = %s
    """

    params: list[Any] = [user_id]

    if research_role is not None:

        role = _validate_research_role(research_role)

        query += """
            AND research_role = %s
        """

        params.append(role)

    query += """
        ORDER BY loaded_at DESC
        LIMIT %s
        OFFSET %s
    """

    params.extend(
        [
            limit,
            offset,
        ]
    )

    with get_cursor() as cur:

        cur.execute(
            query,
            params,
        )

        datasets = cur.fetchall()

    return [
        {
            "id": row["dataset_id"],
            "name": row["source_name"],
            "type": row["source_type"],
            "description": row["dataset_description"],
            "researchRole": row["research_role"],
            "totalRecords": row["total_records"],
            "status": row["status"],
            "uploadedAt": (row["loaded_at"].isoformat() if row["loaded_at"] else None),
        }
        for row in datasets
    ]


def get_dataset_by_id(
    dataset_id: int,
    user_id: int | None = None,
) -> dict[str, Any] | None:

    query = """
        SELECT
            d.dataset_id,
            d.source_name,
            d.source_type,
            d.dataset_description,
            d.research_role,
            d.total_records,
            d.status,
            d.loaded_by,
            d.loaded_at,

            u.full_name
                AS uploaded_by_name

        FROM datasets d

        LEFT JOIN users u
            ON d.loaded_by =
               u.user_id

        WHERE d.dataset_id = %s
    """

    params: list[Any] = [dataset_id]

    if user_id is not None:

        query += """
            AND d.loaded_by = %s
        """

        params.append(user_id)

    with get_cursor() as cur:

        cur.execute(
            query,
            params,
        )

        dataset = cur.fetchone()

    if not dataset:
        return None

    return {
        "id": dataset["dataset_id"],
        "name": dataset["source_name"],
        "type": dataset["source_type"],
        "description": dataset["dataset_description"],
        "researchRole": dataset["research_role"],
        "totalRecords": dataset["total_records"],
        "status": dataset["status"],
        "uploadedBy": dataset["uploaded_by_name"],
        "uploadedAt": (
            dataset["loaded_at"].isoformat() if dataset["loaded_at"] else None
        ),
    }


def get_dataset_feedback(
    dataset_id: int,
    limit: int = 100,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """
    Return raw/preprocessed feedback and
    ground-truth labels.

    Predictions do NOT belong here.

    They belong in experiment_results.
    """

    with get_cursor() as cur:

        cur.execute(
            """
            SELECT
                feedback_id,
                raw_text,
                cleaned_text,
                tokens,
                ground_truth_label,
                preprocessing_complete,
                created_at

            FROM feedback_records

            WHERE dataset_id = %s

            ORDER BY feedback_id

            LIMIT %s
            OFFSET %s
            """,
            (
                dataset_id,
                limit,
                offset,
            ),
        )

        records = cur.fetchall()

    return [
        {
            "id": row["feedback_id"],
            "text": row["raw_text"],
            "cleanedText": row["cleaned_text"],
            "tokens": row["tokens"],
            "groundTruthLabel": row["ground_truth_label"],
            "preprocessingComplete": row["preprocessing_complete"],
            "createdAt": (row["created_at"].isoformat() if row["created_at"] else None),
        }
        for row in records
    ]


def get_all_dataset_feedback(
    dataset_id: int,
) -> list[dict[str, Any]]:
    """
    Retrieve the complete dataset without pagination.

    Intended for experiment execution rather than UI browsing.
    """

    with get_cursor() as cur:

        cur.execute(
            """
            SELECT
                feedback_id,
                raw_text,
                cleaned_text,
                tokens,
                ground_truth_label

            FROM feedback_records

            WHERE dataset_id = %s

            ORDER BY feedback_id
            """,
            (dataset_id,),
        )

        return cur.fetchall()


def get_self_corpus_dataset() -> dict | None:
    """
    Get the most recently loaded SELF corpus.
    """

    with get_cursor() as cur:

        cur.execute(
            """
            SELECT
                dataset_id,
                source_name,
                total_records,
                loaded_at

            FROM datasets

            WHERE research_role =
                'SELF_CORPUS'

            ORDER BY loaded_at DESC

            LIMIT 1
            """
        )

        row = cur.fetchone()

    if not row:
        return None

    return {
        "id": row["dataset_id"],
        "name": row["source_name"],
        "totalRecords": row["total_records"],
        "loadedAt": (row["loaded_at"].isoformat() if row["loaded_at"] else None),
    }


def load_self_corpus() -> list[str]:
    """
    Load raw text belonging to the latest SELF corpus.

    This can replace the hard-coded
    NORMAL_FEEDBACK_SAMPLES lookup in nsa.py.
    """

    with get_cursor() as cur:

        cur.execute(
            """
            SELECT dataset_id
            FROM datasets
            WHERE research_role =
                'SELF_CORPUS'
            ORDER BY loaded_at DESC
            LIMIT 1
            """
        )

        dataset = cur.fetchone()

        if not dataset:

            raise RuntimeError("No SELF_CORPUS dataset " "has been configured.")

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

        raise RuntimeError("The SELF corpus contains " "no feedback records.")

    return [row["raw_text"] for row in records]


def get_dataset_label_distribution(
    dataset_id: int,
) -> dict[str, int]:
    """
    Return ground-truth distribution for
    a labelled evaluation dataset.
    """

    with get_cursor() as cur:

        cur.execute(
            """
            SELECT
                ground_truth_label,
                COUNT(*) AS total

            FROM feedback_records

            WHERE dataset_id = %s

            GROUP BY ground_truth_label
            """,
            (dataset_id,),
        )

        rows = cur.fetchall()

    distribution = {
        "SELF": 0,
        "NON_SELF": 0,
        "UNLABELLED": 0,
    }

    for row in rows:

        label = row["ground_truth_label"]

        count = int(row["total"])

        if label is None:

            distribution["UNLABELLED"] += count

        elif label in distribution:

            distribution[label] += count

    return distribution


def delete_dataset(
    dataset_id: int,
    user_id: int,
) -> bool:
    """
    Delete a dataset owned by the user.

    Note:
    PostgreSQL may prevent deletion if completed
    experiments still reference the dataset.

    This is desirable for research integrity because
    an experiment should not silently lose its source
    dataset.
    """

    with get_cursor(commit=True) as cur:

        cur.execute(
            """
            DELETE FROM datasets

            WHERE dataset_id = %s
            AND loaded_by = %s

            RETURNING dataset_id
            """,
            (
                dataset_id,
                user_id,
            ),
        )

        result = cur.fetchone()

    return result is not None
