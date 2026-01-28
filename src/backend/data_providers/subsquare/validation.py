"""
Data validation and continuity check utilities for Subsquare data.
"""

import logging
import pandas as pd
from typing import Tuple, List, Optional

from .call_indices import SPENDER_TRACKS


def check_continuous_ids(df: pd.DataFrame, id_field: str = None) -> Tuple[bool, List[int]]:
    """
    Checks if the IDs are continuous and returns any gaps found.

    Args:
        df: DataFrame with IDs either as index or in a column
        id_field: Optional name of column containing IDs. If None, uses index

    Returns:
        tuple: (is_continuous: bool, gaps: list of missing IDs)
    """
    # Get all IDs as a sorted list
    if id_field is not None:
        ids = sorted(df[id_field].tolist())
    else:
        ids = sorted(df.index.tolist())

    if not ids:
        return True, []

    # Create a set of expected IDs from min to max
    expected_ids = set(range(min(ids), max(ids) + 1))

    # Find missing IDs
    actual_ids = set(ids)
    gaps = sorted(list(expected_ids - actual_ids))

    is_continuous = len(gaps) == 0

    return is_continuous, gaps


def log_continuity_check(
    df: pd.DataFrame,
    data_type: str,
    id_field: str = None,
    logger: logging.Logger = None
) -> None:
    """
    Helper method to perform and log continuity check results

    Args:
        df: DataFrame to check
        data_type: String describing the type of data (e.g., "referenda", "treasury proposals")
        id_field: Optional name of column containing IDs. If None, uses index
        logger: Optional logger for output
    """
    if logger is None:
        logger = logging.getLogger(__name__)

    is_continuous, gaps = check_continuous_ids(df, id_field)
    if not is_continuous:
        logger.warning(f"Found gaps in {data_type} IDs: {gaps}")
        if len(gaps) <= 10:
            logger.warning(f"Missing IDs: {gaps}")
        else:
            logger.warning(f"First 10 missing IDs: {gaps[:10]}...")
            logger.warning(f"Total number of gaps: {len(gaps)}")

    # Log min and max IDs fetched
    ids = df[id_field] if id_field else df.index
    min_id = ids.min()
    max_id = ids.max()
    logger.info(f"Fetched {data_type} from ID {min_id} to {max_id}")


def validate_and_log_spender_referenda(
    df: pd.DataFrame,
    raw_data_by_id: dict,
    sink,
    logger: logging.Logger = None
) -> None:
    """
    Validate referenda from spender tracks and log errors for those with missing values.

    NOTE: This does NOT filter out invalid rows - it only logs errors.
    Referenda table allows NULLs, so invalid rows are still written to DB.

    Args:
        df: DataFrame of transformed referenda (indexed by referendum ID)
        raw_data_by_id: Dict mapping referendum ID to raw API response
        sink: Data sink with log_data_error method (can be None)
        logger: Optional logger for output
    """
    if logger is None:
        logger = logging.getLogger(__name__)

    required_columns = ['DOT_proposal_time', 'USD_proposal_time', 'DOT_component', 'USDC_component', 'USDT_component']

    for record_id, row in df.iterrows():
        # Only validate spender tracks
        if row.get('track') not in SPENDER_TRACKS:
            continue

        # Check for NULL/NaN in critical columns
        null_columns = []
        for col in required_columns:
            value = row.get(col)
            if pd.isna(value):
                null_columns.append(col)

        if null_columns:
            if sink:
                # Look up raw data by referendum ID (may not exist if not detail-fetched)
                raw_data = raw_data_by_id.get(record_id, {})

                metadata = {
                    'status': row.get('status', 'Unknown'),
                    'track': row.get('track', 'Unknown'),
                    'title': str(row.get('title', 'Unknown'))[:200],
                    'null_columns': null_columns
                }

                sink.log_data_error(
                    table_name="Referenda",
                    record_id=str(record_id),
                    error_type="missing_value",
                    error_message=f"NULL/NaN values in columns: {', '.join(null_columns)}",
                    raw_data=raw_data,
                    metadata=metadata
                )

                logger.warning(
                    f"Referendum {record_id} (track: {row.get('track')}) has NULL values in {null_columns} - logged to DataErrors"
                )
            else:
                logger.warning(
                    f"Referendum {record_id} has NULL values in {null_columns} (sink not available for logging)"
                )


def validate_and_log_treasury_spends(
    df: pd.DataFrame,
    raw_data_list: list,
    sink,
    logger: logging.Logger = None
) -> None:
    """
    Validate treasury spends and log errors for problematic ones.

    NOTE: This does NOT filter out invalid rows - it only logs errors.
    Treasury table allows NULLs, so invalid rows are still written to DB.

    Args:
        df: DataFrame of transformed treasury spends
        raw_data_list: List of raw API responses for error logging
        sink: Data sink with log_data_error method (can be None)
        logger: Optional logger for output
    """
    if logger is None:
        logger = logging.getLogger(__name__)

    required_columns = ['DOT_proposal_time', 'USD_proposal_time', 'DOT_component', 'USDC_component', 'USDT_component']

    for idx, (record_id, row) in enumerate(df.iterrows()):
        # Check for NULL/NaN in critical columns
        null_columns = []
        for col in required_columns:
            value = row[col]
            if pd.isna(value):
                null_columns.append(col)

        if null_columns:
            # Log error but don't prevent insertion
            if sink:
                raw_data = raw_data_list[idx] if idx < len(raw_data_list) else {}

                metadata = {
                    'status': row.get('status', 'Unknown'),
                    'description': str(row.get('description', 'Unknown'))[:200],
                    'null_columns': null_columns
                }

                sink.log_data_error(
                    table_name="Treasury",
                    record_id=str(record_id),
                    error_type="missing_value",
                    error_message=f"NULL/NaN values in columns: {', '.join(null_columns)}",
                    raw_data=raw_data,
                    metadata=metadata
                )

                logger.warning(
                    f"Treasury spend {record_id} has NULL values in {null_columns} - logged to DataErrors"
                )
            else:
                logger.warning(
                    f"Treasury spend {record_id} has NULL values in {null_columns} (sink not available for logging)"
                )
