"""Tests for classification.classify() and score_categories()."""
from __future__ import annotations

import pytest

from classification import (
    CATEGORY_PRIORITY,
    DEFAULT_ISSUE_TYPE,
    ISSUE_TYPES,
    classify,
    score_categories,
)


def test_damaged_product() -> None:
    assert classify("my product is broken") == "Damaged Product"


def test_damaged_product_variant() -> None:
    assert classify("My headphones arrived damaged") == "Damaged Product"


def test_late_delivery() -> None:
    assert classify("my package hasn't arrived") == "Late Delivery"


def test_refund() -> None:
    assert classify("I want my money back") == "Refund"


def test_payment_problem() -> None:
    assert classify("payment failed but money was deducted") == "Payment Problem"


def test_wrong_product() -> None:
    assert classify("you sent the wrong item") == "Wrong Product"


def test_missing_product() -> None:
    assert classify("an item is missing from my package") == "Missing Product"


def test_account_problem() -> None:
    assert classify("I cannot log into my account") == "Account Problem"


def test_other_for_unmatched_text() -> None:
    assert classify("hello, just saying hi") == DEFAULT_ISSUE_TYPE


def test_output_is_always_a_valid_category() -> None:
    for text in ["broken", "late", "refund", "payment", "wrong", "missing", "account", "???", ""]:
        assert classify(text) in ISSUE_TYPES


@pytest.mark.parametrize(
    "text,expected",
    [
        ("the laptop arrived cracked", "Damaged Product"),
        ("my order is delayed by two weeks", "Late Delivery"),
        ("please process my refund", "Refund"),
        ("I was charged twice", "Payment Problem"),
        ("wrong size delivered", "Wrong Product"),
        ("my order is incomplete", "Missing Product"),
        ("I am locked out of my account", "Account Problem"),
        ("I need an invoice", "Other"),
    ],
)
def test_every_category_is_reachable(text: str, expected: str) -> None:
    assert classify(text) == expected


def test_none_and_empty_are_safe() -> None:
    assert classify(None) == DEFAULT_ISSUE_TYPE
    assert classify("") == DEFAULT_ISSUE_TYPE
    assert classify("    ") == DEFAULT_ISSUE_TYPE


def test_priority_breaks_ties_transparently() -> None:
    # Both "refund" (Refund) and "payment" (Payment Problem) appear; the priority
    # order must decide deterministically, not randomly.
    text = "payment failed and I want a refund"
    scores = score_categories(text)
    result = classify(text)
    assert result in {"Refund", "Payment Problem"}
    # The winner must actually be the highest-scoring, then highest-priority, category.
    best = max(scores.values())
    winners = {c for c, s in scores.items() if s == best}
    expected = sorted(winners, key=lambda c: CATEGORY_PRIORITY.index(c))[0]
    assert result == expected


def test_classification_is_deterministic() -> None:
    text = "my headphones arrived broken and I want my money back"
    assert len({classify(text) for _ in range(10)}) == 1


def test_scores_expose_all_categories() -> None:
    scores = score_categories("broken item")
    assert set(scores) == set(ISSUE_TYPES)
    assert scores["Damaged Product"] > 0
    assert scores["Account Problem"] == 0
