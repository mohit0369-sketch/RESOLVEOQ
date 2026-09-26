"""Tests for sentiment.analyze_sentiment()."""
from __future__ import annotations

import pytest

from sentiment import NEUTRAL, NEGATIVE, POSITIVE, SENTIMENTS, analyze_sentiment, sentiment_score


def test_obvious_positive() -> None:
    assert analyze_sentiment("Customer service was helpful and resolved my issue, thank you!") == POSITIVE


def test_obvious_negative() -> None:
    assert analyze_sentiment("My headphones arrived broken, this is terrible and unacceptable!") == NEGATIVE


def test_obvious_neutral() -> None:
    assert analyze_sentiment("I have a question about my order") == NEUTRAL


def test_empty_input_is_neutral() -> None:
    assert analyze_sentiment("") == NEUTRAL


def test_none_input_is_neutral() -> None:
    assert analyze_sentiment(None) == NEUTRAL


def test_whitespace_input_is_neutral() -> None:
    assert analyze_sentiment("     ") == NEUTRAL


def test_always_returns_contract_value() -> None:
    for text in ["great!", "awful", "ok", "", None, "12345"]:
        assert analyze_sentiment(text) in SENTIMENTS


def test_compound_score_range() -> None:
    for text in ["I love this", "I hate this", "", None, "question"]:
        score = sentiment_score(text)
        assert -1.0 <= score <= 1.0


def test_negative_score_is_negative() -> None:
    assert sentiment_score("This is a terrible broken disaster") < 0


def test_positive_score_is_positive() -> None:
    assert sentiment_score("Excellent service, very happy and helpful, thanks!") > 0


@pytest.mark.parametrize(
    "text,expected",
    [
        ("My order arrived damaged and it is useless", NEGATIVE),
        ("Delivery was fast and the product is great, thanks", POSITIVE),
        ("Where is my invoice", NEUTRAL),
    ],
)
def test_parametrised_examples(text: str, expected: str) -> None:
    assert analyze_sentiment(text) == expected
