"""Tests for the denomination utility functions."""
import pytest
from utils.denomination import apply_denomination, AssetKind, get_asset_digits

def test_get_asset_digits():
    """Test digit mapping for different asset kinds."""
    assert get_asset_digits(AssetKind.DOT) == 10
    assert get_asset_digits(AssetKind.KSM) == 12
    assert get_asset_digits(AssetKind.USDT) == 6
    assert get_asset_digits(AssetKind.USDC) == 6
    assert get_asset_digits(AssetKind.DED) == 10
    assert get_asset_digits(None, default_digits=8) == 8

def test_apply_denomination_hex_string():
    """Test denomination of hexadecimal string values."""
    assert apply_denomination("0xFF", default_digits=2) == 2.55
    assert apply_denomination("0x100", default_digits=2) == 2.56

def test_apply_denomination_decimal_string():
    """Test denomination of decimal string values."""
    assert apply_denomination("1000", default_digits=2) == 10.0
    assert apply_denomination("1234", default_digits=2) == 12.34

def test_apply_denomination_scientific_notation():
    """Test denomination of scientific notation string values."""
    # Test with 12 digits (like KSM)
    assert pytest.approx(apply_denomination("5.885291e+24", default_digits=12)) == 5885291000000.0
    # Test with 2 digits
    assert pytest.approx(apply_denomination("1.23e+3", default_digits=2)) == 12.3

def test_apply_denomination_numeric():
    """Test denomination of numeric values."""
    assert apply_denomination(1000, default_digits=2) == 10.0
    assert apply_denomination(1234.56, default_digits=2) == 12.3456

def test_apply_denomination_with_asset_kinds():
    """Test denomination with different asset kinds."""
    value = "1000000000000"  # 1000 units
    assert apply_denomination(value, AssetKind.DOT) == 100.0  # 10 digits
    assert apply_denomination(value, AssetKind.KSM) == 1.0    # 12 digits
    assert apply_denomination(value, AssetKind.USDT) == 1000000.0  # 6 digits

def test_apply_denomination_invalid_input():
    """Test error handling for invalid inputs."""
    with pytest.raises(TypeError, match="Unsupported value type"):
        apply_denomination([1, 2, 3])  # List is not a valid input type
    
    with pytest.raises(ValueError):
        apply_denomination("not_a_number")

def test_apply_denomination_edge_cases():
    """Test edge cases and boundary conditions."""
    assert apply_denomination("0", default_digits=2) == 0.0
    assert apply_denomination("-1000", default_digits=2) == -10.0
    assert apply_denomination("0.0", default_digits=2) == 0.0 