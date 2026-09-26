"""Guardrails: validate any LLM output before it reaches the customer.

The deterministic decision is authoritative. The LLM may only restate verified
facts. Each guardrail returns a flag so downstream systems (Student 1 / 4) can
observe and audit what was corrected.

Checks implemented:
  * invalid / malformed JSON            -> fall back to the deterministic output
  * schema violation                    -> fall back to the deterministic output
  * fabricated refund claims            -> forced Human Review + escalation
  * fabricated action-completion claims -> message rewritten
  * unsupported action                  -> reverted to the deterministic action
  * inconsistent escalation flag        -> forced to the deterministic value
  * missing-information mismatch        -> merged with the deterministic list
  * internal-data leakage               -> message rewritten
  * over-long message                   -> truncated safely
"""

from __future__ import annotations

import logging
import re
from typing import Any

from pydantic import ValidationError

from schemas import DecisionResult, LlmOutput
from tools.policy_lookup import load_policy

logger = logging.getLogger(__name__)


def _guardrail_cfg(
    policy: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return (policy or load_policy()).get("guardrails", {})


def parse_llm_output(raw: str) -> LlmOutput | None:
    """Best-effort recovery of a JSON object from an LLM response."""

    if not raw or not raw.strip():
        logger.warning("guardrails: empty LLM output")
        return None

    text = raw.strip()

    fence = re.search(
        r"```(?:json)?\s*(.*?)```",
        text,
        flags=re.DOTALL | re.IGNORECASE,
    )

    if fence:
        text = fence.group(1).strip()

    start = text.find("{")
    end = text.rfind("}")

    if start == -1 or end == -1 or end <= start:
        logger.warning(
            "guardrails: no JSON object found in LLM output"
        )
        return None

    candidate = text[start : end + 1]

    try:
        return LlmOutput.model_validate_json(candidate)

    except ValidationError as exc:
        logger.warning(
            "guardrails: LLM output failed schema validation: %s",
            exc.errors()[:3],
        )
        return None

    except Exception as exc:
        logger.warning(
            "guardrails: LLM output was not valid JSON: %s",
            exc,
        )
        return None


def _contains_any(
    text: str,
    needles: list[str],
) -> str | None:

    lowered = text.lower()

    for needle in needles:
        if needle.lower() in lowered:
            return needle

    return None


def _has_confirmed_refund(
    order_facts: dict[str, Any],
) -> bool:

    return bool(
        order_facts.get("refund_confirmed")
    )


def _safe_customer_message(
    decision: DecisionResult,
    action: str | None = None,
) -> str:

    resolved = action or decision.action

    templates = {
        "Offer Return/Replacement": (
            "Thanks for letting us know, and sorry about the trouble. "
            "We can help with a return or a replacement for this item - "
            "just confirm which you would prefer."
        ),

        "Investigate Delivery": (
            "Thanks for flagging this. Your parcel is showing a delay, "
            "so we are checking the delivery record with the carrier "
            "and will follow up with you shortly."
        ),

        "Check Refund Eligibility": (
            "Thanks for your message. We are checking your refund "
            "eligibility against the order record and will confirm "
            "the next step with you as soon as it is verified."
        ),

        "Inform Refund Confirmed": (
            "Good news - our records confirm your refund has already "
            "been issued. Depending on your bank it may take a few "
            "business days to appear."
        ),

        "Request Missing Information": (
            "We would love to help, but we need a little more "
            "information first. Please share the details requested "
            "below so we can locate your case."
        ),

        "Human Review": (
            "Thanks for reaching out. We have passed your case to "
            "a specialist who will review it and get back to you "
            "with the next steps."
        ),
    }

    if resolved in templates:
        return templates[resolved]

    return templates["Human Review"]


def apply_guardrails(
    llm_output: LlmOutput | None,
    decision: DecisionResult,
    order_facts: dict[str, Any],
    policy: dict[str, Any] | None = None,
) -> tuple[LlmOutput, list[str], DecisionResult]:

    policy = policy or load_policy()

    cfg = _guardrail_cfg(policy)

    flags: list[str] = []

    effective = decision.model_copy(
        deep=True
    )

    # ---------------------------------------------------------
    # Invalid JSON / schema violation
    # ---------------------------------------------------------

    if llm_output is None:

        flags.append(
            "invalid_llm_json"
        )

        fallback = LlmOutput(
            complaint_id="",
            summary=(
                "LLM output could not be parsed; "
                "deterministic decision applied."
            ),
            action=decision.action,
            reason=decision.reason,
            customer_message=_safe_customer_message(
                decision
            ),
            escalate=decision.escalate,
            missing_information=list(
                decision.missing_information
            ),
        )

        return fallback, flags, effective

    output = llm_output.model_copy(
        deep=True
    )

    # ---------------------------------------------------------
    # Fabricated refund claims
    # ---------------------------------------------------------

    if not _has_confirmed_refund(
        order_facts
    ):

        hit = _contains_any(
            output.customer_message,
            cfg.get(
                "forbidden_refund_claims",
                [],
            ),
        )

        if hit:

            logger.error(
                "guardrails: fabricated refund claim detected ('%s')",
                hit,
            )

            flags.append(
                "fabricated_refund_claim"
            )

            effective.action = (
                "Human Review"
            )

            effective.escalate = True

            effective.escalate_reason = (
                "Guardrail: the model claimed a refund "
                "that the backend does not confirm."
            )

            effective.source = (
                "guardrail"
            )

            output.action = (
                "Human Review"
            )

            output.escalate = True

            output.reason = (
                "Refund status is not confirmed in the backend; "
                "a human agent must verify it."
            )

            output.customer_message = (
                _safe_customer_message(
                    effective
                )
            )

    # ---------------------------------------------------------
    # Fabricated completion claims
    # ---------------------------------------------------------

    hit = _contains_any(
        output.customer_message,
        cfg.get(
            "forbidden_completion_claims",
            [],
        ),
    )

    if hit:

        logger.error(
            "guardrails: unconfirmed completion claim detected ('%s')",
            hit,
        )

        flags.append(
            "fabricated_completion_claim"
        )

        output.customer_message = (
            _safe_customer_message(
                effective
            )
        )

    # ---------------------------------------------------------
    # Unsupported action
    # ---------------------------------------------------------

    allowed = (
        decision.allowed_actions
        or []
    )

    if (
        allowed
        and output.action not in allowed
    ):

        logger.error(
            "guardrails: unsupported action '%s'",
            output.action,
        )

        flags.append(
            "unsupported_action"
        )

        output.action = (
            effective.action
        )

        output.customer_message = (
            _safe_customer_message(
                effective
            )
        )

    # ---------------------------------------------------------
    # Escalation mismatch
    # ---------------------------------------------------------

    if (
        output.escalate
        != effective.escalate
    ):

        logger.warning(
            "guardrails: escalation flag corrected %s -> %s",
            output.escalate,
            effective.escalate,
        )

        flags.append(
            "escalation_inconsistency"
        )

        output.escalate = (
            effective.escalate
        )

    # ---------------------------------------------------------
    # Missing-information mismatch
    # ---------------------------------------------------------

    expected_missing = set(
        effective.missing_information
    )

    produced_missing = set(
        output.missing_information
    )

    if expected_missing - produced_missing:

        flags.append(
            "missing_information_dropped"
        )

        output.missing_information = sorted(
            expected_missing
            | produced_missing
        )

    # ---------------------------------------------------------
    # Internal data leakage
    # ---------------------------------------------------------

    hit = _contains_any(
        output.customer_message,
        cfg.get(
            "internal_markers",
            [],
        ),
    )

    if hit:

        logger.error(
            "guardrails: internal marker leaked "
            "into customer message ('%s')",
            hit,
        )

        flags.append(
            "internal_data_leak"
        )

        output.customer_message = (
            _safe_customer_message(
                effective
            )
        )

    # ---------------------------------------------------------
    # PII / email leakage
    # ---------------------------------------------------------

    if re.search(
        r"[\w.+-]+@[\w-]+\.[\w.]+",
        output.customer_message,
    ):

        logger.error(
            "guardrails: email address found "
            "in customer message"
        )

        flags.append(
            "pii_leak"
        )

        output.customer_message = (
            _safe_customer_message(
                effective
            )
        )

    # ---------------------------------------------------------
    # Customer message length cap
    # ---------------------------------------------------------

    max_len = int(
        cfg.get(
            "max_customer_message_length",
            900,
        )
    )

    if len(
        output.customer_message
    ) > max_len:

        flags.append(
            "message_truncated"
        )

        output.customer_message = (
            output.customer_message[
                : max_len - 3
            ].rstrip()
            + "..."
        )

    # ---------------------------------------------------------
    # Never soften Human Review
    # ---------------------------------------------------------

    if (
        effective.action
        == "Human Review"
        and output.action
        != "Human Review"
    ):

        logger.warning(
            "guardrails: model tried to soften "
            "a Human Review case"
        )

        flags.append(
            "escalated_case_autoresolved"
        )

        output.action = (
            "Human Review"
        )

        output.customer_message = (
            _safe_customer_message(
                effective
            )
        )

    return (
        output,
        flags,
        effective,
    )