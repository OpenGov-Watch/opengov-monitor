# Business Rules

Testable business logic. Format: "Given X, expect Y."

## Value Extraction

### Call Index → Value Source

| Call Index | Call Type | Value Location |
|------------|-----------|----------------|
| `0x0502` | balances.forceTransfer | `args[2].value` |
| `0x1305` | treasury.spend | XCM asset in `args[0]`, amount in `args[1]` |
| `0x6308` | xcmPallet.limitedReserveTransferAssets | XCM assets in `args[2]` |
| `0x6309` | xcmPallet.limitedTeleportAssets | XCM assets in `args[2]` |

### Wrapped Calls (Recurse Into)

| Call Index | Call Type | Inner Call Location |
|------------|-----------|---------------------|
| `0x0102` | scheduler.scheduleNamed | `args[4].value` |
| `0x0104` | scheduler.scheduleAfter | `args[3].value` |
| `0x1a00` | utility.batch | `args[0].value[]` |
| `0x1a02` | utility.batchAll | `args[0].value[]` |
| `0x1a03` | utility.dispatchAs | `args[1].value` |
| `0x1a04` | utility.forceBatch | `args[0].value[]` |

**Note:** Call indices changed at ref 1782 (AssetHub migration). See `gotchas.md` for mapping table.

### Zero-Value Calls (No Treasury Impact)

```
0x0000, 0x0002, 0x0007, 0x0508, 0x1500, 0x1503,
0x2201, 0x6300, 0x6500, ...
```

Unknown call index → log warning, set `AssetsBag.set_nan()`.

---

## XCM Asset Mapping

### Chain Context Interpretation

XCM semantics differ based on chain context. After governance moved to AssetHub at ref 1782, interpretation changed:

| Chain Context | `location.interior.here` means | Asset determined by |
|---------------|-------------------------------|---------------------|
| Relay Chain (pre-1782) | "Native asset (DOT)" | location alone |
| AssetHub (post-1782) | "Current location" | `assetId` field |

**Key rule:** When `location.interior.here` is present, always check `assetId` to determine the actual asset type. Don't assume `here` means native asset.

### General Index → Asset

| Index | Asset |
|-------|-------|
| (native/here) | DOT or KSM |
| 1337 | USDC |
| 1984 | USDT |
| 30 | DED |

### Asset Resolution from assetId

| `assetId.parents` | `assetId.interior` | Result |
|-------------------|-------------------|--------|
| 1 | `here` | Native relay asset (DOT/KSM) |
| 0 | `here` | Native on current chain (DOT) |
| 0 | `x2[palletInstance=50, generalIndex=N]` | Mapped asset (USDC/USDT/DED) |

### Validation

- Parachain must be ≥ 1000 and < 2000 (system chain)
- `palletInstance` must be 50
- Unknown index → `AssetKind.INVALID` → NaN propagation

---

## Price Conversion

### Which Price to Use

| Status | Price Date |
|--------|------------|
| Executed, TimedOut, Approved, Cancelled, Rejected | Historical (`latest_status_change`) |
| Ongoing, Deciding, Confirming, others | Current (CoinGecko) |

### Conversion Rules

| Input | Output | Rule |
|-------|--------|------|
| Same asset | Same | Return input (no conversion) |
| USDC | USDT | 1:1 |
| USDT | USDC | 1:1 |
| DED | Any | Return 0.0 (worthless) |
| DOT/KSM | USDC/USDT | `amount * price` |
| USDC/USDT | DOT/KSM | `amount / price` |

### Denomination (Raw → Human)

| Asset | Decimals | Divisor |
|-------|----------|---------|
| DOT | 10 | 10^10 |
| KSM | 12 | 10^12 |
| USDT/USDC | 6 | 10^6 |
| DED | 10 | 10^10 |

---

## Status Values

| Status | Description |
|--------|-------------|
| Ongoing | In voting period |
| Deciding | In decision phase |
| Confirming | Passed, awaiting confirmation |
| Approved | Confirmed |
| Rejected | Failed |
| Cancelled | Cancelled before completion |
| TimedOut | Expired |
| Executed | Successfully executed |
| Executed_err | Execution failed |

### Status Extraction

```python
status = state["name"]
if status == "Executed" and state["args"]["result"].keys()[0] == "err":
    return "Executed_err"
return status
```

---

## Block Time Estimation

```python
estimated_datetime = reference_datetime + (target_block - reference_block) * block_time
```

Config values in `backend/config.yaml` under `block_time_projection`.

---

## Spending Aggregation Types

| Type | Source | Filter |
|------|--------|--------|
| Direct Spend | Referenda | `status = 'Executed'`, `DOT_latest > 0`, no linked Treasury |
| Claim | Treasury | `status IN ('Paid', 'Processed')` |
| Bounty | Child Bounties | `status = 'Claimed'` |
| Subtreasury | Manual table | All records |
| Fellowship Salary | Salary Cycles | Completed cycles |
| Fellowship Grants | Fellowship Treasury | `status IN ('Paid', 'Approved')` |
