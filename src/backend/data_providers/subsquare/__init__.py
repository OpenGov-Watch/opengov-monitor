"""
Subsquare API Documentation
===========================

This module interfaces with the Subsquare API to fetch Polkadot/Kusama governance data.
Below are the documented web service calls made by this provider:

BASE URLS:
- Polkadot: https://polkadot-api.subsquare.io/
- Kusama: https://kusama-api.subsquare.io/
- Collectives: https://collectives-api.subsquare.io/

API ENDPOINTS:

1. REFERENDA LIST
   URL: https://{network}-api.subsquare.io/gov2/referendums?page={page}&page_size=100

2. REFERENDUM DETAILS
   URL: https://{network}-api.subsquare.io/gov2/referendums/{referendumIndex}.json

3. TREASURY SPENDS LIST
   URL: https://{network}-api.subsquare.io/treasury/spends?page={page}&page_size=100

4. TREASURY SPEND DETAILS
   URL: https://{network}-api.subsquare.io/treasury/spends/{index}.json

5. CHILD BOUNTIES LIST
   URL: https://{network}-api.subsquare.io/treasury/child-bounties?page={page}&page_size=100

6. FELLOWSHIP TREASURY SPENDS LIST
   URL: https://collectives-api.subsquare.io/fellowship/treasury/spends?page={page}&page_size=100

7. FELLOWSHIP TREASURY SPEND DETAILS
   URL: https://collectives-api.subsquare.io/fellowship/treasury/spends/{index}.json

8. FELLOWSHIP SALARY CYCLES
   URL: https://collectives-api.subsquare.io/fellowship/salary/cycles/{cycle}

9. FELLOWSHIP SALARY CLAIMANTS
   URL: https://collectives-api.subsquare.io/fellowship/salary/claimants

10. FELLOWSHIP MEMBERS
    URL: https://collectives-api.subsquare.io/fellowship/members

11. FELLOWSHIP SALARY CYCLE FEEDS
    URL: https://collectives-api.subsquare.io/fellowship/salary/cycles/{cycle}/feeds
"""

import logging

from ..data_provider import DataProvider
from ..network_info import NetworkInfo
from ..asset_kind import AssetKind

# Re-export key constants for backwards compatibility
from .call_indices import (
    SPENDER_TRACKS,
    POLKADOT_CALL_INDICES,
    RELAY_ONLY_CALL_INDICES,
    STATIC_CALL_INDICES,
    ZERO_VALUE_METHODS,
    POLKADOT_ASSETHUB_CUTOFF,
    get_call_index,
)

# Import handler modules
from . import referenda as referenda_module
from . import treasury as treasury_module
from . import fellowship as fellowship_module
from . import xcm_parsing
from . import validation as validation_module


class SubsquareProvider(DataProvider):
    """
    Subsquare API data provider.

    SECURITY NOTE: External API responses are not currently schema-validated.
    The code assumes responses match expected formats. Consider adding JSON
    schema validation (e.g., with pydantic or jsonschema) for defense-in-depth
    against API response manipulation or unexpected format changes.
    """

    def __init__(self, network_info: NetworkInfo, price_service, sink=None):
        self.network_info: NetworkInfo = network_info
        self.price_service = price_service
        self.sink = sink
        self._logger = logging.getLogger(__name__)

    # =========================================================================
    # Referenda
    # =========================================================================

    def fetch_referenda(self, referenda_to_update=10):
        """Fetch and transform referenda from the Subsquare API."""
        return referenda_module.fetch_referenda(
            self.network_info,
            self.price_service,
            referenda_to_update,
            self.sink,
            self._logger
        )

    def fetch_referenda_by_ids(self, ref_ids: list[int]):
        """Fetch specific referenda by their IDs."""
        return referenda_module.fetch_referenda_by_ids(
            ref_ids,
            self.network_info,
            self.price_service,
            self.sink,
            self._logger
        )

    # =========================================================================
    # Treasury
    # =========================================================================

    def fetch_treasury_spends(self, items_to_update=10, block_number=None, block_datetime=None, block_time=None):
        """Fetch and transform treasury spends from the Subsquare API."""
        return treasury_module.fetch_treasury_spends(
            self.network_info,
            self.price_service,
            items_to_update,
            block_number,
            block_datetime,
            block_time,
            self.sink,
            self._logger
        )

    def fetch_child_bounties(self, child_bounties_to_update=10):
        """Fetch and transform child bounties from the Subsquare API."""
        return treasury_module.fetch_child_bounties(
            self.network_info,
            self.price_service,
            child_bounties_to_update,
            self._logger
        )

    # =========================================================================
    # Fellowship
    # =========================================================================

    def fetch_fellowship_treasury_spends(self, items_to_update=10):
        """Fetch and transform fellowship treasury spends from the Collectives API."""
        return fellowship_module.fetch_fellowship_treasury_spends(
            self.network_info,
            self.price_service,
            items_to_update,
            self._logger
        )

    def fetch_fellowship_salary_cycles(self, start_cycle=1, end_cycle=None):
        """Fetch fellowship salary cycle data from the Collectives API."""
        return fellowship_module.fetch_fellowship_salary_cycles(
            self.network_info,
            start_cycle,
            end_cycle,
            self._logger
        )

    def fetch_fellowship_salary_claimants(self, name_mapping=None):
        """Fetch fellowship salary claimants data from the Collectives API."""
        return fellowship_module.fetch_fellowship_salary_claimants(
            self.network_info,
            name_mapping,
            self._logger
        )

    def fetch_fellowship_salary_payments(self, start_cycle=1, end_cycle=None):
        """Fetch individual payment records from /feeds endpoint for each cycle."""
        return fellowship_module.fetch_fellowship_salary_payments(
            self.network_info,
            self.price_service,
            start_cycle,
            end_cycle,
            self._logger
        )

    def fetch_fellowship_members(self):
        """Fetch fellowship members and their ranks from the Collectives API."""
        return fellowship_module.fetch_fellowship_members(self._logger)

    # =========================================================================
    # XCM Parsing (pass-through for backward compatibility)
    # =========================================================================

    def _get_XCM_asset_kind(self, asset_kind: dict) -> AssetKind:
        """Determines the AssetKind from an XCM asset representation."""
        return xcm_parsing.get_xcm_asset_kind(asset_kind, self.network_info, self._logger)

    def _general_index_to_asset_kind(self, general_index: int) -> AssetKind:
        """Maps AssetHub generalIndex to AssetKind."""
        return xcm_parsing.general_index_to_asset_kind(general_index, self._logger)

    def _parse_asset_interior_x2(self, x2_interior: list) -> AssetKind:
        """Parses x2 interior structure with palletInstance + generalIndex."""
        return xcm_parsing.parse_asset_interior_x2(x2_interior, self._logger)

    def _resolve_asset_from_interior(self, interior: dict, parents: int = 0) -> AssetKind:
        """Resolves asset type from an assetId interior structure."""
        return xcm_parsing.resolve_asset_from_interior(
            interior, self.network_info, parents, self._logger
        )

    def _get_XCM_asset_value(self, assets: dict) -> float:
        """Extract the fungible asset value from an XCM assets structure."""
        return xcm_parsing.get_xcm_asset_value(assets, self.network_info)

    # =========================================================================
    # Validation (pass-through for backward compatibility)
    # =========================================================================

    def _validate_and_log_spender_referenda(self, df, raw_data_by_id: dict) -> None:
        """Validate referenda from spender tracks and log errors."""
        validation_module.validate_and_log_spender_referenda(
            df, raw_data_by_id, self.sink, self._logger
        )

    def _validate_and_log_treasury_spends(self, df, raw_data_list: list) -> None:
        """Validate treasury spends and log errors."""
        validation_module.validate_and_log_treasury_spends(
            df, raw_data_list, self.sink, self._logger
        )

    def _check_continuous_ids(self, df, id_field=None):
        """Checks if the IDs are continuous and returns any gaps found."""
        return validation_module.check_continuous_ids(df, id_field)

    def _log_continuity_check(self, df, data_type, id_field=None):
        """Perform and log continuity check results."""
        validation_module.log_continuity_check(df, data_type, id_field, self._logger)
