"""
Fixtures for data provider tests.
"""

import pytest
import pandas as pd
from datetime import datetime
from unittest.mock import MagicMock, patch

from data_providers.network_info import NetworkInfo
from data_providers.asset_kind import AssetKind


@pytest.fixture
def polkadot_network():
    """Polkadot network info fixture."""
    return NetworkInfo(network="polkadot", explorer="subsquare")


@pytest.fixture
def kusama_network():
    """Kusama network info fixture."""
    return NetworkInfo(network="kusama", explorer="subsquare")


@pytest.fixture
def mock_coingecko_polkadot():
    """Mock CoinGecko response for Polkadot."""
    return {"polkadot": {"usd": 7.50}}


@pytest.fixture
def mock_coingecko_kusama():
    """Mock CoinGecko response for Kusama."""
    return {"kusama": {"usd": 25.00}}


@pytest.fixture
def mock_historic_prices():
    """Mock yfinance historic price data."""
    dates = pd.date_range(start="2024-01-01", periods=30, freq="D", tz="UTC")
    data = {
        "Open": [7.0 + i * 0.1 for i in range(30)],
        "High": [7.5 + i * 0.1 for i in range(30)],
        "Low": [6.5 + i * 0.1 for i in range(30)],
        "Close": [7.25 + i * 0.1 for i in range(30)],
        "Adj Close": [7.25 + i * 0.1 for i in range(30)],
        "Volume": [1000000 + i * 10000 for i in range(30)],
    }
    df = pd.DataFrame(data, index=dates)
    # Wrap Close in another layer to match yfinance structure
    df["Close"] = df["Close"].apply(lambda x: [x])
    return df


@pytest.fixture
def mock_statescan_response():
    """Mock Statescan ID service response."""
    return [
        {
            "address": "16a357f5Sxab3V2ne4emGQvqJaCLeYpTMx3TCjnQhmJQ71DX",
            "info": {
                "status": "VERIFIED",
                "display": "Alice",
                "legal": "Alice Corp",
                "web": "https://alice.example.com"
            }
        },
        {
            "address": "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
            "info": {
                "status": "VERIFIED",
                "display": "Bob",
                "legal": "",
                "web": ""
            }
        }
    ]


@pytest.fixture
def mock_statescan_empty_response():
    """Mock empty Statescan response (no identities found)."""
    return []


@pytest.fixture
def mock_requests_get():
    """Mock requests.get for testing HTTP responses."""
    with patch("requests.get") as mock_get:
        yield mock_get


@pytest.fixture
def mock_requests_post():
    """Mock requests.post for testing HTTP responses."""
    with patch("requests.post") as mock_post:
        yield mock_post


@pytest.fixture
def mock_yfinance_download():
    """Mock yfinance.download for testing price fetching."""
    with patch("yfinance.download") as mock_download:
        yield mock_download
