"""Deterministic, rule-based complaint classification (Student 2, layer 1).

Why rules first?
    The first intelligence layer must be transparent, testable and explainable in
    a live demo. A keyword/weight rule engine gives a deterministic answer and a
    readable reason, with zero training data and zero API calls.

The category labels below are a *contract* with Student 1 (backend), Student 3
(AI agent) and Student 4 (dashboard) and must not be renamed silently.

Replacement path:
    :func:`classify` is intentionally isolated and dependency-free. An ML or LLM
    classifier can later be dropped in behind the same signature
    (``text -> category``) without touching any other module.
"""
from __future__ import annotations

import re
from typing import Any, Dict, Final, Optional, Tuple

__all__ = [
    "ISSUE_TYPES",
    "CATEGORY_RULES",
    "CATEGORY_PRIORITY",
    "DEFAULT_ISSUE_TYPE",
    "classify",
    "score_categories",
]

#: The complete, ordered set of allowed ``issue_type`` values.
ISSUE_TYPES: Final[Tuple[str, ...]] = (
    "Damaged Product",
    "Late Delivery",
    "Refund",
    "Payment Problem",
    "Wrong Product",
    "Missing Product",
    "Account Problem",
    "Other",
)

DEFAULT_ISSUE_TYPE: Final[str] = "Other"

# ---------------------------------------------------------------------------
# Rule table: category -> {keyword/phrase: weight}
#
# Weight meaning:
#   4 -> unambiguous, category-defining phrase
#   3 -> strong signal
#   2 -> moderate signal / contextual word
#   1 -> weak signal, only relevant when nothing stronger matched
# ---------------------------------------------------------------------------
CATEGORY_RULES: Final[Dict[str, Dict[str, int]]] = {
    "Payment Problem": {
        "payment failed": 4,
        "money was deducted": 4,
        "charged twice": 4,
        "double charged": 4,
        "card was charged": 3,
        "bank account was debited": 3,
        "debited": 3,
        "charged but": 2,
        "payment went through": 3,
        "payment": 1,
        "charged": 1,
        "deducted": 2,
    },
    "Refund": {
        "refund": 4,
        "money back": 4,
        "reimburse": 3,
        "return the item": 2,
        "returned": 2,
    },
    "Wrong Product": {
        "wrong item": 4,
        "wrong product": 4,
        "wrong size": 4,
        "wrong color": 3,
        "wrong model": 3,
        "not what i ordered": 4,
        "different item": 3,
        "wrong": 1,
    },
    "Missing Product": {
        "missing": 4,
        "missing from": 3,
        "incomplete": 3,
        "only received": 3,
        "part of my order": 3,
        "one of the two items": 3,
        "not in the box": 2,
    },
    "Damaged Product": {
        "arrived damaged": 4,
        "arrived broken": 4,
        "damaged": 3,
        "broken": 3,
        "cracked": 3,
        "defective": 3,
        "faulty": 3,
        "smashed": 3,
        "scratches": 2,
        "stopped working": 3,
        "not working": 2,
        "does not work": 2,
    },
    "Late Delivery": {
        "hasn't arrived": 4,
        "haven't arrived": 4,
        "hasn't been delivered": 4,
        "not yet arrived": 4,
        "not arrived": 4,
        "delayed": 3,
        "delay": 2,
        "late": 2,
        "still waiting": 3,
        "waiting for my order": 3,
        "no update": 2,
        "supposed to arrive": 2,
    },
    "Account Problem": {
        "account was locked": 4,
        "locked out": 4,
        "password reset": 4,
        "cannot log": 3,
        "can't log": 3,
        "log into": 3,
        "log in": 3,
        "sign in": 3,
        "login": 3,
        "account details": 3,
        "unable to update my account": 3,
        "password": 2,
        "profile": 2,
        "account": 1,
    },
}

#: Tie-break order. When two categories reach the same score, the category that
#: appears first here wins. Business impact first, cosmetic issues last.
CATEGORY_PRIORITY: Final[Tuple[str, ...]] = (
    "Payment Problem",
    "Refund",
    "Wrong Product",
    "Missing Product",
    "Damaged Product",
    "Late Delivery",
    "Account Problem",
    DEFAULT_ISSUE_TYPE,
)

_PRIORITY_INDEX: Final[Dict[str, int]] = {c: i for i, c in enumerate(CATEGORY_PRIORITY)}
_COMPILED_RULES: Dict[str, Dict[str, Tuple[int, "re.Pattern[str]"]]] = {}


def _compile_rules() -> Dict[str, Dict[str, Tuple[int, "re.Pattern[str]"]]]:
    """Compile every rule keyword once into a word-boundary regex."""
    if _COMPILED_RULES:
        return _COMPILED_RULES
    for category, rules in CATEGORY_RULES.items():
        _COMPILED_RULES[category] = {
            keyword: (
                weight,
                re.compile(rf"(?<!\w){re.escape(keyword)}(?!\w)"),
            )
            for keyword, weight in rules.items()
        }
    return _COMPILED_RULES


def _normalise(text: Optional[Any]) -> str:
    """Lowercase without importing preprocessing (keeps this module pure)."""
    if text is None:
        return ""
    return text.lower() if isinstance(text, str) else str(text).lower()


def score_categories(text: Optional[Any]) -> Dict[str, int]:
    """Score the text against every category and return the full score map.

    Exposed (not private) so that tests, the AI agent and demo tooling can show
    *why* a complaint was classified the way it was.

    Args:
        text: Complaint text (raw or preprocessed).

    Returns:
        Mapping ``category -> score`` including zero scores.
    """
    lowered = _normalise(text)
    scores: Dict[str, int] = {category: 0 for category in ISSUE_TYPES}
    if not lowered.strip():
        return scores

    for category, rules in _compile_rules().items():
        total = 0
        for weight, pattern in rules.values():
            if pattern.search(lowered):
                total += weight
        scores[category] = total
    return scores


def classify(text: Optional[Any]) -> str:
    """Classify a complaint into exactly one of :data:`ISSUE_TYPES`.

    The decision is fully deterministic:

    1. Score the text against every category (weighted keyword matching).
    2. The highest score wins.
    3. Ties are broken by :data:`CATEGORY_PRIORITY`.
    4. No match at all -> ``"Other"``.

    Args:
        text: Raw or preprocessed complaint text. ``None`` / empty input is
            handled safely and classified as ``"Other"``.

    Returns:
        The category name, always a member of :data:`ISSUE_TYPES`.

    Examples:
        >>> classify("my product is broken")
        'Damaged Product'
        >>> classify("I want my money back")
        'Refund'
        >>> classify("my package hasn't arrived")
        'Late Delivery'
        >>> classify("payment failed but money was deducted")
        'Payment Problem'
        >>> classify("you sent the wrong item")
        'Wrong Product'
    """
    scores = score_categories(text)
    best_score = max(scores.values())
    if best_score <= 0:
        return DEFAULT_ISSUE_TYPE

    winners = [c for c, s in scores.items() if s == best_score]
    winners.sort(key=lambda c: _PRIORITY_INDEX.get(c, len(_PRIORITY_INDEX)))
    return winners[0]
