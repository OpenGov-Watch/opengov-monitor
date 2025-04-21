import pandas as pd
import logging
from .auth import GoogleAuth
from . import utils
from datetime import datetime
import json
from typing import Union, List, Tuple, Dict, Any, Optional, cast, TypeVar, Protocol
import numpy as np
from pandas import Series, Index, DataFrame
from pandas.core.dtypes.common import is_numeric_dtype
from requests import Session
import re

class ClientWithSession(Protocol):
    """Protocol defining a client with a session attribute."""
    session: Session

class SpreadsheetSink:
    """A class for handling data output to Google Spreadsheets with smart update capabilities.

    This class provides functionality to update Google Sheets with pandas DataFrames,
    handling both updates to existing rows and appending new rows. It includes features
    for data type conversion, ID-based row matching, and automatic formatting.

    Key features:
    - Smart updates: Updates existing rows and appends new ones based on ID matching
    - Type conversion: Handles numpy types, dates, and JSON data automatically
    - Data validation: Ensures data integrity and column count matching
    - Automatic formatting: Applies filters and sorting to worksheets
    - Comprehensive logging: Tracks all operations with detailed statistics

    Requirements:
    - The worksheet must have a 'url' column containing hyperlinks with extractable IDs
    - The worksheet cannot have more than 26 columns (A-Z)
    - The first row (A1:Z1) is reserved for column headers
    - Data starts from row 2 (A2:Zn)

    Example:
        >>> sink = SpreadsheetSink('credentials.json')
        >>> sink.connect()
        >>> df = pd.DataFrame({
        ...     'url': ['https://example.com/1'],
        ...     'value': [100],
        ...     'date': [pd.Timestamp('2024-01-01')]
        ... })
        >>> sink.update_worksheet('spreadsheet_id', 'Sheet1', df)
        >>> sink.close()
    """

    def __init__(self, credentials_file):
        """Initialize the SpreadsheetSink.

        Args:
            credentials_file: Path to Google service account credentials JSON file
                or a dictionary containing the credentials.
        """
        # type: ignore[assignment]  # GoogleAuth initialization
        self.auth = GoogleAuth(credentials_file)
        self._logger = logging.getLogger("data_sinks.google.spreadsheet")
        self._current_operation = None

    def connect(self):
        """Connect to Google Sheets API.
        
        This method must be called before any other operations.
        It establishes the connection using the credentials provided during initialization.
        """
        # type: ignore[attr-defined]  # GoogleAuth connect method
        self.auth.connect()

    def _setup_worksheet(self, spreadsheet_id, name, df):
        """Setup and validate worksheet connection."""
        assert self.auth.client is not None, "You need to connect to Google Sheets first"
        # type: ignore[attr-defined]  # Google Sheets client open_by_key
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
        """Apply updates to the worksheet."""
        # Log initial state
        self._logger.debug(
            "Starting updates",
            extra={
                "range_string": range_string,
                "dataframe_stats": {
                    "sheet_df": self._get_dataframe_stats(sheet_df, "sheet_df"),
                    "update_df": self._get_dataframe_stats(update_df, "update_df"),
                    "append_df": self._get_dataframe_stats(append_df, "append_df")
                }
            }
        )

        # Make a copy of sheet_df to avoid modifying the original
        sheet_df = sheet_df.copy()

        # Update existing rows
        if not update_df.empty:
            # Convert update_df to native types
            update_df = self._convert_numpy_types(update_df)
            
            # Update sheet_df with new values
            for idx in update_df.index:
                if idx in sheet_df.index:
                    # First set all columns to empty string for this row
                    for col in sheet_df.columns:
                        if col not in update_df.columns:
                            sheet_df.loc[idx, col] = ''
                    
                    # Then update with new values
                    for col in update_df.columns:
                        if col in sheet_df.columns:
                            value = update_df.loc[idx, col]
                            # Convert string numbers to float
                            if isinstance(value, str) and value.replace('.', '').isdigit():
                                value = float(value)
                            sheet_df.loc[idx, col] = value

            # Log post-update stats
            self._logger.debug(
                "Updated existing rows",
                extra={"post_update_stats": self._get_dataframe_stats(update_df, "update_df")}
            )

        # Convert sheet_df to list of lists for update
        update_data = self._convert_to_native_types(sheet_df)
        
        # Always update the worksheet to maintain state
        worksheet.update(
            range_string,
            update_data,
            raw=False
        )

        # Append new rows
        if not append_df.empty:
            # Convert append_df to native types
            append_df = self._convert_numpy_types(append_df)
            
            # Convert to list of lists for append
            append_data = self._convert_to_native_types(append_df)
            
            # Append new rows
            worksheet.append_rows(
                append_data,
                value_input_option='USER_ENTERED'
            )

            # Log post-append stats
            self._logger.debug(
                "Appended new rows",
                extra={"post_append_stats": self._get_dataframe_stats(append_df, "append_df")}
            )

    def _apply_formatting(self, worksheet):
        """Apply filter and sort to the worksheet."""
        requests = []
        requests.append(utils.create_filter_request(worksheet.id))
        requests.append(utils.create_sort_request(worksheet.id, worksheet.col_count))
        worksheet.spreadsheet.batch_update({"requests": requests})

    def update_worksheet(self, spreadsheet_id, name, df, allow_empty_first_row=False):
        """Update a worksheet with new data, handling both updates and appends.

        This method performs a smart update of the worksheet by:
        1. Loading existing data and matching rows by ID extracted from URLs
        2. Converting dates and JSON data to appropriate formats
        3. Updating existing rows with new values
        4. Appending new rows that don't exist in the sheet
        5. Applying formatting (filters and sorting)

        Args:
            spreadsheet_id (str): The ID of the Google Spreadsheet (from the URL)
            name (str): The name of the worksheet to update
            df (pd.DataFrame): DataFrame containing the new data. Must have a 'url' column
                and matching column names with the worksheet
            allow_empty_first_row (bool, optional): If True, allows initialization of
                empty worksheets. Defaults to False.

        Raises:
            ValueError: If the spreadsheet format is invalid or column count mismatch
            SystemExit: If first row is empty and allow_empty_first_row is False
            Exception: For other errors (auth, connection, etc.)

        Note:
            - The method uses the 'url' column to extract IDs for row matching
            - Updates preserve data types (numeric, string, etc.)
            - New rows are appended at the end of the worksheet
            - The worksheet is automatically sorted after updates
        """
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
        """Close the connection to Google Sheets API.
        
        This method should be called when done using the SpreadsheetSink
        to properly clean up resources.
        """
        if self.auth.client:
            client = cast(ClientWithSession, self.auth.client)
            client.session.close()

    def _find_gaps(self, index: Union[Index, Series]) -> List[Tuple[Any, Any]]:
        """Find gaps in a numeric index sequence."""
        if len(index) < 2:  # type: ignore[arg-type]
            return []
        
        # Try to convert index to numeric
        try:
            numeric_index = pd.to_numeric(index, errors='coerce')
            # Convert to Series to use pandas methods
            numeric_series = pd.Series(numeric_index)
            if numeric_series.isna().any():  # type: ignore[attr-defined]
                return []  # If any conversion failed, treat as no gaps
            
            sorted_idx = numeric_series.dropna().sort_values()
            gaps = []
            for i in range(len(sorted_idx) - 1):
                if sorted_idx.iloc[i + 1] - sorted_idx.iloc[i] > 1:
                    gaps.append((sorted_idx.iloc[i], sorted_idx.iloc[i + 1]))
            return gaps
        except (ValueError, TypeError):
            return []  # Non-numeric indices have no gaps

    def _get_dataframe_stats(self, df: Optional[DataFrame], name: str) -> Dict[str, Any]:
        """Get statistics about a DataFrame."""
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
            # Convert to Series to use pandas methods
            numeric_series = pd.Series(numeric_index)
            
            # If we have any valid numeric values
            if not numeric_series.isna().all():
                # Find gaps in numeric values
                valid_numeric = numeric_series.dropna()
                if len(valid_numeric) > 1:
                    sorted_idx = valid_numeric.sort_values()
                    gaps = []
                    for i in range(len(sorted_idx) - 1):
                        if sorted_idx.iloc[i + 1] - sorted_idx.iloc[i] > 1:
                            gaps.append((float(sorted_idx.iloc[i]), float(sorted_idx.iloc[i + 1])))
                    return {
                        "name": name,
                        "size": df.shape,
                        "index_range": f"min={float(sorted_idx.min())} to max={float(sorted_idx.max())}",
                        "index_is_continuous": True,  # Mixed indices are treated as continuous
                        "gaps": gaps
                    }
        except (ValueError, TypeError):
            pass
        
        # For non-numeric or mixed indices, treat as continuous
        try:
            index_values = list(df.index)
            index_min = min(str(x) for x in index_values if x is not None)
            index_max = max(str(x) for x in index_values if x is not None)
            index_range = f"min={index_min} to max={index_max}"
        except (TypeError, ValueError):
            index_range = "non-numeric index"
        
        return {
            "name": name,
            "size": df.shape,
            "index_range": index_range,
            "index_is_continuous": True,  # Non-numeric indices are always considered continuous
            "gaps": []
        }

    def _convert_numpy_types(self, df):
        """Convert numpy types to native Python types.
        
        Args:
            df (pd.DataFrame): DataFrame to convert
            
        Returns:
            pd.DataFrame: DataFrame with numpy types converted to native Python types
        """
        if df.empty:
            return df

        # Create a copy to avoid modifying the original
        df = df.copy()

        # Convert numpy types to native Python types
        for col in df.columns:
            if pd.api.types.is_numeric_dtype(df[col]):
                df[col] = df[col].apply(
                    lambda x: float(x) if pd.notnull(x) and not isinstance(x, str) else x
                )
            elif pd.api.types.is_datetime64_any_dtype(df[col]):
                df[col] = df[col].apply(
                    lambda x: x.strftime('%Y-%m-%d %H:%M:%S') if pd.notnull(x) else ''
                )
            else:
                df[col] = df[col].apply(lambda x: str(x) if pd.notnull(x) else '')

        return df

    def _convert_to_native_types(self, data):
        """Convert data to native Python types suitable for Google Sheets API.
        
        Args:
            data: DataFrame, Series, or list of lists to convert
            
        Returns:
            List of lists with native Python types suitable for Google Sheets API
        """
        if isinstance(data, (pd.DataFrame, pd.Series)):
            if data.empty:
                return []
            # Convert DataFrame to list of lists
            data = data.values.tolist()
        elif not data:  # Empty list
            return []

        result = []
        for row in data:
            converted_row = []
            for value in row:
                if pd.isna(value):
                    converted_row.append('')
                elif isinstance(value, (np.integer, np.floating)):
                    # Convert numpy numeric types to native Python types
                    converted_row.append(float(value))
                elif isinstance(value, str) and value.replace('.', '').isdigit():
                    # Convert string numbers to float
                    converted_row.append(float(value))
                else:
                    converted_row.append(str(value) if value is not None else '')
            result.append(converted_row)
        return result 