"""Pydantic models: the contracts of the AI Agent."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


Severity = Literal["Low", "Medium", "High", "Critical"]


class AgentRequest(BaseModel):
    """Complaint intelligence + identifiers sent to the AI Agent."""

    model_config = ConfigDict(extra="ignore")

    complaint_id: str = Field(
        ...,
        description="Complaint id from the intelligence layer",
    )
    clean_text: str = Field(
        ...,
        description="Cleaned complaint text",
    )
    issue_type: str = Field(
        ...,
        description="Issue type, e.g. Damaged Product",
    )
    sentiment: str | None = None
    severity: Severity | None = None
    cluster: str | None = None

    customer_id: str | None = None
    order_id: str | None = None

    @field_validator("complaint_id", "clean_text", "issue_type")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("must not be blank")
        return value.strip()


class CustomerRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")

    customer_id: str
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    membership_tier: str | None = None
    is_high_risk: bool = False
    previous_complaints: int = 0


class OrderRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")

    order_id: str
    customer_id: str | None = None
    product: str | None = None
    status: str | None = None
    delivery_date: str | None = None
    expected_delivery: str | None = None
    return_window_open: bool = False
    payment_status: str | None = None
    amount_paid: float | None = None
    refund_confirmed: bool = False
    refund_amount: float | None = None
    tracking_status: str | None = None
    carrier: str | None = None
    data_conflict: bool = False


class DecisionResult(BaseModel):
    """Output of the deterministic decision engine."""

    model_config = ConfigDict(extra="ignore")

    action: str
    reason: str
    escalate: bool
    escalate_reason: str | None = None
    missing_information: list[str] = Field(default_factory=list)
    allowed_actions: list[str] = Field(default_factory=list)
    canonical_issue_type: str = "Unknown"
    policy_version: str | None = None
    risk_flags: list[str] = Field(default_factory=list)

    source: Literal[
        "policy_rule",
        "policy_default",
        "missing_info",
        "guardrail",
    ] = "policy_default"


class LlmOutput(BaseModel):
    """Strict schema expected from the LLM."""

    model_config = ConfigDict(extra="ignore")

    complaint_id: str
    summary: str
    action: str
    reason: str
    customer_message: str
    escalate: bool
    missing_information: list[str] = Field(default_factory=list)


class AgentResponse(BaseModel):
    """Final structured response returned by the AI Agent."""

    model_config = ConfigDict(extra="ignore")

    complaint_id: str
    summary: str
    action: str
    reason: str
    customer_message: str
    escalate: bool
    missing_information: list[str] = Field(default_factory=list)
    escalate_reason: str | None = None
    guardrail_flags: list[str] = Field(default_factory=list)
    severity: str | None = None
    issue_type: str | None = None
    used_llm: bool = False
    llm_provider: str | None = None
    policy_version: str | None = None


class AgentContext(BaseModel):
    """Verified facts available to the AI pipeline."""

    model_config = ConfigDict(extra="ignore")

    request: AgentRequest
    customer: CustomerRecord | None = None
    order: OrderRecord | None = None
    policy: dict[str, Any] = Field(default_factory=dict)
    decision: DecisionResult | None = None