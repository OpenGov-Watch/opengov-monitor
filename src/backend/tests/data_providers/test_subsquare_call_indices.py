"""Tests for call index mapping based on runtime versions.

Polkadot runtime upgrade at ref 1782 changed pallet indices.
These tests verify that the correct call indices are used based on ref_id.
"""

import pytest
from data_providers.subsquare import (
    POLKADOT_CALL_INDICES,
    POLKADOT_ASSETHUB_CUTOFF,
    RELAY_ONLY_CALL_INDICES,
    STATIC_CALL_INDICES,
    ZERO_VALUE_METHODS,
    get_call_index,
)


class TestCallIndexConstants:
    """Tests for call index constants."""

    def test_cutoff_is_1782(self):
        """Verify the cutoff referendum ID for AssetHub migration."""
        assert POLKADOT_ASSETHUB_CUTOFF == 1782

    def test_relay_utility_indices_defined(self):
        """Verify relay (pre-1782) utility call indices are correctly defined."""
        relay = POLKADOT_CALL_INDICES["relay"]
        assert relay["utility.batch"] == "0x1a00"
        assert relay["utility.batchAll"] == "0x1a02"
        assert relay["utility.dispatchAs"] == "0x1a03"
        assert relay["utility.forceBatch"] == "0x1a04"

    def test_relay_treasury_indices_defined(self):
        """Verify relay treasury call indices."""
        relay = POLKADOT_CALL_INDICES["relay"]
        assert relay["treasury.proposeSpend"] == "0x1300"
        assert relay["treasury.approveProposal"] == "0x1302"
        assert relay["treasury.spend"] == "0x1305"

    def test_relay_bounties_indices_defined(self):
        """Verify relay bounties call indices."""
        relay = POLKADOT_CALL_INDICES["relay"]
        assert relay["bounties.proposeBounty"] == "0x2200"
        assert relay["bounties.approveBounty"] == "0x2201"
        assert relay["bounties.proposeCurator"] == "0x2202"
        assert relay["bounties.unassignCurator"] == "0x2203"
        assert relay["bounties.acceptCurator"] == "0x2204"
        assert relay["bounties.closeBounty"] == "0x2207"
        assert relay["bounties.approveBountyWithCurator"] == "0x2209"

    def test_assethub_utility_indices_defined(self):
        """Verify AssetHub (from ref 1782) utility call indices are correctly defined."""
        assethub = POLKADOT_CALL_INDICES["assethub"]
        assert assethub["utility.batch"] == "0x2800"
        assert assethub["utility.batchAll"] == "0x2802"
        assert assethub["utility.dispatchAs"] == "0x2803"
        assert assethub["utility.forceBatch"] == "0x2804"

    def test_assethub_treasury_indices_defined(self):
        """Verify AssetHub treasury call indices."""
        assethub = POLKADOT_CALL_INDICES["assethub"]
        assert assethub["treasury.proposeSpend"] == "0x3c00"
        assert assethub["treasury.approveProposal"] == "0x3c02"
        assert assethub["treasury.spend"] == "0x3c05"

    def test_assethub_bounties_indices_defined(self):
        """Verify AssetHub bounties call indices."""
        assethub = POLKADOT_CALL_INDICES["assethub"]
        assert assethub["bounties.proposeBounty"] == "0x4100"
        assert assethub["bounties.approveBounty"] == "0x4101"
        assert assethub["bounties.proposeCurator"] == "0x4102"
        assert assethub["bounties.unassignCurator"] == "0x4103"
        assert assethub["bounties.acceptCurator"] == "0x4104"
        assert assethub["bounties.closeBounty"] == "0x4107"
        assert assethub["bounties.approveBountyWithCurator"] == "0x4109"

    def test_relay_and_assethub_indices_differ(self):
        """Verify that relay and assethub indices are different for shared pallets."""
        relay = POLKADOT_CALL_INDICES["relay"]
        assethub = POLKADOT_CALL_INDICES["assethub"]

        for key in relay.keys():
            assert relay[key] != assethub[key], f"Expected {key} to differ between relay and assethub"

    def test_relay_only_indices_defined(self):
        """Verify relay-only pallet indices that don't exist on AssetHub."""
        assert RELAY_ONLY_CALL_INDICES["configuration.setMaxCodeSize"] == "0x3303"
        assert RELAY_ONLY_CALL_INDICES["paras.forceSetCurrentCode"] == "0x3800"
        assert RELAY_ONLY_CALL_INDICES["hrmp.forceOpenHrmpChannel"] == "0x3c07"
        assert RELAY_ONLY_CALL_INDICES["identity.addRegistrar"] == "0x1c00"
        assert RELAY_ONLY_CALL_INDICES["slots.forceLease"] == "0x4700"
        assert RELAY_ONLY_CALL_INDICES["auctions.newAuction"] == "0x4800"

    def test_static_indices_defined(self):
        """Verify static indices that don't change between chains."""
        assert STATIC_CALL_INDICES["system.remark"] == "0x0000"
        assert STATIC_CALL_INDICES["system.remarkWithEvent"] == "0x0007"
        assert STATIC_CALL_INDICES["system.setCode"] == "0x0002"
        assert STATIC_CALL_INDICES["scheduler.scheduleNamed"] == "0x0102"
        assert STATIC_CALL_INDICES["scheduler.scheduleAfter"] == "0x0104"
        assert STATIC_CALL_INDICES["referenda.submit"] == "0x1500"
        assert STATIC_CALL_INDICES["referenda.cancel"] == "0x1503"
        assert STATIC_CALL_INDICES["referenda.kill"] == "0x1504"


class TestGetCallIndex:
    """Tests for the get_call_index helper function."""

    def test_relay_only_returns_same_for_any_ref_id(self):
        """Relay-only methods return the same index regardless of ref_id."""
        # Before cutoff
        assert get_call_index("identity.addRegistrar", 1000) == "0x1c00"
        # After cutoff
        assert get_call_index("identity.addRegistrar", 2000) == "0x1c00"

    def test_static_returns_same_for_any_ref_id(self):
        """Static methods return the same index regardless of ref_id."""
        # Before cutoff
        assert get_call_index("system.remark", 1000) == "0x0000"
        assert get_call_index("referenda.submit", 1000) == "0x1500"
        # After cutoff
        assert get_call_index("system.remark", 2000) == "0x0000"
        assert get_call_index("referenda.submit", 2000) == "0x1500"

    def test_era_specific_returns_relay_before_cutoff(self):
        """Methods with era-specific indices return relay indices before cutoff."""
        # Just before cutoff
        ref_id = POLKADOT_ASSETHUB_CUTOFF - 1
        assert get_call_index("utility.batch", ref_id) == "0x1a00"
        assert get_call_index("treasury.spend", ref_id) == "0x1305"
        assert get_call_index("bounties.closeBounty", ref_id) == "0x2207"

    def test_era_specific_returns_assethub_at_cutoff(self):
        """Methods with era-specific indices return assethub indices at cutoff."""
        ref_id = POLKADOT_ASSETHUB_CUTOFF
        assert get_call_index("utility.batch", ref_id) == "0x2800"
        assert get_call_index("treasury.spend", ref_id) == "0x3c05"
        assert get_call_index("bounties.closeBounty", ref_id) == "0x4107"

    def test_era_specific_returns_assethub_after_cutoff(self):
        """Methods with era-specific indices return assethub indices after cutoff."""
        ref_id = 2000
        assert get_call_index("utility.batch", ref_id) == "0x2800"
        assert get_call_index("treasury.spend", ref_id) == "0x3c05"
        assert get_call_index("bounties.closeBounty", ref_id) == "0x4107"

    def test_unknown_method_returns_none(self):
        """Unknown methods return None."""
        assert get_call_index("nonexistent.method", 1000) is None
        assert get_call_index("nonexistent.method", 2000) is None

    def test_bounties_close_bounty_ref_1795(self):
        """Specifically test the bounties.closeBounty case for ref 1795 (the original bug)."""
        # Ref 1795 is after the 1782 cutoff, should use assethub indices
        assert get_call_index("bounties.closeBounty", 1795) == "0x4107"


class TestCallIndexSelection:
    """Tests for selecting correct indices based on ref_id."""

    def test_ref_before_cutoff_uses_relay_indices(self):
        """Ref 1781 and earlier should use relay indices."""
        for ref_id in [1, 100, 1000, 1781]:
            assert get_call_index("utility.batch", ref_id) == "0x1a00"
            assert get_call_index("treasury.spend", ref_id) == "0x1305"

    def test_ref_at_cutoff_uses_assethub_indices(self):
        """Ref 1782 should use assethub indices."""
        ref_id = 1782
        assert get_call_index("utility.batch", ref_id) == "0x2800"
        assert get_call_index("treasury.spend", ref_id) == "0x3c05"

    def test_ref_after_cutoff_uses_assethub_indices(self):
        """Ref 1783 and later should use assethub indices."""
        for ref_id in [1783, 1800, 1831, 2000]:
            assert get_call_index("utility.batch", ref_id) == "0x2800"
            assert get_call_index("treasury.spend", ref_id) == "0x3c05"

    def test_boundary_conditions(self):
        """Test exact boundary at cutoff."""
        # Just below cutoff
        ref_id = POLKADOT_ASSETHUB_CUTOFF - 1
        assert get_call_index("utility.batch", ref_id) == "0x1a00"

        # Exactly at cutoff
        ref_id = POLKADOT_ASSETHUB_CUTOFF
        assert get_call_index("utility.batch", ref_id) == "0x2800"


class TestZeroValueMethods:
    """Tests for the ZERO_VALUE_METHODS constant."""

    def test_all_methods_have_valid_indices(self):
        """All zero-value methods should have valid indices in at least one era."""
        for method in ZERO_VALUE_METHODS:
            # Try relay era
            relay_idx = get_call_index(method, 1000)
            # Try assethub era
            assethub_idx = get_call_index(method, 2000)

            # At least one should be valid
            assert relay_idx is not None or assethub_idx is not None, \
                f"Method {method} has no valid index in any era"

    def test_bounties_methods_included(self):
        """All bounties methods should be in zero value methods."""
        bounties_methods = [
            "bounties.proposeBounty",
            "bounties.approveBounty",
            "bounties.approveBountyWithCurator",
            "bounties.proposeCurator",
            "bounties.unassignCurator",
            "bounties.acceptCurator",
            "bounties.closeBounty",
        ]
        for method in bounties_methods:
            assert method in ZERO_VALUE_METHODS, f"{method} should be in ZERO_VALUE_METHODS"

    def test_expected_methods_present(self):
        """Verify expected key methods are present."""
        expected = [
            "system.remark",
            "treasury.proposeSpend",
            "treasury.approveProposal",
            "whitelist.dispatchWhitelistedCallWithPreimage",
            "xcmPallet.send",
            "assetRate.create",
        ]
        for method in expected:
            assert method in ZERO_VALUE_METHODS, f"{method} should be in ZERO_VALUE_METHODS"
