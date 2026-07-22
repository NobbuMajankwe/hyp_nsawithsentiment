"""
Handles CSV and JSON file uploads, parsing, and storage in the database.
"""

from __future__ import annotations

import csv
import json
import io
from typing import List, Dict, Any
from datetime import datetime
from database import get_cursor


class DatasetParseError(Exception):
    """Raised when a dataset file cannot be parsed."""

    pass


def parse_csv_file(file_content: bytes, encoding: str = "utf-8") -> List[str]:

    try:
        text_content = file_content.decode(encoding)
        reader = csv.DictReader(io.StringIO(text_content))

        # Get the fieldnames
        fieldnames = reader.fieldnames
        if not fieldnames:
            raise DatasetParseError("CSV file is empty or has no headers")

        # Look for a text column
        text_column = None
        for possible_name in [
            "feedback",
            "text",
            "comment",
            "review",
            "message",
            "content",
        ]:
            if possible_name in [f.lower() for f in fieldnames]:
                # Find the actual case-sensitive name
                text_column = next(f for f in fieldnames if f.lower() == possible_name)
                break

        # If no standard column found, use the first column
        if not text_column:
            text_column = fieldnames[0]

        # Extract feedback texts
        feedback_list = []
        for row in reader:
            text = row.get(text_column, "").strip()
            if text:
                feedback_list.append(text)

        if not feedback_list:
            raise DatasetParseError("No feedback text found in CSV file")

        return feedback_list

    except UnicodeDecodeError:
        raise DatasetParseError(f"Cannot decode CSV file with {encoding} encoding")
    except csv.Error as e:
        raise DatasetParseError(f"CSV parsing error: {str(e)}")
    except Exception as e:
        raise DatasetParseError(f"Unexpected error parsing CSV: {str(e)}")


def parse_json_file(file_content: bytes, encoding: str = "utf-8") -> List[str]:

    try:
        text_content = file_content.decode(encoding)
        data = json.loads(text_content)

        feedback_list = []

        # Format 1: Array of strings
        if isinstance(data, list):
            for item in data:
                if isinstance(item, str):
                    text = item.strip()
                    if text:
                        feedback_list.append(text)
                elif isinstance(item, dict):
                    # Look for text field in object
                    for key in [
                        "text",
                        "feedback",
                        "comment",
                        "review",
                        "message",
                        "content",
                    ]:
                        if key in item:
                            text = str(item[key]).strip()
                            if text:
                                feedback_list.append(text)
                            break

        # Format 2: Object with array field
        elif isinstance(data, dict):
            for key in ["feedback", "texts", "data", "records", "comments", "reviews"]:
                if key in data and isinstance(data[key], list):
                    for item in data[key]:
                        if isinstance(item, str):
                            text = item.strip()
                            if text:
                                feedback_list.append(text)
                        elif isinstance(item, dict):
                            for subkey in ["text", "feedback", "comment", "review"]:
                                if subkey in item:
                                    text = str(item[subkey]).strip()
                                    if text:
                                        feedback_list.append(text)
                                    break
                    break

        if not feedback_list:
            raise DatasetParseError("No feedback text found in JSON file")

        return feedback_list

    except json.JSONDecodeError as e:
        raise DatasetParseError(f"Invalid JSON format: {str(e)}")
    except UnicodeDecodeError:
        raise DatasetParseError(f"Cannot decode JSON file with {encoding} encoding")
    except Exception as e:
        raise DatasetParseError(f"Unexpected error parsing JSON: {str(e)}")


def save_dataset_to_db(
    user_id: int,
    source_name: str,
    source_type: str,
    feedback_texts: List[str],
    file_path: str = None,
    description: str = None,
) -> int:

    with get_cursor(commit=True) as cur:
        # Create dataset entry
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
                loaded_by
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING dataset_id
            """,
            (
                source_name,
                source_type,
                description,
                file_path,
                len(feedback_texts),
                "LOADED",
                user_id,
            ),
        )

        dataset = cur.fetchone()
        dataset_id = dataset["dataset_id"]

        # Insert feedback records
        for text in feedback_texts:
            cur.execute(
                """
                INSERT INTO feedback_records
                (
                    dataset_id,
                    raw_text,
                    preprocessing_complete,
                    is_valid,
                    is_anomalous
                )
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    dataset_id,
                    text,
                    False,  # Will be processed during analysis
                    True,  # Default to valid until analyzed
                    False,  # Default to non-anomalous until analyzed
                ),
            )

    return dataset_id


def get_user_datasets(
    user_id: int, limit: int = 50, offset: int = 0
) -> List[Dict[str, Any]]:

    with get_cursor() as cur:
        cur.execute(
            """
            SELECT 
                dataset_id,
                source_name,
                source_type,
                dataset_description,
                total_records,
                status,
                loaded_at
            FROM datasets
            WHERE loaded_by = %s
            AND source_type IN ('CSV', 'JSON', 'API')
            ORDER BY loaded_at DESC
            LIMIT %s OFFSET %s
            """,
            (user_id, limit, offset),
        )

        datasets = cur.fetchall()

        return [
            {
                "id": d["dataset_id"],
                "name": d["source_name"],
                "type": d["source_type"],
                "description": d["dataset_description"],
                "totalRecords": d["total_records"],
                "status": d["status"],
                "uploadedAt": d["loaded_at"].isoformat() if d["loaded_at"] else None,
            }
            for d in datasets
        ]


def get_dataset_by_id(dataset_id: int, user_id: int = None) -> Dict[str, Any] | None:

    with get_cursor() as cur:
        query = """
            SELECT 
                d.dataset_id,
                d.source_name,
                d.source_type,
                d.dataset_description,
                d.total_records,
                d.status,
                d.loaded_by,
                d.loaded_at,
                u.full_name as uploaded_by_name
            FROM datasets d
            LEFT JOIN users u ON d.loaded_by = u.user_id
            WHERE d.dataset_id = %s
        """

        params = [dataset_id]

        if user_id is not None:
            query += " AND d.loaded_by = %s"
            params.append(user_id)

        cur.execute(query, params)
        dataset = cur.fetchone()

        if not dataset:
            return None

        return {
            "id": dataset["dataset_id"],
            "name": dataset["source_name"],
            "type": dataset["source_type"],
            "description": dataset["dataset_description"],
            "totalRecords": dataset["total_records"],
            "status": dataset["status"],
            "uploadedBy": dataset["uploaded_by_name"],
            "uploadedAt": (
                dataset["loaded_at"].isoformat() if dataset["loaded_at"] else None
            ),
        }


def get_dataset_feedback(
    dataset_id: int, limit: int = 100, offset: int = 0
) -> List[Dict[str, Any]]:

    with get_cursor() as cur:
        cur.execute(
            """
            SELECT 
                feedback_id,
                raw_text,
                cleaned_text,
                is_valid,
                is_anomalous,
                created_at
            FROM feedback_records
            WHERE dataset_id = %s
            ORDER BY feedback_id
            LIMIT %s OFFSET %s
            """,
            (dataset_id, limit, offset),
        )

        records = cur.fetchall()

        return [
            {
                "id": r["feedback_id"],
                "text": r["raw_text"],
                "cleanedText": r["cleaned_text"],
                "isValid": r["is_valid"],
                "isAnomalous": r["is_anomalous"],
                "createdAt": r["created_at"].isoformat() if r["created_at"] else None,
            }
            for r in records
        ]


def delete_dataset(dataset_id: int, user_id: int) -> bool:
    """
    Delete a dataset and all its associated feedback records.
    """
    with get_cursor(commit=True) as cur:
        # Verify ownership and delete
        cur.execute(
            """
            DELETE FROM datasets
            WHERE dataset_id = %s AND loaded_by = %s
            RETURNING dataset_id
            """,
            (dataset_id, user_id),
        )

        result = cur.fetchone()
        return result is not None
