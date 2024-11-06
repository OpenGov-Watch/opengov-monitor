from data_providers.subsquare import SubsquareProvider
from data_providers.price_service import PriceService
from data_providers.network_info import NetworkInfo
from spreadsheet_sink import SpreadsheetSink
import json

import os
from flask import Flask
app = Flask(__name__)

import logging
logging.basicConfig(level=logging.DEBUG)
logging.getLogger("yfinance").setLevel(logging.INFO)
logging.getLogger("urllib3").setLevel(logging.INFO)
logging.getLogger("peewee").setLevel(logging.INFO)
logging.getLogger("google").setLevel(logging.INFO)

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)



def transform_referenda(df, network_info):
  df["url"] = df.index.to_series().apply(lambda x:f'=HYPERLINK("{network_info.referenda_url}{x}", {x})')
  # sort url to the front
  df = df[["url"] + [col for col in df.columns if col != "url"]]
  return df

def transform_treasury(df, network_info):
  df["ref_url"] = df["ref_num"].apply(lambda x:f'=HYPERLINK("{network_info.referenda_url}{x}", {x})')
  df["url"] = df["id"].apply(lambda x:f'=HYPERLINK("{network_info.treasury_url}{x}", {x})')
  # sort url to the front
  df = df[["url", "ref_url"] + [col for col in df.columns if col not in ["url", "ref_url"]]]
  return df

def transform_child_bounties(df, network_info):
  df["url"] = df.index.to_series().apply(lambda x:f'=HYPERLINK("{network_info.child_bounty_url}{x}", {x})')
  # sort url to the front
  df = df[["url"] + [col for col in df.columns if col != "url"]]
  return df

@app.route("/")
def main():
  try:
    # Preconditions

    ## Parameters
    network = "polkadot"
    # network = "kusama"
    explorer = "subsquare"
    spreadsheet_id = os.environ.get('OPENGOV_MONITOR_SPREADSHEET_ID')
    if spreadsheet_id is None:
      logger.error("OPENGOV_MONITOR_SPREADSHEET_ID environment variable not set. Defaulting to test spreadsheet.")
      spreadsheet_id = "1TdAAQogfMEKAKX1FNRj6W0exVIjPySw0yHrf397wU-Q"
    assert spreadsheet_id is not None, "Please set the OPENGOV_MONITOR_SPREADSHEET_ID environment variable"

    credentials_string = os.environ.get('OPENGOV_MONITOR_CREDENTIALS')
    if credentials_string is None:
      logger.error("OPENGOV_MONITOR_CREDENTIALS environment variable not set. Trying to read from file.")
      credentials_string = open("credentials.json").read()
    assert credentials_string is not None, "Please configure the OPENGOV_MONITOR_CREDENTIALS environment variable or provide a credentials.json file"
    credentials_json = json.loads(credentials_string)
    
    # set ´first_run` to True to ignore some sanity checks and allow the spreadsheet to be empty initially
    referenda_to_fetch = 1e6
    treasury_proposals_to_fetch = 0
    child_bounties_to_fetch = 0
      

    network_info = NetworkInfo(network, explorer)
    price_service = PriceService(network_info)
    #provider = PolkassemblyProvider(network_info, price_service)
    provider = SubsquareProvider(network_info, price_service)
    spreadsheet_sink = SpreadsheetSink(credentials_json)
    spreadsheet_sink.connect_to_gspread()

    # Fetch Data
    ## Prices  
    logging.debug("Fetching prices")
    price_service.load_prices()

    # Fetch and sink referenda
    if referenda_to_fetch > 0:   
      logging.debug("Fetching referenda")
      referenda_df = provider.fetch_referenda(referenda_to_fetch)
      referenda_df = transform_referenda(referenda_df, network_info)

      logger.debug("Updating Referenda worksheet")
      spreadsheet_sink.update_worksheet(spreadsheet_id, "Referenda", referenda_df, allow_empty_first_row=True)

    # Fetch and sink treasury proposals
    if treasury_proposals_to_fetch > 0:
      logging.debug("Fetching treasury proposals")
      treasury_df = provider.fetch_treasury_proposals(treasury_proposals_to_fetch)

      logger.debug("Updating Treasury worksheet")
      spreadsheet_sink.update_worksheet(spreadsheet_id, "Treasury", treasury_df)

    # Fetch and sink child bounties
    if child_bounties_to_fetch > 0:
      logging.debug("Fetching child bounties")
      child_bounties_df = provider.fetch_child_bounties(child_bounties_to_fetch)
      child_bounties_df = transform_child_bounties(child_bounties_df, network_info)

      logger.debug("Updating Child Bounties worksheet")
      spreadsheet_sink.update_worksheet(spreadsheet_id, "Child Bounties", child_bounties_df, allow_empty_first_row=True)

    return "ok"

  except Exception as e:
    logger.error(f"An error occurred: {e}", exc_info=True)
    return f"error"

if __name__ == "__main__":
  app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))