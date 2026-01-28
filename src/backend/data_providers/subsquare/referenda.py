"""
Referenda fetching and transformation.

This module handles fetching governance referenda from the Subsquare API
and transforming them into a structured DataFrame format.
"""

import logging
import pandas as pd
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..network_info import NetworkInfo

from ..asset_kind import AssetKind
from .api_client import fetch_list, fetch_item
from .proposal_parser import bag_from_referendum_data, get_needs_detail_call_indices
from .validation import log_continuity_check, validate_and_log_spender_referenda


def fetch_referenda(
    network_info: "NetworkInfo",
    price_service,
    referenda_to_update: int = 10,
    sink=None,
    logger: logging.Logger = None
) -> pd.DataFrame:
    """
    Fetch and transform referenda from the Subsquare API.

    Args:
        network_info: Network info for API URL and denomination.
        price_service: Service for price conversions.
        referenda_to_update: Maximum number of referenda to fetch.
        sink: Optional data sink for error logging.
        logger: Optional logger.

    Returns:
        DataFrame with transformed referendum data.
    """
    if logger is None:
        logger = logging.getLogger(__name__)

    base_url = f"https://{network_info.name}-api.subsquare.io/gov2/referendums"

    logging.debug("Fetching referenda list")
    df_updates = fetch_list(base_url, referenda_to_update, logger)

    # For batch referenda, we need to fetch the individual referenda to inspect the proposal
    needs_detail_call_indices = get_needs_detail_call_indices()

    logging.debug("Fetching referenda details")
    replacements = []
    detail_items = 0
    for index, row in df_updates.iterrows():
        # if we have a preimage and it is within the set of batch call indexes, we need to fetch the individual referenda
        if len(row["onchainData"]["proposal"]) > 0 and row["onchainData"]["proposal"]["callIndex"] in needs_detail_call_indices:
            url = f"{base_url}/{row['referendumIndex']}.json"
            referendum = fetch_item(url)
            replacements.append(referendum)

            detail_items += 1
            if detail_items % 10 == 0:
                logging.debug(f"Fetched {detail_items} detail items")
    df_replacements = pd.DataFrame(replacements)
    df_updates = pd.concat([df_updates, df_replacements], ignore_index=True)
    df_updates.drop_duplicates(subset=["referendumIndex"], keep="last", inplace=True)

    logging.debug("Transforming referenda")
    df_updates = transform_referenda(df_updates, network_info, price_service, logger)

    # Build dict mapping referendum ID to raw data for error logging
    raw_data_by_id = {item.get('referendumIndex'): item for item in replacements}

    # Validate spender track referenda and log errors
    validate_and_log_spender_referenda(df_updates, raw_data_by_id, sink, logger)

    # Add continuity check
    log_continuity_check(df_updates, "referenda", logger=logger)

    return df_updates


def fetch_referenda_by_ids(
    ref_ids: list[int],
    network_info: "NetworkInfo",
    price_service,
    sink=None,
    logger: logging.Logger = None
) -> pd.DataFrame:
    """
    Fetch specific referenda by their IDs.

    This is used for re-fetching referenda that had errors during previous processing.

    Args:
        ref_ids: List of referendum IDs to fetch.
        network_info: Network info for API URL and denomination.
        price_service: Service for price conversions.
        sink: Optional data sink for error logging.
        logger: Optional logger.

    Returns:
        DataFrame with transformed referendum data.
    """
    if logger is None:
        logger = logging.getLogger(__name__)

    base_url = f"https://{network_info.name}-api.subsquare.io/gov2/referendums"

    items = []
    for ref_id in ref_ids:
        url = f"{base_url}/{ref_id}.json"
        logger.info(f"Fetching referendum {ref_id}")
        try:
            item = fetch_item(url)
            items.append(item)
        except SystemExit as e:
            logger.warning(f"Failed to fetch referendum {ref_id}: {e}")
            continue

    if not items:
        logger.warning("No referenda could be fetched")
        return pd.DataFrame()

    df = pd.DataFrame(items)
    df = transform_referenda(df, network_info, price_service, logger)

    # Build raw_data dict for validation
    raw_data_by_id = {item.get('referendumIndex'): item for item in items}
    validate_and_log_spender_referenda(df, raw_data_by_id, sink, logger)

    return df


def transform_referenda(
    df: pd.DataFrame,
    network_info: "NetworkInfo",
    price_service,
    logger: logging.Logger = None
) -> pd.DataFrame:
    """
    Transform raw referenda data into structured format.

    Args:
        df: DataFrame with raw referendum data.
        network_info: Network info for denomination.
        price_service: Service for price conversions.
        logger: Optional logger.

    Returns:
        Transformed DataFrame with computed columns.
    """
    if logger is None:
        logger = logging.getLogger(__name__)

    df = df.copy()

    def _determine_track(row):
        if "origins" in row["info"]["origin"]:
            return row["info"]["origin"]["origins"]
        elif "system" in row["info"]["origin"] and row["info"]["origin"]["system"]["root"] is None:
            return "Root"
        else:
            logger.info(f"Unknown origin type: {row['info']['origin']}")
            return "<unknown>"

    def _get_status(state) -> str:
        """
        Fetches the status.
        If the status is Executed, we check the result.
        If the result is err, we return Executed_err.
        This helps to filter out failed referenda.
        """
        status = state["name"]
        if status == "Executed":
            result = list(state["args"]["result"].keys())[0]
            if result == "err":
                return f"{status}_{result}"
        return status

    df.rename(columns={
        "createdAt": "proposal_time",
        "lastActivityAt": "latest_status_change",
        "referendumIndex": "id"
    }, inplace=True)

    df["proposal_time"] = pd.to_datetime(df["proposal_time"], utc=True)
    df["latest_status_change"] = pd.to_datetime(df["state"].apply(lambda x: x["indexer"]["blockTime"] * 1e6), utc=True)

    df["status"] = df["state"].apply(_get_status)

    df["bag"] = df.apply(lambda row: bag_from_referendum_data(row, network_info, logger), axis=1)
    native_asset_name = network_info.native_asset.name
    df[f"{native_asset_name}_proposal_time"] = df.apply(
        _get_value_converter(network_info, price_service, network_info.native_asset, "proposal_time", logger),
        axis=1
    )
    df[f"{native_asset_name}_latest"] = df.apply(
        _get_value_converter(network_info, price_service, network_info.native_asset, "latest_status_change", logger),
        axis=1
    )
    df["USD_proposal_time"] = df.apply(
        _get_value_converter(network_info, price_service, AssetKind.USDC, "proposal_time", logger),
        axis=1
    )
    df["USD_latest"] = df.apply(
        _get_value_converter(network_info, price_service, AssetKind.USDC, "latest_status_change", logger),
        axis=1
    )
    df[f"{native_asset_name}_component"] = df["bag"].apply(lambda x: x.get_amount(network_info.native_asset))
    df["USDC_component"] = df["bag"].apply(lambda x: x.get_amount(AssetKind.USDC))
    df["USDT_component"] = df["bag"].apply(lambda x: x.get_amount(AssetKind.USDT))
    df["tally_ayes"] = df.apply(
        lambda x: network_info.apply_denomination(x["onchainData"]["tally"]["ayes"], network_info.native_asset),
        axis=1
    )
    df["tally_nays"] = df.apply(
        lambda x: network_info.apply_denomination(x["onchainData"]["tally"]["nays"], network_info.native_asset),
        axis=1
    )
    df["track"] = df["onchainData"].apply(_determine_track)

    df.set_index("id", inplace=True)
    df = df[[
        "title", "status", f"{native_asset_name}_proposal_time", "USD_proposal_time",
        "track", "tally_ayes", "tally_nays", "proposal_time", "latest_status_change",
        f"{native_asset_name}_latest", "USD_latest",
        f"{native_asset_name}_component", "USDC_component", "USDT_component"
    ]]

    return df


def _get_value_converter(network_info, price_service, target_asset: AssetKind, date_key, logger, status_key=None):
    """
    Factory method to create a function that determines the USD price of a row.

    If a status_key is provided, it will be used to determine if the current price
    instead of the historic price.
    - If the status is an end status, the historic price of the date will be used.
    - If the status is not an end status, the current price will be used.
    If no status_key is provided, the historic price of the date will be used.

    Args:
        network_info: Network info for asset configuration.
        price_service: Price service for conversions.
        target_asset: Target asset for conversion (e.g., USDC).
        date_key: Column name containing the date.
        logger: Logger for errors.
        status_key: Optional column name containing the status.

    Returns:
        A function that determines the USD price of a row.
    """
    from ..assets_bag import AssetsBag

    def convert_value(row):
        try:
            historic_value_statuses = ["Executed", "TimedOut", "Approved", "Cancelled", "Rejected"]
            date = None
            if (status_key is None) or row[status_key] in historic_value_statuses:
                # use the historic price
                date = row[date_key]
            bag: AssetsBag = row["bag"]
            value = bag.get_total_value(price_service, target_asset, date)
            return value
        except Exception as e:
            logger.error(f"Error converting value for row {row}: {e}")
            return float('nan')

    return convert_value
