# Business Logic

## Proposal Value Extraction

Referendum values are extracted by parsing the on-chain proposal call data. The `callIndex` field determines the parsing strategy.

### Call Index Mapping

| Call Index | Call Type | Value Source |
|------------|-----------|--------------|
| `0x0502` | balances.forceTransfer | `args[2].value` |
| `0x1305` | treasury.spend | XCM asset in `args[0]`, amount in `args[1]` |
| `0x6308` | xcmPallet.limitedReserveTransferAssets | XCM assets in `args[2]` |
| `0x6309` | xcmPallet.limitedTeleportAssets | XCM assets in `args[2]` |

### Wrapped/Batch Calls

These call types contain nested calls that must be recursively parsed:

| Call Index | Call Type | Inner Call Location |
|------------|-----------|---------------------|
| `0x0102` | scheduler.scheduleNamed | `args[4].value` |
| `0x0104` | scheduler.scheduleAfter | `args[3].value` |
| `0x1a00` | utility.batch | `args[0].value[]` |
| `0x1a02` | utility.batchAll | `args[0].value[]` |
| `0x1a03` | utility.dispatchAs | `args[1].value` (verify treasury source) |
| `0x1a04` | utility.forceBatch | `args[0].value[]` |

### Zero-Value Call Indices

These calls are known to have no treasury value (governance/system operations):

```
0x0000  system.remark
0x0007  system.remarkWithEvent
0x0002  system.setCode
0x0508  balances.forceSetBalance
0x1500  referenda.submit
0x1503  referenda.cancel
0x2201  bounties.approveBounty
0x6300  xcmPallet.send
0x6500  assetRate.create
... (and others)
```

---

## XCM Asset Parsing

XCM (Cross-Consensus Message) assets come in different versions (v3, v4, v5). The parsing extracts the asset type from the multilocation format.

### Version 3 Format

```json
{
  "v3": {
    "location": {
      "interior": {
        "x1": { "parachain": 1000 }
      }
    },
    "assetId": {
      "concrete": {
        "interior": {
          "x2": [
            { "palletInstance": 50 },
            { "generalIndex": 1337 }
          ]
        }
      }
    }
  }
}
```

### Version 4/5 Format

```json
{
  "v4": {
    "location": {
      "interior": {
        "x1": [{ "parachain": 1000 }]
      }
    },
    "assetId": {
      "parents": 1,
      "interior": {
        "here": null,
        "x2": [
          { "palletInstance": 50 },
          { "generalIndex": 1337 }
        ]
      }
    }
  }
}
```

### General Index Mapping

| Index | Asset |
|-------|-------|
| (native/here) | DOT or KSM |
| 1337 | USDC |
| 1984 | USDT |
| 30 | DED |

### Validation Rules

- Parachain must be >= 1000 (system chains)
- `palletInstance` must be 50 (assets pallet)
- Unknown indices return `AssetKind.INVALID`

---

## Value Conversion

### Price Lookup Strategy

The price date depends on proposal status:

**End statuses** (use historical price at that date):
- Executed
- TimedOut
- Approved
- Cancelled
- Rejected

**Active statuses** (use current price):
- Ongoing
- Deciding
- Confirming
- All others

### Conversion Rules

```python
def convert_asset_value(input_asset, amount, output_asset, date=None):
    # Same asset: no conversion
    if input_asset == output_asset:
        return amount

    # Stablecoin to stablecoin: 1:1
    if input_asset in [USDC, USDT] and output_asset in [USDC, USDT]:
        return amount

    # DED: worthless
    if input_asset == DED:
        return 0.0

    # Get price (historical or current)
    price = get_price(date) if date else current_price

    # USD -> Network token
    if input_asset in [USDC, USDT]:
        return amount / price

    # Network token -> USD
    return amount * price
```

### Denomination

Raw on-chain values must be denominated before use:

| Asset | Decimals | Divisor |
|-------|----------|---------|
| DOT | 10 | 10,000,000,000 |
| KSM | 12 | 1,000,000,000,000 |
| USDT/USDC | 6 | 1,000,000 |
| DED | 10 | 10,000,000,000 |

---

## Block Time Estimation

Treasury spends have `validFrom` and `expireAt` fields as block numbers. These are converted to datetime estimates:

```python
estimated_datetime = reference_datetime + (target_block - reference_block) * block_time
```

Configuration (from `config.yaml`):
```yaml
block_time_projection:
  block_number: 25732485
  block_datetime: 2025-04-25T15:27:36
  block_time: 6.0  # seconds per block
```

---

## Status Handling

### Referendum Status Values

| Status | Description |
|--------|-------------|
| Ongoing | Currently in voting period |
| Deciding | In decision phase |
| Confirming | Passed, awaiting confirmation period |
| Approved | Passed and confirmed |
| Rejected | Failed to pass |
| Cancelled | Cancelled before completion |
| TimedOut | Expired without decision |
| Executed | Successfully executed |
| Executed_err | Execution attempted but failed |

### Status Extraction

```python
def get_status(state):
    status = state["name"]
    if status == "Executed":
        result = list(state["args"]["result"].keys())[0]
        if result == "err":
            return "Executed_err"
    return status
```

---

## Data Continuity Validation

The system checks for gaps in sequential IDs to detect missing data:

```python
def check_continuous_ids(df, id_field=None):
    ids = sorted(df.index if id_field is None else df[id_field])
    expected = set(range(min(ids), max(ids) + 1))
    actual = set(ids)
    gaps = sorted(expected - actual)
    return len(gaps) == 0, gaps
```

Gaps are logged as warnings but do not halt execution.

---

## Error Handling

### Graceful Degradation

| Scenario | Behavior |
|----------|----------|
| Unknown call index | Log warning, set AssetsBag to NaN |
| Invalid XCM asset | Return `AssetKind.INVALID`, set NaN |
| Price conversion error | Return `float('nan')` |
| Name resolution failure | Return empty string |
| API error | Raise `SystemExit` with message |

### NaN Propagation

When a proposal value cannot be determined:
1. `AssetsBag.set_nan()` is called
2. All `get_amount()` calls return `float('nan')`
3. All `get_total_value()` calls return `float('nan')`
4. USD columns show NaN in output
