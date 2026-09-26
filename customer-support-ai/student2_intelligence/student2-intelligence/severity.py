"""Severity scoring for the Student 2 Intelligence Engine.

IMPORTANT — these are PROJECT RULES, not a universal definition of how severe a
customer complaint is. They encode the escalation policy agreed for this
hackathon product and are intentionally kept in one place so the business can
tune them without touching pipeline code.

Initial policy:

    +--------------------------------+-------------+----------+
    | issue_type                     | sentiment   | severity |
    +--------------------------------+-------------+----------+
    | Refund                         | Negative    | High     |
    | Payment Problem                | Negative    | High     |
    | Damaged Product                | Negative    | High     |
    | Late Delivery                  | any         | Medium   |
    | everything else                | any         | Low      |
    +--------------------------------+-------------+----------+

Money-related and physical-damage complaints are treated as High because they
usually require a human follow-up. Pure delivery delays are Medium because they
resolve themselves over time. Everything else starts Low and can be escalated
later.

To extend the policy, edit :data:`HIGH_SEVERITY_ISSUE_TYPES`,
:data:`MEDIUM_SEVERITY_ISSUE_TYPES` or :data:`SEVERITY_RULES` only.
"""
from __future__ import annotations

from typing import Any, Final, FrozenSet, Mapping, Optional, Tuple

__all__ = [
    "SEVERITIES",
    "LOW",
    "MEDIUM",
    "HIGH",
    "HIGH_SEVERITY_ISSUE_TYPES",
    "MEDIUM_SEVERITY_ISSUE_TYPES",
    "determine_severity",
    "explain_severity",
]

LOW: Final[str] = "Low"
MEDIUM: Final[str] = "Medium"
HIGH: Final[str] = "High"

#: The complete, ordered set of allowed ``severity`` values (contract).
SEVERITIES: Final[Tuple[str, ...]] = (LOW, MEDIUM, HIGH)

#: Issues escalated to High — but only when the sentiment is Negative.
HIGH_SEVERITY_ISSUE_TYPES: Final[FrozenSet[str]] = frozenset(
    {"Refund", "Payment Problem", "Damaged Product"}
)

#: Issues escalated to Medium regardless of sentiment (project rule).
MEDIUM_SEVERITY_ISSUE_TYPES: Final[FrozenSet[str]] = frozenset({"Late Delivery"})

#: Sentiment value that triggers the High rule for :data:`HIGH_SEVERITY_ISSUE_TYPES`.
HIGH_SEVERITY_SENTIMENT: Final[str] = "Negative"

#: Read-only summary of the policy, useful for documentation and API responses.
SEVERITY_RULES: Final[Mapping[str, str]] = {
    "high": f"{HIGH_SEVERITY_SENTIMENT} sentiment AND issue_type in {sorted(HIGH_SEVERITY_ISSUE_TYPES)}",
    "medium": f"issue_type in {sorted(MEDIUM_SEVERITY_ISSUE_TYPES)}",
    "low": "default (no rule matched)",
}


def _normalise(value: Optional[Any]) -> str:
    if value is None:
        return ""
    return value.strip() if isinstance(value, str) else str(value).strip()


def determine_severity(
    text: Optional[Any],
    sentiment: Optional[Any],
    issue_type: Optional[Any],
) -> str:
    """Return the project severity (``Low`` / ``Medium`` / ``High``).

    The function is deterministic and side-effect free. ``text`` is accepted for
    signature stability and future rules (e.g. detecting explicit escalation
    phrases, legal threats, or repeat contacts) but is not used by the current
    policy.

    Args:
        text: The complaint text (reserved for future escalation keywords).
        sentiment: One of ``Positive`` / ``Neutral`` / ``Negative``.
            ``None`` is treated as unknown -> all rules fall through.
        issue_type: One of the classifier categories.

    Returns:
        One of :data:`SEVERITIES`.

    Examples:
        >>> determine_severity("I want my money back", "Negative", "Refund")
        'High'
        >>> determine_severity("where is my parcel", "Negative", "Late Delivery")
        'Medium'
        >>> determine_severity("nice service", "Positive", "Other")
        'Low'
    """
    sentiment_value = _normalise(sentiment)
    issue_value = _normalise(issue_type)
    # `text` intentionally unused by the current policy; kept for signature
    # stability so future rules can add escalation keywords without a breaking
    # API change.
    _ = _normalise(text)

    if (
        sentiment_value == HIGH_SEVERITY_SENTIMENT
        and issue_value in HIGH_SEVERITY_ISSUE_TYPES
    ):
        return HIGH

    if issue_value in MEDIUM_SEVERITY_ISSUE_TYPES:
        return MEDIUM

    return LOW


def explain_severity(sentiment: Optional[Any], issue_type: Optional[Any]) -> str:
    """Return a human-readable justification for the severity decision."""
    severity = determine_severity(None, sentiment, issue_type)
    if severity == HIGH:
        return f"{issue_type} + {sentiment} sentiment matches the project High-severity rule (money or damage involved)."
    if severity == MEDIUM:
        return f"{issue_type} is a project Medium-severity issue (delivery delay, self-resolving)."
    return f"No escalation rule matched for issue_type={issue_type!r} with {sentiment} sentiment."
