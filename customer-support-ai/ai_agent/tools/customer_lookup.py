import os
import httpx


BACKEND_URL = os.getenv(
    "BACKEND_URL",
    "http://127.0.0.1:8000"
)


def get_customer(customer_id: str | None) -> dict | None:
    """
    Fetch a customer from the Student 1 backend.

    Returns:
        Customer dictionary when found.
        None when customer_id is missing or customer does not exist.
    """
    if not customer_id:
        return None

    url = f"{BACKEND_URL}/customers/{customer_id}"

    try:
        response = httpx.get(url, timeout=5.0)

        if response.status_code == 404:
            return None

        response.raise_for_status()
        return response.json()

    except httpx.HTTPError:
        return None