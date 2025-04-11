import pandas as pd
import logging
from .auth import GoogleAuth
from . import utils
from datetime import datetime
import json

class SpreadsheetSink:
    """Handle data output to Google Spreadsheets."""

    def __init__(self, credentials_file):
        self.auth = GoogleAuth(credentials_file)
        self._logger = logging.getLogger("data_sinks.google.spreadsheet")
        self._current_operation = None

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

    def _find_sequence_gaps(self, sorted_ids):
        """Find gaps in ID sequence."""
        gaps = []
        for i in range(len(sorted_ids) - 1):
            if sorted_ids[i + 1] - sorted_ids[i] > 1:
                gaps.append({
                    "start": sorted_ids[i],
                    "end": sorted_ids[i + 1],
                    "gap_size": sorted_ids[i + 1] - sorted_ids[i] - 1
                })
        return gaps

    def _prepare_index_matching(self, sheet_df):
        """Prepare sheet DataFrame for index matching."""
        sheet_df = sheet_df.copy()
        
        # Log the ID extraction process
        self._logger.debug("Starting ID extraction from URLs")
        original_urls = sheet_df["url"].tolist()
        sheet_df["id"] = sheet_df["url"].apply(utils.extract_id)
        
        # Check for any ID extraction issues
        extracted_ids = sheet_df["id"].tolist()
        self._logger.info(f"Extracted {len(extracted_ids)} IDs from {len(original_urls)} URLs")
        
        # Log any potential ID issues
        if None in extracted_ids or '' in extracted_ids:
            self._logger.warning("Found empty or null IDs during extraction", 
                               extra={"problematic_urls": [url for url, id in zip(original_urls, extracted_ids) 
                                                         if not id]})

        # Check for ID sequence gaps
        sorted_ids = sorted([int(id) for id in extracted_ids if str(id).isdigit()])
        if sorted_ids:
            gaps = self._find_sequence_gaps(sorted_ids)
            if gaps:
                self._logger.warning("Found gaps in ID sequence", 
                                   extra={"gaps": gaps, 
                                         "operation": self._current_operation})

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
        
        # Log the state before processing
        self._logger.info("Processing data deltas", 
                         extra={
                             "incoming_records": len(df),
                             "existing_records": len(sheet_df),
                             "incoming_ids": df.index.tolist(),
                             "existing_ids": sheet_df.index.tolist()
                         })

        update_df = df[df.index.isin(sheet_df.index)]
        append_df = df[~df.index.isin(sheet_df.index)]

        # Log the results
        self._logger.info("Delta processing complete", 
                         extra={
                             "updates": len(update_df),
                             "appends": len(append_df),
                             "updated_ids": update_df.index.tolist(),
                             "appended_ids": append_df.index.tolist()
                         })

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
        operation_id = f"{name}_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}"
        self._current_operation = operation_id
        
        self._logger.info(f"Starting worksheet update", 
                         extra={
                             "operation_id": operation_id,
                             "worksheet": name,
                             "spreadsheet_id": spreadsheet_id,
                             "incoming_records": len(df)
                         })

        try:
            # Existing implementation with added logging
            worksheet, range_string, column_count = self._setup_worksheet(spreadsheet_id, name, df)
            
            sheet_df = self._load_sheet_data(worksheet, range_string, df.columns, allow_empty_first_row)
            if sheet_df is None:
                raise ValueError("The spreadsheet is not in the expected format")

            # Log the state before any transformations
            self._logger.debug("Initial data loaded", 
                             extra={
                                 "operation_id": operation_id,
                                 "sheet_rows": len(sheet_df),
                                 "sheet_columns": len(sheet_df.columns)
                             })

            sheet_df = self._prepare_index_matching(sheet_df)
            df = self._transform_dates(df)
            df = self._prepare_columns_for_json(df)

            update_df, append_df = self._process_deltas(df, sheet_df)
            
            # Log before applying updates
            self._logger.info("Preparing to apply updates", 
                            extra={
                                "operation_id": operation_id,
                                "updates": len(update_df),
                                "appends": len(append_df)
                            })

            self._apply_updates(worksheet, sheet_df, update_df, append_df, range_string)
            self._apply_formatting(worksheet)

            self._logger.info("Worksheet update completed successfully", 
                            extra={
                                "operation_id": operation_id,
                                "final_row_count": worksheet.row_count
                            })

        except Exception as e:
            self._logger.error(f"Error updating worksheet", 
                             extra={
                                 "operation_id": operation_id,
                                 "error": str(e)
                             },
                             exc_info=True)
            raise
        finally:
            self._current_operation = None

    def close(self):
        """Close the connection."""
        if self.auth.client:
            self.auth.client.session.close() 