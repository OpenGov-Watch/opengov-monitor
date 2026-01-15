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
