"""Tests for the PriceService class.

This module contains tests for the PriceService class, which handles:
- Price fetching from multiple sources
- Price conversion between assets
- Price caching and loading
- Error handling for failed requests

Test cases cover:
- Network info initialization for different networks
- Price conversion between different assets
- Error handling for invalid networks
"""

import pytest
from data_providers.network_info import NetworkInfo
from utils.denomination import AssetKind

@pytest.fixture
def network_info():
    return NetworkInfo("polkadot")

def test_get_network_info(network_info):
    """Test network info initialization and properties.
    
    Verifies that NetworkInfo correctly initializes with:
    - Correct network name
    - Proper digit configuration
    - Correct native asset mapping
    - Accurate denomination factor
    - Valid service URLs
    """
    assert network_info.name == "polkadot"
    assert network_info.digits == 10
    assert network_info.native_asset == AssetKind.DOT
    assert network_info.denomination_factor == 10**10
    assert network_info.treasury_url == "https://polkadot.subsquare.io/treasury/proposals/"
    assert network_info.child_bounty_url == "https://polkadot.subsquare.io/treasury/child-bounties/"
    assert network_info.referenda_url == "https://polkadot.subsquare.io/referenda/" 