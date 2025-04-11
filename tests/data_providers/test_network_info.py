"""Tests for the NetworkInfo class."""
import pytest
from data_providers.network_info import NetworkInfo
from utils.denomination import AssetKind

def test_network_info_initialization():
    """Test NetworkInfo initialization for different networks."""
    # Test Polkadot
    polkadot_info = NetworkInfo("polkadot")
    assert polkadot_info.name == "polkadot"
    assert polkadot_info.native_asset == AssetKind.DOT
    assert polkadot_info.chain_name == "polkadot"
    assert polkadot_info.referenda_url == "https://polkadot.subsquare.io/referenda/"
    assert polkadot_info.treasury_url == "https://polkadot.subsquare.io/treasury/proposals/"
    assert polkadot_info.child_bounty_url == "https://polkadot.subsquare.io/treasury/child-bounties/"

    # Test Kusama
    kusama_info = NetworkInfo("kusama")
    assert kusama_info.name == "kusama"
    assert kusama_info.native_asset == AssetKind.KSM
    assert kusama_info.chain_name == "kusama"
    assert kusama_info.referenda_url == "https://kusama.subsquare.io/referenda/"
    assert kusama_info.treasury_url == "https://kusama.subsquare.io/treasury/proposals/"
    assert kusama_info.child_bounty_url == "https://kusama.subsquare.io/treasury/child-bounties/"

def test_apply_denomination():
    """Test denomination application for different assets."""
    info = NetworkInfo("polkadot")
    
    # Test DOT denomination (10 digits)
    assert info.apply_denomination(10000000000) == 1.0  # 1 DOT
    assert info.apply_denomination(100000000000) == 10.0  # 10 DOT
    
    # Test with explicit asset kind
    assert info.apply_denomination(10000000000, AssetKind.DOT) == 1.0
    assert info.apply_denomination(1000000, AssetKind.USDT) == 1.0  # 6 digits
    assert info.apply_denomination(1000000000000, AssetKind.KSM) == 1.0  # 12 digits

def test_invalid_network():
    """Test handling of invalid network names."""
    with pytest.raises(ValueError, match="Unsupported network"):
        NetworkInfo("invalid") 