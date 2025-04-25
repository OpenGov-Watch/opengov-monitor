from .asset_kind import AssetKind

class NetworkInfo:
    def __init__(self, network = "polkadot", explorer = "subsquare"):
        self.name = network
        if network == "polkadot":
            self.digits = 10
            self.native_asset = AssetKind.DOT
            self.treasury_address = "13UVJyLnbVp9RBZYFwFGyDvVd1y27Tt8tkntv6Q7JVPhFsTB"
        else:
            self.digits = 12
            self.native_asset = AssetKind.KSM
            self.treasury_address = "F3opxRbN5ZbjJNU511Kj2TLuzFcDq9BGduA9TgiECafpg29"

        self.denomination_factor = 10**self.digits

        if explorer == "polkassembly":
            self.treasury_url = f"https://{network}.polkassembly.io/treasury/"
            self.child_bounty_url = f"https://{network}.polkassembly.io/bounties/"
            self.fellowship_treasury_spend_url = f"https://collectives.subsquare.io/fellowship/treasury/spends/"
        else:
            self.treasury_url = f"https://{network}.subsquare.io/treasury/proposals/"
            self.child_bounty_url = f"https://{network}.subsquare.io/treasury/child-bounties/"
            self.fellowship_treasury_spend_url = f"https://collectives.subsquare.io/fellowship/treasury/spends/"

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
                return int(value, 16) / denomination_factor
            try:
                # Handle scientific notation or other float-like strings
                return float(value) / denomination_factor
            except ValueError:
                raise Exception(f"Invalid string value: {value}")
        elif isinstance(value, (int, float)):
            return value / denomination_factor
        else:
            raise Exception(f"pls implement me. value {value}, type {type(value)}")
