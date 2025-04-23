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
            
            # Handle empty data case
            if not data or (len(data) == 1 and len(data[0]) == 0):
                if allow_empty_first_row:
                    self._logger.info("No data found in the specified range. Initializing an empty DataFrame.")
                    return pd.DataFrame(columns=df_columns)
                else:
                    self._logger.error("Empty first row found in the sheet.")
                    raise SystemExit(-1)
            
            # Validate column count
            if len(data[0]) != len(df_columns):
                self._logger.error(f"Column count mismatch. Expected {len(df_columns)}, got {len(data[0])}")
                raise ValueError(f"Column count mismatch in sheet data. Expected {len(df_columns)} columns.")
            
            sheet_df = pd.DataFrame(data, columns=df_columns)
            return sheet_df
            
        except Exception as e:
            self._logger.error("Error loading sheet data", extra={"error": str(e)})
            raise

    def _find_sequence_gaps(self, sorted_ids):
        """Find gaps in ID sequence."""
        try:
            # Convert all IDs to integers
            numeric_ids = [int(id) for id in sorted_ids]
            gaps = []
            for i in range(len(numeric_ids) - 1):
                if numeric_ids[i + 1] - numeric_ids[i] > 1:
                    gaps.append({
                        "start": numeric_ids[i],
                        "end": numeric_ids[i + 1],
                        "gap_size": numeric_ids[i + 1] - numeric_ids[i] - 1
                    })
            return gaps
        except (ValueError, TypeError):
            return []  # Return empty list for non-numeric IDs

    def _prepare_index_matching(self, sheet_df):
        """Extract IDs from URLs and set them as index."""
        sheet_df = sheet_df.copy()
        original_urls = sheet_df['url'].tolist()
        extracted_ids = []
        
        for url in original_urls:
            try:
                id_value = utils.extract_id(url)
                if id_value is None:
                    self._logger.warning(
                        f"Could not extract ID from URL: {url}",
                        extra={"error": "Could not extract numeric ID from URL"}
                    )
                    id_value = pd.NA  # Use pandas NA for missing values
                extracted_ids.append(id_value)
            except Exception as e:
                self._logger.warning(
                    f"Could not extract ID from URL: {url}",
                    extra={"error": str(e)}
                )
                extracted_ids.append(pd.NA)  # Use pandas NA for errors
        
        sheet_df["id"] = extracted_ids
        self._logger.info(f"Extracted {len(extracted_ids)} IDs from {len(original_urls)} URLs")
        
        # Check for ID sequence gaps
        try:
            numeric_ids = [int(id) for id in extracted_ids if pd.notna(id) and str(id).isdigit()]
            if numeric_ids:
                sorted_ids = sorted(numeric_ids)
                gaps = self._find_sequence_gaps(sorted_ids)
                if gaps:
                    self._logger.warning("Found gaps in ID sequence", 
                                       extra={"gaps": gaps, 
                                             "operation": self._current_operation})
        except Exception as e:
            self._logger.warning("Error checking for ID sequence gaps", extra={"error": str(e)})
        
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
        """Apply updates and appends to the worksheet.
        
        Updates are applied as full row replacements - if a row exists in update_df, it completely
        replaces the corresponding row in sheet_df, including setting any columns not present in
        update_df to NaN. This ensures consistent behavior between updates and new rows.
        
        Args:
            worksheet: The Google Sheets worksheet to update
            sheet_df: DataFrame containing current sheet data
            update_df: DataFrame containing rows to update or add
            append_df: DataFrame containing rows to append
            range_string: The range in the worksheet to update (e.g., "A2:D100")
        """
        # Collect stats for all DataFrames
        stats = {
            "sheet_df": self._get_dataframe_stats(sheet_df, "sheet"),
            "update_df": self._get_dataframe_stats(update_df, "update"),
            "append_df": self._get_dataframe_stats(append_df, "append"),
            "range_string": range_string
        }
        
        self._logger.debug("DataFrame analysis before update", extra={"dataframe_stats": stats})
        
        # Handle updates
        if not update_df.empty:
            # Convert numeric columns to float64
            for col in update_df.columns:
                if col in sheet_df.columns and pd.api.types.is_numeric_dtype(sheet_df[col]):
                    update_df[col] = pd.to_numeric(update_df[col], errors='coerce')
            
            # Update rows - full row replacement for matching indices
            for idx in update_df.index:
                if idx in sheet_df.index:
                    # Replace entire row with update data
                    sheet_df.loc[idx] = update_df.loc[idx]
                else:
                    # Add new row
                    sheet_df.loc[idx] = update_df.loc[idx]
        
        # Replace NaN values with empty strings to ensure JSON compliance
        sheet_df.fillna('', inplace=True)
        data_to_update = sheet_df.values.tolist()
        worksheet.update(data_to_update, range_string, raw=False)
        
        # Log stats after update
        post_update_stats = self._get_dataframe_stats(sheet_df, "post_update")
        self._logger.debug("DataFrame analysis after update", extra={"post_update_stats": post_update_stats})
        
        # Handle appends
        if not append_df.empty:
            # Convert numeric columns in append_df
            for col in append_df.columns:
                if col in sheet_df.columns and pd.api.types.is_numeric_dtype(sheet_df[col]):
                    append_df[col] = pd.to_numeric(append_df[col], errors='coerce')
            
            # Append new rows
            worksheet.append_rows(
                append_df.fillna('').values.tolist(),
                value_input_option='USER_ENTERED'
            )
            
            # Log final stats after append
            final_df = pd.concat([sheet_df, append_df])
            final_stats = self._get_dataframe_stats(final_df, "final")
            self._logger.debug("DataFrame analysis after append", extra={"final_stats": final_stats})

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

    def _find_gaps(self, index):
        """Find gaps in a numeric index sequence.
        
        Args:
            index: pandas.Index - The index to check for gaps
            
        Returns:
            list[tuple]: List of (start, end) tuples representing gaps
        """
        if len(index) < 2:
            return []
        
        # Try to convert index to numeric
        try:
            numeric_index = pd.to_numeric(index, errors='coerce')
            if numeric_index.isna().any():
                return []  # If any conversion failed, treat as no gaps
            
            sorted_idx = sorted(numeric_index.dropna())
            gaps = []
            for i in range(len(sorted_idx) - 1):
                if sorted_idx[i + 1] - sorted_idx[i] > 1:
                    gaps.append((sorted_idx[i], sorted_idx[i + 1]))
            return gaps
        except (ValueError, TypeError):
            return []  # Non-numeric indices have no gaps

    def _get_dataframe_stats(self, df, name):
        """Get statistical information about a DataFrame."""
        if df is None:
            raise AttributeError("Cannot get stats for None DataFrame")
        
        if df.empty:
            return {
                "name": name,
                "size": (0, 0),
                "index_range": "empty",
                "index_is_continuous": True,
                "gaps": []
            }
        
        # Convert index to numeric if possible
        try:
            numeric_index = pd.to_numeric(df.index, errors='coerce')
            if not numeric_index.isna().any():
                df = df.copy()
                df.index = numeric_index
        except (ValueError, TypeError):
            pass
        
        # Check if index is continuous
        is_continuous = True
        if len(df.index) > 1:
            sorted_idx = sorted(df.index)
            try:
                for i in range(len(sorted_idx) - 1):
                    if sorted_idx[i + 1] - sorted_idx[i] > 1:
                        is_continuous = False
                        break
            except TypeError:
                # Non-numeric indices are always considered continuous
                is_continuous = True
        
        return {
            "name": name,
            "size": df.shape,
            "index_range": f"min={df.index.min()} to max={df.index.max()}",
            "index_is_continuous": is_continuous,
            "gaps": self._find_gaps(df.index)
        }