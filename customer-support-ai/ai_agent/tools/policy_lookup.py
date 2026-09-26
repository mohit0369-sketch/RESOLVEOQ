from __future__ import annotations

import json
from pathlib import Path
from typing import Any


POLICY_PATH = (
    Path(__file__).resolve().parent.parent
    / "data"
    / "policy.json"
)


def load_policy() -> dict[str, Any]:
    """Load the policy document from data/policy.json."""

    with open(POLICY_PATH, "r", encoding="utf-8") as file:
        return json.load(file)


def get_policy(issue_type: str | None = None) -> dict[str, Any]:
    """
    Return the loaded policy.

    issue_type is accepted for compatibility with the Student 3
    integration contract.
    """

    return load_policy()