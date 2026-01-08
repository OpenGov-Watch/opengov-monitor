# Price Service Specification

This document specifies the behavior of the PriceService class for unit testing.

## Overview

PriceService provides price conversion between assets using:
- **Historic prices**: Yahoo Finance (yfinance library)
- **Current prices**: CoinGecko API

---

## Initialization

```python
PriceService(network_info: NetworkInfo)
```

| Network | `pair` | `pair_start_date` |
|---------|--------|-------------------|
| polkadot | `DOT-USD` | `2020-08-20` |
| kusama | `KSM-USD` | `2019-12-12` |

**Initial state:**
- `_historic_prices_df`: `None`
- `current_price`: `None`

---

## load_prices()

Fetches both historic and current prices. Must be called before any conversions.

### Historic Prices

```python
yf.download(pair, pair_start_date, today)
```

**Behavior:**
- Downloads daily OHLCV data from Yahoo Finance
- Index is converted to UTC datetime
- Uses `Close` price for conversions

**Error conditions:**
- Empty response → Raises `ValueError("No historic prices found for {pair} from {start} to {end}")`

### Current Price

```
GET https://api.coingecko.com/api/v3/simple/price?ids={network}&vs_currencies=usd
```

**Response format:**
```json
{
  "polkadot": { "usd": 7.50 }
}
```

**Behavior:**
- Extracts `data[network]['usd']` as `current_price`

**Error conditions:**
- Non-200 status → Raises `ValueError("Failed to fetch current price from CoinGecko: {status} - {text}")`

---

## _get_historic_price(date)

Returns the closing price for a given date.

### Nearest Date Matching

Uses pandas `get_indexer` with `method='nearest'` to find closest available date.

**Example:**
- Query: `2024-01-15` (Monday)
- If no data for Jan 15, returns price from nearest available date (e.g., Jan 12 if weekend)

**Error conditions:**
- `_historic_prices_df` is `None` → Raises `ValueError("Historic prices not available. Call get_historic_price() first.")`
- No matching date found (index = -1) → Raises `ValueError("No historic price found for date {date}")`

---

## convert_asset_value()

```python
convert_asset_value(
    input_asset: AssetKind,
    input_amount: float,
    output_asset: AssetKind,
    date: datetime = None
) -> float
```

### Conversion Rules

| Input Asset | Output Asset | Rule |
|-------------|--------------|------|
| Same as output | - | Return `input_amount` (no conversion) |
| USDC | USDT | Return `input_amount` (1:1) |
| USDT | USDC | Return `input_amount` (1:1) |
| DED | Any | Return `0.0` (worthless) |
| DOT/KSM | USDC/USDT | `input_amount * price` |
| USDC/USDT | DOT/KSM | `input_amount / price` |

### Price Selection

| `date` Parameter | Price Used |
|------------------|------------|
| `None` | `self.current_price` (CoinGecko) |
| datetime object | `_get_historic_price(date)` (Yahoo Finance) |

### Stablecoin Definition

```python
stables = [AssetKind.USDC, AssetKind.USDT]
```

### Assertions

The function asserts these constraints:
1. One of input/output must be a stablecoin (USDC or USDT)
2. One of input/output must be the network's native token (DOT for Polkadot, KSM for Kusama)

**Invalid conversion example:** `DOT → KSM` would fail assertion.

---

## Date Usage in Callers

The SubsquareProvider determines which date to use based on status:

### End Statuses (use historical price)
- `Executed`
- `TimedOut`
- `Approved`
- `Cancelled`
- `Rejected`

For these statuses, use `latest_status_change` datetime.

### Active Statuses (use current price)
- `Ongoing`
- `Deciding`
- `Confirming`
- All others

For these statuses, pass `date=None` to use current price.

---

## NaN Propagation

PriceService does not directly return NaN. NaN values come from:
1. `AssetsBag.is_nan()` returning `True` (invalid asset)
2. `input_amount` being `float('nan')`

When `AssetsBag.is_nan()` is `True`, the caller should return `float('nan')` without calling `convert_asset_value`.

---

## Test Scenarios

### Happy Path
| Scenario | Input | Expected |
|----------|-------|----------|
| DOT to USD at current | `(DOT, 100, USDC, None)` | `100 * current_price` |
| DOT to USD at historic | `(DOT, 100, USDC, date)` | `100 * historic_price(date)` |
| USD to DOT at current | `(USDC, 100, DOT, None)` | `100 / current_price` |
| USD to DOT at historic | `(USDC, 100, DOT, date)` | `100 / historic_price(date)` |
| Same asset | `(DOT, 100, DOT, _)` | `100` |
| Stablecoin swap | `(USDC, 100, USDT, _)` | `100` |
| DED conversion | `(DED, 1000, USDC, _)` | `0.0` |

### Edge Cases
| Scenario | Input | Expected |
|----------|-------|----------|
| Zero amount | `(DOT, 0, USDC, None)` | `0.0` |
| Negative amount | `(DOT, -100, USDC, None)` | `-100 * price` |
| Weekend date | `(DOT, 100, USDC, Saturday)` | Uses nearest weekday price |
| Future date | `(DOT, 100, USDC, tomorrow)` | Uses most recent available price |
| Before pair start | `(DOT, 100, USDC, 2019-01-01)` | Nearest available (2020-08-20) |

### Error Cases
| Scenario | Expected |
|----------|----------|
| `load_prices()` not called | `ValueError` |
| Invalid conversion (DOT→KSM) | `AssertionError` |
| CoinGecko rate limit | `ValueError` |
| Yahoo Finance empty | `ValueError` |
