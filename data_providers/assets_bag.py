from utils.denomination import AssetKind
from .price_service import PriceService

class AssetsBag:
    def __init__(self, assets=None):
        self._assets = assets or {}
        self._nan = False

    def add_asset(self, asset: AssetKind, amount: float):
        if asset in self._assets:
            self._assets[asset] += amount
        else:
            self._assets[asset] = amount

    def remove_asset(self, asset: AssetKind, amount: float):
        if asset in self._assets:
            self._assets[asset] -= amount
            if self._assets[asset] <= 0:
                del self._assets[asset]
        else:
            raise ValueError(f"Asset {asset} not found in the bag")

    def set_nan(self):
        self._nan = True

    def get_asset_amount(self, asset: AssetKind) -> float:
        return self._assets.get(asset, 0)

    def get_all_assets(self) -> dict[AssetKind, float]:
        return self._assets.copy()

    def clear(self):
        self._assets.clear()

    def get_total_value(self, price_service: PriceService, target_asset: AssetKind, date=None) -> float:
        if self._nan:
            return float('nan')

        total_value = 0
        for asset, amount in self._assets.items():
            value = price_service.convert_asset_value(asset, amount, target_asset, date)
            total_value += value
        return total_value

    def __repr__(self):
        return f"AssetBag({self._assets})"