from .asset_kind import AssetKind

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
        if asset_kind is None:
            digits = self.digits
        elif asset_kind == AssetKind.DOT:
            digits = 10
        elif asset_kind == AssetKind.KSM:
            digits = 12
        elif asset_kind == AssetKind.USDT or asset_kind == AssetKind.USDC:
            digits = 6
        elif asset_kind == AssetKind.DED:
            digits = 10
        else:
            raise Exception(f"pls implement me. asset_kind {asset_kind}, type {type(asset_kind)}")

        denomination_factor = 10**digits

        if isinstance(value, str):
            if value.startswith("0x"):
                return int(value, 16)/denomination_factor
            return int(value,10)/denomination_factor
        elif isinstance (value, (int)) or isinstance(value, float):
            return value/denomination_factor
        else:
            raise Exception(f"pls implement me. value {value}, type {type(value)}")
