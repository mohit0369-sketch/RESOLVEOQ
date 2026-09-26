from __future__ import annotations

import json
from pathlib import Path

from schemas import (
    AgentRequest,
    AgentResponse,
    AgentContext,
    CustomerRecord,
    OrderRecord,
)

from tools.customer_lookup import get_customer
from tools.order_lookup import get_order
from tools.policy_lookup import load_policy

from decision import decide
from llm_provider import get_provider
from guardrails import apply_guardrails, parse_llm_output


BASE_DIR = Path(__file__).resolve().parent
POLICY_PATH = BASE_DIR / "data" / "policy.json"


def get_policy(issue_type: str | None = None) -> dict:
    """
    Load the policy document.

    issue_type is accepted for compatibility with the Student 3
    integration contract.
    """
    return load_policy()


class Agent:
    """
    Main Student 3 AI Agent pipeline.

    Flow:

        Backend data
            ↓
        Deterministic decision
            ↓
        LLM wording
            ↓
        Guardrails
            ↓
        Final response
    """

    def __init__(self):
        self.provider = get_provider()

    def run(
        self,
        request: AgentRequest,
    ) -> AgentResponse:

        # ---------------------------------------------------------
        # 1. Retrieve verified customer data
        # ---------------------------------------------------------

        raw_customer = get_customer(
            request.customer_id
        )

        customer = (
            CustomerRecord.model_validate(
                raw_customer
            )
            if raw_customer
            else None
        )

        # ---------------------------------------------------------
        # 2. Retrieve verified order data
        # ---------------------------------------------------------

        raw_order = get_order(
            request.order_id
        )

        order = (
            self._normalize_order(
                raw_order
            )
            if raw_order
            else None
        )

        # ---------------------------------------------------------
        # 3. Load policy
        # ---------------------------------------------------------

        policy = get_policy(
            request.issue_type
        )

        # ---------------------------------------------------------
        # 4. Deterministic decision
        # ---------------------------------------------------------

        decision = decide(
            request=request,
            customer=customer,
            order=order,
        )

        # ---------------------------------------------------------
        # 5. Build verified context
        # ---------------------------------------------------------

        context = AgentContext(
            request=request,
            customer=customer,
            order=order,
            policy=policy,
            decision=decision,
        )

        # Keep context available for debugging/future integration.
        _ = context

        # ---------------------------------------------------------
        # 6. Ask LLM ONLY for wording
        # ---------------------------------------------------------

        user_prompt = json.dumps(
            {
                "request": request.model_dump(),

                "customer": (
                    customer.model_dump()
                    if customer
                    else None
                ),

                "order": (
                    order.model_dump()
                    if order
                    else None
                ),

                "deterministic_decision": (
                    decision.model_dump()
                ),
            },
            ensure_ascii=False,
        )

        system_prompt = """
You are a customer-support response writer.

The deterministic decision supplied to you is authoritative.

You MUST:

- keep the exact action
- keep the exact escalation decision
- never invent customer facts
- never invent order facts
- never claim a refund was completed unless verified
- never claim an order was shipped or delivered unless verified
- write a concise, professional customer-facing message
- return valid JSON only

You are responsible for wording, not business decisions.

Required JSON fields:

complaint_id
summary
action
reason
customer_message
escalate
missing_information
"""

        llm_raw = self.provider.complete(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )

        # ---------------------------------------------------------
        # 7. Parse LLM output using guardrails
        # ---------------------------------------------------------

        parsed_llm_output = parse_llm_output(
            llm_raw
        )

        # ---------------------------------------------------------
        # 8. Apply safety guardrails
        # ---------------------------------------------------------

        (
            safe_output,
            guardrail_flags,
            effective_decision,
        ) = apply_guardrails(
            llm_output=parsed_llm_output,
            decision=decision,
            order_facts=(
                order.model_dump()
                if order
                else {}
            ),
            policy=policy,
        )

        # ---------------------------------------------------------
        # 9. Build final response
        # ---------------------------------------------------------

        response = AgentResponse(
            complaint_id=request.complaint_id,

            summary=safe_output.summary,

            action=effective_decision.action,

            reason=effective_decision.reason,

            customer_message=(
                safe_output.customer_message
            ),

            escalate=effective_decision.escalate,

            missing_information=(
                safe_output.missing_information
            ),

            escalate_reason=(
                effective_decision.escalate_reason
            ),

            guardrail_flags=guardrail_flags,

            severity=request.severity,

            issue_type=request.issue_type,

            used_llm=(
                not self.provider.is_mock
            ),

            llm_provider=self.provider.name,

            policy_version=(
                effective_decision.policy_version
            ),
        )

        return response

    @staticmethod
    def _normalize_order(
        raw_order: dict,
    ) -> OrderRecord:
        """
        Adapt Student 1 backend order fields
        to the AI Agent contract.

        Student 1 backend:
            item
            amount

        AI Agent:
            product
            amount_paid
        """

        data = dict(raw_order)

        if (
            "product" not in data
            and "item" in data
        ):
            data["product"] = data["item"]

        if (
            "amount_paid" not in data
            and "amount" in data
        ):
            data["amount_paid"] = data["amount"]

        return OrderRecord.model_validate(
            data
        )


# -------------------------------------------------------------
# Global agent instance
# -------------------------------------------------------------

agent = Agent()