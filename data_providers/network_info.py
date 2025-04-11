from typing import Optional, Union
from utils.denomination import AssetKind, apply_denomination

class NetworkInfo:
    SUPPORTED_NETWORKS = ["polkadot", "kusama"]

    def __init__(self, network: str = "polkadot", explorer: str = "subsquare"):
        if network not in self.SUPPORTED_NETWORKS:
            raise ValueError(f"Unsupported network: {network}")

        self.name = network
        if network == "polkadot":
            self.digits = 10
            self.native_asset = AssetKind.DOT
        else:
            self.digits = 12
            self.native_asset = AssetKind.KSM

        self.denomination_factor = 10**self.digits

        if explorer == "polkassembly":
            self.treasury_url = f"https://{network}.polkassembly.io/treasury/"
            self.child_bounty_url = f"https://{network}.polkassembly.io/bounties/"
        else:
            self.treasury_url = f"https://{network}.subsquare.io/treasury/proposals/"
            self.child_bounty_url = f"https://{network}.subsquare.io/treasury/child-bounties/"

        self.referenda_url = f"https://{network}.{explorer}.io/referenda/"

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
