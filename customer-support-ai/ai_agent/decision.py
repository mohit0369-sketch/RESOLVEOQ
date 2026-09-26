from __future__ import annotations

from typing import Any

from schemas import AgentRequest, CustomerRecord, OrderRecord, DecisionResult


POLICY_PATH = "data/policy.json"


def _load_policy() -> dict[str, Any]:
    import json

    with open(POLICY_PATH, "r", encoding="utf-8") as file:
        return json.load(file)


def _missing_information(
    request: AgentRequest,
    customer: CustomerRecord | None,
    order: OrderRecord | None,
) -> list[str]:
    missing = []

    if not request.customer_id or customer is None:
        missing.append("customer_id")

    if not request.order_id or order is None:
        missing.append("order_id")

    return missing


def decide(
    request: AgentRequest,
    customer: CustomerRecord | None,
    order: OrderRecord | None,
) -> DecisionResult:
    """
    Deterministic decision engine.

    Priority:
    1. Missing critical information
    2. Conflicting backend data
    3. High-risk customer/order
    4. Matching policy rule
    5. Policy default
    """

    policy = _load_policy()

    # ---------------------------------------------------------
    # 1. Missing critical information
    # ---------------------------------------------------------
    missing = _missing_information(request, customer, order)

    if missing:
        return DecisionResult(
            action="Request Missing Information",
            reason="Required customer or order information is unavailable.",
            escalate=False,
            missing_information=missing,
            allowed_actions=["Request Missing Information"],
            canonical_issue_type=request.issue_type,
            policy_version=policy.get("version"),
            source="missing_info",
        )

    # ---------------------------------------------------------
    # 2. Conflicting backend data
    # ---------------------------------------------------------
    if order and order.data_conflict:
        return DecisionResult(
            action="Human Review",
            reason="Backend order data contains a conflict that requires verification.",
            escalate=True,
            escalate_reason="Conflicting backend data",
            allowed_actions=["Human Review"],
            canonical_issue_type=request.issue_type,
            policy_version=policy.get("version"),
            risk_flags=["data_conflict"],
            source="policy_rule",
        )

    # ---------------------------------------------------------
    # 3. High-risk customer
    # ---------------------------------------------------------
    if customer and customer.is_high_risk:
        return DecisionResult(
            action="Human Review",
            reason="The customer account is marked as high risk.",
            escalate=True,
            escalate_reason="High-risk customer",
            allowed_actions=["Human Review"],
            canonical_issue_type=request.issue_type,
            policy_version=policy.get("version"),
            risk_flags=["high_risk_customer"],
            source="policy_rule",
        )

    # ---------------------------------------------------------
    # 4. Find matching policy rule
    # ---------------------------------------------------------
    for rule in policy.get("rules", []):
        if rule.get("issue_type", "").lower() == request.issue_type.lower():

            required = rule.get("required_information", [])

            missing_rule_info = []

            if "customer_id" in required and not request.customer_id:
                missing_rule_info.append("customer_id")

            if "order_id" in required and not request.order_id:
                missing_rule_info.append("order_id")

            if missing_rule_info:
                return DecisionResult(
                    action="Request Missing Information",
                    reason="The policy requires additional information before this issue can be processed.",
                    escalate=False,
                    missing_information=missing_rule_info,
                    allowed_actions=["Request Missing Information"],
                    canonical_issue_type=request.issue_type,
                    policy_version=policy.get("version"),
                    source="missing_info",
                )

            return DecisionResult(
                action=rule.get("action", "Human Review"),
                reason=rule.get(
                    "reason",
                    "The complaint matches a configured policy rule.",
                ),
                escalate=False,
                missing_information=[],
                allowed_actions=[rule.get("action", "Human Review")],
                canonical_issue_type=request.issue_type,
                policy_version=policy.get("version"),
                source="policy_rule",
            )

    # ---------------------------------------------------------
    # 5. Policy default
    # ---------------------------------------------------------
    default_action = policy.get("default_action", "Human Review")

    return DecisionResult(
        action=default_action,
        reason="No specific policy rule matched this complaint.",
        escalate=default_action == "Human Review",
        escalate_reason=(
            "No matching policy rule"
            if default_action == "Human Review"
            else None
        ),
        allowed_actions=[default_action],
        canonical_issue_type=request.issue_type,
        policy_version=policy.get("version"),
        source="policy_default",
    )