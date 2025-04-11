import pandas as pd
import logging
from .auth import GoogleAuth
from . import utils

class SpreadsheetSink:
    """Handle data output to Google Spreadsheets."""

    def __init__(self, credentials_file):
        self.auth = GoogleAuth(credentials_file)
        self._logger = logging.getLogger(__name__)

    def connect(self):
        """Connect to Google Sheets."""
        self.auth.connect()

    def _setup_worksheet(self, spreadsheet_id, name, df):
        """Setup and validate worksheet connection."""
        assert self.auth.client is not None, "You need to connect to Google Sheets first"
        spreadsheet = self.auth.client.open_by_key(spreadsheet_id)
        worksheet = spreadsheet.worksheet(name)
        column_count = len(df.columns)
        
        assert column_count <= 26, "Too many columns for the current implementation"
        range_string = f'A2:{chr(64 + column_count)}{worksheet.row_count}'
        
        return worksheet, range_string, column_count

    def _load_sheet_data(self, worksheet, range_string, df_columns, allow_empty_first_row=False):
        """Load and validate sheet data."""
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
        """Prepare sheet DataFrame for index matching."""
        sheet_df = sheet_df.copy()
        sheet_df["id"] = sheet_df["url"].apply(utils.extract_id)
        sheet_df.set_index("id", inplace=True)
        return sheet_df

    def _transform_dates(self, df):
        """Transform date columns to Google Sheets format."""
        df = df.copy()
        for col in ["proposal_time", "latest_status_change"]:
            if col in df.columns:
                df[col] = df[col].apply(utils.format_date)
        return df

    def _prepare_columns_for_json(self, df):
        """Prepare columns for JSON conversion."""
        columns_to_convert = [
            "DOT", "USD_proposal_time", "tally.ayes", "tally.nays",
            "tally.turnout", "tally.total", "proposal_time",
            "latest_status_change", "USD_latest"
        ]
        df = df.copy()
        for column in columns_to_convert:
            if column in df.columns:
                # Convert to string first to ensure object type
                df[column] = df[column].astype(str).astype("object")
        return df

    def _process_deltas(self, df, sheet_df):
        """Process updates and new data."""
        df = df.copy()
        df.index = df.index.astype(str)
        update_df = df[df.index.isin(sheet_df.index)]
        append_df = df[~df.index.isin(sheet_df.index)]
        return update_df, append_df

    def _apply_updates(self, worksheet, sheet_df, update_df, append_df, range_string):
        """Apply updates and appends to the worksheet."""
        sheet_df.update(update_df)
        data_to_update = sheet_df.values.tolist()
        worksheet.update(data_to_update, range_string, raw=False)

        if not append_df.empty:
            worksheet.append_rows(
                append_df.fillna('').values.tolist(),
                value_input_option='USER_ENTERED'
            )

    def _apply_formatting(self, worksheet):
        """Apply filter and sort to the worksheet."""
        requests = []
        requests.append(utils.create_filter_request(worksheet.id))
        requests.append(utils.create_sort_request(worksheet.id, worksheet.col_count))
        worksheet.spreadsheet.batch_update({"requests": requests})

    def update_worksheet(self, spreadsheet_id, name, df, allow_empty_first_row=False):
        """Update a worksheet with new data, handling both updates and appends."""
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
        self._apply_formatting(worksheet)

    def close(self):
        """Close the connection."""
        if self.auth.client:
            self.auth.client.session.close() 