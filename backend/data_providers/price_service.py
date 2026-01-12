import yfinance as yf
import datetime
import requests
from .network_info import NetworkInfo
import logging
import pandas as pd
from .asset_kind import AssetKind

'''
PriceService provides price information for the network's native token against USD.
It fetches historic prices from Yahoo Finance and current prices from CoinGecko.
'''
class PriceService:
  def __init__(self, network_info):
    self._logger = logging.getLogger(__name__)
    self.network_info = network_info
    if network_info.name == "polkadot":
      self.pair_start_date = '2020-08-20'
    else: # Kusama
      self.pair_start_date = '2019-12-12'
    self.pair = f"{self.network_info.native_asset.name}-USD"

    self._today = datetime.datetime.now().strftime("%Y-%m-%d")
    self._historic_prices_df = None
    self.current_price = None

  def load_prices(self):
    # historic prices
    self._historic_prices_df = yf.download(self.pair, self.pair_start_date, self._today)
    self._historic_prices_df.index = pd.to_datetime(self._historic_prices_df.index, utc=True)
    
    if self._historic_prices_df.empty:
      raise ValueError(f"No historic prices found for {self.pair} from {self.pair_start_date} to {self._today}")

    # current price
    ticker = self.network_info.name
    url = f'https://api.coingecko.com/api/v3/simple/price?ids={ticker}&vs_currencies=usd'
    response = requests.get(url)
    
    if response.status_code != 200:
      raise ValueError(f"Failed to fetch current price from CoinGecko: {response.status_code} - {response.text}")

    data = response.json()
    self.current_price = data[ticker]['usd']

  def _get_historic_price(self, date):
    if self._historic_prices_df is None:
      raise ValueError("Historic prices not available. Call get_historic_price() first.")
    closest_date = self._historic_prices_df.index.get_indexer([date], method='nearest')[0]

    if closest_date == -1:
      raise ValueError(f"No historic price found for date {date}")

    return self._historic_prices_df.iloc[closest_date]['Close'].iloc[0]

  '''
  Converts an amount of an asset to another asset.
  Currently only conversions to/from USD and the network's native token are supported.
  If a date is provided, the conversion is done using the price at that date. 
  Else, the current price is used.
  '''
  def convert_asset_value(self, input_asset: AssetKind, input_amount: float, output_asset: AssetKind, date = None) -> float:

    stables = [AssetKind.USDC, AssetKind.USDT]

    if input_asset == output_asset or (input_asset in stables and output_asset in stables):
       return input_amount

    if input_asset == AssetKind.DED:
      return 0. # DED is not worth anything

    # Only USD <> network token conversions are supported for now
    assert input_asset in stables or output_asset in stables, "Only USD conversions are supported for now"
    network_asset = AssetKind.DOT if self.network_info.name == "polkadot" else AssetKind.KSM
    assert input_asset == network_asset or output_asset == network_asset, "Only conversions to/from the network's native token are supported for now"

    if input_asset in stables:
      # USD -> NETWORK_TOKEN
      if date:
        conversion_rate = self._get_historic_price(date)
      else:
        conversion_rate = self.current_price
      return input_amount / conversion_rate
    
    # NETWORK_TOKEN -> USD
    if date:
      conversion_rate = self._get_historic_price(date)
    else:
      conversion_rate = self.current_price
    return input_amount * conversion_rate