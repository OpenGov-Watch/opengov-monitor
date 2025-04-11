from .asset_kind import AssetKind
from utils.denomination import apply_denomination

class NetworkInfo:
    def __init__(self, network = "polkadot", explorer = "subsquare"):
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

    # returns the human-readable value with the denomination applied
    # if no asset_kind is provided, it will use the network's native token
    def apply_denomination(self, value, asset_kind: AssetKind = None) -> float:
        """
        Apply denomination to a value using the network's configuration.
        
        This is a wrapper around utils.denomination.apply_denomination that uses
        the network's default digits when asset_kind is None.
        """
        return apply_denomination(value, asset_kind, default_digits=self.digits)
