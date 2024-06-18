import yfinance as yf
import datetime
import requests
from .network_info import NetworkInfo
from enum import Enum

class AssetKind(Enum):
    INVALID = 0
    DOT = 1
    KSM = 2
    USDT = 3
    USDC = 4

class PriceService:
  def __init__(self, network_info):
    self.network_info = network_info
    if network_info.name == "polkadot":
      self.pair_start_date = '2020-08-20'
    else:
      self.pair_start_date = '2019-12-12'
    self.pair = f"{self.network_info.ticker}-USD"

    self._today = datetime.datetime.now().strftime("%Y-%m-%d")
    self._historic_prices_df = None
    self.current_price = None

  def load_prices(self):
    self._historic_prices_df = self._fetch_historic_prices(self.pair)
    self.current_price = self._get_current_price(self.network_info.name)

  def _fetch_historic_prices(self, pair):
    data = yf.download(pair, self.pair_start_date, self._today)
    return data

  def _get_current_price(self, network):
    url = f'https://api.coingecko.com/api/v3/simple/price?ids={network}&vs_currencies=usd'
    response = requests.get(url)
    data = response.json()
    self.current_price = data[network]['usd']
    return self.current_price

  def get_historic_price(self, date):
    if self._historic_prices_df is None:
      raise ValueError("Historic prices not available. Call get_historic_price() first.")
    closest_date = self._historic_prices_df.index.get_indexer([date], method='nearest')[0]
    return self._historic_prices_df.iloc[closest_date]['Close']

  # performs a conversion into the network's token value & denomination!
  def get_historic_network_token_value(self, input_asset: AssetKind, input_amount: float, date) -> float:
    input_amount = self.apply_denomination(input_amount, input_asset)
    if input_asset == AssetKind.USDT or input_asset == AssetKind.USDC:
      price = self.get_historic_price(date)      
      return input_amount / price
    assert input_asset.name == self.network_info.ticker
    return input_amount

  def apply_denomination(self, value, asset_kind: AssetKind = None) -> float:
      if asset_kind is None:
          digits = self.network_info.digits
          denomination_factor = self.network_info.denomination_factor
      elif asset_kind == AssetKind.USDT or asset_kind == AssetKind.USDC:
          digits = 6
          denomination_factor = 10**digits
      else:
          raise Exception(f"pls implement me. asset_kind {asset_kind}, type {type(asset_kind)}")

      if isinstance(value, str):
          if value.startswith("0x"):
              return int(value, 16)/denomination_factor
          return int(value,10)/denomination_factor
      elif isinstance (value, (int)):
          return value/denomination_factor
      else:
          raise Exception(f"pls implement me. value {value}, type {type(value)}")
