"""Functions for handling asset denomination."""
from enum import Enum
from typing import Union, Optional

class AssetKind(Enum):
    """Enum representing different types of assets."""
    DOT = "DOT"
    KSM = "KSM"
    USDT = "USDT"
    USDC = "USDC"
    DED = "DED"

def get_asset_digits(asset_kind: Optional[AssetKind] = None, default_digits: int = 10) -> int:
    """Get the number of decimal digits for a given asset kind.
    
    Args:
        asset_kind: The type of asset to determine denomination
        default_digits: Number of decimal places to use if asset_kind is None
    
    Returns:
        int: The number of decimal digits for the asset
    """
    if asset_kind is None:
        return default_digits
    
    digits_map = {
        AssetKind.DOT: 10,
        AssetKind.KSM: 12,
        AssetKind.USDT: 6,
        AssetKind.USDC: 6,
        AssetKind.DED: 10
    }
    
    return digits_map.get(asset_kind, default_digits)

def apply_denomination(value: Union[str, int, float], 
                      asset_kind: Optional[AssetKind] = None,
                      default_digits: int = 10) -> float:
    """Convert a raw value to its denominated form based on the asset kind.
    
    Args:
        value: The raw value to convert. Can be a string (decimal or hex), int, or float
        asset_kind: The type of asset to determine denomination. If None, uses default_digits
        default_digits: Number of decimal places to use if asset_kind is None
    
    Returns:
        float: The denominated value
        
    Raises:
        ValueError: If the value cannot be converted to a number
        TypeError: If the value is not a string, int, or float
    """
    digits = get_asset_digits(asset_kind, default_digits)
    denomination_factor = 10**digits

    if isinstance(value, str):
        if value.startswith("0x"):
            return int(value, 16)/denomination_factor
        try:
            # Handle scientific notation and regular numbers
            return float(value)/denomination_factor
        except ValueError:
            # If float conversion fails, try direct integer conversion
            return int(value, 10)/denomination_factor
    elif isinstance(value, (int, float)):
        return value/denomination_factor
    else:
        raise TypeError(f"Unsupported value type: {type(value)}") 