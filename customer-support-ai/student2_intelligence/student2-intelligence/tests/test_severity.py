"""Tests for severity.determine_severity() — project rules, not universal truth."""
from __future__ import annotations

import pytest

from severity import HIGH, LOW, MEDIUM, SEVERITIES, determine_severity, explain_severity


@pytest.mark.parametrize("issue_type", ["Refund", "Payment Problem", "Damaged Product"])
def test_negative_with_high_severity_issue_is_high(issue_type: str) -> None:
    assert determine_severity("some text", "Negative", issue_type) == HIGH


def test_late_delivery_is_medium_regardless_of_sentiment() -> None:
    assert determine_severity("where is my parcel", "Negative", "Late Delivery") == MEDIUM
    assert determine_severity("it arrived, fine", "Positive", "Late Delivery") == MEDIUM


def test_unmatched_issue_is_low() -> None:
    assert determine_severity("hello", "Neutral", "Other") == LOW


def test_non_negative_refund_is_not_high() -> None:
    # The High rule requires Negative sentiment; a positive refund note is Low.
    assert determine_severity("refund received, thanks!", "Positive", "Refund") == LOW


def test_wrong_and_missing_product_are_low_by_default() -> None:
    assert determine_severity("wrong item", "Negative", "Wrong Product") == LOW
    assert determine_severity("missing item", "Negative", "Missing Product") == LOW


def test_account_problem_is_low_by_default() -> None:
    assert determine_severity("cannot log in", "Negative", "Account Problem") == LOW


def test_always_returns_contract_value() -> None:
    for sentiment in ["Positive", "Neutral", "Negative", None, ""]:
        for issue_type in ["Refund", "Late Delivery", "Other", None, "Unknown"]:
            assert determine_severity("text", sentiment, issue_type) in SEVERITIES


def test_none_inputs_are_safe() -> None:
    assert determine_severity(None, None, None) == LOW


def test_is_deterministic() -> None:
    results = {determine_severity("x", "Negative", "Refund") for _ in range(10)}
    assert results == {HIGH}


def test_explain_severity_returns_readable_text() -> None:
    assert "High" in explain_severity("Negative", "Refund")
    assert "Medium" in explain_severity("Negative", "Late Delivery")
    assert "No escalation" in explain_severity("Positive", "Other")
