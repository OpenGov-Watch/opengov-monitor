from google.oauth2.service_account import Credentials
import gspread
import pandas as pd
import datetime
import re
import logging
pd.set_option('future.no_silent_downcasting', True)

class SpreadsheetSink:

    def __init__(self, credentials_file):
        self.credentials = credentials_file

    def connect_to_gspread(self):
        scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
        creds = Credentials.from_service_account_info(self.credentials, scopes=scope)
        self._gc = gspread.authorize(creds)
        self._logger = logging.getLogger(__name__)

    def _create_filter_request(self, worksheet_id):
        """Create a filter request for the worksheet.
        
        Args:
            worksheet_id: The ID of the worksheet to apply the filter to
            
        Returns:
            dict: The filter request configuration
        """
        return {
            "setBasicFilter": {
                "filter": {
                    "range": {
                        "sheetId": worksheet_id,
                        "startRowIndex": 0,
                        "startColumnIndex": 0,
                    }
                }
            }
        }

    def _create_sort_request(self, worksheet_id, worksheet_col_count):
        """Create a sort request for the worksheet.
        
        Args:
            worksheet_id: The ID of the worksheet to sort
            worksheet_col_count: The total number of columns in the worksheet
            
        Returns:
            dict: The sort request configuration
        """
        return {
            "sortRange": {
                "range": {
                    "sheetId": worksheet_id,
                    "startRowIndex": 1,  # Skip the header row
                    "startColumnIndex": 0,
                    "endColumnIndex": worksheet_col_count
                },
                "sortSpecs": [
                    {
                        "dimensionIndex": 0,  # Index of the column to sort by (0 for the first column)
                        "sortOrder": "DESCENDING"  # Sort order (ASCENDING or DESCENDING)
                    }
                ]
            }
        }

    def _format_date(self, timestamp):
        """Format a timestamp into days since 1900-01-01.
        
        Args:
            timestamp: A pandas timestamp object
            
        Returns:
            int: Number of days since 1900-01-01
            
        Raises:
            ValueError: If the timestamp is null
        """
        if pd.isnull(timestamp):
            raise ValueError("Timestamp cannot be null when formatting date")
        return (timestamp.date() - datetime.date(1900, 1, 1)).days

    def _extract_id(self, input_string):
        """Extract ID from a hyperlink string or handle integer IDs.
        
        Args:
            input_string: Either a hyperlink string containing an ID or an integer
            
        Returns:
            str or None: The extracted ID or None if no valid ID found
        """
        if isinstance(input_string, int):
            return None
        
        match = re.search(r',\s(\d+)\)$', input_string)
        return match.group(1) if match else None

    def _setup_worksheet(self, spreadsheet_id, name, df):
        """Setup and validate worksheet connection.
        
        Args:
            spreadsheet_id: The ID of the Google Spreadsheet
            name: The name of the worksheet
            df: The DataFrame containing the data
            
        Returns:
            tuple: (worksheet, range_string, column_count)
            
        Raises:
            AssertionError: If not connected to gspread or if there are too many columns
        """
        assert self._gc is not None, "You need to connect to gspread first"
        spreadsheet = self._gc.open_by_key(spreadsheet_id)
        worksheet = spreadsheet.worksheet(name)
        column_count = len(df.columns)
        
        assert column_count <= 26, "Too many columns for the current implementation"
        range_string = f'A2:{chr(64 + column_count)}{worksheet.row_count}'
        
        return worksheet, range_string, column_count

    def _load_sheet_data(self, worksheet, range_string, df_columns, allow_empty_first_row=False):
        """Load and validate sheet data.
        
        Args:
            worksheet: The worksheet object
            range_string: The range to load data from
            df_columns: The expected columns
            allow_empty_first_row: Whether to allow an empty first row
            
        Returns:
            pd.DataFrame: The loaded sheet data
            
        Raises:
            SystemExit: If empty first row is found and not allowed
            ValueError: If there's a mismatch in column count
        """
        try:
            data = worksheet.get(range_string, value_render_option="FORMULA")
            sheet_df = pd.DataFrame(data, columns=df_columns)
        except ValueError as e:
            if len(data) == 1 and len(data[0]) == 0:
                if allow_empty_first_row:
                    logging.info("No data found in the specified range. Initializing an empty DataFrame.")
                    return pd.DataFrame(columns=df_columns)
                else:
                    logging.error("Empty first row found in the sheet. Use allow_empty_first_row=True to allow this.")
                    raise SystemExit(-1)
            else:
                logging.warning(f"expected column count in sheet: {len(df_columns)}")
                logging.warning(f"actual columns in first row: {len(data[0])}")
                logging.warning(e)
                raise

        return sheet_df

    def _prepare_index_matching(self, sheet_df):
        """Prepare sheet DataFrame for index matching.
        
        Args:
            sheet_df: The sheet DataFrame
            
        Returns:
            pd.DataFrame: DataFrame with ID index
        """
        sheet_df = sheet_df.copy()
        sheet_df["id"] = sheet_df["url"].apply(self._extract_id)
        sheet_df.set_index("id", inplace=True)
        return sheet_df

    def _transform_dates(self, df):
        """Transform date columns to Google Sheets format.
        
        Args:
            df: The DataFrame to transform
            
        Returns:
            pd.DataFrame: DataFrame with transformed dates
        """
        df = df.copy()
        for col in ["proposal_time", "latest_status_change"]:
            if col in df.columns:
                df[col] = df[col].apply(self._format_date)
        return df

    def _prepare_columns_for_json(self, df):
        """Prepare columns for JSON conversion.
        
        Args:
            df: The DataFrame to prepare
            
        Returns:
            pd.DataFrame: DataFrame with prepared columns
        """
        columns_to_convert = [
            "DOT", "USD_proposal_time", "tally.ayes", "tally.nays",
            "tally.turnout", "tally.total", "proposal_time",
            "latest_status_change", "USD_latest"
        ]
        df = df.copy()
        for column in columns_to_convert:
            if column in df.columns:
                df[column] = df[column].astype("object").fillna("")
        return df

    def _process_deltas(self, df, sheet_df):
        """Process updates and new data.
        
        Args:
            df: The new data DataFrame
            sheet_df: The existing sheet DataFrame
            
        Returns:
            tuple: (update_df, append_df)
        """
        df = df.copy()
        df.index = df.index.astype(str)
        update_df = df[df.index.isin(sheet_df.index)]
        append_df = df[~df.index.isin(sheet_df.index)]
        return update_df, append_df

    def _apply_updates(self, worksheet, sheet_df, update_df, append_df, range_string):
        """Apply updates and appends to the worksheet.
        
        Args:
            worksheet: The worksheet object
            sheet_df: The sheet DataFrame
            update_df: DataFrame with rows to update
            append_df: DataFrame with rows to append
            range_string: The range to update
        """
        sheet_df.update(update_df)
        data_to_update = sheet_df.values.tolist()
        worksheet.update(data_to_update, range_string, raw=False)

        if not append_df.empty:
            worksheet.append_rows(
                append_df.fillna('').values.tolist(),
                value_input_option='USER_ENTERED'
            )

    def update_worksheet(self, spreadsheet_id, name, df, allow_empty_first_row=False):
        """Update a worksheet with new data, handling both updates and appends.
        
        Args:
            spreadsheet_id: The ID of the Google Spreadsheet
            name: The name of the worksheet to update
            df: The DataFrame containing the new data
            allow_empty_first_row: Whether to allow an empty first row in the sheet
            
        Raises:
            AssertionError: If not connected to gspread or if there are too many columns
            ValueError: If the spreadsheet format is invalid
            SystemExit: If empty first row is found and not allowed
        """
        # Setup and get worksheet
        worksheet, range_string, column_count = self._setup_worksheet(spreadsheet_id, name, df)

        # Load existing data
        sheet_df = self._load_sheet_data(worksheet, range_string, df.columns, allow_empty_first_row)
        if sheet_df is None:
            raise ValueError("The spreadsheet is not in the expected format. Most likely the first row doesn't match")

        # Prepare data for processing
        sheet_df = self._prepare_index_matching(sheet_df)
        df = self._transform_dates(df)
        df = self._prepare_columns_for_json(df)

        # Process updates and new data
        update_df, append_df = self._process_deltas(df, sheet_df)

        # Apply updates
        self._apply_updates(worksheet, sheet_df, update_df, append_df, range_string)

        # Apply filter and sort
        requests = []
        requests.append(self._create_filter_request(worksheet.id))
        requests.append(self._create_sort_request(worksheet.id, worksheet.col_count))

        worksheet.spreadsheet.batch_update({"requests": requests})
        worksheet.spreadsheet.client.session.close()
