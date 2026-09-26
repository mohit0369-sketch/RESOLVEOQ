"""Sentiment analysis for the Student 2 Intelligence Engine.

Primary backend: VADER (``vaderSentiment``) — a lightweight, lexicon + rule based
sentiment model that needs no GPU, no training data and no network access at
inference time, which makes it ideal for a hackathon demo.

Fallback backend: a small built-in lexicon analyser with basic negation
handling. It is only used when ``vaderSentiment`` is not installed, so that the
pipeline still runs (the fallback is logged at WARNING level and reported in the
output diagnostics). It is deliberately conservative and documented as a
degraded mode.

Both backends are isolated behind :func:`analyze_sentiment`, so a transformer
sentiment model can later replace them without touching other modules.
"""
from __future__ import annotations

import logging
import re
import threading
from typing import Any, Final, Optional

__all__ = [
    "analyze_sentiment",
    "sentiment_score",
    "sentiment_backend",
    "SENTIMENTS",
    "POSITIVE",
    "NEUTRAL",
    "NEGATIVE",
]

logger = logging.getLogger(__name__)

POSITIVE: Final[str] = "Positive"
NEUTRAL: Final[str] = "Neutral"
NEGATIVE: Final[str] = "Negative"

#: The complete, ordered set of allowed ``sentiment`` values (contract).
SENTIMENTS: Final[tuple[str, ...]] = (POSITIVE, NEUTRAL, NEGATIVE)

#: VADER compound score thresholds (the library's own recommended convention).
POSITIVE_THRESHOLD: Final[float] = 0.05
NEGATIVE_THRESHOLD: Final[float] = -0.05

_TOKEN_RE = re.compile(r"[a-z']+")
_NEGATORS = {"not", "no", "never", "cannot", "can't", "don't", "didn't", "won't", "isn't", "wasn't", "hasn't", "haven't", "without"}

# Minimal fallback lexicon. Only used when VADER is unavailable.
_FALLBACK_LEXICON: Final[dict[str, float]] = {
    "damaged": -2.0, "broken": -2.0, "cracked": -1.8, "defective": -2.0,
    "faulty": -2.0, "smashed": -2.2, "scratches": -1.2, "missing": -1.6,
    "wrong": -1.6, "late": -1.4, "delayed": -1.5, "fail": -1.8, "failed": -1.8,
    "problem": -1.4, "issue": -1.0, "worst": -3.0, "terrible": -2.6,
    "awful": -2.6, "angry": -2.4, "frustrated": -2.2, "disappointed": -2.2,
    "refund": -0.8, "waiting": -0.9, "locked": -1.4, "refused": -1.8,
    "unacceptable": -2.4, "useless": -2.2, "poor": -1.8, "bad": -1.6,
    "happy": 2.0, "great": 2.4, "excellent": 2.6, "good": 1.8, "thanks": 1.4,
    "thank": 1.4, "helpful": 2.0, "fast": 1.2, "quickly": 1.2, "resolved": 1.6,
    "perfect": 2.6, "love": 2.4, "amazing": 2.8, "satisfied": 2.0,
    "friendly": 1.8, "recommend": 1.8, "smooth": 1.4, "awesome": 2.6,
}

_lock = threading.Lock()
_vader_analyzer: Any = None
_vader_loaded = False
_fallback_used = False


def _get_vader_analyzer() -> Optional[Any]:
    """Lazily create and cache the VADER analyzer (module-level singleton)."""
    global _vader_analyzer, _vader_loaded
    if _vader_loaded:
        return _vader_analyzer
    with _lock:
        if not _vader_loaded:
            try:
                from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

                _vader_analyzer = SentimentIntensityAnalyzer()
                logger.debug("VADER sentiment analyzer loaded.")
            except Exception as exc:  # pragma: no cover - environment dependent
                logger.warning(
                    "vaderSentiment is unavailable (%s). Falling back to the "
                    "built-in lexicon analyser (degraded mode).", exc,
                )
                _vader_analyzer = None
            _vader_loaded = True
    return _vader_analyzer


def _fallback_score(text: str) -> float:
    """Very small lexicon + negation analyser used only if VADER is missing."""
    global _fallback_used
    _fallback_used = True
    tokens = _TOKEN_RE.findall(text.lower())
    if not tokens:
        return 0.0
    total = 0.0
    for i, token in enumerate(tokens):
        value = _FALLBACK_LEXICON.get(token)
        if value is None:
            continue
        window = tokens[max(0, i - 3):i]
        if any(neg in _NEGATORS for neg in window):
            value = -value
        total += value
    return max(-1.0, min(1.0, total / (len(tokens) ** 0.5 or 1)))


def sentiment_score(text: Optional[Any]) -> float:
    """Return the raw compound sentiment score in ``[-1.0, 1.0]``.

    Args:
        text: Complaint text. ``None`` / empty input scores ``0.0``.

    Returns:
        Compound score where ``-1`` is maximally negative and ``+1`` maximally
        positive.
    """
    if text is None:
        return 0.0
    text = text if isinstance(text, str) else str(text)
    if not text.strip():
        return 0.0

    analyzer = _get_vader_analyzer()
    if analyzer is None:
        return _fallback_score(text)
    return float(analyzer.polarity_scores(text)["compound"])


def analyze_sentiment(text: Optional[Any]) -> str:
    """Classify complaint text as ``Positive``, ``Neutral`` or ``Negative``.

    Args:
        text: Raw or preprocessed complaint text. ``None`` / empty input is
            handled safely and returns ``Neutral``.

    Returns:
        One of :data:`SENTIMENTS`.

    Examples:
        >>> analyze_sentiment("Customer service was helpful and resolved my issue")
        'Positive'
        >>> analyze_sentiment("I have a question about my order")
        'Neutral'
        >>> analyze_sentiment("My headphones arrived broken, this is terrible")
        'Negative'
    """
    score = sentiment_score(text)
    if score >= POSITIVE_THRESHOLD:
        return POSITIVE
    if score <= NEGATIVE_THRESHOLD:
        return NEGATIVE
    return NEUTRAL


def sentiment_backend() -> str:
    """Return the name of the sentiment backend actually in use."""
    return "vader" if _get_vader_analyzer() is not None else "fallback-lexicon"
