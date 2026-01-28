"""
Fellowship treasury, salary, and member data fetching and transformation.

This module handles all fellowship-related data from the Collectives API.
"""

import logging
import pandas as pd
import requests
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..network_info import NetworkInfo

from ..asset_kind import AssetKind
from ..assets_bag import AssetsBag
from .api_client import fetch_list, fetch_item, REQUEST_TIMEOUT


def fetch_fellowship_treasury_spends(
    network_info: "NetworkInfo",
    price_service,
    items_to_update: int = 10,
    logger: logging.Logger = None
) -> pd.DataFrame:
    """
    Fetch and transform fellowship treasury spends from the Collectives API.

    Args:
        network_info: Network info for denomination.
        price_service: Service for price conversions.
        items_to_update: Maximum number to fetch.
        logger: Optional logger.

    Returns:
        DataFrame with transformed fellowship treasury spend data.
    """
    if logger is None:
        logger = logging.getLogger(__name__)

    base_url = "https://collectives-api.subsquare.io/fellowship/treasury/spends"
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

    df_updates = transform_fellowship_treasury_spends(df_updates, network_info, price_service, logger)

    return df_updates


def transform_fellowship_treasury_spends(
    df: pd.DataFrame,
    network_info: "NetworkInfo",
    price_service,
    logger: logging.Logger = None
) -> pd.DataFrame:
    """
    Transform raw fellowship treasury spend data.

    Args:
        df: DataFrame with raw data.
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
        "index": "id",
        "state": "status",
        "title": "description",
    }, inplace=True)

    df[network_info.native_asset.name] = df["onchainData"].apply(
        lambda x: network_info.apply_denomination(x["meta"]["amount"], network_info.native_asset)
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
        _get_value_converter(price_service, AssetKind.USDC, "proposal_time", logger),
        axis=1
    )
    df["USD_latest"] = df.apply(
        _get_value_converter(price_service, AssetKind.USDC, "latest_status_change", logger),
        axis=1
    )
    df.set_index("id", inplace=True)
    df = df[["status", "description", "DOT", "USD_proposal_time", "proposal_time", "latest_status_change", "USD_latest"]]

    return df


def fetch_fellowship_salary_cycles(
    network_info: "NetworkInfo",
    start_cycle: int = 1,
    end_cycle: int = None,
    logger: logging.Logger = None
) -> pd.DataFrame:
    """
    Fetch fellowship salary cycle data from the Collectives API.

    Args:
        network_info: Network info for denomination.
        start_cycle: Starting cycle number (default: 1).
        end_cycle: Ending cycle number (default: None, fetches until failure).
        logger: Optional logger.

    Returns:
        DataFrame with salary cycle data.
    """
    if logger is None:
        logger = logging.getLogger(__name__)

    cycles_data = []
    current_cycle = start_cycle

    while True:
        if end_cycle and current_cycle > end_cycle:
            break

        url = f"https://collectives-api.subsquare.io/fellowship/salary/cycles/{current_cycle}"
        logger.debug(f"Fetching salary cycle {current_cycle} from {url}")

        try:
            response = requests.get(url, timeout=REQUEST_TIMEOUT)
            if response.status_code == 200:
                data = response.json()
                data['cycle'] = current_cycle  # Add cycle number to data
                cycles_data.append(data)
                current_cycle += 1
            elif response.status_code == 404:
                logger.info(f"No more salary cycles found after cycle {current_cycle - 1}")
                break
            else:
                logger.error(f"Error fetching cycle {current_cycle}: {response.status_code} {response.reason}")
                break
        except Exception as e:
            logger.error(f"Exception fetching cycle {current_cycle}: {e}")
            break

    if not cycles_data:
        logger.warning("No salary cycle data found")
        return pd.DataFrame()

    df = pd.DataFrame(cycles_data)
    df = transform_salary_cycles(df, network_info, logger)

    logger.info(f"Fetched {len(df)} salary cycles from {start_cycle} to {current_cycle - 1}")
    return df


def transform_salary_cycles(
    df: pd.DataFrame,
    network_info: "NetworkInfo",
    logger: logging.Logger = None
) -> pd.DataFrame:
    """Transform raw salary cycle data into structured format."""
    if logger is None:
        logger = logging.getLogger(__name__)

    df = df.copy()

    # Extract key fields from status object
    # Fellowship salaries are paid in USDC (6 decimals), not DOT (10 decimals)
    df['budget_usdc'] = df['status'].apply(
        lambda x: network_info.apply_denomination(x.get('budget', 0), AssetKind.USDC)
    )
    df['total_registrations_usdc'] = df['status'].apply(
        lambda x: network_info.apply_denomination(x.get('totalRegistrations', 0), AssetKind.USDC)
    )
    df['unregistered_paid_usdc'] = df['unRegisteredPaid'].apply(
        lambda x: network_info.apply_denomination(int(x), AssetKind.USDC)
    )
    df['registered_paid_amount_usdc'] = df['registeredPaid'].apply(
        lambda x: network_info.apply_denomination(int(x), AssetKind.USDC)
    )

    # Extract periods (direct fields)
    df['registration_period'] = df['registrationPeriod']
    df['payout_period'] = df['payoutPeriod']

    # Extract block information (endIndexer may be None for ongoing cycles)
    df['start_block'] = df['startIndexer'].apply(
        lambda x: x.get('blockHeight', 0) if isinstance(x, dict) else None
    )
    df['end_block'] = df['endIndexer'].apply(
        lambda x: x.get('blockHeight', 0) if isinstance(x, dict) else None
    )
    df['start_time'] = pd.to_datetime(
        df['startIndexer'].apply(lambda x: x.get('blockTime', 0) * 1e6 if isinstance(x, dict) else None),
        utc=True
    )
    df['end_time'] = pd.to_datetime(
        df['endIndexer'].apply(lambda x: x.get('blockTime', 0) * 1e6 if isinstance(x, dict) else None),
        utc=True
    )

    # Set index and select final columns
    df.set_index('cycle', inplace=True)
    df = df[[
        'budget_usdc', 'registeredCount', 'registeredPaidCount',
        'registered_paid_amount_usdc', 'total_registrations_usdc', 'unregistered_paid_usdc',
        'registration_period', 'payout_period', 'start_block', 'end_block',
        'start_time', 'end_time'
    ]]

    return df


def fetch_fellowship_salary_claimants(
    network_info: "NetworkInfo",
    name_mapping: dict = None,
    logger: logging.Logger = None
) -> pd.DataFrame:
    """
    Fetch fellowship salary claimants data from the Collectives API.

    Args:
        network_info: Network info for denomination.
        name_mapping: Optional mapping of addresses to names.
        logger: Optional logger.

    Returns:
        DataFrame with individual claimant data.
    """
    if logger is None:
        logger = logging.getLogger(__name__)

    url = "https://collectives-api.subsquare.io/fellowship/salary/claimants"
    logger.debug(f"Fetching salary claimants from {url}")

    try:
        response = requests.get(url, timeout=REQUEST_TIMEOUT)
        if response.status_code == 200:
            data = response.json()
            if not data:
                logger.warning("No claimants data found")
                return pd.DataFrame()

            df = pd.DataFrame(data)
            df = transform_salary_claimants(df, network_info, name_mapping, logger)

            logger.info(f"Fetched {len(df)} salary claimants")
            return df
        else:
            logger.error(f"Error fetching claimants: {response.status_code} {response.reason}")
            return pd.DataFrame()
    except Exception as e:
        logger.error(f"Exception fetching claimants: {e}")
        return pd.DataFrame()


def transform_salary_claimants(
    df: pd.DataFrame,
    network_info: "NetworkInfo",
    name_mapping: dict = None,
    logger: logging.Logger = None
) -> pd.DataFrame:
    """Transform raw salary claimants data into structured format."""
    if logger is None:
        logger = logging.getLogger(__name__)

    df = df.copy()

    # Extract status information
    df['last_active'] = df['status'].apply(lambda x: x.get('lastActive', 0))
    df['last_active_time'] = pd.to_datetime(df['last_active'] * 1e6, utc=True)

    # Determine status type and extract relevant data
    def extract_status_info(status_obj):
        status = status_obj.get('status', {})
        if 'attempted' in status:
            attempted = status['attempted']
            return {
                'status_type': 'attempted',
                'registered_amount': attempted.get('registered', 0),
                'attempt_id': attempted.get('id', 0),
                'attempt_amount': attempted.get('amount', 0)
            }
        elif 'registered' in status:
            return {
                'status_type': 'registered',
                'registered_amount': status['registered'],
                'attempt_id': 0,
                'attempt_amount': 0
            }
        elif 'nothing' in status:
            return {
                'status_type': 'nothing',
                'registered_amount': 0,
                'attempt_id': 0,
                'attempt_amount': 0
            }
        else:
            return {
                'status_type': 'unknown',
                'registered_amount': 0,
                'attempt_id': 0,
                'attempt_amount': 0
            }

    # Apply status extraction
    status_info = df['status'].apply(extract_status_info)
    status_df = pd.DataFrame(list(status_info))
    df = pd.concat([df, status_df], axis=1)

    # Convert amounts to USDC (fellowship salaries are paid in USDC, not DOT)
    df['registered_amount_usdc'] = df['registered_amount'].apply(
        lambda x: network_info.apply_denomination(x, AssetKind.USDC) if x else 0
    )
    df['attempt_amount_usdc'] = df['attempt_amount'].apply(
        lambda x: network_info.apply_denomination(x, AssetKind.USDC) if x else 0
    )

    # Apply name mapping if provided
    if name_mapping:
        df['name'] = df['address'].map(name_mapping).fillna('')
        df['display_name'] = df.apply(
            lambda row: row['name'] if row['name'] else f"{row['address'][:6]}...{row['address'][-6:]}",
            axis=1
        )
    else:
        df['name'] = ''
        df['display_name'] = df['address'].apply(lambda x: f"{x[:6]}...{x[-6:]}")

    # Create shortened address for reference
    df['short_address'] = df['address'].apply(lambda x: f"{x[:6]}...{x[-6:]}")

    # Set address as index and select final columns (rank will be added later by script)
    df.set_index('address', inplace=True)
    df = df[[
        'display_name', 'name', 'short_address', 'status_type', 'registered_amount_usdc',
        'attempt_amount_usdc', 'attempt_id', 'last_active_time'
    ]]

    return df


def fetch_fellowship_salary_payments(
    network_info: "NetworkInfo",
    price_service,
    start_cycle: int = 1,
    end_cycle: int = None,
    logger: logging.Logger = None
) -> pd.DataFrame:
    """
    Fetch individual payment records from /feeds endpoint for each cycle.
    Iterates cycles until 404. Filters for "Paid" events only.

    Args:
        network_info: Network info for denomination.
        price_service: Service for price conversions.
        start_cycle: Starting cycle number (default: 1).
        end_cycle: Ending cycle number (default: None, fetches until 404).
        logger: Optional logger.

    Returns:
        DataFrame with salary payment records.
    """
    if logger is None:
        logger = logging.getLogger(__name__)

    all_payments = []
    current_cycle = start_cycle

    while True:
        if end_cycle and current_cycle > end_cycle:
            break

        # Paginated endpoint - need to fetch all pages per cycle
        page = 1
        cycle_paid_count = 0

        while True:
            url = f"https://collectives-api.subsquare.io/fellowship/salary/cycles/{current_cycle}/feeds?page={page}&page_size=100"
            logger.debug(f"Fetching salary cycle {current_cycle} feeds page {page}")

            try:
                response = requests.get(url, timeout=REQUEST_TIMEOUT)
                if response.status_code == 200:
                    data = response.json()
                    feeds = data.get("items", [])

                    if not feeds:
                        break  # No more items in this cycle

                    paid_events = [f for f in feeds if f.get("event") == "Paid"]
                    cycle_paid_count += len(paid_events)

                    for event in paid_events:
                        payment = _extract_payment_from_event(event, current_cycle)
                        if payment:
                            all_payments.append(payment)

                    # Check if we've fetched all pages
                    total = data.get("total", 0)
                    fetched = page * data.get("pageSize", 100)
                    if fetched >= total:
                        break
                    page += 1
                elif response.status_code == 404:
                    logger.info(f"No more salary cycles found after cycle {current_cycle - 1}")
                    # Exit both loops
                    current_cycle = -1  # Signal to exit outer loop
                    break
                else:
                    logger.error(f"Error fetching cycle {current_cycle} feeds: {response.status_code} {response.reason}")
                    current_cycle = -1
                    break
            except Exception as e:
                logger.error(f"Exception fetching cycle {current_cycle} feeds: {e}")
                current_cycle = -1
                break

        if current_cycle == -1:
            break

        logger.debug(f"Cycle {current_cycle}: found {cycle_paid_count} Paid events")
        current_cycle += 1

    if not all_payments:
        logger.warning("No salary payment data found")
        return pd.DataFrame()

    df = pd.DataFrame(all_payments)
    df = transform_salary_payments(df, network_info, price_service, logger)

    logger.info(f"Fetched {len(df)} salary payments from cycles {start_cycle} to {current_cycle - 1}")
    return df


def _extract_payment_from_event(event: dict, cycle: int) -> dict:
    """Extract payment data from a Paid event."""
    args = event.get("args", {})
    indexer = event.get("indexer", {})
    member_info = args.get("memberInfo", {})

    return {
        "payment_id": args.get("paymentId"),
        "cycle": cycle,
        "who": args.get("who", ""),
        "beneficiary": args.get("beneficiary", ""),
        "amount_raw": args.get("amount", "0"),
        "salary_raw": member_info.get("salary", "0"),
        "rank": member_info.get("rank"),
        "is_active": member_info.get("isActive", False),
        "block_height": indexer.get("blockHeight"),
        "block_time_ms": indexer.get("blockTime"),  # MILLISECONDS!
    }


def transform_salary_payments(
    df: pd.DataFrame,
    network_info: "NetworkInfo",
    price_service,
    logger: logging.Logger = None
) -> pd.DataFrame:
    """Transform raw payment data."""
    if logger is None:
        logger = logging.getLogger(__name__)

    df = df.copy()

    # Denominate amounts (fellowship salaries are paid in USDC, not DOT)
    df['amount_usdc'] = df['amount_raw'].apply(
        lambda x: network_info.apply_denomination(x, AssetKind.USDC)
    )
    df['salary_usdc'] = df['salary_raw'].apply(
        lambda x: network_info.apply_denomination(x, AssetKind.USDC)
    )

    # Convert time (MILLISECONDS for feeds endpoint - not seconds like other endpoints!)
    df['block_time'] = pd.to_datetime(df['block_time_ms'], unit='ms', utc=True)
    df['is_active'] = df['is_active'].astype(int)

    # Calculate DOT equivalent using historic price at block_time
    # USDC -> DOT: amount / DOT_price_in_USD
    df['amount_dot'] = df.apply(
        lambda row: price_service.convert_asset_value(
            AssetKind.USDC, row['amount_usdc'], AssetKind.DOT, row['block_time']
        ) if pd.notna(row['amount_usdc']) else None,
        axis=1
    )

    # Initialize name columns (will be populated by run_sqlite.py after batch resolution)
    df['who_name'] = ''
    df['beneficiary_name'] = ''

    df.set_index('payment_id', inplace=True)
    return df[[
        'cycle', 'who', 'who_name', 'beneficiary', 'beneficiary_name',
        'amount_usdc', 'amount_dot', 'salary_usdc', 'rank', 'is_active',
        'block_height', 'block_time'
    ]]


def fetch_fellowship_members(logger: logging.Logger = None) -> dict:
    """
    Fetch fellowship members and their ranks from the Collectives API.

    Args:
        logger: Optional logger.

    Returns:
        dict: Mapping of address to rank (0-7).
    """
    if logger is None:
        logger = logging.getLogger(__name__)

    url = "https://collectives-api.subsquare.io/fellowship/members"
    logger.debug(f"Fetching fellowship members from {url}")

    try:
        response = requests.get(url, timeout=REQUEST_TIMEOUT)
        if response.status_code == 200:
            data = response.json()
            if not data:
                logger.warning("No fellowship members data found")
                return {}

            # Create address to rank mapping
            members_mapping = {}
            for member in data:
                if isinstance(member, dict):
                    address = member.get('address', '')
                    rank = member.get('rank', None)
                    if address and rank is not None:
                        members_mapping[address] = rank

            logger.info(f"Fetched {len(members_mapping)} fellowship members")

            # Log rank distribution
            rank_counts = {}
            for rank in members_mapping.values():
                rank_counts[rank] = rank_counts.get(rank, 0) + 1

            rank_summary = ", ".join([f"Rank {r}: {c}" for r, c in sorted(rank_counts.items())])
            logger.info(f"Rank distribution: {rank_summary}")

            return members_mapping
        else:
            logger.error(f"Error fetching fellowship members: {response.status_code} {response.reason}")
            return {}
    except Exception as e:
        logger.error(f"Exception fetching fellowship members: {e}")
        return {}


def _get_value_converter(price_service, target_asset: AssetKind, date_key, logger, status_key=None):
    """
    Factory method to create a function that determines the price of a row.

    Args:
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
