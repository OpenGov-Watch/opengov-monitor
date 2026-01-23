# Regression Testing XCM Parsing

How to verify XCM parsing changes don't break existing data processing.

## Overview

When modifying XCM parsing logic in `subsquare.py`, run regression tests to ensure the refactored code produces the same output as the old code for existing data.

**Test flow:**
1. Export baseline CSV from database (captures old code's output)
2. Backup raw API responses (the inputs)
3. Run regression test: API responses → new code → compare against baseline

## Prerequisites

```bash
cd src/backend
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
```

## Step 1: Export Baseline CSV

Export the current database state before making code changes:

```bash
python scripts/export_baseline.py \
  --db ../../data/local/polkadot.db \
  --output tests/fixtures/baseline
```

This creates:
- `tests/fixtures/baseline/referenda_baseline.csv`
- `tests/fixtures/baseline/treasury_baseline.csv`

**Columns exported:**
- `DOT_component`, `USDC_component`, `USDT_component`
- `DOT_latest`, `USD_latest`
- `DOT_proposal_time`, `USD_proposal_time`

## Step 2: Backup API Responses

Fetch and save raw Subsquare API responses:

```bash
python scripts/backup_api_responses.py \
  --output tests/fixtures/api_responses
```

This downloads:
- `tests/fixtures/api_responses/treasury_spends/*.json`
- `tests/fixtures/api_responses/referenda/*.json`

**Note:** This fetches all referenda/treasury up to ID 1600 (pre-1782 cutoff). Takes ~20 minutes for 1755 files.

### Options

```bash
# Treasury only
python scripts/backup_api_responses.py --treasury-only

# Referenda only
python scripts/backup_api_responses.py --referenda-only

# Specific referenda IDs
python scripts/backup_api_responses.py --ref-ids 203,204,205
```

## Step 3: Run Regression Tests

After making code changes, run:

```bash
pytest tests/data_providers/test_subsquare_regression.py -v
```

### What it tests

1. **Treasury XCM parsing** - For each treasury spend:
   - Loads API response from fixture
   - Parses `assetKind` using `_get_XCM_asset_kind()`
   - Compares result against baseline CSV
   - Fails if parsed asset type doesn't match baseline

2. **Referenda XCM parsing** - Similar comparison for referenda

### Expected output

```
test_treasury_fixtures_loaded PASSED
test_referenda_fixtures_loaded PASSED
test_treasury_baseline_exists PASSED
test_referenda_baseline_exists PASSED
test_xcm_parsing_matches_baseline_treasury PASSED
test_xcm_parsing_matches_baseline_referenda PASSED
```

If `test_xcm_parsing_matches_baseline_treasury` fails, you'll see:
```
XCM parsing mismatches found (3 total):
  Spend 203: expected DOT, got USDC
  Spend 204: expected DOT, got USDT
  ...
```

## Step 4: Verify Specific Fixes

To verify a specific spend (e.g., #203 USDC fix):

```bash
python scripts/verify_spend_203.py
```

Expected output:
```
Parsed AssetKind: USDC
Denominated amount: 36,600.00 USDC

[PASS] AssetKind is correct: USDC
[PASS] Amount is correct: 36,600.00
```

## When to Update Baseline

Update the baseline when:
- Bug fix intentionally changes output (e.g., spend #203 should be USDC not DOT)
- Schema changes add new columns
- New data sources are added

**Do not update baseline** if regression test fails unexpectedly - investigate the failure first.

## File Locations

| File | Purpose |
|------|---------|
| `scripts/export_baseline.py` | Export baseline CSVs |
| `scripts/backup_api_responses.py` | Backup API responses |
| `scripts/verify_spend_203.py` | Verify specific fix |
| `tests/fixtures/baseline/` | Baseline CSVs |
| `tests/fixtures/api_responses/` | Raw API JSON files |
| `tests/data_providers/test_subsquare_regression.py` | Regression tests |
