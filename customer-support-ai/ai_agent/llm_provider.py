"""
LLM provider layer.

The deterministic decision engine decides the action.
The LLM only generates customer-friendly wording.

Mock mode works without an API key, which is useful for local development
and hackathon demos.
"""

from __future__ import annotations

import abc
import json
import os
from typing import Any


class LLMProvider(abc.ABC):
    """Common interface for all LLM providers."""

    name: str = "abstract"

    @abc.abstractmethod
    def complete(self, system_prompt: str, user_prompt: str) -> str:
        raise NotImplementedError

    @property
    def is_mock(self) -> bool:
        return False


class MockProvider(LLMProvider):
    """
    Deterministic offline provider.

    It does not decide the action.
    It simply turns the deterministic decision into customer-friendly text.
    """

    name = "mock"

    @property
    def is_mock(self) -> bool:
        return True

    def complete(self, system_prompt: str, user_prompt: str) -> str:
        context = _extract_context(user_prompt)

        decision = context.get("deterministic_decision", {}) or {}
        request = context.get("request", {}) or {}

        action = decision.get("action", "Human Review")

        messages = {
            "Replacement": (
                "I'm sorry your item arrived in that condition. "
                "We can help arrange a replacement."
            ),
            "Delivery Investigation": (
                "Sorry for the delay. "
                "We're checking the delivery status and will update you once we have more information."
            ),
            "Refund Review": (
                "Thanks for getting in touch. "
                "We're reviewing your refund request against the order details."
            ),
            "Order Investigation": (
                "Thanks for letting us know. "
                "We're checking the order details to understand what happened."
            ),
            "Request Missing Information": (
                "We'd like to help straight away, but we need a little more "
                "information before we can continue."
            ),
            "Human Review": (
                "Thanks for reaching out. "
                "Your case has been passed to a specialist who will review it "
                "and follow up with the next steps."
            ),
        }

        message = messages.get(
            action,
            messages["Human Review"],
        )

        payload = {
            "complaint_id": request.get("complaint_id", ""),
            "summary": _make_summary(context, action),
            "action": action,
            "reason": decision.get(
                "reason",
                "Deterministic policy decision.",
            ),
            "customer_message": message,
            "escalate": bool(
                decision.get("escalate", False)
            ),
            "missing_information": decision.get(
                "missing_information",
                [],
            ),
        }

        return json.dumps(payload)


def _make_summary(
    context: dict[str, Any],
    action: str,
) -> str:
    request = context.get("request", {}) or {}
    order = context.get("order") or {}

    complaint = str(
        request.get(
            "clean_text",
            "the customer's issue",
        )
    ).rstrip(".")

    product = (
        order.get("product")
        or order.get("item")
    )

    if product:
        return (
            f"Customer reports: {complaint}. "
            f"Item: {product}. "
            f"Recommended action: {action}."
        )

    return (
        f"Customer reports: {complaint}. "
        f"Recommended action: {action}."
    )


def _extract_context(user_prompt: str) -> dict[str, Any]:
    """
    Extract the JSON context embedded in the prompt.
    """

    try:
        return json.loads(user_prompt)
    except (json.JSONDecodeError, TypeError):
        return {}


class OpenAICompatibleProvider(LLMProvider):
    """
    Provider for OpenAI-compatible APIs.

    The openai package is imported only when this provider is used.
    """

    name = "openai-compatible"

    def __init__(
        self,
        api_key: str,
        model: str = "gpt-4o-mini",
        base_url: str | None = None,
        temperature: float = 0.2,
        timeout: float = 30.0,
        max_tokens: int = 700,
    ) -> None:

        try:
            from openai import OpenAI
        except ImportError as exc:
            raise RuntimeError(
                "The 'openai' package is required for the real LLM provider. "
                "Run: pip install openai"
            ) from exc

        self.client = OpenAI(
            api_key=api_key,
            base_url=base_url,
            timeout=timeout,
        )

        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens

    def complete(
        self,
        system_prompt: str,
        user_prompt: str,
    ) -> str:

        response = self.client.chat.completions.create(
            model=self.model,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": user_prompt,
                },
            ],
        )

        return response.choices[0].message.content or "{}"


def get_provider() -> LLMProvider:
    """
    Select the provider.

    Mock mode is used when:
    - STUDENT3_FORCE_MOCK=1
    - no API key is configured

    Otherwise the OpenAI-compatible provider is used.
    """

    force_mock = os.getenv(
        "STUDENT3_FORCE_MOCK",
        "0",
    ).lower() in {
        "1",
        "true",
        "yes",
    }

    api_key = (
        os.getenv("LLM_API_KEY")
        or os.getenv("OPENAI_API_KEY")
    )

    if force_mock or not api_key:
        return MockProvider()

    return OpenAICompatibleProvider(
        api_key=api_key,
        model=os.getenv(
            "LLM_MODEL",
            "gpt-4o-mini",
        ),
        base_url=os.getenv("LLM_BASE_URL") or None,
    )