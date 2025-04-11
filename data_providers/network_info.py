from typing import Optional, Union
from utils.denomination import AssetKind, apply_denomination

class NetworkInfo:
    """Network-specific information and configuration.
    
    This class provides network-specific information and utilities for different
    blockchain networks (e.g., Polkadot, Kusama). It handles:
    - Network name and properties
    - Asset denominations and conversions
    - Network-specific URLs for various services
    - Asset type mappings
    
    Usage:
        network_info = NetworkInfo("polkadot")  # Initialize for Polkadot network
        amount = network_info.apply_denomination(10000000000, AssetKind.DOT)  # Convert to human-readable
    """

    SUPPORTED_NETWORKS = ["polkadot", "kusama"]

    def __init__(self, network_name: str):
        """Initialize network information.
        
        Args:
            network_name: Name of the network (e.g., "polkadot", "kusama")
            
        Raises:
            ValueError: If the network name is not supported
        """
        if network_name not in self.SUPPORTED_NETWORKS:
            raise ValueError(f"Unsupported network: {network_name}")

        self.name = network_name
        if network_name == "polkadot":
            self.digits = 10
            self.native_asset = AssetKind.DOT
        else:
            self.digits = 12
            self.native_asset = AssetKind.KSM

        self.denomination_factor = 10**self.digits

        self.treasury_url = f"https://{network_name}.subsquare.io/treasury/proposals/"
        self.child_bounty_url = f"https://{network_name}.subsquare.io/treasury/child-bounties/"
        self.referenda_url = f"https://{network_name}.subsquare.io/referenda/"

    @property
    def chain_name(self) -> str:
        """Return the chain name for use in URLs."""
        return self.name

    # returns the human-readable value with the denomination applied
    # if no asset_kind is provided, it will use the network's native token
    def apply_denomination(self, value: Union[int, float], asset_kind: Optional[AssetKind] = None) -> float:
        """
        Apply denomination to a value using the network's configuration.
        
        Args:
            value: The value to apply denomination to
            asset_kind: Optional asset kind to use for denomination. If None, uses network's native token.
            
        Returns:
            The value with denomination applied
        """
        return apply_denomination(value, asset_kind, default_digits=self.digits)
