"""Student 2 — Intelligence Engine: public entry point.

This module is the *only* surface Student 1 (backend), Student 3 (AI agent) and
Student 4 (dashboard) need to know about. They call :func:`analyze_complaints`
with a list of raw complaints and receive a JSON-serialisable dict that follows
``contracts/data_formats.json``.

Pipeline
--------
    validate -> preprocess -> classify -> sentiment -> severity
             -> embed (batch) -> cluster -> name clusters
             -> trend detection -> emerging issues -> structured output

Everything is orchestrated by one function so the engine cannot be wired up
incorrectly. No frontend code, no dashboard code and no agent decision logic live
here — only complaint -> intelligence transformation.

Run directly for a demo:

    python main.py                       # demo complaints (+ dataset if present)
    python main.py --file data/complaints.json --output output.json
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence

import numpy as np

from classification import ISSUE_TYPES, classify
from clustering import (
    cluster_embeddings,
    clustering_backend,
    describe_clusters,
    name_clusters,
)
from embeddings import EmbeddingError, create_embeddings, embedder_name, embedding_dim
from preprocessing import clean_text
from sentiment import analyze_sentiment, sentiment_backend
from severity import SEVERITIES, determine_severity
from trends import (
    DEFAULT_EMERGING_GROWTH_THRESHOLD,
    DEFAULT_EMERGING_MIN_COUNT,
    detect_emerging_issues,
    detect_trends,
)

__all__ = [
    "InvalidComplaintError",
    "analyze_complaints",
    "load_complaints",
    "save_output",
    "validate_complaints",
]

logger = logging.getLogger(__name__)

REQUIRED_FIELD = "text"
BASE_DIR = Path(__file__).resolve().parent
DEFAULT_DATA_FILE = BASE_DIR / "data" / "complaints.json"

#: Demo complaints required by the project brief (section 22).
DEMO_COMPLAINTS: List[Dict[str, Any]] = [
    {
        "complaint_id": "DEMO-1",
        "text": "My headphones arrived broken and I want my money back!",
        "customer_id": "U900",
        "order_id": "O900",
        "created_at": "2026-09-20",
    },
    {
        "complaint_id": "DEMO-2",
        "text": "Payment failed but money was deducted from my card.",
        "customer_id": "U901",
        "order_id": "O901",
        "created_at": "2026-09-21",
    },
    {
        "complaint_id": "DEMO-3",
        "text": "Customer service was helpful and my issue was resolved quickly, thank you!",
        "customer_id": "U902",
        "order_id": "O902",
        "created_at": "2026-09-22",
    },
]


class InvalidComplaintError(ValueError):
    """Raised when the input to the engine is structurally unusable.

    Only *fatal* problems raise (input is not a sequence of mappings). Recoverable
    per-record problems (missing id, unparseable date, empty text) are reported in
    ``diagnostics["warnings"]`` instead of aborting the whole batch.
    """


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
def validate_complaints(complaints: Any) -> List[Dict[str, Any]]:
    """Validate the raw request payload and normalise it to a list of dicts.

    Recoverable per-record problems are collected on the returned records as
    ``_validation_warnings`` so that :func:`analyze_complaints` can report them.

    Args:
        complaints: Expected ``list[dict]``. A single dict is also accepted and
            wrapped into a one-item list.

    Returns:
        A new list of shallow-copied dicts, each optionally carrying
        ``_validation_warnings`` (list[str]).

    Raises:
        InvalidComplaintError: If ``complaints`` is ``None``, not a sequence, or
            not a sequence of mappings.
    """
    if complaints is None:
        raise InvalidComplaintError(
            "Input is None. Pass a list of complaint dicts, e.g. "
            "[{'complaint_id': 'C001', 'text': 'my order is late', ...}]."
        )

    if isinstance(complaints, dict):
        complaints = [complaints]

    if isinstance(complaints, (str, bytes)) or not isinstance(complaints, Iterable):
        raise InvalidComplaintError(
            f"Input must be a list of complaint dicts, got {type(complaints).__name__}."
        )

    records = list(complaints)
    validated: List[Dict[str, Any]] = []
    for index, record in enumerate(records):
        if not isinstance(record, dict):
            raise InvalidComplaintError(
                f"Complaint at index {index} must be a dict, got {type(record).__name__}."
            )
        item = dict(record)
        warnings: List[str] = []
        if REQUIRED_FIELD not in item:
            warnings.append(f"missing required field '{REQUIRED_FIELD}' (treated as empty text)")
        elif item.get(REQUIRED_FIELD) is None:
            warnings.append("field 'text' is null (treated as empty text)")
        elif not isinstance(item.get(REQUIRED_FIELD), str):
            warnings.append(f"field 'text' is {type(item[REQUIRED_FIELD]).__name__}, coerced to string")
        for optional in ("complaint_id", "customer_id", "order_id", "created_at"):
            if item.get(optional) is None:
                warnings.append(f"missing optional field '{optional}'")
        if warnings:
            item["_validation_warnings"] = warnings
        validated.append(item)
    return validated


# ---------------------------------------------------------------------------
# Pipeline stages
# ---------------------------------------------------------------------------
def _preprocess(records: Sequence[Dict[str, Any]]) -> List[str]:
    """Stage 1: clean every complaint's text."""
    return [clean_text(record.get(REQUIRED_FIELD)) for record in records]


def _classify(clean_texts: Sequence[str]) -> List[str]:
    """Stage 2: assign an ``issue_type`` to every complaint."""
    return [classify(text) for text in clean_texts]


def _sentiment(clean_texts: Sequence[str]) -> List[str]:
    """Stage 3: assign a ``sentiment`` label."""
    return [analyze_sentiment(text) for text in clean_texts]


def _severity(sentiments: Sequence[str], issue_types: Sequence[str]) -> List[str]:
    """Stage 4: assign a project ``severity``."""
    return [
        determine_severity(None, sentiment, issue_type)
        for sentiment, issue_type in zip(sentiments, issue_types)
    ]


def _embed(clean_texts: Sequence[str]) -> np.ndarray:
    """Stage 5: batch-embed all complaint texts (one model call)."""
    return create_embeddings(clean_texts)


def _safe_embed(clean_texts: Sequence[str]) -> tuple[np.ndarray, List[str]]:
    """Embed with a graceful, *reported* degradation path.

    Returns the embedding matrix and a list of warnings. On total embedding
    failure the engine still returns classification/sentiment/severity
    intelligence, with clustering and trends disabled and clearly flagged.
    """
    try:
        return _embed(clean_texts), []
    except EmbeddingError as exc:
        warning = (
            f"Embedding generation failed ({exc}). Clustering and semantic trend "
            "detection are disabled for this run; classification, sentiment and "
            "severity are still valid."
        )
        logger.error(warning)
        return np.zeros((len(clean_texts), 0), dtype=np.float32), [warning]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def analyze_complaints(
    complaints: Any,
    emerging_growth_threshold: float = DEFAULT_EMERGING_GROWTH_THRESHOLD,
    emerging_min_count: int = DEFAULT_EMERGING_MIN_COUNT,
    trend_label_key: str = "auto",
    include_embeddings: bool = True,
) -> Dict[str, Any]:
    """Run the complete Student 2 intelligence pipeline.

    This is the single public function of the Intelligence Engine. Its return
    value is JSON-serialisable and follows ``contracts/data_formats.json``.

    Args:
        complaints: List of raw complaint dicts. See the input schema in
            ``contracts/data_formats.json``. An empty list is valid and yields a
            well-formed empty result (no exception).
        emerging_growth_threshold: Growth (%) above which an issue is "emerging".
        emerging_min_count: Minimum current-period volume for "emerging".
        trend_label_key: ``"auto"`` (cluster when meaningful, else category),
            ``"cluster"`` or ``"issue_type"``.
        include_embeddings: When ``False``, vectors are omitted from the output
            (useful for very large payloads). Defaults to ``True``.

    Returns:
        Dict with keys:

        * ``analyzed_complaints`` — one enriched record per input complaint.
        * ``trends`` — per-issue count and growth.
        * ``emerging_issues`` — issues growing beyond the threshold.
        * ``clusters`` — cluster id/name/size summary.
        * ``metadata`` — run counters, backend names, configuration used.
        * ``diagnostics`` — warnings and errors, so callers can see degradation
          instead of guessing.

    Raises:
        InvalidComplaintError: If the payload is structurally invalid (``None``,
            not a sequence, or contains non-dict entries).

    Examples:
        >>> result = analyze_complaints([{"complaint_id": "C1", "text": "my order is late"}])
        >>> result["analyzed_complaints"][0]["issue_type"]
        'Late Delivery'
    """
    records = validate_complaints(complaints)
    warnings: List[str] = []
    errors: List[str] = []
    for record in records:
        for warning in record.get("_validation_warnings", []):
            identifier = record.get("complaint_id", "?")
            warnings.append(f"{identifier}: {warning}")

    empty_result: Dict[str, Any] = {
        "analyzed_complaints": [],
        "trends": [],
        "emerging_issues": [],
        "clusters": [],
        "metadata": {
            "total_complaints": 0,
            "processed_complaints": 0,
            "periods_analyzed": 0,
            "embedding_backend": None,
            "embedding_dim": 0,
            "clustering_backend": None,
            "sentiment_backend": None,
            "emerging_growth_threshold": float(emerging_growth_threshold),
            "emerging_min_count": int(emerging_min_count),
            "trend_label_key": trend_label_key,
        },
        "diagnostics": {"warnings": warnings, "errors": errors},
    }

    if not records:
        logger.warning("analyze_complaints received zero complaints; returning empty result.")
        empty_result["metadata"]["sentiment_backend"] = sentiment_backend()
        return empty_result

    # 1. Preprocessing -----------------------------------------------------
    clean_texts = _preprocess(records)

    # 2. Classification ----------------------------------------------------
    issue_types = _classify(clean_texts)

    # 3. Sentiment ---------------------------------------------------------
    sentiments = _sentiment(clean_texts)

    # 4. Severity ----------------------------------------------------------
    severities = _severity(sentiments, issue_types)
    assert all(value in ISSUE_TYPES for value in issue_types)
    assert all(value in SEVERITIES for value in severities)

    # 5. Embeddings (single batch call) ------------------------------------
    embeddings, embedding_warnings = _safe_embed(clean_texts)
    warnings.extend(embedding_warnings)
    embeddings_available = embeddings.shape[1] > 0 and embeddings.shape[0] == len(records)

    # 6. Clustering + 7. Naming -------------------------------------------
    if embeddings_available:
        try:
            labels = cluster_embeddings(embeddings)
        except Exception as exc:  # never let clustering kill the whole run
            error = f"Clustering failed ({exc}); every complaint is reported as '{_noise_name()}'."
            logger.error(error)
            errors.append(error)
            labels = np.full(len(records), -1, dtype=int)
    else:
        labels = np.full(len(records), -1, dtype=int)

    cluster_names = name_clusters(labels, issue_types)
    cluster_summary = describe_clusters(labels, cluster_names)

    # 8. Build output records ---------------------------------------------
    analyzed: List[Dict[str, Any]] = []
    for index, record in enumerate(records):
        item: Dict[str, Any] = {
            "complaint_id": record.get("complaint_id", f"idx-{index}"),
            "clean_text": clean_texts[index],
            "issue_type": issue_types[index],
            "sentiment": sentiments[index],
            "severity": severities[index],
            "cluster": cluster_names.get(int(labels[index]), cluster_names.get(-1, "Unclustered")),
            "cluster_id": int(labels[index]),
            "customer_id": record.get("customer_id"),
            "order_id": record.get("order_id"),
            "created_at": record.get("created_at"),
        }
        if include_embeddings:
            vector = embeddings[index] if embeddings_available else np.zeros(0, dtype=np.float32)
            item["embedding"] = [float(value) for value in vector]
        analyzed.append(item)

    # 9. Trends + 10. Emerging issues -------------------------------------
    try:
        trends = detect_trends(analyzed, label_key=trend_label_key)
    except Exception as exc:
        error = f"Trend detection failed ({exc}); 'trends' is empty for this run."
        logger.error(error)
        errors.append(error)
        trends = []

    try:
        emerging = detect_emerging_issues(
            trends,
            growth_threshold=emerging_growth_threshold,
            min_count=emerging_min_count,
        )
    except Exception as exc:
        error = f"Emerging-issue detection failed ({exc}); 'emerging_issues' is empty for this run."
        logger.error(error)
        errors.append(error)
        emerging = []

    periods = {str(record.get("created_at"))[:7] for record in analyzed if record.get("created_at")}

    return {
        "analyzed_complaints": analyzed,
        "trends": trends,
        "emerging_issues": emerging,
        "clusters": cluster_summary,
        "metadata": {
            "total_complaints": len(records),
            "processed_complaints": len(analyzed),
            "periods_analyzed": len(periods),
            "embedding_backend": embedder_name() if embeddings_available else None,
            "embedding_dim": int(embeddings.shape[1]) if embeddings_available else embedding_dim(),
            "clustering_backend": clustering_backend() if embeddings_available else None,
            "sentiment_backend": sentiment_backend(),
            "emerging_growth_threshold": float(emerging_growth_threshold),
            "emerging_min_count": int(emerging_min_count),
            "trend_label_key": trend_label_key,
        },
        "diagnostics": {"warnings": warnings, "errors": errors},
    }


def _noise_name() -> str:
    from clustering import NOISE_NAME

    return NOISE_NAME


# ---------------------------------------------------------------------------
# I/O helpers
# ---------------------------------------------------------------------------
def load_complaints(path: Optional[str] = None) -> List[Dict[str, Any]]:
    """Load complaints from a JSON file.

    Args:
        path: Path to a JSON file containing a list of complaint dicts. Defaults
            to ``data/complaints.json`` next to this module.

    Returns:
        The parsed list of dicts (``[]`` for a JSON ``null``).

    Raises:
        FileNotFoundError: If the file does not exist.
        ValueError: If the JSON is malformed or is not a list of objects.
    """
    file_path = Path(path) if path else DEFAULT_DATA_FILE
    if not file_path.exists():
        raise FileNotFoundError(
            f"Complaint file not found: {file_path}. "
            "Run 'python main.py --demo-only' or point --file at a valid JSON file."
        )

    try:
        with file_path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Malformed JSON in {file_path}: {exc}") from exc

    if payload is None:
        return []
    if not isinstance(payload, list):
        raise ValueError(
            f"{file_path} must contain a JSON list of complaint objects, got {type(payload).__name__}."
        )
    return payload


def save_output(result: Dict[str, Any], path: str) -> Path:
    """Write the engine output to a JSON file (UTF-8, indented).

    Args:
        result: The dict returned by :func:`analyze_complaints`.
        path: Destination file path.

    Returns:
        The :class:`~pathlib.Path` that was written.

    Raises:
        TypeError: If the result is not JSON-serialisable (e.g. raw numpy values).
    """
    destination = Path(path)
    if destination.parent and not destination.parent.exists():
        destination.parent.mkdir(parents=True, exist_ok=True)

    try:
        serialised = json.dumps(result, indent=2, ensure_ascii=False, allow_nan=False, default=_json_default)
    except (TypeError, ValueError) as exc:
        raise TypeError(f"Output is not JSON-serialisable: {exc}") from exc

    destination.write_text(serialised, encoding="utf-8")
    logger.info("Wrote intelligence output to %s", destination)
    return destination


def _json_default(value: Any) -> Any:
    """Safety net that converts numpy scalars/arrays if any slip through."""
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, np.ndarray):
        return value.tolist()
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serialisable")


# ---------------------------------------------------------------------------
# CLI / demo
# ---------------------------------------------------------------------------
def _configure_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    )


def _print_demo(result: Dict[str, Any]) -> None:
    """Pretty-print the demo complaints exactly as the brief requires."""
    print("\n" + "=" * 78)
    print("STUDENT 2 — INTELLIGENCE ENGINE DEMO")
    print("=" * 78)
    demo_ids = {item["complaint_id"] for item in DEMO_COMPLAINTS}
    demos = [item for item in result["analyzed_complaints"] if item["complaint_id"] in demo_ids]

    # Deduplicate on the first demo definition order.
    order = {item["complaint_id"]: i for i, item in enumerate(DEMO_COMPLAINTS)}
    demos.sort(key=lambda item: order.get(item["complaint_id"], 99))

    for item in demos:
        vector = item.get("embedding") or []
        preview = ", ".join(f"{value:+.3f}" for value in vector[:5])
        print(f"\ncomplaint_id : {item['complaint_id']}")
        print(f"  raw           -> {next(c['text'] for c in DEMO_COMPLAINTS if c['complaint_id'] == item['complaint_id'])}")
        print(f"  clean_text    -> {item['clean_text']}")
        print(f"  issue_type    -> {item['issue_type']}")
        print(f"  sentiment     -> {item['sentiment']}")
        print(f"  severity      -> {item['severity']}")
        print(f"  embedding     -> dim={len(vector)} [{preview}, ...]")
        print(f"  cluster       -> {item['cluster']} (id={item['cluster_id']})")
        print(f"  created_at    -> {item['created_at']}")

    print("\n" + "-" * 78)
    print(f"Embedding backend : {result['metadata']['embedding_backend']}")
    print(f"Clustering backend: {result['metadata']['clustering_backend']}")
    print(f"Sentiment backend : {result['metadata']['sentiment_backend']}")
    print(f"Complaints        : {result['metadata']['processed_complaints']}")
    print(f"Periods analyzed  : {result['metadata']['periods_analyzed']}")

    print("\nTRENDS")
    print(f"{'cluster_name':<28}{'count':>7}{'prev':>7}{'growth %':>10}")
    for trend in result["trends"]:
        print(
            f"{str(trend['cluster_name']):<28}{trend['count']:>7}"
            f"{trend['previous_count']:>7}{trend['growth_percent']:>10}"
        )

    print("\nEMERGING ISSUES")
    if not result["emerging_issues"]:
        print("  (none above the configured threshold)")
    for issue in result["emerging_issues"]:
        print(f"  - {issue['cluster_name']}: {issue['growth_percent']}% growth "
              f"({issue['previous_count']} -> {issue['current_count']})")

    if result["diagnostics"]["warnings"]:
        print("\nDIAGNOSTIC WARNINGS")
        for warning in result["diagnostics"]["warnings"][:10]:
            print(f"  ! {warning}")
    if result["diagnostics"]["errors"]:
        print("\nDIAGNOSTIC ERRORS")
        for error in result["diagnostics"]["errors"]:
            print(f"  x {error}")
    print("=" * 78 + "\n")


def main(argv: Optional[Sequence[str]] = None) -> int:
    """Command-line entry point. Returns a process exit code."""
    parser = argparse.ArgumentParser(description="Student 2 — RESOLVE IQ Intelligence Engine")
    parser.add_argument("--file", default=None, help="Path to complaints JSON (default: data/complaints.json)")
    parser.add_argument("--output", default=None, help="Where to write the JSON output")
    parser.add_argument("--demo-only", action="store_true", help="Run only the 3 demo complaints")
    parser.add_argument("--no-embeddings", action="store_true", help="Omit vectors from the output")
    parser.add_argument("--growth-threshold", type=float, default=DEFAULT_EMERGING_GROWTH_THRESHOLD)
    parser.add_argument("--min-count", type=int, default=DEFAULT_EMERGING_MIN_COUNT)
    parser.add_argument("-v", "--verbose", action="store_true", help="Debug logging")
    args = parser.parse_args(argv)

    _configure_logging(args.verbose)

    complaints: List[Dict[str, Any]] = list(DEMO_COMPLAINTS)
    if not args.demo_only:
        try:
            complaints += load_complaints(args.file)
        except (FileNotFoundError, ValueError) as exc:
            logger.warning("Could not load dataset (%s). Continuing with the demo complaints only.", exc)

    try:
        result = analyze_complaints(
            complaints,
            emerging_growth_threshold=args.growth_threshold,
            emerging_min_count=args.min_count,
            include_embeddings=not args.no_embeddings,
        )
    except InvalidComplaintError as exc:
        logger.error("Invalid input: %s", exc)
        return 2

    # Prove the contract: the output must be JSON-serialisable.
    try:
        json.dumps(result, allow_nan=False)
    except (TypeError, ValueError) as exc:  # pragma: no cover - defensive
        logger.error("Output is not JSON-serialisable: %s", exc)
        return 3

    _print_demo(result)

    if args.output:
        save_output(result, args.output)
        print(f"Saved structured intelligence to {args.output}")

    if not result["analyzed_complaints"]:
        logger.warning("No complaints were processed.")
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
