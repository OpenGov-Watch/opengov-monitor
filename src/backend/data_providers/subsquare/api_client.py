"""
HTTP fetch utilities for Subsquare API.
"""

import logging
import pandas as pd
import requests


# HTTP request timeout in seconds - prevents hanging on unresponsive endpoints
REQUEST_TIMEOUT = 30


def fetch_list(base_url: str, num_items: int, logger: logging.Logger = None) -> pd.DataFrame:
    """Fetch items from a paginated API endpoint.

    Args:
        base_url: The API endpoint URL.
        num_items: Maximum number of items to fetch. 0 = fetch ALL items.
        logger: Optional logger for debug messages.

    Returns:
        DataFrame with fetched items.
    """
    if logger is None:
        logger = logging.getLogger(__name__)

    all_items = []
    page = 1

    while True:
        url = f"{base_url}?page={page}&page_size=100"
        logger.debug(f"Fetching from {url}")
        response = requests.get(url, timeout=REQUEST_TIMEOUT)
        if response.status_code == 200:
            data = response.json()
            items = data['items']
            if not items:
                break
            all_items.extend(items)
            page += 1

            logger.debug(f"Fetched {len(all_items)} items")

            # num_items = 0 means fetch ALL items (no early break)
            if num_items > 0 and len(all_items) >= num_items:
                break
        else:
            message = f"While fetching {base_url}, we received error: {response.status_code} {response.reason}"
            raise SystemExit(message)

    df = pd.DataFrame(all_items)
    return df


def fetch_item(url: str) -> dict:
    """Fetch a single item from an API endpoint.

    Args:
        url: The full API endpoint URL.

    Returns:
        JSON response as a dictionary.

    Raises:
        SystemExit: If the request fails.
    """
    response = requests.get(url, timeout=REQUEST_TIMEOUT)
    if response.status_code == 200:
        data = response.json()
        return data
    else:
        message = f"While fetching {url}, we received error: {response.status_code} {response.reason}"
        raise SystemExit(message)
