"""
XCM (Cross-Consensus Message) parsing utilities.

These shared utilities encapsulate chain-context-aware XCM parsing logic.
XCM has different semantics depending on chain context:

| Chain Context    | `location.interior.here` means | Asset determined by |
|------------------|-------------------------------|---------------------|
| Relay Chain      | "Native asset (DOT)"          | location alone      |
| AssetHub         | "Current location"            | assetId field       |

After governance moved to AssetHub (ref 1782), the interpretation of
`here` changed: it no longer implies "native asset", just "current chain".
"""

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..network_info import NetworkInfo

from ..asset_kind import AssetKind


def general_index_to_asset_kind(general_index: int, logger: logging.Logger = None) -> AssetKind:
    """
    Maps AssetHub generalIndex to AssetKind.

    Args:
        general_index: The generalIndex from XCM assetId interior.
        logger: Optional logger for warnings.

    Returns:
        AssetKind for known indices, or INVALID for unknown.
    """
    if logger is None:
        logger = logging.getLogger(__name__)

    if general_index == 1337:
        return AssetKind.USDC
    elif general_index == 1984:
        return AssetKind.USDT
    elif general_index == 30:
        return AssetKind.DED
    elif general_index == 19840000000000:
        # Known invalid value (mistaken entry)
        return AssetKind.INVALID
    else:
        logger.warning(f"Unknown general_index: {general_index}")
        return AssetKind.INVALID


def parse_asset_interior_x2(x2_interior: list, logger: logging.Logger = None) -> AssetKind:
    """
    Parses x2 interior structure with palletInstance + generalIndex.

    Expected format: [{"palletInstance": 50}, {"generalIndex": 1337}]

    Args:
        x2_interior: List containing palletInstance and generalIndex dicts.
        logger: Optional logger for warnings.

    Returns:
        AssetKind based on generalIndex, or INVALID if structure is wrong.
    """
    if logger is None:
        logger = logging.getLogger(__name__)

    try:
        if len(x2_interior) < 2:
            logger.warning(f"x2 interior too short: {x2_interior}")
            return AssetKind.INVALID

        pallet_instance = x2_interior[0].get("palletInstance")
        if pallet_instance != 50:
            logger.warning(f"Expected palletInstance 50, got {pallet_instance}")
            return AssetKind.INVALID

        if "generalIndex" not in x2_interior[1]:
            # has been mistakenly the case in ref 1714
            return AssetKind.INVALID

        general_index = x2_interior[1]["generalIndex"]
        return general_index_to_asset_kind(general_index, logger)

    except (KeyError, IndexError, TypeError) as e:
        logger.warning(f"Invalid x2 structure: {e}")
        return AssetKind.INVALID


def resolve_asset_from_interior(
    interior: dict,
    network_info: "NetworkInfo",
    parents: int = 0,
    logger: logging.Logger = None
) -> AssetKind:
    """
    Resolves asset type from an assetId interior structure.

    This is the core chain-context-aware parsing logic:
    - parents=1 + here → native relay chain asset (DOT/KSM)
    - parents=0 + here → native on current chain (still DOT on AssetHub)
    - parents=0 + x2   → AssetHub fungible (USDC/USDT/DED)

    Args:
        interior: The interior dict from assetId.
        network_info: Network info for determining native asset.
        parents: The parents value from assetId (0 or 1).
        logger: Optional logger for warnings.

    Returns:
        AssetKind based on the interior structure.
    """
    if logger is None:
        logger = logging.getLogger(__name__)

    # parents=1 means we're referencing the relay chain
    if parents == 1 and "here" in interior:
        return network_info.native_asset

    # parents=0 means we're on the current chain
    if parents == 0:
        if "x2" in interior:
            return parse_asset_interior_x2(interior["x2"], logger)
        elif "here" in interior:
            # Native asset on current chain (still DOT on AssetHub)
            return network_info.native_asset

    logger.warning(f"Unknown interior structure: parents={parents}, keys={list(interior.keys())}")
    return AssetKind.INVALID


def get_xcm_asset_kind(
    asset_kind: dict,
    network_info: "NetworkInfo",
    logger: logging.Logger = None
) -> AssetKind:
    """
    Determines the AssetKind from an XCM (Cross-Consensus Message) asset representation.

    This method parses different versions of XCM asset formats (v3, v4, v5)
    to identify the type of asset (e.g., DOT, KSM, USDC, USDT, DED).

    IMPORTANT: Chain context affects XCM semantics:
    - Pre-1782 (Relay Chain): `location.interior.here` = native DOT
    - Post-1782 (AssetHub): `location.interior.here` = "current chain",
      must check `assetId` to determine actual asset type.

    Args:
        asset_kind: A dictionary representing the XCM asset.
        network_info: Network info for determining native asset.
        logger: Optional logger for warnings.

    Returns:
        AssetKind: The identified AssetKind, or AssetKind.INVALID if unknown or unsupported.
    """
    if logger is None:
        logger = logging.getLogger(__name__)

    version_key = list(asset_kind.keys())[0]

    if version_key == "v3":
        return _parse_xcm_v3(asset_kind["v3"], network_info, logger)
    elif version_key in ["v4", "v5"]:
        return _parse_xcm_v4_v5(asset_kind[version_key], version_key, network_info, logger)
    else:
        logger.warning(f"Unknown asset kind version: {version_key} in {asset_kind}")
        return AssetKind.INVALID


def _parse_xcm_v3(
    v3_data: dict,
    network_info: "NetworkInfo",
    logger: logging.Logger
) -> AssetKind:
    """
    Parse XCM v3 format asset kind.

    v3 format differs from v4/v5:
    - Uses assetId.concrete instead of assetId directly
    - location.interior.here doesn't always mean native asset (on AssetHub)

    Args:
        v3_data: The v3 dict from asset_kind.
        network_info: Network info for determining native asset.
        logger: Logger for warnings.

    Returns:
        AssetKind based on parsing.
    """
    location_interior = v3_data["location"]["interior"]

    # Case 1: location.interior.here - could be relay chain OR AssetHub
    # Must check assetId.concrete to determine actual asset
    if "here" in location_interior:
        concrete = v3_data["assetId"]["concrete"]
        concrete_parents = concrete.get("parents", 0)
        concrete_interior = concrete["interior"]
        return resolve_asset_from_interior(concrete_interior, network_info, concrete_parents, logger)

    # Case 2: location has x1 (system parachain reference)
    if "x1" in location_interior:
        try:
            parachain = location_interior["x1"]["parachain"]
            if parachain < 1000 or parachain >= 2000:
                logger.warning(f"Parachain {parachain} is not a system chain")
                return AssetKind.INVALID

            concrete = v3_data["assetId"]["concrete"]
            concrete_interior = concrete["interior"]

            if "here" in concrete_interior:
                return network_info.native_asset

            if "x2" in concrete_interior:
                return parse_asset_interior_x2(concrete_interior["x2"], logger)

            logger.warning(f"Unknown v3 concrete interior: {list(concrete_interior.keys())}")
            return AssetKind.INVALID

        except (KeyError, TypeError) as e:
            logger.warning(f"Invalid v3 x1 structure: {e}")
            return AssetKind.INVALID

    logger.warning(f"Unknown v3 location interior: {list(location_interior.keys())}")
    return AssetKind.INVALID


def _parse_xcm_v4_v5(
    data: dict,
    version_key: str,
    network_info: "NetworkInfo",
    logger: logging.Logger
) -> AssetKind:
    """
    Parse XCM v4/v5 format asset kind.

    v4/v5 use a unified assetId structure (no concrete wrapper).

    Args:
        data: The v4/v5 dict from asset_kind.
        version_key: "v4" or "v5" for error messages.
        network_info: Network info for determining native asset.
        logger: Logger for warnings.

    Returns:
        AssetKind based on parsing.
    """
    location_interior = data["location"]["interior"]
    asset_id = data["assetId"]
    asset_id_parents = asset_id.get("parents", 0)
    asset_id_interior = asset_id["interior"]

    # Case 1: location.interior.here - we're on AssetHub, check assetId
    if "here" in location_interior:
        return resolve_asset_from_interior(asset_id_interior, network_info, asset_id_parents, logger)

    # Case 2: location has x1 (system parachain reference)
    if "x1" in location_interior:
        try:
            parachain = location_interior["x1"][0]["parachain"]
            if parachain < 1000 or parachain >= 2000:
                logger.warning(f"Parachain {parachain} is not a system chain")
                return AssetKind.INVALID

            # Check assetId to determine asset type
            if asset_id_parents == 1 and "here" in asset_id_interior:
                return network_info.native_asset

            if "x2" in asset_id_interior:
                return parse_asset_interior_x2(asset_id_interior["x2"], logger)

            logger.warning(f"Unknown {version_key} assetId interior: {list(asset_id_interior.keys())}")
            return AssetKind.INVALID

        except (KeyError, IndexError, TypeError) as e:
            logger.warning(f"Invalid {version_key} x1 structure: {e}")
            return AssetKind.INVALID

    # Case 3: Multi-hop location (x2, x3, etc.) - not yet implemented
    if "x2" in location_interior or "x3" in location_interior:
        logger.warning(f"Multi-hop location not yet supported for {version_key}: {list(location_interior.keys())}")
        return AssetKind.INVALID

    logger.warning(f"Unknown {version_key} location interior: {list(location_interior.keys())}")
    return AssetKind.INVALID


def get_xcm_asset_value(assets: dict, network_info: "NetworkInfo") -> float:
    """
    Extract the fungible asset value from an XCM assets structure.

    Args:
        assets: XCM assets dict with version key (v3 or v4).
        network_info: Network info for denomination.

    Returns:
        Denominated asset value.

    Raises:
        ValueError: If asset format is unknown.
    """
    if "v3" in assets:
        raw_value = assets["v3"][0]["fun"]["fungible"]
    elif "v4" in assets:
        raw_value = assets["v4"][0]["fun"]["fungible"]
    else:
        raise ValueError(f"Unknown asset kind: {assets}")

    value = network_info.apply_denomination(raw_value, network_info.native_asset)
    return value
