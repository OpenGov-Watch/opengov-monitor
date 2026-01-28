"""
Treasury spends and child bounties fetching and transformation.

This module handles fetching treasury spend proposals and child bounties
from the Subsquare API.
"""

import logging
import pandas as pd
from datetime import datetime, timedelta
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..network_info import NetworkInfo

from ..asset_kind import AssetKind
from ..assets_bag import AssetsBag
from .api_client import fetch_list, fetch_item
from .xcm_parsing import get_xcm_asset_kind
from .validation import validate_and_log_treasury_spends


def fetch_treasury_spends(
    network_info: "NetworkInfo",
    price_service,
    items_to_update: int = 10,
    block_number: int = None,
    block_datetime: datetime = None,
    block_time: float = None,
    sink=None,
    logger: logging.Logger = None
) -> pd.DataFrame:
    """
    Fetch and transform treasury spends from the Subsquare API.

    Args:
        network_info: Network info for API URL and denomination.
        price_service: Service for price conversions.
        items_to_update: Maximum number of items to fetch.
        block_number: Reference block number for datetime estimation.
        block_datetime: Reference block datetime for estimation.
        block_time: Block time in seconds for estimation.
        sink: Optional data sink for error logging.
        logger: Optional logger.

    Returns:
        DataFrame with transformed treasury spend data.
    """
    if logger is None:
        logger = logging.getLogger(__name__)

    base_url = f"https://{network_info.name}-api.subsquare.io/treasury/spends"
    df_updates = fetch_list(base_url, items_to_update, logger)

    # load details
    replacements = []
    detail_items = 0
    for index, row in df_updates.iterrows():
        url = f"{base_url}/{row['index']}.json"
        item = fetch_item(url)
        replacements.append(item)

        detail_items += 1
        if detail_items % 10 == 0:
            logging.debug(f"Fetched {detail_items} detail items")
    df_replacements = pd.DataFrame(replacements)
    df_updates = pd.concat([df_updates, df_replacements], ignore_index=True)
    df_updates.drop_duplicates(subset=["index"], keep="last", inplace=True)

    df_updates = transform_treasury_spends(
        df_updates, network_info, price_service,
        block_number, block_datetime, block_time, logger
    )

    # Validate and log errors (but still return all rows including ones with NULL)
    validate_and_log_treasury_spends(df_updates, replacements, sink, logger)

    return df_updates


def transform_treasury_spends(
    df: pd.DataFrame,
    network_info: "NetworkInfo",
    price_service,
    reference_block_number: int = None,
    reference_block_datetime: datetime = None,
    block_time: float = None,
    logger: logging.Logger = None
) -> pd.DataFrame:
    """
    Transform raw treasury spend data into structured format.

    Args:
        df: DataFrame with raw treasury spend data.
        network_info: Network info for denomination.
        price_service: Service for price conversions.
        reference_block_number: Reference block for datetime estimation.
        reference_block_datetime: Reference datetime for estimation.
        block_time: Block time in seconds.
        logger: Optional logger.

    Returns:
        Transformed DataFrame.
    """
    if logger is None:
        logger = logging.getLogger(__name__)

    df = df.copy()

    df.rename(columns={
        "index": "id",
        "state": "status",
        "title": "description",
    }, inplace=True)

    def _bag_from_treasury_spend_data(row) -> AssetsBag:
        bag = AssetsBag()

        try:
            asset_kind = get_xcm_asset_kind(row["onchainData"]["meta"]["assetKind"], network_info, logger)
            if asset_kind == AssetKind.INVALID:
                logger.warning(f"getting invalid asset kind for {row}")
                bag.set_nan()
                return bag

            amount = row["onchainData"]["meta"]["amount"]
            amount = network_info.apply_denomination(amount, asset_kind)
            bag.add_asset(asset_kind, amount)
        except Exception as e:
            logger.warning(f"exception while _bag_from_treasury_spend_data: {e}")
            bag.set_nan()
            return bag

        return bag

    def _estimate_block_datetime_from_block_number(block_num: int) -> datetime:
        assert block_num is not None, "block_number is None"
        assert reference_block_number is not None, "reference_block_number is None"
        assert reference_block_datetime is not None, "reference_block_datetime is None"
        assert block_time is not None, "block_time is None"
        # estimate the block time
        estimated_block_datetime = reference_block_datetime + timedelta(
            seconds=(block_num - reference_block_number) * block_time
        )
        return estimated_block_datetime

    df["proposal_time"] = pd.to_datetime(
        df["onchainData"].apply(lambda x: x["timeline"][0]["indexer"]["blockTime"] * 1e6),
        utc=True
    )
    df["latest_status_change"] = pd.to_datetime(
        df["onchainData"].apply(lambda x: x["timeline"][-1]["indexer"]["blockTime"] * 1e6),
        utc=True
    )

    df["bag"] = df.apply(_bag_from_treasury_spend_data, axis=1)

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
    df["validFrom"] = df["onchainData"].apply(
        lambda x: _estimate_block_datetime_from_block_number(x["meta"]["validFrom"])
    )
    df["expireAt"] = df["onchainData"].apply(
        lambda x: _estimate_block_datetime_from_block_number(x["meta"]["expireAt"])
    )

    df.set_index("id", inplace=True)
    df = df[[
        "referendumIndex", "status", "description",
        f"{native_asset_name}_proposal_time", "USD_proposal_time",
        "proposal_time", "latest_status_change",
        f"{native_asset_name}_latest", "USD_latest",
        f"{native_asset_name}_component", "USDC_component", "USDT_component",
        "validFrom", "expireAt"
    ]]

    return df


def fetch_child_bounties(
    network_info: "NetworkInfo",
    price_service,
    child_bounties_to_update: int = 10,
    logger: logging.Logger = None
) -> pd.DataFrame:
    """
    Fetch and transform child bounties from the Subsquare API.

    Args:
        network_info: Network info for API URL and denomination.
        price_service: Service for price conversions.
        child_bounties_to_update: Maximum number to fetch.
        logger: Optional logger.

    Returns:
        DataFrame with transformed child bounty data.
    """
    if logger is None:
        logger = logging.getLogger(__name__)

    base_url = f"https://{network_info.name}-api.subsquare.io/treasury/child-bounties"
    df_updates = fetch_list(base_url, child_bounties_to_update, logger)

    df_updates = transform_child_bounties(df_updates, network_info, price_service, logger)

    return df_updates


def transform_child_bounties(
    df: pd.DataFrame,
    network_info: "NetworkInfo",
    price_service,
    logger: logging.Logger = None
) -> pd.DataFrame:
    """
    Transform raw child bounty data into structured format.

    Args:
        df: DataFrame with raw child bounty data.
        network_info: Network info for denomination.
        price_service: Service for price conversions.
        logger: Optional logger.

    Returns:
        Transformed DataFrame.
    """
    if logger is None:
        logger = logging.getLogger(__name__)

    df = df.copy()

    df.rename(columns={
        "state": "status",
    }, inplace=True)

    df[network_info.native_asset.name] = df["onchainData"].apply(
        lambda x: network_info.apply_denomination(x["value"], network_info.native_asset)
    )
    df["bag"] = df.apply(
        lambda x: AssetsBag({network_info.native_asset: x[network_info.native_asset.name]}),
        axis=1
    )
    df["proposal_time"] = pd.to_datetime(
        df["onchainData"].apply(lambda x: x["timeline"][0]["indexer"]["blockTime"] * 1e6),
        utc=True
    )
    df["latest_status_change"] = pd.to_datetime(
        df["onchainData"].apply(lambda x: x["timeline"][-1]["indexer"]["blockTime"] * 1e6),
        utc=True
    )
    df["USD_proposal_time"] = df.apply(
        _get_value_converter(network_info, price_service, AssetKind.USDC, "proposal_time", logger),
        axis=1
    )
    df["USD_latest"] = df.apply(
        _get_value_converter(network_info, price_service, AssetKind.USDC, "latest_status_change", logger),
        axis=1
    )
    df["description"] = df["onchainData"].apply(lambda x: x["description"])
    df["beneficiary"] = df["onchainData"].apply(lambda x: x["address"])
    df["identifier"] = df.apply(lambda row: f'{row["parentBountyId"]}_{row["index"]}', axis=1)

    df.set_index("identifier", inplace=True)
    df = df[[
        "index", "parentBountyId", "status", "description", "DOT",
        "USD_proposal_time", "beneficiary", "proposal_time",
        "latest_status_change", "USD_latest"
    ]]

    return df


def _get_value_converter(network_info, price_service, target_asset: AssetKind, date_key, logger, status_key=None):
    """
    Factory method to create a function that determines the USD price of a row.

    Args:
        network_info: Network info for asset configuration.
        price_service: Price service for conversions.
        target_asset: Target asset for conversion.
        date_key: Column name containing the date.
        logger: Logger for errors.
        status_key: Optional column name containing the status.

    Returns:
        A function that determines the price of a row.
    """
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
