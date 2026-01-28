"""
Runtime constants and call index utilities for Polkadot governance.

Call index mapping for different Polkadot runtime eras.
Runtime upgrade at ref 1782 changed pallet indices (AssetHub migration).
"""

# Tracks that should have USD/DOT values (spending-related tracks)
SPENDER_TRACKS = ['SmallSpender', 'MediumSpender', 'BigSpender', 'SmallTipper', 'BigTipper', 'Treasurer']

# Call index mapping for different Polkadot runtime eras
POLKADOT_CALL_INDICES = {
    "relay": {  # Before ref 1782
        # Utility (0x1a = 26)
        "utility.batch": "0x1a00",
        "utility.batchAll": "0x1a02",
        "utility.dispatchAs": "0x1a03",
        "utility.forceBatch": "0x1a04",
        # Treasury (0x13 = 19)
        "treasury.proposeSpend": "0x1300",
        "treasury.approveProposal": "0x1302",
        "treasury.spend": "0x1305",
        # Whitelist (0x17 = 23)
        "whitelist.dispatchWhitelistedCallWithPreimage": "0x1703",
        # Bounties (0x22 = 34)
        "bounties.proposeBounty": "0x2200",
        "bounties.approveBounty": "0x2201",
        "bounties.proposeCurator": "0x2202",
        "bounties.unassignCurator": "0x2203",
        "bounties.acceptCurator": "0x2204",
        "bounties.closeBounty": "0x2207",
        "bounties.approveBountyWithCurator": "0x2209",
        # AssetRate (0x65 = 101)
        "assetRate.create": "0x6500",
        "assetRate.update": "0x6501",
        "assetRate.remove": "0x6502",
        # Balances (0x05 = 5)
        "balances.forceSetBalance": "0x0508",
        "balances.forceAdjustTotalIssuance": "0x0509",
        # Preimage (0x0a = 10)
        "preimage.notePreimage": "0x0a00",
        "preimage.requestPreimage": "0x0a02",
        # NominationPools (0x27 = 39)
        "nominationPools.setConfigs": "0x270b",
        # XcmPallet (0x63 = 99)
        "xcmPallet.send": "0x6300",
    },
    "assethub": {  # From ref 1782 onwards
        # Utility (0x28 = 40)
        "utility.batch": "0x2800",
        "utility.batchAll": "0x2802",
        "utility.dispatchAs": "0x2803",
        "utility.forceBatch": "0x2804",
        # Treasury (0x3c = 60)
        "treasury.proposeSpend": "0x3c00",
        "treasury.approveProposal": "0x3c02",
        "treasury.spend": "0x3c05",
        # Whitelist (0x40 = 64)
        "whitelist.dispatchWhitelistedCallWithPreimage": "0x4003",
        # Bounties (0x41 = 65)
        "bounties.proposeBounty": "0x4100",
        "bounties.approveBounty": "0x4101",
        "bounties.proposeCurator": "0x4102",
        "bounties.unassignCurator": "0x4103",
        "bounties.acceptCurator": "0x4104",
        "bounties.closeBounty": "0x4107",
        "bounties.approveBountyWithCurator": "0x4109",
        # AssetRate (0x43 = 67)
        "assetRate.create": "0x4300",
        "assetRate.update": "0x4301",
        "assetRate.remove": "0x4302",
        # Balances (0x0a = 10)
        "balances.forceSetBalance": "0x0a08",
        "balances.forceAdjustTotalIssuance": "0x0a09",
        # Preimage (0x05 = 5)
        "preimage.notePreimage": "0x0500",
        "preimage.requestPreimage": "0x0502",
        # NominationPools (0x50 = 80)
        "nominationPools.setConfigs": "0x500b",
        # PolkadotXcm (0x1f = 31)
        "xcmPallet.send": "0x1f00",
    },
}

# Relay-only pallets (don't exist on AssetHub, indices never change)
RELAY_ONLY_CALL_INDICES = {
    "configuration.setMaxCodeSize": "0x3303",
    "configuration.setHrmpChannelMaxCapacity": "0x3320",
    "paras.forceSetCurrentCode": "0x3800",
    "paras.forceSetCurrentHead": "0x3801",
    "hrmp.forceOpenHrmpChannel": "0x3c07",
    "registrar.deregister": "0x4602",
    "registrar.swap": "0x4603",
    "registrar.removeLock": "0x4604",
    "slots.forceLease": "0x4700",
    "slots.clearAllLeases": "0x4701",
    "auctions.newAuction": "0x4800",
    "identity.addRegistrar": "0x1c00",
}

# Unchanged across both chains (system, scheduler, referenda have same indices)
STATIC_CALL_INDICES = {
    "system.remark": "0x0000",
    "system.remarkWithEvent": "0x0007",
    "system.setCode": "0x0002",
    "scheduler.scheduleNamed": "0x0102",
    "scheduler.scheduleAfter": "0x0104",
    "referenda.submit": "0x1500",
    "referenda.cancel": "0x1503",
    "referenda.kill": "0x1504",
}

# Methods that are known to be zero-value (not Treasury-related)
ZERO_VALUE_METHODS = [
    "system.remark",
    "system.remarkWithEvent",
    "system.setCode",
    "balances.forceSetBalance",
    "balances.forceAdjustTotalIssuance",
    "preimage.notePreimage",
    "preimage.requestPreimage",
    "treasury.proposeSpend",
    "treasury.approveProposal",
    "referenda.submit",
    "referenda.cancel",
    "referenda.kill",
    "whitelist.dispatchWhitelistedCallWithPreimage",
    "identity.addRegistrar",
    "bounties.proposeBounty",
    "bounties.approveBounty",
    "bounties.approveBountyWithCurator",
    "bounties.proposeCurator",
    "bounties.unassignCurator",
    "bounties.acceptCurator",
    "bounties.closeBounty",
    "nominationPools.setConfigs",
    "configuration.setMaxCodeSize",
    "configuration.setHrmpChannelMaxCapacity",
    "paras.forceSetCurrentCode",
    "hrmp.forceOpenHrmpChannel",
    "paras.forceSetCurrentHead",
    "registrar.deregister",
    "registrar.swap",
    "registrar.removeLock",
    "slots.forceLease",
    "slots.clearAllLeases",
    "auctions.newAuction",
    "xcmPallet.send",
    "assetRate.create",
    "assetRate.update",
    "assetRate.remove",
]

# First referendum using AssetHub call indices
POLKADOT_ASSETHUB_CUTOFF = 1782


def get_call_index(method_name: str, ref_id: int) -> str | None:
    """Get call index for a method, handling runtime version differences.

    Args:
        method_name: The pallet.method name (e.g., "bounties.closeBounty")
        ref_id: The referendum ID to determine which runtime era to use

    Returns:
        The call index hex string, or None if method not found
    """
    # Check relay-only pallets first (they don't exist on AssetHub)
    if method_name in RELAY_ONLY_CALL_INDICES:
        return RELAY_ONLY_CALL_INDICES[method_name]

    # Check static indices (same on both chains)
    if method_name in STATIC_CALL_INDICES:
        return STATIC_CALL_INDICES[method_name]

    # Select era-specific indices
    if ref_id >= POLKADOT_ASSETHUB_CUTOFF:
        return POLKADOT_CALL_INDICES["assethub"].get(method_name)
    else:
        return POLKADOT_CALL_INDICES["relay"].get(method_name)
