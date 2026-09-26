"""Tests for trends.py — growth maths, period split and emerging-issue detection.

These tests are pure-arithmetic and always run (no model needed).
"""
from __future__ import annotations

import pytest

from trends import (
    DEFAULT_EMERGING_GROWTH_THRESHOLD,
    DEFAULT_EMERGING_MIN_COUNT,
    compute_growth,
    compute_period_counts,
    detect_emerging_issues,
    detect_trends,
    split_by_period,
)


# --------------------------------------------------------------------------
# Growth percentage
# --------------------------------------------------------------------------
def test_growth_matches_the_specified_example() -> None:
    # previous 15 -> current 25 == 66.7%
    assert compute_growth(15, 25) == 66.7


def test_growth_negative_when_volume_drops() -> None:
    assert compute_growth(10, 5) == -50.0


def test_growth_zero_when_both_zero() -> None:
    assert compute_growth(0, 0) == 0.0


def test_growth_zero_when_unchanged() -> None:
    assert compute_growth(7, 7) == 0.0


def test_growth_division_by_zero_is_handled() -> None:
    # A brand-new problem is reported as 100% growth, never as a crash/Infinity.
    assert compute_growth(0, 4) == 100.0


def test_growth_handles_none_inputs() -> None:
    assert compute_growth(None, None) == 0.0
    assert compute_growth(None, 3) == 100.0


# --------------------------------------------------------------------------
# Period splitting
# --------------------------------------------------------------------------
def test_split_by_period_separates_two_months() -> None:
    records = [
        {"created_at": "2026-08-05", "issue_type": "Refund"},
        {"created_at": "2026-09-05", "issue_type": "Refund"},
        {"created_at": "2026-09-20", "issue_type": "Late Delivery"},
    ]
    previous, current = split_by_period(records)
    assert len(previous) == 1
    assert len(current) == 2


def test_split_with_single_period_returns_empty_previous() -> None:
    records = [{"created_at": "2026-09-01"}, {"created_at": "2026-09-02"}]
    previous, current = split_by_period(records)
    assert previous == []
    assert len(current) == 2


def test_split_ignores_invalid_dates() -> None:
    records = [{"created_at": "not-a-date"}, {"created_at": "2026-09-02"}]
    previous, current = split_by_period(records)
    assert previous == []
    assert len(current) == 1


def test_split_empty_input() -> None:
    assert split_by_period([]) == ([], [])


# --------------------------------------------------------------------------
# Counting
# --------------------------------------------------------------------------
def test_compute_period_counts_group_by_cluster() -> None:
    records = [
        {"cluster": "Damaged Products"},
        {"cluster": "Damaged Products"},
        {"cluster": "Refund Problems"},
    ]
    assert compute_period_counts(records, "cluster") == {"Damaged Products": 2, "Refund Problems": 1}


def test_compute_period_counts_empty() -> None:
    assert compute_period_counts([], "cluster") == {}


# --------------------------------------------------------------------------
# Trend detection
# --------------------------------------------------------------------------
def _make_records(cluster: str, month: str, count: int) -> list[dict]:
    return [
        {"cluster": cluster, "issue_type": cluster, "created_at": f"{month}-{day:02d}"}
        for day in range(1, count + 1)
    ]


def test_detect_trends_reports_growth() -> None:
    records = _make_records("Damaged Products", "2026-08", 15) + _make_records("Damaged Products", "2026-09", 25)
    trends = detect_trends(records, label_key="cluster")
    damaged = next(t for t in trends if t["cluster_name"] == "Damaged Products")
    assert damaged["count"] == 25
    assert damaged["previous_count"] == 15
    assert damaged["growth_percent"] == 66.7


def test_detect_trends_sorted_by_current_volume() -> None:
    records = (
        _make_records("Late Delivery", "2026-09", 5)
        + _make_records("Payment Problems", "2026-09", 9)
        + _make_records("Refund Problems", "2026-08", 4)
    )
    trends = detect_trends(records, label_key="cluster")
    assert trends[0]["cluster_name"] == "Payment Problems"
    assert trends[0]["count"] == 9


def test_detect_trends_empty_for_no_records() -> None:
    assert detect_trends([], label_key="cluster") == []


def test_detect_trends_counts_new_issue_as_100_percent() -> None:
    records = _make_records("New Issue", "2026-09", 4)
    trends = detect_trends(records, label_key="cluster")
    assert trends[0]["previous_count"] == 0
    assert trends[0]["growth_percent"] == 100.0


# --------------------------------------------------------------------------
# Emerging issues
# --------------------------------------------------------------------------
def test_emerging_flagged_above_threshold() -> None:
    trends = [
        {"cluster_name": "Refund Problems", "count": 7, "previous_count": 5, "current_count": 7, "growth_percent": 40.0},
        {"cluster_name": "Others", "count": 4, "previous_count": 4, "current_count": 4, "growth_percent": 0.0},
    ]
    emerging = detect_emerging_issues(trends)
    assert [issue["cluster_name"] for issue in emerging] == ["Refund Problems"]
    assert "reason" in emerging[0]


def test_emerging_respects_min_count() -> None:
    trends = [
        # Huge growth but only 1 complaint -> not a trend.
        {"cluster_name": "Tiny Issue", "count": 1, "previous_count": 0, "current_count": 1, "growth_percent": 100.0}
    ]
    assert detect_emerging_issues(trends, growth_threshold=25.0, min_count=3) == []


def test_emerging_threshold_is_configurable() -> None:
    trends = [{"cluster_name": "X", "count": 5, "previous_count": 4, "current_count": 5, "growth_percent": 25.0}]
    assert detect_emerging_issues(trends, growth_threshold=25.0, min_count=3)
    assert detect_emerging_issues(trends, growth_threshold=50.0, min_count=3) == []


def test_emerging_sorted_by_growth_descending() -> None:
    trends = [
        {"cluster_name": "A", "count": 5, "previous_count": 1, "current_count": 5, "growth_percent": 400.0},
        {"cluster_name": "B", "count": 5, "previous_count": 4, "current_count": 5, "growth_percent": 25.0},
    ]
    emerging = detect_emerging_issues(trends, growth_threshold=25.0, min_count=3)
    assert [issue["cluster_name"] for issue in emerging] == ["A", "B"]


def test_emerging_defaults_are_single_source_of_truth() -> None:
    assert DEFAULT_EMERGING_GROWTH_THRESHOLD == 25.0
    assert DEFAULT_EMERGING_MIN_COUNT == 3


def test_emerging_empty_input() -> None:
    assert detect_emerging_issues([]) == []


@pytest.mark.parametrize(
    "previous,current,expected",
    [(0, 0, 0.0), (0, 5, 100.0), (5, 5, 0.0), (2, 3, 50.0), (3, 2, -33.3), (100, 150, 50.0)],
)
def test_growth_parametrised(previous: int, current: int, expected: float) -> None:
    assert compute_growth(previous, current) == expected
