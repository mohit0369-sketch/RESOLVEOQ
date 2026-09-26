import os
import httpx


BACKEND_URL = os.getenv(
    "BACKEND_URL",
    "http://127.0.0.1:8000"
)


def get_order(order_id: str | None) -> dict | None:
    """
    Fetch an order from the Student 1 backend.

    Returns:
        Order dictionary when found.
        None when order_id is missing or order does not exist.
    """
    if not order_id:
        return None

    url = f"{BACKEND_URL}/orders/{order_id}"

    try:
        response = httpx.get(url, timeout=5.0)

        if response.status_code == 404:
            return None

        response.raise_for_status()
        return response.json()

    except httpx.HTTPError:
        return None