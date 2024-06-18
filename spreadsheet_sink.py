from google.oauth2.service_account import Credentials
import gspread
import pandas as pd
import datetime
import re
import logging
pd.set_option('future.no_silent_downcasting', True)

class SpreadsheetSink:

    def __init__(self, credentials_file):
        self.credentials_file = credentials_file

    def connect_to_gspread(self):
        # Use the JSON key you just downloaded
        scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
        creds = Credentials.from_service_account_file(self.credentials_file, scopes=scope)
        self._gc = gspread.authorize(creds)
        self._logger = logging.getLogger(__name__)
        

    """# Update Spreadsheet

    Our strategy for updating is as follows:
    - we read the current spreadsheet
    - we determine
      - which rows already exist and will be updated --> update_df
      - which rows from our transform are missing from the sheet --> append_df
    - we will then prepare a dataframe that can replace the current cells without destroying other data

    Assumptions:
    - The index of df is called ref_id and that there is a column ref_url that contains hyperlinks
    - The worksheet and the df must have the same columns in the same order

    """
    def update_worksheet(self, spreadsheet_id, name, df, allow_empty_first_row=False):

        assert self._gc is not None, "You need to connect to gspread first"

        # copy the df to avoid modifying the original
        df = df.copy()

        # The credentialed user email needs to have access to the Google Sheet
        spreadsheet = self._gc.open_by_key(spreadsheet_id)
        # load the data
        worksheet = spreadsheet.worksheet(name)
        column_count = len(df.columns)

        # Get all values in the sheet and convert to DataFrame
        assert column_count<=26, "Too many columns for the current implementation"
        range = f'A2:{chr(64 + column_count)}{worksheet.row_count}'  # chr(65+column_count) finds the right ASCII character starting from A (column 0 -> A, etc...)

        sheet_df = None
        try:
            data = worksheet.get(range, value_render_option="FORMULA")
            sheet_df = pd.DataFrame(data, columns=df.columns)
        # except KeyError: # TE 2024-06-18 - I believe this error condition no longer applies - leaving it here to be removed later
        #    # Handle the case where 'values' is missing by initializing an empty DataFrame
        #    # with the same columns as your target DataFrame
        #    sheet_df = pd.DataFrame(columns=df.columns)
        #    logging.warn("No data found in the specified range.")
        except ValueError as e:
            if len(data) == 1 and len(data[0]) == 0:
                if allow_empty_first_row:
                    logging.info("No data found in the specified range. Initializing an empty DataFrame.")
                    sheet_df = pd.DataFrame(columns=df.columns)
                else:
                    logging.error("Empty first row found in the sheet. Use allow_empty_first_row=True to allow this.")
                    raise SystemExit(-1)
            else:
                logging.warn(f"expected column count in sheet: {column_count}")
                logging.warn(f"actual columns in first row: {len(data[0])}")
                logging.warn(e)

        if sheet_df is None:
            raise SystemExit(-1)

        # prepare the spreadsheet for index matching
        sheet_df["id"] = sheet_df["url"].apply(self._extract_id)  # we extract the index from the hyperlink to perform key matching later
        sheet_df.set_index("id", inplace=True)

        # transformations to be compatible with the Google Sheets API
        df["proposal_time"] = df["proposal_time"].apply(self._format_date)
        df["latest_status_change"] = df["latest_status_change"].apply(self._format_date)

        # build deltas
        df.index = df.index.astype(str)  # coerce numerical indexes into strings to allow comparison
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

    def _format_date(self, timestamp):
        if pd.isnull(timestamp):
            raise Exception("implement a warning or contract around this method")
        return (timestamp.date() - datetime.date(1900, 1, 1)).days  # days since 1900-01-01

    # Define the function to extract ID
    def _extract_id(self, input_string):
        # Regular expression to match the ID at the end of the string
        match = re.search(r',\s(\d+)\)$', input_string)
        # Extract and return the ID if a match is found
        if match:
            return match.group(1)
        # Return None or some default value if no ID is found
        return None
