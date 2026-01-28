"""
Referendum proposal value extraction.

This module contains the logic for extracting monetary values from referendum
proposals by parsing call data structures.
"""

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..network_info import NetworkInfo

from ..asset_kind import AssetKind
from ..assets_bag import AssetsBag
from .call_indices import (
    POLKADOT_CALL_INDICES,
    ZERO_VALUE_METHODS,
    get_call_index,
)
from .xcm_parsing import get_xcm_asset_kind, get_xcm_asset_value


def build_bag_from_call_value(
    bag: AssetsBag,
    call: dict,
    timestamp,
    ref_id: int,
    network_info: "NetworkInfo",
    logger: logging.Logger = None
) -> None:
    """
    Extract monetary value from a proposal call and add it to the assets bag.

    This function recursively processes nested calls (batch, scheduled, dispatch)
    to extract the total value being spent.

    Args:
        bag: AssetsBag to accumulate values into.
        call: The call data structure from the proposal.
        timestamp: Timestamp for the call.
        ref_id: Referendum ID for error context and runtime version selection.
        network_info: Network info for denomination and treasury address.
        logger: Optional logger for warnings.
    """
    if logger is None:
        logger = logging.getLogger(__name__)

    # Build list of known zero-value call indices dynamically based on ref_id
    # These are proposals we know don't have a direct treasury value
    known_zero_value_call_indices = [
        idx for idx in (get_call_index(m, ref_id) for m in ZERO_VALUE_METHODS) if idx
    ]

    # Build wrapped_proposals from dynamic indices (varies by runtime version)
    wrapped_proposals = [
        get_call_index("scheduler.scheduleNamed", ref_id),
        get_call_index("scheduler.scheduleAfter", ref_id),
        get_call_index("utility.batch", ref_id),
        get_call_index("utility.batchAll", ref_id),
        get_call_index("utility.dispatchAs", ref_id),
        get_call_index("utility.forceBatch", ref_id),
    ]

    should_inspect_proposal = [
        get_call_index("xcmPallet.send", ref_id),
    ]

    # get call index
    if len(call) == 0:  # no preimage
        return

    if "call" in call:
        call = call["call"]

    call_index = call["callIndex"]
    args = call.get("args", None)

    try:
        if call_index in known_zero_value_call_indices:
            return
        elif call_index in wrapped_proposals:
            if call_index == get_call_index("scheduler.scheduleNamed", ref_id):
                inner_call = args[4]["value"]
                build_bag_from_call_value(bag, inner_call, timestamp, ref_id, network_info, logger)
            elif call_index == get_call_index("scheduler.scheduleAfter", ref_id):
                inner_call = args[3]["value"]
                build_bag_from_call_value(bag, inner_call, timestamp, ref_id, network_info, logger)
            elif call_index == get_call_index("utility.dispatchAs", ref_id):
                # let's make sure the caller is the treasury
                try:
                    dispatch_source = args[0]["value"]["system"]["signed"]
                except KeyError:
                    logger.warning(f"Ref {ref_id}: dispatchAs call does not have a signed source")
                    return

                if dispatch_source != network_info.treasury_address:
                    logger.warning(f"Ref {ref_id}: dispatchAs call does not have a treasury source")
                    return

                inner_call = args[1]["value"]
                build_bag_from_call_value(bag, inner_call, timestamp, ref_id, network_info, logger)
            else:  # batch calls
                for inner_call in args[0]["value"]:
                    # if you get an exception here, make sure you requested the details on this callIndex
                    build_bag_from_call_value(bag, inner_call, timestamp, ref_id, network_info, logger)
                    if bag.is_nan():
                        break
        elif call_index in should_inspect_proposal:
            logger.warning(f"Ref {ref_id}: {call_index} not implemented")
            bag.set_nan()
            return
        elif call_index == "0x0502":  # balances.forceTransfer
            assert args is not None, "we should always have the details of the call"
            assert args[0]["name"] == "source"
            source = args[0]["value"]["id"]
            assert source == network_info.treasury_address
            amount = args[2]["value"]
            amount = network_info.apply_denomination(amount, network_info.native_asset)
            bag.add_asset(network_info.native_asset, amount)
        elif call_index == get_call_index("treasury.spend", ref_id):
            assert args is not None, "we should always have the details of the call"
            assert args[0]["name"] == "assetKind"
            asset_kind = get_xcm_asset_kind(args[0]["value"], network_info, logger)
            if asset_kind == AssetKind.INVALID:
                bag.set_nan()
                return

            assert args[1]["name"] == "amount"
            amount = args[1]["value"]

            amount = network_info.apply_denomination(amount, asset_kind)
            bag.add_asset(asset_kind, amount)
        elif call_index == "0x0103":  # scheduler.cancelNamed
            if ref_id == 56:  # cancel auction
                return
            raise ValueError(f"ref {ref_id}: {call} not implemented")
        elif call_index == "0x6303":  # xcmPallet.execute
            message = args[0]["value"]
            _build_bag_from_xcm_message(bag, message, logger)
            return
        elif call_index == "0x6308":  # xcmPallet.limitedReserveTransferAssets
            assets = args[2]["value"]
            value = get_xcm_asset_value(assets, network_info)
            bag.add_asset(network_info.native_asset, value)
        elif call_index == "0x6309":  # xcmPallet.limitedTeleportAssets
            assets = args[2]["value"]
            value = get_xcm_asset_value(assets, network_info)
            bag.add_asset(network_info.native_asset, value)
            return
        else:
            logger.warning(f"ref {ref_id}: Unknown proposal type: {call}")
            bag.set_nan()
            return
    except Exception as e:
        logger.warning(f"ref {ref_id}: Error processing call: {e}\n{call}")
        bag.set_nan()
        return


def _build_bag_from_xcm_message(bag: AssetsBag, message, logger: logging.Logger) -> None:
    """
    Parse an XCM message to extract asset values.

    Currently not fully implemented.
    """
    logger.warning("_build_bag_from_XCM_message not implemented")
    bag.set_nan()


def bag_from_referendum_data(
    row,
    network_info: "NetworkInfo",
    logger: logging.Logger = None
) -> AssetsBag:
    """
    Extract monetary value from a referendum data row.

    Args:
        row: DataFrame row with referendum data.
        network_info: Network info for denomination.
        logger: Optional logger for errors.

    Returns:
        AssetsBag with accumulated values.
    """
    if logger is None:
        logger = logging.getLogger(__name__)

    bag = AssetsBag()

    # for some proposals, it would be too troublesome to write the deep packet inspection
    # so we just set the bag to NaN
    known_zero_value_proposals = {
        "polkadot": [
            546,  # Starlay Hack Recovery Attempt
            1424,  # Parallel Hack Recovery Attempt
        ]
    }

    try:
        if "treasuryInfo" in row["onchainData"]:
            amount = row["onchainData"]["treasuryInfo"]["amount"]
            amount = network_info.apply_denomination(amount, network_info.native_asset)
            bag.add_asset(network_info.native_asset, amount)
        elif "treasuryBounties" in row:  # accepting a new bounty
            pass
        else:
            ref_id = row["id"]
            if ref_id in known_zero_value_proposals.get(network_info.name, []):
                bag.set_nan()
                return bag

            build_bag_from_call_value(
                bag,
                row["onchainData"]["proposal"],
                row["proposal_time"],
                ref_id,
                network_info,
                logger
            )
    except Exception as e:
        if row['id'] != 1424:
            logger.error(f"Error processing row {row['id']}: {e}")
        bag.set_nan()

    return bag


def get_needs_detail_call_indices() -> list:
    """
    Get list of call indices that require fetching referendum details.

    These are methods that have nested/complex call data that needs
    deep inspection to extract values.

    Returns:
        List of call index hex strings for both runtime eras.
    """
    needs_detail_methods = [
        "utility.batch",
        "utility.batchAll",
        "utility.dispatchAs",
        "utility.forceBatch",
        "treasury.spend",
        "xcmPallet.send",
        "whitelist.dispatchWhitelistedCallWithPreimage",
    ]

    # Build list of indices for both runtime eras
    needs_detail_call_indices = []
    for method in needs_detail_methods:
        relay_idx = POLKADOT_CALL_INDICES["relay"].get(method)
        assethub_idx = POLKADOT_CALL_INDICES["assethub"].get(method)
        if relay_idx:
            needs_detail_call_indices.append(relay_idx)
        if assethub_idx and assethub_idx != relay_idx:
            needs_detail_call_indices.append(assethub_idx)

    return needs_detail_call_indices
