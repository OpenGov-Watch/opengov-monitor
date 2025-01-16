from .asset_kind import AssetKind
from .price_service import PriceService

class AssetsBag:
    def __init__(self, assets=None):
        self.assets = assets or {}

    def add_asset(self, asset: AssetKind, amount: float):
        if asset in self.assets:
            self.assets[asset] += amount
        else:
            self.assets[asset] = amount

    def remove_asset(self, asset: AssetKind, amount: float):
        if asset in self.assets:
            self.assets[asset] -= amount
            if self.assets[asset] <= 0:
                del self.assets[asset]
        else:
            raise ValueError(f"Asset {asset} not found in the bag")

    def get_amount(self, asset: AssetKind) -> float:
        return self.assets.get(asset, 0)

    def get_total_value(self, price_service: PriceService, target_asset: AssetKind, date=None) -> float:
        total_value = 0
        for asset, amount in self.assets.items():
            value = price_service.convert_asset_value(asset, amount, target_asset, date)
            total_value += value
        return total_value

    def __repr__(self):
        return f"AssetBag({self.assets})"