from data_providers.subsquare import SubsquareProvider
from data_providers.polkassembly import PolkassemblyProvider
from data_providers.price_service import PriceService
from data_providers.network_info import NetworkInfo

# -*- coding: utf-8 -*-
## Imports"""

import pandas as pd
import datetime
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)



"""# Update Spreadsheet

Our strategy for updating is as follows:
- we read the current spreadsheet
- we determine
  - which rows already exist and will be updated --> update_df
  - which rows from our transform are missing from the sheet --> append_df
- we will then prepare a dataframe that can replace the current cells without destroying other data

Warning:
This function manipulates the df index. might be unsafe to use if the df is reused later
Assumes that the index of df is called ref_id and that there is a column ref_url that contains hyperlinks
The worksheet and the df must have the same columns in the same order

"""

from google.oauth2.service_account import Credentials
import gspread
import re



# Define the function to extract ID
def extract_id(input_string):
    # Regular expression to match the ID at the end of the string
    match = re.search(r',\s(\d+)\)$', input_string)
    # Extract and return the ID if a match is found
    if match:
        return match.group(1)
    # Return None or some default value if no ID is found
    return None

def connect_to_gspread():
  # Use the JSON key you just downloaded
  scope = ['https://spreadsheets.google.com/feeds',
          'https://www.googleapis.com/auth/drive']
  creds = Credentials.from_service_account_file('credentials.json', scopes=scope)
  gc = gspread.authorize(creds)
  return gc


def update_worksheet(gc, name, df, spreadsheet_id):

  # copy the df to avoid modifying the original
  df = df.copy()

  def _format_date(timestamp):
    if pd.isnull(timestamp):
        raise Exception("implement a warning or contract around this method")
    return (timestamp.date()-datetime.date(1900,1,1)).days # days since 1900-01-01


  # The credentialed user email needs to have access to the Google Sheet
  spreadsheet = gc.open_by_key(spreadsheet_id)
  # load the data
  worksheet = spreadsheet.worksheet(name)
  column_count = len(df.columns)

  # Get all values in the sheet and convert to DataFrame
  range = f'A2:{chr(64+column_count)}{worksheet.row_count}' # chr(65+column_count) finds the right ASCII character starting from A (column 0 -> A, etc...)

  sheet_df = None
  try:
      data = worksheet.get(range, value_render_option="FORMULA")
      sheet_df = pd.DataFrame(data, columns=df.columns)
  except KeyError:
      # Handle the case where 'values' is missing by initializing an empty DataFrame
      # with the same columns as your target DataFrame
      sheet_df = pd.DataFrame(columns=df.columns)
      print("No data found in the specified range.")
  except ValueError as e:
      print(f"column_count {column_count}")
      print(len(data[0]))
      for sublist in data:
        if len(sublist) == 12:
          print(sublist)
          break
      print(e)

  if sheet_df is None:
    raise SystemExit(-1)

  # prepare the spreadsheet for index matching
  sheet_df["id"] = sheet_df["url"].apply(extract_id) # we extract the index from the hyperlink to perform key matching later
  sheet_df.set_index("id", inplace=True)


  # transformations to be compatible with the Google Sheets API
  df["created"] = df["created"].apply(_format_date)
  df["last_status_change"] = df["last_status_change"].apply(_format_date)


  # build deltas
  df.index = df.index.astype(str) # coerce numerical indexes into strings to allow comparison
  update_df = df[df.index.isin(sheet_df.index)]
  append_df = df[~df.index.isin(sheet_df.index)]


  # make sure columns can be converted to json
  sheet_df["USD_latest"] = sheet_df["USD_latest"].astype("object").fillna("")

  # Update the cells with new values
  sheet_df.update(update_df)
  data_to_update = sheet_df.values.tolist()
  worksheet.update(data_to_update, range, raw=False)

  # Append new rows at the bottom
  if not append_df.empty:
    worksheet.append_rows(append_df.fillna('').values.tolist(), value_input_option='USER_ENTERED')

  # Update Filter
  def _filterRequest():
    return {
      "setBasicFilter": {
          "filter": {
              "range": {
                  "sheetId": worksheet.id,
                  "startRowIndex": 0,
                  "startColumnIndex": 0,
              }
          }
        }
      }

  def _sortRequest():
    return {
      "sortRange": {
          "range": {
              "sheetId": worksheet.id,
              "startRowIndex": 1,  # Skip the header row
              "startColumnIndex": 0,
              "endColumnIndex": worksheet.col_count
          },
          "sortSpecs": [
              {
                  "dimensionIndex": 0,  # Index of the column to sort by (0 for the first column)
                  "sortOrder": "DESCENDING"  # Sort order (ASCENDING or DESCENDING)
              }
          ]
      }
  }

  requests = []
  requests.append(_filterRequest())
  requests.append(_sortRequest())

  spreadsheet.batch_update({"requests": requests})

  spreadsheet.client.session.close()

def transform_referenda(df, network_info):
  df["url"] = df.index.to_series().apply(lambda x:f'=HYPERLINK("{network_info.referenda_url}{x}", {x})')
  # sort url to the front
  df = df[["url"] + [col for col in df.columns if col != "url"]]
  return df


def main():
  # Preconditions

  ## Parameters
  network = "polkadot"
  # network = "kusama"
  explorer = "subsquare"
  spreadsheet_id = "14jhH_zdDivhGqOzDyCGiTlH_s-WcPLRoXqwAsQvfNMw" # Monitoring DEV
  referenda_to_fetch = 10
  treasury_proposals_to_fetch = 0

  network_info = NetworkInfo(network, explorer)
  price_service = PriceService(network_info)
  provider = PolkassemblyProvider(network_info, price_service)

  logging.debug("Connecting to Google Sheets")
  gc = connect_to_gspread()

  # Fetch Data
  ## Prices  
  logging.debug("Fetching prices")
  price_service.load_prices()
  """### Fetch Referenda entries"""
  #provider = SubsquareProvider(network)
  logging.debug("Fetching referenda")
  referenda_df = provider.fetch_referenda(referenda_to_fetch)
  referenda_df = transform_referenda(referenda_df, network_info)
  logger.debug("Updating Referenda worksheet")
  update_worksheet(gc, "Referenda", referenda_df, spreadsheet_id)

  """### Fetch Treasury entries"""

  if treasury_proposals_to_fetch > 0:
    logging.debug("Fetching treasury proposals")
    treasury_df = provider.fetch_treasury_proposals(treasury_proposals_to_fetch)
    logger.debug("Updating Treasury worksheet")
    update_worksheet(gc, "Treasury", treasury_df, spreadsheet_id)



if __name__ == "__main__":
    main()