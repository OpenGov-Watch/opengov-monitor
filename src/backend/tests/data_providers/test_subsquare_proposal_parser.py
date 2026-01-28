"""
Tests for referendum proposal value extraction.

Key test areas:
- Scheduler calls (scheduleNamed, scheduleAfter)
- Utility batch calls (batch, batchAll, forceBatch)
- Balances/treasury calls (forceTransfer, spend)
- XCM pallet parsing
- Runtime version differences (pre/post ref 1782)
"""

import pytest
from unittest.mock import MagicMock

from data_providers.subsquare.proposal_parser import (
    build_bag_from_call_value,
    bag_from_referendum_data,
    get_needs_detail_call_indices,
)
from data_providers.subsquare.call_indices import (
    get_call_index,
    POLKADOT_CALL_INDICES,
    POLKADOT_ASSETHUB_CUTOFF,
)
from data_providers.network_info import NetworkInfo
from data_providers.asset_kind import AssetKind
from data_providers.assets_bag import AssetsBag


@pytest.fixture
def polkadot_network():
    """Polkadot network info fixture."""
    return NetworkInfo(network="polkadot", explorer="subsquare")


class TestBuildBagFromCallValue:
    """Tests for build_bag_from_call_value function."""

    def test_handles_empty_call(self, polkadot_network):
        """Test that empty call results in unchanged bag."""
        bag = AssetsBag()
        call = {}

        build_bag_from_call_value(bag, call, None, 100, polkadot_network)

        # Empty call (no preimage) returns early without changing the bag
        assert not bag.is_nan()
        assert bag.get_amount(AssetKind.DOT) == 0.0

    def test_handles_balances_force_transfer(self, polkadot_network):
        """Test extraction of value from balances.forceTransfer call."""
        bag = AssetsBag()
        # This call index is static: 0x0502
        call = {
            "callIndex": "0x0502",
            "args": [
                {"name": "source", "value": {"id": polkadot_network.treasury_address}},
                {"name": "dest", "value": {"id": "some_address"}},
                {"name": "value", "value": "10000000000"},  # 1 DOT in plancks
            ]
        }

        build_bag_from_call_value(bag, call, None, 100, polkadot_network)

        assert bag.get_amount(AssetKind.DOT) == 1.0

    def test_handles_treasury_spend_relay(self, polkadot_network):
        """Test extraction of value from treasury.spend call (pre-1782)."""
        bag = AssetsBag()
        # Pre-1782 call index for treasury.spend
        call_index = POLKADOT_CALL_INDICES["relay"]["treasury.spend"]

        # DOT asset kind (v3 format)
        asset_kind = {
            "v3": {
                "location": {"parents": 0, "interior": {"here": None}},
                "assetId": {"concrete": {"parents": 0, "interior": {"here": None}}}
            }
        }

        call = {
            "callIndex": call_index,
            "args": [
                {"name": "assetKind", "value": asset_kind},
                {"name": "amount", "value": "10000000000"},  # 1 DOT
                {"name": "beneficiary", "value": {"id": "some_address"}},
                {"name": "validFrom", "value": 1000},
            ]
        }

        build_bag_from_call_value(bag, call, None, 100, polkadot_network)

        assert bag.get_amount(AssetKind.DOT) == 1.0

    def test_handles_treasury_spend_assethub(self, polkadot_network):
        """Test extraction of value from treasury.spend call (post-1782)."""
        bag = AssetsBag()
        # Post-1782 call index for treasury.spend
        call_index = POLKADOT_CALL_INDICES["assethub"]["treasury.spend"]

        # USDC asset kind (v4 format on AssetHub)
        asset_kind = {
            "v4": {
                "location": {"parents": 0, "interior": {"here": None}},
                "assetId": {
                    "parents": 0,
                    "interior": {"x2": [{"palletInstance": 50}, {"generalIndex": 1337}]}
                }
            }
        }

        call = {
            "callIndex": call_index,
            "args": [
                {"name": "assetKind", "value": asset_kind},
                {"name": "amount", "value": "1000000000"},  # 1000 USDC (6 decimals)
                {"name": "beneficiary", "value": {"id": "some_address"}},
                {"name": "validFrom", "value": 1000},
            ]
        }

        build_bag_from_call_value(bag, call, None, 1800, polkadot_network)

        assert bag.get_amount(AssetKind.USDC) == 1000.0

    def test_handles_nested_call_in_call_field(self, polkadot_network):
        """Test extraction when call is nested in 'call' field."""
        bag = AssetsBag()
        call = {
            "call": {
                "callIndex": "0x0502",
                "args": [
                    {"name": "source", "value": {"id": polkadot_network.treasury_address}},
                    {"name": "dest", "value": {"id": "some_address"}},
                    {"name": "value", "value": "10000000000"},
                ]
            }
        }

        build_bag_from_call_value(bag, call, None, 100, polkadot_network)

        assert bag.get_amount(AssetKind.DOT) == 1.0

    def test_handles_utility_batch(self, polkadot_network):
        """Test extraction from utility.batch with multiple inner calls."""
        bag = AssetsBag()
        batch_call_index = POLKADOT_CALL_INDICES["relay"]["utility.batch"]

        # Two force transfers
        inner_calls = [
            {
                "callIndex": "0x0502",
                "args": [
                    {"name": "source", "value": {"id": polkadot_network.treasury_address}},
                    {"name": "dest", "value": {"id": "addr1"}},
                    {"name": "value", "value": "10000000000"},  # 1 DOT
                ]
            },
            {
                "callIndex": "0x0502",
                "args": [
                    {"name": "source", "value": {"id": polkadot_network.treasury_address}},
                    {"name": "dest", "value": {"id": "addr2"}},
                    {"name": "value", "value": "20000000000"},  # 2 DOT
                ]
            }
        ]

        call = {
            "callIndex": batch_call_index,
            "args": [{"name": "calls", "value": inner_calls}]
        }

        build_bag_from_call_value(bag, call, None, 100, polkadot_network)

        assert bag.get_amount(AssetKind.DOT) == 3.0  # 1 + 2 DOT

    def test_handles_scheduler_schedule_named(self, polkadot_network):
        """Test extraction from scheduler.scheduleNamed call."""
        bag = AssetsBag()
        schedule_call_index = POLKADOT_CALL_INDICES["relay"]["utility.batch"]  # Used as wrapper

        # Inner call wrapped in scheduleNamed
        inner_call = {
            "callIndex": "0x0502",
            "args": [
                {"name": "source", "value": {"id": polkadot_network.treasury_address}},
                {"name": "dest", "value": {"id": "some_address"}},
                {"name": "value", "value": "10000000000"},
            ]
        }

        # scheduleNamed has inner call at args[4]
        call = {
            "callIndex": "0x0102",  # scheduler.scheduleNamed (static)
            "args": [
                {"name": "id", "value": "some_id"},
                {"name": "when", "value": 1000},
                {"name": "maybePeriodic", "value": None},
                {"name": "priority", "value": 0},
                {"name": "call", "value": inner_call},
            ]
        }

        build_bag_from_call_value(bag, call, None, 100, polkadot_network)

        assert bag.get_amount(AssetKind.DOT) == 1.0

    def test_handles_unknown_call_index(self, polkadot_network):
        """Test that unknown call index sets bag to NaN."""
        bag = AssetsBag()
        call = {
            "callIndex": "0xFFFF",  # Unknown
            "args": []
        }

        build_bag_from_call_value(bag, call, None, 100, polkadot_network)

        assert bag.is_nan()

    def test_handles_known_zero_value_method(self, polkadot_network):
        """Test that known zero-value methods don't affect the bag."""
        bag = AssetsBag()
        # system.remark is a known zero-value method
        call = {
            "callIndex": "0x0000",  # system.remark
            "args": [{"name": "remark", "value": "some remark"}]
        }

        build_bag_from_call_value(bag, call, None, 100, polkadot_network)

        # Known zero-value methods return early without changing the bag
        assert not bag.is_nan()
        assert bag.get_amount(AssetKind.DOT) == 0.0


class TestBagFromReferendumData:
    """Tests for bag_from_referendum_data function."""

    def test_extracts_from_treasury_info(self, polkadot_network):
        """Test extraction from treasuryInfo field."""
        row = {
            "id": 100,
            "proposal_time": "2024-01-15T10:00:00Z",
            "onchainData": {
                "treasuryInfo": {"amount": "10000000000"},  # 1 DOT
                "proposal": {}
            }
        }

        bag = bag_from_referendum_data(row, polkadot_network)

        assert bag.get_amount(AssetKind.DOT) == 1.0

    def test_extracts_from_proposal_call(self, polkadot_network):
        """Test extraction from proposal call when no treasuryInfo."""
        row = {
            "id": 100,
            "proposal_time": "2024-01-15T10:00:00Z",
            "onchainData": {
                "proposal": {
                    "callIndex": "0x0502",
                    "args": [
                        {"name": "source", "value": {"id": polkadot_network.treasury_address}},
                        {"name": "dest", "value": {"id": "some_address"}},
                        {"name": "value", "value": "10000000000"},
                    ]
                }
            }
        }

        bag = bag_from_referendum_data(row, polkadot_network)

        assert bag.get_amount(AssetKind.DOT) == 1.0

    def test_handles_treasury_bounties(self, polkadot_network):
        """Test that treasuryBounties results in empty bag (known zero value)."""
        row = {
            "id": 100,
            "proposal_time": "2024-01-15T10:00:00Z",
            "treasuryBounties": [{"bountyId": 1}],
            "onchainData": {"proposal": {}}
        }

        bag = bag_from_referendum_data(row, polkadot_network)

        # Bounty acceptance has no direct value - bag stays empty (not NaN)
        assert not bag.is_nan()
        assert bag.get_amount(AssetKind.DOT) == 0.0

    def test_handles_known_zero_value_proposals(self, polkadot_network):
        """Test that known zero-value proposals result in NaN bag."""
        # Starlay Hack Recovery Attempt (ref 546 on polkadot)
        row = {
            "id": 546,
            "proposal_time": "2024-01-15T10:00:00Z",
            "onchainData": {"proposal": {"callIndex": "0x6300", "args": []}}
        }

        bag = bag_from_referendum_data(row, polkadot_network)

        assert bag.is_nan()

    def test_handles_exception_gracefully(self, polkadot_network):
        """Test that exceptions result in NaN bag."""
        row = {
            "id": 100,
            "proposal_time": "2024-01-15T10:00:00Z",
            "onchainData": {
                "proposal": {
                    "callIndex": "0x0502",
                    "args": None  # This will cause an exception
                }
            }
        }

        bag = bag_from_referendum_data(row, polkadot_network)

        assert bag.is_nan()


class TestGetNeedsDetailCallIndices:
    """Tests for get_needs_detail_call_indices function."""

    def test_returns_list_of_call_indices(self):
        """Test that function returns a list of hex strings."""
        indices = get_needs_detail_call_indices()

        assert isinstance(indices, list)
        assert len(indices) > 0
        # All should be hex strings
        for idx in indices:
            assert isinstance(idx, str)
            assert idx.startswith("0x")

    def test_includes_utility_batch_indices(self):
        """Test that utility batch indices are included."""
        indices = get_needs_detail_call_indices()

        # Should include both relay and assethub versions
        relay_batch = POLKADOT_CALL_INDICES["relay"]["utility.batch"]
        assethub_batch = POLKADOT_CALL_INDICES["assethub"]["utility.batch"]

        assert relay_batch in indices
        assert assethub_batch in indices

    def test_includes_treasury_spend_indices(self):
        """Test that treasury.spend indices are included."""
        indices = get_needs_detail_call_indices()

        relay_spend = POLKADOT_CALL_INDICES["relay"]["treasury.spend"]
        assethub_spend = POLKADOT_CALL_INDICES["assethub"]["treasury.spend"]

        assert relay_spend in indices
        assert assethub_spend in indices

    def test_no_duplicate_indices(self):
        """Test that there are no duplicate indices."""
        indices = get_needs_detail_call_indices()

        assert len(indices) == len(set(indices))


class TestGetCallIndex:
    """Tests for get_call_index function."""

    def test_returns_relay_index_for_pre_1782(self):
        """Test that relay indices are returned for ref < 1782."""
        index = get_call_index("utility.batch", 1000)

        assert index == POLKADOT_CALL_INDICES["relay"]["utility.batch"]
        assert index == "0x1a00"

    def test_returns_assethub_index_for_post_1782(self):
        """Test that AssetHub indices are returned for ref >= 1782."""
        index = get_call_index("utility.batch", 1800)

        assert index == POLKADOT_CALL_INDICES["assethub"]["utility.batch"]
        assert index == "0x2800"

    def test_returns_static_index_regardless_of_ref(self):
        """Test that static indices are returned for any ref."""
        # scheduler.scheduleNamed is static
        index_pre = get_call_index("scheduler.scheduleNamed", 100)
        index_post = get_call_index("scheduler.scheduleNamed", 2000)

        assert index_pre == index_post
        assert index_pre == "0x0102"

    def test_returns_none_for_unknown_method(self):
        """Test that None is returned for unknown method."""
        index = get_call_index("unknown.method", 100)

        assert index is None

    def test_cutoff_boundary(self):
        """Test behavior at exact cutoff boundary."""
        # ref 1781 should use relay
        index_1781 = get_call_index("utility.batch", 1781)
        assert index_1781 == POLKADOT_CALL_INDICES["relay"]["utility.batch"]

        # ref 1782 should use assethub
        index_1782 = get_call_index("utility.batch", POLKADOT_ASSETHUB_CUTOFF)
        assert index_1782 == POLKADOT_CALL_INDICES["assethub"]["utility.batch"]
