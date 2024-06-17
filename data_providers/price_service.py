import yfinance as yf
import datetime
import requests
from .network_info import NetworkInfo

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
    self._historic_prices_df = self._get_historic_price(self.pair)
    self.current_price = self._get_current_price(self.network_info.name)

  def _get_historic_price(self, pair):
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

  def apply_denomination(self, value):
      if isinstance(value, str):
          if value.startswith("0x"):
              return int(value, 16)/self.network_info.denomination_factor
          return value[:-self.network_info.digits] if len(value) >= self.network_info.digits else "" # cut the digits after the decimal from the string
      elif isinstance (value, (int)):
          return value/self.network_info.denomination_factor
      else:
          raise Exception(f"pls implement me. value {value}, type {type(value)}")
