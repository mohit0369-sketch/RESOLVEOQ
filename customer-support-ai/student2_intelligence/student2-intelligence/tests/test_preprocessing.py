"""Tests for preprocessing.clean_text()."""
from __future__ import annotations

import pytest

from preprocessing import clean_text


def test_normal_text_is_preserved() -> None:
    assert clean_text("my order is damaged") == "my order is damaged"


def test_uppercase_is_lowercased() -> None:
    assert clean_text("MY ORDER IS DAMAGED") == "my order is damaged"


def test_punctuation_is_removed() -> None:
    assert clean_text("My ORDER is DAMAGED!!! ") == "my order is damaged"


def test_multiple_spaces_are_collapsed() -> None:
    assert clean_text("package    has   not  arrived") == "package has not arrived"


def test_newlines_and_tabs_are_collapsed() -> None:
    assert clean_text("damaged\n\titem   here") == "damaged item here"


def test_empty_string_returns_empty_string() -> None:
    assert clean_text("") == ""


def test_none_returns_empty_string() -> None:
    assert clean_text(None) == ""


def test_whitespace_only_returns_empty_string() -> None:
    assert clean_text("   \t \n ") == ""


def test_in_word_apostrophe_is_preserved_for_negation() -> None:
    assert clean_text("Package   hasn't   arrived...") == "package hasn't arrived"


def test_curly_apostrophe_is_normalised() -> None:
    # U+2019 (right single quotation mark) must behave like ASCII '
    assert clean_text("It\u2019s broken") == "it's broken"


def test_edge_apostrophes_are_removed() -> None:
    assert clean_text("'broken' laptop") == "broken laptop"


def test_words_are_not_glued_together() -> None:
    assert clean_text("damaged.Item") == "damaged item"


def test_negation_words_survive() -> None:
    result = clean_text("I did NOT receive my refund!")
    assert "not" in result and "refund" in result


def test_non_string_input_is_coerced_safely() -> None:
    assert clean_text(12345) == "12345"


def test_function_is_idempotent() -> None:
    once = clean_text("My ORDER is DAMAGED!!! ")
    assert clean_text(once) == once


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("Item   MISSING?", "item missing"),
        ("PAYMENT failed!!", "payment failed"),
        ("Refund   please...", "refund please"),
    ],
)
def test_parametrised_cases(raw: str, expected: str) -> None:
    assert clean_text(raw) == expected
