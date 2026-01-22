"""Tests for call index mapping based on runtime versions.

Polkadot runtime upgrade at ref 1788 changed pallet indices.
These tests verify that the correct call indices are used based on ref_id.
"""

import pytest
from data_providers.subsquare import (
    POLKADOT_CALL_INDICES,
    POLKADOT_ASSETHUB_CUTOFF,
)


class TestCallIndexConstants:
    """Tests for call index constants."""

    def test_cutoff_is_1788(self):
        """Verify the cutoff referendum ID for AssetHub migration."""
        assert POLKADOT_ASSETHUB_CUTOFF == 1788

    def test_relay_indices_defined(self):
        """Verify relay (pre-1788) call indices are correctly defined."""
        relay = POLKADOT_CALL_INDICES["relay"]
        assert relay["utility.batch"] == "0x1a00"
        assert relay["utility.batchAll"] == "0x1a02"
        assert relay["utility.dispatchAs"] == "0x1a03"
        assert relay["utility.forceBatch"] == "0x1a04"
        assert relay["treasury.spend"] == "0x1305"

    def test_assethub_indices_defined(self):
        """Verify AssetHub (from ref 1788) call indices are correctly defined."""
        assethub = POLKADOT_CALL_INDICES["assethub"]
        assert assethub["utility.batch"] == "0x2800"
        assert assethub["utility.batchAll"] == "0x2802"
        assert assethub["utility.dispatchAs"] == "0x2803"
        assert assethub["utility.forceBatch"] == "0x2804"
        assert assethub["treasury.spend"] == "0x3c05"

    def test_relay_and_assethub_indices_differ(self):
        """Verify that relay and assethub indices are different."""
        relay = POLKADOT_CALL_INDICES["relay"]
        assethub = POLKADOT_CALL_INDICES["assethub"]

        for key in relay.keys():
            assert relay[key] != assethub[key], f"Expected {key} to differ between relay and assethub"


class TestCallIndexSelection:
    """Tests for selecting correct indices based on ref_id."""

    def test_ref_before_cutoff_uses_relay_indices(self):
        """Ref 1787 and earlier should use relay indices."""
        for ref_id in [1, 100, 1000, 1787]:
            if ref_id >= POLKADOT_ASSETHUB_CUTOFF:
                indices = POLKADOT_CALL_INDICES["assethub"]
            else:
                indices = POLKADOT_CALL_INDICES["relay"]

            assert indices == POLKADOT_CALL_INDICES["relay"], f"Ref {ref_id} should use relay indices"

    def test_ref_at_cutoff_uses_assethub_indices(self):
        """Ref 1788 should use assethub indices."""
        ref_id = 1788
        if ref_id >= POLKADOT_ASSETHUB_CUTOFF:
            indices = POLKADOT_CALL_INDICES["assethub"]
        else:
            indices = POLKADOT_CALL_INDICES["relay"]

        assert indices == POLKADOT_CALL_INDICES["assethub"], "Ref 1788 should use assethub indices"

    def test_ref_after_cutoff_uses_assethub_indices(self):
        """Ref 1831 and later should use assethub indices."""
        for ref_id in [1789, 1800, 1831, 2000]:
            if ref_id >= POLKADOT_ASSETHUB_CUTOFF:
                indices = POLKADOT_CALL_INDICES["assethub"]
            else:
                indices = POLKADOT_CALL_INDICES["relay"]

            assert indices == POLKADOT_CALL_INDICES["assethub"], f"Ref {ref_id} should use assethub indices"

    def test_boundary_conditions(self):
        """Test exact boundary at cutoff."""
        # Just below cutoff
        ref_id = POLKADOT_ASSETHUB_CUTOFF - 1
        if ref_id >= POLKADOT_ASSETHUB_CUTOFF:
            indices = POLKADOT_CALL_INDICES["assethub"]
        else:
            indices = POLKADOT_CALL_INDICES["relay"]
        assert indices == POLKADOT_CALL_INDICES["relay"]

        # Exactly at cutoff
        ref_id = POLKADOT_ASSETHUB_CUTOFF
        if ref_id >= POLKADOT_ASSETHUB_CUTOFF:
            indices = POLKADOT_CALL_INDICES["assethub"]
        else:
            indices = POLKADOT_CALL_INDICES["relay"]
        assert indices == POLKADOT_CALL_INDICES["assethub"]
