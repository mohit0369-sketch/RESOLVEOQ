"""Trend and emerging-issue detection for the Student 2 Intelligence Engine.

Time model
----------
Complaints are grouped by *calendar month* of ``created_at``. The most recent
month present in the dataset is the **current period**; the month before it is
the **previous period**. This keeps the definition of "trend" explicit and
auditable, and avoids the "rolling 30 days" ambiguity during a demo where all
synthetic data falls inside two months.

Records whose ``created_at`` cannot be parsed (or is missing) are excluded from
trend arithmetic only — they still appear in ``analyzed_complaints``. Their
count is reported in the output diagnostics.

Growth formula
--------------
    growth_percent = ((current - previous) / previous) * 100

Division-by-zero policy (documented, single source of truth):
    * previous == 0 and current == 0 -> 0.0
    * previous == 0 and current  > 0 -> 100.0  (a brand-new problem; treated as
      100% growth so it is always surfaced rather than hidden as "infinite")
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import pandas as pd

from clustering import NOISE_NAME

__all__ = [
    "DEFAULT_EMERGING_GROWTH_THRESHOLD",
    "DEFAULT_EMERGING_MIN_COUNT",
    "compute_growth",
    "compute_period_counts",
    "detect_emerging_issues",
    "detect_trends",
    "split_by_period",
]

logger = logging.getLogger(__name__)

#: Minimum growth (%) for an issue to be flagged as emerging. Single source of truth.
DEFAULT_EMERGING_GROWTH_THRESHOLD: float = 25.0

#: Minimum number of complaints in the current period to be flagged as emerging.
DEFAULT_EMERGING_MIN_COUNT: int = 3

DATE_KEY = "created_at"


def _as_date(series: pd.Series) -> pd.Series:
    """Coerce a column to datetimes, invalid values become NaT (never raises)."""
    return pd.to_datetime(series, errors="coerce", format="mixed")


def split_by_period(
    records: Sequence[Dict[str, Any]],
    date_key: str = DATE_KEY,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Split records into ``(previous_period, current_period)`` by calendar month.

    Args:
        records: Complaint dicts containing ``date_key``.
        date_key: Name of the date field (default ``"created_at"``).

    Returns:
        ``(previous, current)``. ``previous`` is empty when the dataset spans
        only one month or when no date is parseable.
    """
    if not records:
        return [], []

    dates = _as_date(pd.Series([record.get(date_key) for record in records], dtype="object"))
    valid = dates.dropna()
    if valid.empty:
        logger.warning("No parseable '%s' values found; trend analysis will be empty.", date_key)
        return [], []

    periods = sorted({(int(ts.year), int(ts.month)) for ts in valid})
    current_key = periods[-1]
    previous_key = periods[-2] if len(periods) >= 2 else None

    previous: List[Dict[str, Any]] = []
    current: List[Dict[str, Any]] = []
    for record, timestamp in zip(records, dates):
        if pd.isna(timestamp):
            continue
        key = (int(timestamp.year), int(timestamp.month))
        if key == current_key:
            current.append(record)
        elif previous_key is not None and key == previous_key:
            previous.append(record)

    logger.debug(
        "Periods detected: previous=%s (%d records), current=%s (%d records).",
        previous_key, len(previous), current_key, len(current),
    )
    return previous, current


def _resolve_label_key(records: Sequence[Dict[str, Any]], label_key: str) -> str:
    """Decide which field to trend on.

    ``"auto"`` uses the semantic ``cluster`` name when at least two meaningful
    clusters exist (that is the value of clustering), otherwise it falls back to
    the classifier's ``issue_type`` so trends are never empty.
    """
    if label_key and label_key != "auto":
        return label_key
    clusters = {r.get("cluster") for r in records if r.get("cluster")}
    meaningful = {c for c in clusters if c and c != NOISE_NAME}
    return "cluster" if len(meaningful) >= 2 else "issue_type"


def _label_of(record: Dict[str, Any], label_key: str) -> str:
    value = record.get(label_key)
    if value is None or (isinstance(value, str) and not value.strip()):
        return "Unknown"
    return str(value)


def compute_period_counts(
    records: Sequence[Dict[str, Any]],
    label_key: str = "auto",
) -> Dict[str, int]:
    """Count records per cluster/category inside one period.

    Args:
        records: Records from a single period.
        label_key: ``"cluster"``, ``"issue_type"`` or ``"auto"``.

    Returns:
        ``{label: count}``, empty for empty input.
    """
    if not records:
        return {}
    key = _resolve_label_key(records, label_key)
    frame = pd.DataFrame({"label": [_label_of(record, key) for record in records]})
    return {str(label): int(count) for label, count in frame["label"].value_counts().items()}


def compute_growth(previous: Optional[int], current: Optional[int]) -> float:
    """Return the period-over-period growth in percent, rounded to 1 decimal.

    Args:
        previous: Count in the previous period (``None`` treated as 0).
        current: Count in the current period (``None`` treated as 0).

    Returns:
        ``((current - previous) / previous) * 100``, with the documented
        zero-division policy (previous==0 -> 0.0 or 100.0).

    Examples:
        >>> compute_growth(15, 25)
        66.7
        >>> compute_growth(0, 0)
        0.0
        >>> compute_growth(0, 4)
        100.0
        >>> compute_growth(10, 5)
        -50.0
    """
    previous_count = int(previous or 0)
    current_count = int(current or 0)

    if previous_count == 0:
        return 0.0 if current_count == 0 else 100.0

    return round((current_count - previous_count) / previous_count * 100.0, 1)


def detect_trends(
    analyzed_complaints: Sequence[Dict[str, Any]],
    label_key: str = "auto",
    date_key: str = DATE_KEY,
) -> List[Dict[str, Any]]:
    """Compute per-issue trend information for the analyzed complaints.

    Args:
        analyzed_complaints: Output records of :func:`main.analyze_complaints`.
        label_key: ``"auto"`` (default), ``"cluster"`` or ``"issue_type"``.
        date_key: Date field used for the period split.

    Returns:
        List of trend dicts sorted by current volume (descending):
        ``{"cluster_name", "count", "previous_count", "current_count", "growth_percent"}``.
        Empty list when there is nothing to trend.
    """
    previous, current = split_by_period(analyzed_complaints, date_key=date_key)
    if not current and not previous:
        return []

    resolved_key = _resolve_label_key(list(current) + list(previous), label_key)
    previous_counts = compute_period_counts(previous, resolved_key)
    current_counts = compute_period_counts(current, resolved_key)

    all_labels = set(previous_counts) | set(current_counts)
    trends: List[Dict[str, Any]] = []
    for label in all_labels:
        current_count = int(current_counts.get(label, 0))
        previous_count = int(previous_counts.get(label, 0))
        trends.append(
            {
                "cluster_name": label,
                "count": current_count,
                "previous_count": previous_count,
                "current_count": current_count,
                "growth_percent": compute_growth(previous_count, current_count),
            }
        )

    trends.sort(key=lambda item: (-item["count"], item["cluster_name"]))
    return trends


def detect_emerging_issues(
    trends: Sequence[Dict[str, Any]],
    growth_threshold: float = DEFAULT_EMERGING_GROWTH_THRESHOLD,
    min_count: int = DEFAULT_EMERGING_MIN_COUNT,
) -> List[Dict[str, Any]]:
    """Flag issues whose volume grows beyond the configured threshold.

    An issue is *emerging* when **both** conditions hold:

    * ``growth_percent >= growth_threshold`` (default 25%), and
    * ``current_count >= min_count`` (default 3) — this prevents one-off
      complaints from being reported as a trend.

    Args:
        trends: Output of :func:`detect_trends`.
        growth_threshold: Growth percentage threshold (configurable, never hard-coded elsewhere).
        min_count: Minimum current-period volume.

    Returns:
        List of emerging-issue dicts (trend fields plus a human-readable
        ``reason``), sorted by growth descending.
    """
    emerging: List[Dict[str, Any]] = []
    for trend in trends or []:
        growth = float(trend.get("growth_percent", 0.0))
        current_count = int(trend.get("current_count", trend.get("count", 0)) or 0)
        previous_count = int(trend.get("previous_count", 0) or 0)
        if current_count < min_count or growth < growth_threshold:
            continue
        emerging.append(
            {
                "cluster_name": trend.get("cluster_name"),
                "count": current_count,
                "previous_count": previous_count,
                "current_count": current_count,
                "growth_percent": round(growth, 1),
                "growth_threshold": float(growth_threshold),
                "reason": (
                    f"Volume grew {round(growth, 1)}% ({previous_count} → {current_count}) in the "
                    f"current period, exceeding the {float(growth_threshold)}% threshold with at "
                    f"least {int(min_count)} complaints."
                ),
            }
        )

    emerging.sort(key=lambda item: (-item["growth_percent"], -item["current_count"], str(item["cluster_name"])))
    return emerging
