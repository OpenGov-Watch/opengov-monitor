"""
Tests for PriceService class.

Based on docs/spec/price-service.md specification.
"""

import pytest
import pandas as pd
from datetime import datetime
from unittest.mock import MagicMock, patch

from data_providers.price_service import PriceService
from data_providers.network_info import NetworkInfo
from data_providers.asset_kind import AssetKind


class TestPriceServiceInit:
    """Tests for PriceService initialization."""

    def test_polkadot_init(self, polkadot_network):
        """Polkadot should use DOT-USD pair starting 2020-08-20."""
        service = PriceService(polkadot_network)
        assert service.pair == "DOT-USD"
        assert service.pair_start_date == "2020-08-20"
        assert service._historic_prices_df is None
        assert service.current_price is None

    def test_kusama_init(self, kusama_network):
        """Kusama should use KSM-USD pair starting 2019-12-12."""
        service = PriceService(kusama_network)
        assert service.pair == "KSM-USD"
        assert service.pair_start_date == "2019-12-12"


class TestPriceServiceLoadPrices:
    """Tests for load_prices method."""

    def test_load_prices_success(self, polkadot_network, mock_coingecko_polkadot):
        """Successful load should populate both historic and current prices."""
        service = PriceService(polkadot_network)

        # Create mock historic data
        dates = pd.date_range(start="2024-01-01", periods=10, freq="D", tz="UTC")
        mock_df = pd.DataFrame({
            "Close": [[7.5]] * 10,
        }, index=dates)

        with patch("yfinance.download", return_value=mock_df):
            with patch("requests.get") as mock_get:
                mock_response = MagicMock()
                mock_response.status_code = 200
                mock_response.json.return_value = mock_coingecko_polkadot
                mock_get.return_value = mock_response

                service.load_prices()

        assert service._historic_prices_df is not None
        assert service.current_price == 7.50

    def test_load_prices_empty_historic_raises(self, polkadot_network):
        """Empty historic data should raise ValueError."""
        service = PriceService(polkadot_network)

        with patch("yfinance.download", return_value=pd.DataFrame()):
            with pytest.raises(ValueError, match="No historic prices found"):
                service.load_prices()

    def test_load_prices_coingecko_error_raises(self, polkadot_network):
        """Non-200 CoinGecko response should raise ValueError."""
        service = PriceService(polkadot_network)

        dates = pd.date_range(start="2024-01-01", periods=10, freq="D", tz="UTC")
        mock_df = pd.DataFrame({"Close": [[7.5]] * 10}, index=dates)

        with patch("yfinance.download", return_value=mock_df):
            with patch("requests.get") as mock_get:
                mock_response = MagicMock()
                mock_response.status_code = 429
                mock_response.text = "Rate limited"
                mock_get.return_value = mock_response

                with pytest.raises(ValueError, match="Failed to fetch current price"):
                    service.load_prices()


class TestPriceServiceGetHistoricPrice:
    """Tests for _get_historic_price method."""

    def test_get_historic_price_not_loaded_raises(self, polkadot_network):
        """Calling without load_prices should raise ValueError."""
        service = PriceService(polkadot_network)

        with pytest.raises(ValueError, match="Historic prices not available"):
            service._get_historic_price(datetime(2024, 1, 15))

    def test_get_historic_price_exact_match(self, polkadot_network):
        """Should return exact price for matching date."""
        service = PriceService(polkadot_network)

        dates = pd.date_range(start="2024-01-01", periods=10, freq="D", tz="UTC")
        close_prices = [7.0 + i * 0.1 for i in range(10)]
        # Create multi-level column structure like yfinance returns
        df = pd.DataFrame({"Close": close_prices}, index=dates)
        # Convert to MultiIndex columns (ticker, field)
        df.columns = pd.MultiIndex.from_tuples([("Close", "DOT-USD")])
        service._historic_prices_df = df

        # Jan 5 = index 4, price = 7.0 + 0.4 = 7.4
        result = service._get_historic_price(pd.Timestamp("2024-01-05", tz="UTC"))
        assert result == pytest.approx(7.4)

    def test_get_historic_price_nearest_match(self, polkadot_network):
        """Should return nearest available price for missing date."""
        service = PriceService(polkadot_network)

        # Only weekday data
        dates = pd.to_datetime(["2024-01-08", "2024-01-09", "2024-01-10"], utc=True)
        df = pd.DataFrame({"Close": [7.0, 7.1, 7.2]}, index=dates)
        df.columns = pd.MultiIndex.from_tuples([("Close", "DOT-USD")])
        service._historic_prices_df = df

        # Weekend date should find nearest weekday
        result = service._get_historic_price(pd.Timestamp("2024-01-07", tz="UTC"))
        # Should match Jan 8 (closest available)
        assert result == pytest.approx(7.0)


class TestPriceServiceConvertAssetValue:
    """Tests for convert_asset_value method."""

    @pytest.fixture
    def loaded_service(self, polkadot_network):
        """Service with prices pre-loaded."""
        service = PriceService(polkadot_network)

        dates = pd.date_range(start="2024-01-01", periods=10, freq="D", tz="UTC")
        close_prices = [7.5] * 10
        df = pd.DataFrame({"Close": close_prices}, index=dates)
        df.columns = pd.MultiIndex.from_tuples([("Close", "DOT-USD")])
        service._historic_prices_df = df
        service.current_price = 7.50

        return service

    # Same asset returns input
    def test_same_asset_no_conversion(self, loaded_service):
        """Same input/output asset should return input unchanged."""
        result = loaded_service.convert_asset_value(
            AssetKind.DOT, 100.0, AssetKind.DOT
        )
        assert result == 100.0

    # Stablecoin 1:1
    def test_usdc_to_usdt_one_to_one(self, loaded_service):
        """USDC to USDT should be 1:1."""
        result = loaded_service.convert_asset_value(
            AssetKind.USDC, 100.0, AssetKind.USDT
        )
        assert result == 100.0

    def test_usdt_to_usdc_one_to_one(self, loaded_service):
        """USDT to USDC should be 1:1."""
        result = loaded_service.convert_asset_value(
            AssetKind.USDT, 100.0, AssetKind.USDC
        )
        assert result == 100.0

    # DED is worthless
    def test_ded_to_usd_returns_zero(self, loaded_service):
        """DED to any asset should return 0."""
        result = loaded_service.convert_asset_value(
            AssetKind.DED, 1000.0, AssetKind.USDC
        )
        assert result == 0.0

    # DOT to USD conversions
    def test_dot_to_usd_current_price(self, loaded_service):
        """DOT to USD with no date should use current price."""
        result = loaded_service.convert_asset_value(
            AssetKind.DOT, 100.0, AssetKind.USDC
        )
        assert result == pytest.approx(750.0)  # 100 * 7.50

    def test_dot_to_usd_historic_price(self, loaded_service):
        """DOT to USD with date should use historic price."""
        result = loaded_service.convert_asset_value(
            AssetKind.DOT, 100.0, AssetKind.USDC,
            date=pd.Timestamp("2024-01-05", tz="UTC")
        )
        assert result == pytest.approx(750.0)

    # USD to DOT conversions
    def test_usd_to_dot_current_price(self, loaded_service):
        """USD to DOT with no date should use current price."""
        result = loaded_service.convert_asset_value(
            AssetKind.USDC, 100.0, AssetKind.DOT
        )
        assert result == pytest.approx(100.0 / 7.50)

    def test_usd_to_dot_historic_price(self, loaded_service):
        """USD to DOT with date should use historic price."""
        result = loaded_service.convert_asset_value(
            AssetKind.USDT, 100.0, AssetKind.DOT,
            date=pd.Timestamp("2024-01-05", tz="UTC")
        )
        assert result == pytest.approx(100.0 / 7.50)

    # Edge cases
    def test_zero_amount(self, loaded_service):
        """Zero amount should return zero."""
        result = loaded_service.convert_asset_value(
            AssetKind.DOT, 0.0, AssetKind.USDC
        )
        assert result == 0.0

    def test_negative_amount(self, loaded_service):
        """Negative amount should return negative result."""
        result = loaded_service.convert_asset_value(
            AssetKind.DOT, -100.0, AssetKind.USDC
        )
        assert result == pytest.approx(-750.0)

    # Invalid conversions
    def test_dot_to_ksm_raises_assertion(self, loaded_service):
        """DOT to KSM should fail assertion (no stablecoin)."""
        with pytest.raises(AssertionError):
            loaded_service.convert_asset_value(
                AssetKind.DOT, 100.0, AssetKind.KSM
            )


class TestPriceServiceKusama:
    """Tests for Kusama network price conversions."""

    @pytest.fixture
    def loaded_kusama_service(self, kusama_network):
        """Service with Kusama prices pre-loaded."""
        service = PriceService(kusama_network)

        dates = pd.date_range(start="2024-01-01", periods=10, freq="D", tz="UTC")
        close_prices = [25.0] * 10
        df = pd.DataFrame({"Close": close_prices}, index=dates)
        df.columns = pd.MultiIndex.from_tuples([("Close", "KSM-USD")])
        service._historic_prices_df = df
        service.current_price = 25.00

        return service

    def test_ksm_to_usd(self, loaded_kusama_service):
        """KSM to USD should work on Kusama network."""
        result = loaded_kusama_service.convert_asset_value(
            AssetKind.KSM, 100.0, AssetKind.USDC
        )
        assert result == pytest.approx(2500.0)

    def test_usd_to_ksm(self, loaded_kusama_service):
        """USD to KSM should work on Kusama network."""
        result = loaded_kusama_service.convert_asset_value(
            AssetKind.USDC, 100.0, AssetKind.KSM
        )
        assert result == pytest.approx(4.0)

    def test_dot_on_kusama_raises(self, loaded_kusama_service):
        """DOT conversion on Kusama should fail."""
        with pytest.raises(AssertionError):
            loaded_kusama_service.convert_asset_value(
                AssetKind.DOT, 100.0, AssetKind.USDC
            )
