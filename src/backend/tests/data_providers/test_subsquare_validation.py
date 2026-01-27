"""Tests for data validation in SubsquareProvider."""

import pytest
import pandas as pd
import numpy as np
from unittest.mock import MagicMock

from data_providers.subsquare import SubsquareProvider, SPENDER_TRACKS


class TestValidateSpenderReferenda:
    """Tests for _validate_and_log_spender_referenda validation."""

    def test_logs_error_for_spender_track_with_null_values(self, polkadot_network):
        """Verify error logged when spender track referendum has NULL values."""
        mock_sink = MagicMock()
        mock_price_service = MagicMock()

        provider = SubsquareProvider(polkadot_network, mock_price_service, mock_sink)

        df = pd.DataFrame({
            'title': ['Test Ref'],
            'status': ['Executed'],
            'track': ['Treasurer'],
            'DOT_proposal_time': [np.nan],  # NULL
            'USD_proposal_time': [np.nan],  # NULL
            'DOT_component': [1000.0],
            'USDC_component': [0.0],
            'USDT_component': [0.0],
        }, index=pd.Index([1831], name='id'))

        provider._validate_and_log_spender_referenda(df, {})

        mock_sink.log_data_error.assert_called_once()
        call_args = mock_sink.log_data_error.call_args
        assert call_args.kwargs['table_name'] == 'Referenda'
        assert call_args.kwargs['record_id'] == '1831'
        assert call_args.kwargs['error_type'] == 'missing_value'
        assert 'DOT_proposal_time' in call_args.kwargs['error_message']
        assert 'USD_proposal_time' in call_args.kwargs['error_message']

    def test_no_error_for_non_spender_track(self, polkadot_network):
        """Verify no error logged for non-spender tracks like Root."""
        mock_sink = MagicMock()
        mock_price_service = MagicMock()

        provider = SubsquareProvider(polkadot_network, mock_price_service, mock_sink)

        df = pd.DataFrame({
            'title': ['Test Ref'],
            'status': ['Executed'],
            'track': ['Root'],  # Not a spender track
            'DOT_proposal_time': [np.nan],  # NULL but track is Root
            'USD_proposal_time': [np.nan],
            'DOT_component': [np.nan],
            'USDC_component': [np.nan],
            'USDT_component': [np.nan],
        }, index=pd.Index([100], name='id'))

        provider._validate_and_log_spender_referenda(df, {})

        mock_sink.log_data_error.assert_not_called()

    def test_no_error_when_values_present(self, polkadot_network):
        """Verify no error when all values are present."""
        mock_sink = MagicMock()
        mock_price_service = MagicMock()

        provider = SubsquareProvider(polkadot_network, mock_price_service, mock_sink)

        df = pd.DataFrame({
            'title': ['Test Ref'],
            'status': ['Executed'],
            'track': ['Treasurer'],
            'DOT_proposal_time': [1000.0],
            'USD_proposal_time': [5000.0],
            'DOT_component': [1000.0],
            'USDC_component': [0.0],
            'USDT_component': [0.0],
        }, index=pd.Index([123], name='id'))

        provider._validate_and_log_spender_referenda(df, {})

        mock_sink.log_data_error.assert_not_called()

    def test_logs_error_for_all_spender_tracks(self, polkadot_network):
        """Verify validation works for all spender track types."""
        mock_price_service = MagicMock()

        for track in SPENDER_TRACKS:
            mock_sink = MagicMock()
            provider = SubsquareProvider(polkadot_network, mock_price_service, mock_sink)

            df = pd.DataFrame({
                'title': ['Test Ref'],
                'status': ['Executed'],
                'track': [track],
                'DOT_proposal_time': [np.nan],  # NULL
                'USD_proposal_time': [1000.0],
                'DOT_component': [1000.0],
                'USDC_component': [0.0],
                'USDT_component': [0.0],
            }, index=pd.Index([1], name='id'))

            provider._validate_and_log_spender_referenda(df, {})

            assert mock_sink.log_data_error.called, f"Expected error to be logged for track {track}"

    def test_metadata_includes_track_and_title(self, polkadot_network):
        """Verify metadata includes track and title information."""
        mock_sink = MagicMock()
        mock_price_service = MagicMock()

        provider = SubsquareProvider(polkadot_network, mock_price_service, mock_sink)

        df = pd.DataFrame({
            'title': ['My Test Referendum Title'],
            'status': ['Executed'],
            'track': ['BigSpender'],
            'DOT_proposal_time': [np.nan],
            'USD_proposal_time': [1000.0],
            'DOT_component': [1000.0],
            'USDC_component': [0.0],
            'USDT_component': [0.0],
        }, index=pd.Index([42], name='id'))

        provider._validate_and_log_spender_referenda(df, {})

        call_args = mock_sink.log_data_error.call_args
        metadata = call_args.kwargs['metadata']
        assert metadata['track'] == 'BigSpender'
        assert metadata['title'] == 'My Test Referendum Title'
        assert metadata['status'] == 'Executed'
        assert 'DOT_proposal_time' in metadata['null_columns']

    def test_handles_missing_sink(self, polkadot_network):
        """Verify no error when sink is None (just logs warning)."""
        mock_price_service = MagicMock()

        provider = SubsquareProvider(polkadot_network, mock_price_service, sink=None)

        df = pd.DataFrame({
            'title': ['Test Ref'],
            'status': ['Executed'],
            'track': ['Treasurer'],
            'DOT_proposal_time': [np.nan],
            'USD_proposal_time': [np.nan],
            'DOT_component': [1000.0],
            'USDC_component': [0.0],
            'USDT_component': [0.0],
        }, index=pd.Index([1831], name='id'))

        # Should not raise - just logs warning
        provider._validate_and_log_spender_referenda(df, {})

    def test_multiple_referenda_mixed_tracks(self, polkadot_network):
        """Verify only spender track referenda are validated in mixed dataframe."""
        mock_sink = MagicMock()
        mock_price_service = MagicMock()

        provider = SubsquareProvider(polkadot_network, mock_price_service, mock_sink)

        df = pd.DataFrame({
            'title': ['Root Ref', 'Spender Ref', 'Admin Ref'],
            'status': ['Executed', 'Executed', 'Executed'],
            'track': ['Root', 'SmallSpender', 'FellowshipAdmin'],
            'DOT_proposal_time': [np.nan, np.nan, np.nan],
            'USD_proposal_time': [np.nan, np.nan, np.nan],
            'DOT_component': [np.nan, np.nan, np.nan],
            'USDC_component': [np.nan, np.nan, np.nan],
            'USDT_component': [np.nan, np.nan, np.nan],
        }, index=pd.Index([1, 2, 3], name='id'))

        provider._validate_and_log_spender_referenda(df, {})

        # Only the SmallSpender referendum should trigger an error
        assert mock_sink.log_data_error.call_count == 1
        call_args = mock_sink.log_data_error.call_args
        assert call_args.kwargs['record_id'] == '2'

    def test_raw_data_matched_by_id(self, polkadot_network):
        """Verify raw_data is correctly matched by referendum ID, not position."""
        mock_sink = MagicMock()
        mock_price_service = MagicMock()

        provider = SubsquareProvider(polkadot_network, mock_price_service, mock_sink)

        df = pd.DataFrame({
            'title': ['Test Ref'],
            'status': ['Executed'],
            'track': ['Treasurer'],
            'DOT_proposal_time': [np.nan],
            'USD_proposal_time': [np.nan],
            'DOT_component': [1000.0],
            'USDC_component': [0.0],
            'USDT_component': [0.0],
        }, index=pd.Index([1784], name='id'))

        # Provide raw_data keyed by the correct referendum ID
        raw_data_by_id = {1784: {'referendumIndex': 1784, 'title': 'Correct raw data'}}

        provider._validate_and_log_spender_referenda(df, raw_data_by_id)

        call_args = mock_sink.log_data_error.call_args
        assert call_args.kwargs['raw_data']['referendumIndex'] == 1784
        assert call_args.kwargs['raw_data']['title'] == 'Correct raw data'


class TestSpenderTracksConstant:
    """Tests for SPENDER_TRACKS constant."""

    def test_spender_tracks_contains_expected_values(self):
        """Verify SPENDER_TRACKS contains all expected spending tracks."""
        expected = ['SmallSpender', 'MediumSpender', 'BigSpender', 'SmallTipper', 'BigTipper', 'Treasurer']
        assert set(SPENDER_TRACKS) == set(expected)
