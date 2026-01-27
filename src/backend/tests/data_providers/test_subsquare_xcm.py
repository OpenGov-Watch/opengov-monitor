"""
Tests for SubsquareProvider XCM asset kind parsing.

Tests the _get_XCM_asset_kind() method which parses XCM v4/v5 asset structures
to determine the correct asset type (DOT, USDC, USDT, etc.).
"""

import pytest
from unittest.mock import MagicMock
from data_providers.subsquare import SubsquareProvider
from data_providers.asset_kind import AssetKind
from data_providers.network_info import NetworkInfo


@pytest.fixture
def subsquare_provider(polkadot_network):
    """Create a SubsquareProvider instance for testing."""
    price_service = MagicMock()
    sink = MagicMock()
    provider = SubsquareProvider(polkadot_network, price_service, sink)
    return provider


class TestXCMv5NativeRelayChain:
    """Test v5 XCM with native relay chain asset (DOT/KSM)."""

    def test_v5_native_relay_chain_dot(self, subsquare_provider):
        """Test v5 XCM with parents=1, here in assetId (Treasury 108 pattern)."""
        asset_kind = {
            "v5": {
                "location": {
                    "parents": 0,
                    "interior": {"here": None}
                },
                "assetId": {
                    "parents": 1,
                    "interior": {"here": None}
                }
            }
        }
        result = subsquare_provider._get_XCM_asset_kind(asset_kind)
        assert result == AssetKind.DOT

    def test_v5_native_relay_chain_with_here_string(self, subsquare_provider):
        """Test v5 XCM with 'here' as key (some APIs return it differently)."""
        asset_kind = {
            "v5": {
                "location": {
                    "parents": 0,
                    "interior": {"here": ""}
                },
                "assetId": {
                    "parents": 1,
                    "interior": {"here": ""}
                }
            }
        }
        result = subsquare_provider._get_XCM_asset_kind(asset_kind)
        assert result == AssetKind.DOT


class TestXCMv5AssetHub:
    """Test v5 XCM with Asset Hub assets (USDC, USDT)."""

    def test_v5_assethub_usdc(self, subsquare_provider):
        """Test v5 XCM with parents=0, x2 in assetId (Treasury 183 pattern)."""
        asset_kind = {
            "v5": {
                "location": {
                    "parents": 0,
                    "interior": {"here": None}
                },
                "assetId": {
                    "parents": 0,
                    "interior": {
                        "x2": [
                            {"palletInstance": 50},
                            {"generalIndex": 1337}
                        ]
                    }
                }
            }
        }
        result = subsquare_provider._get_XCM_asset_kind(asset_kind)
        assert result == AssetKind.USDC

    def test_v5_assethub_usdt(self, subsquare_provider):
        """Test v5 XCM with generalIndex 1984 for USDT."""
        asset_kind = {
            "v5": {
                "location": {
                    "parents": 0,
                    "interior": {"here": None}
                },
                "assetId": {
                    "parents": 0,
                    "interior": {
                        "x2": [
                            {"palletInstance": 50},
                            {"generalIndex": 1984}
                        ]
                    }
                }
            }
        }
        result = subsquare_provider._get_XCM_asset_kind(asset_kind)
        assert result == AssetKind.USDT

    def test_v5_assethub_native_asset(self, subsquare_provider):
        """Test v5 XCM with parents=0 and assetId.interior.here (Asset Hub native)."""
        asset_kind = {
            "v5": {
                "location": {
                    "parents": 0,
                    "interior": {"here": None}
                },
                "assetId": {
                    "parents": 0,
                    "interior": {"here": None}
                }
            }
        }
        result = subsquare_provider._get_XCM_asset_kind(asset_kind)
        # Asset Hub native asset is still DOT in this context
        assert result == AssetKind.DOT


class TestXCMv4Compatibility:
    """Test v4 XCM compatibility (should work same as v5)."""

    def test_v4_native_relay_chain(self, subsquare_provider):
        """Test v4 XCM with parents=1 (should work same as v5)."""
        asset_kind = {
            "v4": {
                "location": {
                    "parents": 0,
                    "interior": {"here": None}
                },
                "assetId": {
                    "parents": 1,
                    "interior": {"here": None}
                }
            }
        }
        result = subsquare_provider._get_XCM_asset_kind(asset_kind)
        assert result == AssetKind.DOT

    def test_v4_assethub_usdc(self, subsquare_provider):
        """Test v4 XCM with Asset Hub USDC."""
        asset_kind = {
            "v4": {
                "location": {
                    "parents": 0,
                    "interior": {"here": None}
                },
                "assetId": {
                    "parents": 0,
                    "interior": {
                        "x2": [
                            {"palletInstance": 50},
                            {"generalIndex": 1337}
                        ]
                    }
                }
            }
        }
        result = subsquare_provider._get_XCM_asset_kind(asset_kind)
        assert result == AssetKind.USDC


class TestXCMv5X1Location:
    """Test v5 XCM with x1 location (system parachain pattern)."""

    def test_v5_x1_parachain_usdc(self, subsquare_provider):
        """Test v5 XCM with x1 location (system parachain pattern)."""
        asset_kind = {
            "v5": {
                "location": {
                    "parents": 0,
                    "interior": {
                        "x1": [{"parachain": 1000}]
                    }
                },
                "assetId": {
                    "parents": 0,
                    "interior": {
                        "x2": [
                            {"palletInstance": 50},
                            {"generalIndex": 1337}
                        ]
                    }
                }
            }
        }
        result = subsquare_provider._get_XCM_asset_kind(asset_kind)
        assert result == AssetKind.USDC

    def test_v5_x1_parachain_native_dot(self, subsquare_provider):
        """Test v5 XCM with x1 parachain location but native DOT asset."""
        asset_kind = {
            "v5": {
                "location": {
                    "parents": 0,
                    "interior": {
                        "x1": [{"parachain": 1000}]
                    }
                },
                "assetId": {
                    "parents": 1,
                    "interior": {"here": None}
                }
            }
        }
        result = subsquare_provider._get_XCM_asset_kind(asset_kind)
        assert result == AssetKind.DOT


class TestXCMInvalidCases:
    """Test invalid XCM structures return AssetKind.INVALID."""

    def test_v5_invalid_pallet_instance(self, subsquare_provider):
        """Test rejection of non-50 pallet instance."""
        asset_kind = {
            "v5": {
                "location": {"parents": 0, "interior": {"here": None}},
                "assetId": {
                    "parents": 0,
                    "interior": {
                        "x2": [
                            {"palletInstance": 99},  # Wrong!
                            {"generalIndex": 1337}
                        ]
                    }
                }
            }
        }
        result = subsquare_provider._get_XCM_asset_kind(asset_kind)
        assert result == AssetKind.INVALID

    def test_v5_unknown_general_index(self, subsquare_provider):
        """Test unknown generalIndex returns INVALID."""
        asset_kind = {
            "v5": {
                "location": {"parents": 0, "interior": {"here": None}},
                "assetId": {
                    "parents": 0,
                    "interior": {
                        "x2": [
                            {"palletInstance": 50},
                            {"generalIndex": 9999}  # Unknown
                        ]
                    }
                }
            }
        }
        result = subsquare_provider._get_XCM_asset_kind(asset_kind)
        assert result == AssetKind.INVALID

    def test_v5_non_system_parachain(self, subsquare_provider):
        """Test rejection of non-system parachain (< 1000 or >= 2000)."""
        asset_kind = {
            "v5": {
                "location": {
                    "parents": 0,
                    "interior": {
                        "x1": [{"parachain": 2001}]  # Not a system parachain
                    }
                },
                "assetId": {
                    "parents": 0,
                    "interior": {
                        "x2": [
                            {"palletInstance": 50},
                            {"generalIndex": 1337}
                        ]
                    }
                }
            }
        }
        result = subsquare_provider._get_XCM_asset_kind(asset_kind)
        assert result == AssetKind.INVALID


class TestXCMEdgeCases:
    """Test edge cases and malformed structures."""

    def test_v5_malformed_x2_missing_general_index(self, subsquare_provider):
        """Test graceful handling of malformed x2 structure."""
        asset_kind = {
            "v5": {
                "location": {"parents": 0, "interior": {"here": None}},
                "assetId": {
                    "parents": 0,
                    "interior": {
                        "x2": [{"palletInstance": 50}]  # Missing generalIndex
                    }
                }
            }
        }
        result = subsquare_provider._get_XCM_asset_kind(asset_kind)
        assert result == AssetKind.INVALID

    def test_v5_empty_x2(self, subsquare_provider):
        """Test handling of empty x2 array."""
        asset_kind = {
            "v5": {
                "location": {"parents": 0, "interior": {"here": None}},
                "assetId": {
                    "parents": 0,
                    "interior": {"x2": []}
                }
            }
        }
        result = subsquare_provider._get_XCM_asset_kind(asset_kind)
        assert result == AssetKind.INVALID

    def test_v5_missing_pallet_instance_key(self, subsquare_provider):
        """Test handling of missing palletInstance key in x2."""
        asset_kind = {
            "v5": {
                "location": {"parents": 0, "interior": {"here": None}},
                "assetId": {
                    "parents": 0,
                    "interior": {
                        "x2": [
                            {"notPalletInstance": 50},  # Wrong key
                            {"generalIndex": 1337}
                        ]
                    }
                }
            }
        }
        result = subsquare_provider._get_XCM_asset_kind(asset_kind)
        assert result == AssetKind.INVALID

    def test_v5_unknown_assetid_interior(self, subsquare_provider):
        """Test unknown assetId interior structure (not x2, not here)."""
        asset_kind = {
            "v5": {
                "location": {"parents": 0, "interior": {"here": None}},
                "assetId": {
                    "parents": 0,
                    "interior": {"x1": [{"something": "unknown"}]}
                }
            }
        }
        result = subsquare_provider._get_XCM_asset_kind(asset_kind)
        assert result == AssetKind.INVALID


class TestXCMv3ChainContext:
    """
    Test v3 XCM chain context awareness.

    These tests verify that v3 parsing correctly interprets XCM based on
    chain context (Relay Chain vs AssetHub) after the governance migration
    at ref 1782.

    Key insight: `location.interior.here` means different things:
    - On Relay Chain: "native asset (DOT)"
    - On AssetHub: "current location" - must check assetId.concrete for actual asset
    """

    def test_v3_here_location_with_native_dot_assetid(self, subsquare_provider):
        """
        Test v3 with here location but assetId.concrete indicates DOT.

        This pattern appears when governance is on AssetHub but spending DOT.
        location.interior.here = "we're on AssetHub"
        assetId.concrete.interior.here = "native asset of this chain" = DOT
        """
        asset_kind = {
            "v3": {
                "location": {
                    "parents": 0,
                    "interior": {"here": None}
                },
                "assetId": {
                    "concrete": {
                        "parents": 0,
                        "interior": {"here": None}
                    }
                }
            }
        }
        result = subsquare_provider._get_XCM_asset_kind(asset_kind)
        assert result == AssetKind.DOT

    def test_v3_here_location_with_usdc_assetid(self, subsquare_provider):
        """
        Test v3 with here location but assetId.concrete indicates USDC.

        This is the Treasury spend #203 pattern:
        location.interior.here = "we're on AssetHub"
        assetId.concrete with x2 = "USDC on pallet 50, index 1337"

        Previously this was incorrectly returning DOT because the old code
        only checked location.interior.here and immediately returned native.
        """
        asset_kind = {
            "v3": {
                "location": {
                    "parents": 0,
                    "interior": {"here": None}
                },
                "assetId": {
                    "concrete": {
                        "parents": 0,
                        "interior": {
                            "x2": [
                                {"palletInstance": 50},
                                {"generalIndex": 1337}
                            ]
                        }
                    }
                }
            }
        }
        result = subsquare_provider._get_XCM_asset_kind(asset_kind)
        assert result == AssetKind.USDC

    def test_v3_here_location_with_usdt_assetid(self, subsquare_provider):
        """Test v3 with here location but assetId.concrete indicates USDT."""
        asset_kind = {
            "v3": {
                "location": {
                    "parents": 0,
                    "interior": {"here": None}
                },
                "assetId": {
                    "concrete": {
                        "parents": 0,
                        "interior": {
                            "x2": [
                                {"palletInstance": 50},
                                {"generalIndex": 1984}
                            ]
                        }
                    }
                }
            }
        }
        result = subsquare_provider._get_XCM_asset_kind(asset_kind)
        assert result == AssetKind.USDT

    def test_v3_here_location_with_relay_reference(self, subsquare_provider):
        """
        Test v3 with here location but assetId.concrete references relay chain.

        parents=1 in assetId.concrete means "go up to relay chain"
        interior.here means "native asset there" = DOT
        """
        asset_kind = {
            "v3": {
                "location": {
                    "parents": 0,
                    "interior": {"here": None}
                },
                "assetId": {
                    "concrete": {
                        "parents": 1,
                        "interior": {"here": None}
                    }
                }
            }
        }
        result = subsquare_provider._get_XCM_asset_kind(asset_kind)
        assert result == AssetKind.DOT

    def test_v3_x1_parachain_with_usdc(self, subsquare_provider):
        """Test v3 with x1 parachain location and USDC asset."""
        asset_kind = {
            "v3": {
                "location": {
                    "parents": 0,
                    "interior": {
                        "x1": {"parachain": 1000}
                    }
                },
                "assetId": {
                    "concrete": {
                        "parents": 0,
                        "interior": {
                            "x2": [
                                {"palletInstance": 50},
                                {"generalIndex": 1337}
                            ]
                        }
                    }
                }
            }
        }
        result = subsquare_provider._get_XCM_asset_kind(asset_kind)
        assert result == AssetKind.USDC

    def test_v3_x1_parachain_with_native_dot(self, subsquare_provider):
        """Test v3 with x1 parachain location and native DOT asset."""
        asset_kind = {
            "v3": {
                "location": {
                    "parents": 0,
                    "interior": {
                        "x1": {"parachain": 1000}
                    }
                },
                "assetId": {
                    "concrete": {
                        "parents": 0,
                        "interior": {"here": None}
                    }
                }
            }
        }
        result = subsquare_provider._get_XCM_asset_kind(asset_kind)
        assert result == AssetKind.DOT

    def test_v3_x1_parachain_with_ded(self, subsquare_provider):
        """Test v3 with DED token (generalIndex 30)."""
        asset_kind = {
            "v3": {
                "location": {
                    "parents": 0,
                    "interior": {
                        "x1": {"parachain": 1000}
                    }
                },
                "assetId": {
                    "concrete": {
                        "parents": 0,
                        "interior": {
                            "x2": [
                                {"palletInstance": 50},
                                {"generalIndex": 30}
                            ]
                        }
                    }
                }
            }
        }
        result = subsquare_provider._get_XCM_asset_kind(asset_kind)
        assert result == AssetKind.DED


class TestXCMSharedUtilities:
    """Test the shared utility functions for XCM parsing."""

    def test_general_index_to_asset_kind_usdc(self, subsquare_provider):
        """Test USDC mapping."""
        assert subsquare_provider._general_index_to_asset_kind(1337) == AssetKind.USDC

    def test_general_index_to_asset_kind_usdt(self, subsquare_provider):
        """Test USDT mapping."""
        assert subsquare_provider._general_index_to_asset_kind(1984) == AssetKind.USDT

    def test_general_index_to_asset_kind_ded(self, subsquare_provider):
        """Test DED mapping."""
        assert subsquare_provider._general_index_to_asset_kind(30) == AssetKind.DED

    def test_general_index_to_asset_kind_invalid(self, subsquare_provider):
        """Test invalid mapping for known bad value."""
        assert subsquare_provider._general_index_to_asset_kind(19840000000000) == AssetKind.INVALID

    def test_general_index_to_asset_kind_unknown(self, subsquare_provider):
        """Test unknown index returns INVALID."""
        assert subsquare_provider._general_index_to_asset_kind(9999) == AssetKind.INVALID

    def test_parse_asset_interior_x2_usdc(self, subsquare_provider):
        """Test x2 parsing for USDC."""
        x2 = [{"palletInstance": 50}, {"generalIndex": 1337}]
        assert subsquare_provider._parse_asset_interior_x2(x2) == AssetKind.USDC

    def test_parse_asset_interior_x2_wrong_pallet(self, subsquare_provider):
        """Test x2 parsing with wrong pallet instance."""
        x2 = [{"palletInstance": 99}, {"generalIndex": 1337}]
        assert subsquare_provider._parse_asset_interior_x2(x2) == AssetKind.INVALID

    def test_parse_asset_interior_x2_too_short(self, subsquare_provider):
        """Test x2 parsing with too few elements."""
        x2 = [{"palletInstance": 50}]
        assert subsquare_provider._parse_asset_interior_x2(x2) == AssetKind.INVALID

    def test_resolve_asset_from_interior_relay(self, subsquare_provider):
        """Test resolving relay chain native asset."""
        interior = {"here": None}
        assert subsquare_provider._resolve_asset_from_interior(interior, parents=1) == AssetKind.DOT

    def test_resolve_asset_from_interior_local_native(self, subsquare_provider):
        """Test resolving local native asset."""
        interior = {"here": None}
        assert subsquare_provider._resolve_asset_from_interior(interior, parents=0) == AssetKind.DOT

    def test_resolve_asset_from_interior_usdc(self, subsquare_provider):
        """Test resolving USDC from x2 interior."""
        interior = {"x2": [{"palletInstance": 50}, {"generalIndex": 1337}]}
        assert subsquare_provider._resolve_asset_from_interior(interior, parents=0) == AssetKind.USDC
