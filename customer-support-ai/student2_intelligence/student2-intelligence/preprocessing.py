"""Text preprocessing for the Student 2 Intelligence Engine.

This module contains the *first* stage of the complaint intelligence pipeline:
turning a raw customer complaint string into a canonical, comparable form that
every downstream stage (classification, sentiment, embeddings) can rely on.

Design goal: be aggressive enough to remove noise (casing, punctuation,
duplicated whitespace) but conservative enough to never destroy meaning that a
later stage depends on (negations such as ``hasn't``, quantifiers such as
``twice``, numeric sizes such as ``size 42``).
"""
from __future__ import annotations

import re
from typing import Any, Optional

__all__ = ["clean_text"]

# Collapse any run of whitespace (spaces, tabs, newlines) into a single space.
_WHITESPACE_RE = re.compile(r"\s+")

# Everything that is NOT a lowercase letter, a digit, an apostrophe or
# whitespace becomes a space. Replacing (instead of deleting) prevents words
# from being glued together, e.g. "damaged.Item" -> "damaged item".
_UNWANTED_RE = re.compile(r"[^0-9a-z'\s]+")

# Apostrophes that are not *inside* a word are noise (e.g. ``'broken'`` -> ``broken``)
# while in-word apostrophes are kept so negations survive (``hasn't``).
_EDGE_APOSTROPHE_RE = re.compile(r"(?:^|\s)'+|'+(?=\s|$)")


def clean_text(text: Optional[Any]) -> str:
    """Normalise raw complaint text.

    Transformations applied, in order:

    1. ``None`` / non-string input is handled safely (``None`` -> ``""``).
    2. Case folding to lowercase (``"DAMAGED"`` -> ``"damaged"``).
    3. Unicode curly apostrophes are normalised to the ASCII form.
    4. Punctuation and symbols are replaced by a single space, so
       ``"ORDER is DAMAGED!!!"`` -> ``"order is damaged"``.
    5. Apostrophes at word edges are removed but in-word apostrophes are kept,
       preserving negations (``"hasn't arrived"``).
    6. Whitespace runs are collapsed and the result is stripped.

    Args:
        text: Raw complaint text. May be ``None`` or any non-string value.

    Returns:
        A normalised, lowercase, single-spaced string. Returns ``""`` for
        ``None``, empty input, or input that contains no alphanumeric content.

    Examples:
        >>> clean_text("My ORDER is DAMAGED!!! ")
        'my order is damaged'
        >>> clean_text(None)
        ''
        >>> clean_text("Package   hasn't   arrived...")
        "package hasn't arrived"
    """
    if text is None:
        return ""
    if not isinstance(text, str):
        # Be forgiving: integers, etc. are coerced rather than raising.
        text = str(text)

    lowered = text.lower().replace("\u2019", "'")
    spaced = _UNWANTED_RE.sub(" ", lowered)
    spaced = _EDGE_APOSTROPHE_RE.sub(" ", spaced)
    collapsed = _WHITESPACE_RE.sub(" ", spaced)
    return collapsed.strip()
