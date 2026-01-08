# Subsquare Parsing Specification

This document specifies how the SubsquareProvider transforms API responses into DataFrames. Use this as the source of truth for unit tests.

## Timestamp Normalization

All timestamps are normalized to UTC datetime objects.

| Source Format | Transformation |
|---------------|----------------|
| `blockTime` (seconds) | `pd.to_datetime(blockTime * 1e6, utc=True)` |
| `blockTime` (milliseconds) - salary feeds only | `pd.to_datetime(blockTime, unit='ms', utc=True)` |
| ISO string (`createdAt`, `lastActivityAt`) | `pd.to_datetime(value, utc=True)` |

**Note:** The salary cycle feeds endpoint uses milliseconds for `blockTime`, unlike all other endpoints which use seconds.

---

## Referenda Parsing

### API Response → DataFrame Column Mapping

| API Field | DataFrame Column | Transformation |
|-----------|------------------|----------------|
| `referendumIndex` | `id` (index) | Direct |
| `title` | `title` | Direct |
| `createdAt` | `proposal_time` | ISO → UTC datetime |
| `state.indexer.blockTime` | `latest_status_change` | seconds × 1e6 → UTC datetime |
| `state.name` | `status` | See status extraction below |
| `onchainData.tally.ayes` | `tally.ayes` | Apply denomination (÷ 10^10 for DOT) |
| `onchainData.tally.nays` | `tally.nays` | Apply denomination |
| `info.origin.__typename` | `track` | Extract track name |

### Computed Columns

| Column | Computation |
|--------|-------------|
| `url` | `=HYPERLINK("{base_url}{id}", {id})` |
| `{ASSET}_proposal_time` | `bag.get_total_value(price_service, asset, proposal_time)` |
| `{ASSET}_latest` | `bag.get_total_value(price_service, asset, latest_status_change)` |
| `USD_proposal_time` | Convert bag to USD at proposal_time |
| `USD_latest` | Convert bag to USD at latest_status_change |
| `{ASSET}_component` | `bag.get_amount(asset)` - raw asset amount |
| `USDC_component` | `bag.get_amount(USDC)` |
| `USDT_component` | `bag.get_amount(USDT)` |

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

**Valid status values:** `Ongoing`, `Deciding`, `Confirming`, `Approved`, `Rejected`, `Cancelled`, `TimedOut`, `Executed`, `Executed_err`

### Track Extraction

```python
def determine_track(onchain_data):
    info = onchain_data.get("info", {})
    origin = info.get("origin", {})
    typename = origin.get("__typename")
    return typename if typename else None
```

### Final Column Order

```python
["url", "title", "status", "DOT_proposal_time", "USD_proposal_time",
 "track", "tally.ayes", "tally.nays", "proposal_time", "latest_status_change",
 "DOT_latest", "USD_latest", "DOT_component", "USDC_component", "USDT_component"]
```

---

## Treasury Spends Parsing

### API Response → DataFrame Column Mapping

| API Field | DataFrame Column | Transformation |
|-----------|------------------|----------------|
| `index` | `id` (index) | Direct |
| `title` | `description` | Direct (renamed) |
| `referendumIndex` | `referendumIndex` | Direct |
| `state` | `status` | Direct (renamed) |
| `onchainData.meta.assetKind` | (parsed) | XCM asset parsing |
| `onchainData.meta.amount` | (bag) | Apply denomination |
| `onchainData.meta.validFrom` | `validFrom` | Block → datetime estimate |
| `onchainData.meta.expireAt` | `expireAt` | Block → datetime estimate |
| `onchainData.timeline[0].indexer.blockTime` | `proposal_time` | First timeline entry |
| `onchainData.timeline[-1].indexer.blockTime` | `latest_status_change` | Last timeline entry |

### Block Time Estimation

```python
def estimate_datetime(block_number, reference_block, reference_datetime, block_time):
    return reference_datetime + timedelta(seconds=(block_number - reference_block) * block_time)
```

**Default config (from `config.yaml`):**
- `block_number`: 25732485
- `block_datetime`: 2025-04-25T15:27:36
- `block_time`: 6.0 seconds

### Final Column Order

```python
["url", "referendumIndex", "status", "description",
 "DOT_proposal_time", "USD_proposal_time",
 "proposal_time", "latest_status_change",
 "DOT_latest", "USD_latest",
 "DOT_component", "USDC_component", "USDT_component",
 "validFrom", "expireAt"]
```

---

## Child Bounties Parsing

### API Response → DataFrame Column Mapping

| API Field | DataFrame Column | Transformation |
|-----------|------------------|----------------|
| `index` | `index` | Direct |
| `parentBountyId` | `parentBountyId` | Direct |
| `state` | `status` | Direct (renamed) |
| `onchainData.value` | `DOT` | Apply denomination |
| `onchainData.description` | `description` | Direct |
| `onchainData.address` | `beneficiary` | Direct |
| `onchainData.timeline[0].indexer.blockTime` | `proposal_time` | First timeline entry |
| `onchainData.timeline[-1].indexer.blockTime` | `latest_status_change` | Last timeline entry |

### Identifier Construction

```python
identifier = f"{parentBountyId}_{index}"
```

**Example:** Parent bounty 10, child index 5 → identifier `"10_5"`

### Final Column Order

```python
["url", "index", "parentBountyId", "status", "description",
 "DOT", "USD_proposal_time", "beneficiary",
 "proposal_time", "latest_status_change", "USD_latest"]
```

**Index column:** `identifier` (string)

---

## Fellowship Treasury Spends Parsing

### API Response → DataFrame Column Mapping

| API Field | DataFrame Column | Transformation |
|-----------|------------------|----------------|
| `index` | `id` (index) | Direct |
| `title` | `description` | Direct (renamed) |
| `state` | `status` | Direct (renamed) |
| `onchainData.meta.amount` | `DOT` | Apply denomination |
| `onchainData.timeline[0].indexer.blockTime` | `proposal_time` | First timeline entry |
| `onchainData.timeline[-1].indexer.blockTime` | `latest_status_change` | Last timeline entry |

### Final Column Order

```python
["url", "status", "description", "DOT", "USD_proposal_time",
 "proposal_time", "latest_status_change", "USD_latest"]
```

---

## Fellowship Salary Cycles Parsing

### API Response → DataFrame Column Mapping

| API Field | DataFrame Column | Transformation |
|-----------|------------------|----------------|
| `cycle` (injected) | `cycle` (index) | Direct |
| `status.budget` | `budget_dot` | Apply denomination |
| `status.totalRegistrations` | `total_registrations_dot` | Apply denomination |
| `registeredCount` | `registeredCount` | Direct |
| `registeredPaidCount` | `registeredPaidCount` | Direct |
| `registeredPaid` | `registered_paid_amount_dot` | Apply denomination |
| `unRegisteredPaid` | `unregistered_paid_dot` | Apply denomination |
| `registrationPeriod` | `registration_period` | Direct |
| `payoutPeriod` | `payout_period` | Direct |
| `startIndexer.blockHeight` | `start_block` | Direct |
| `endIndexer.blockHeight` | `end_block` | Direct (nullable) |
| `startIndexer.blockTime` | `start_time` | seconds × 1e6 → UTC datetime |
| `endIndexer.blockTime` | `end_time` | seconds × 1e6 → UTC datetime (nullable) |

### Final Column Order

```python
["url", "budget_dot", "registeredCount", "registeredPaidCount",
 "registered_paid_amount_dot", "total_registrations_dot", "unregistered_paid_dot",
 "registration_period", "payout_period", "start_block", "end_block",
 "start_time", "end_time"]
```

---

## Fellowship Salary Claimants Parsing

### API Response → DataFrame Column Mapping

| API Field | DataFrame Column | Transformation |
|-----------|------------------|----------------|
| `address` | `address` (index) | Direct |
| `status.lastActive` | `last_active_time` | seconds × 1e6 → UTC datetime |
| `status.status` | `status_type` | See status extraction below |
| `status.status.registered` | `registered_amount_dot` | Apply denomination |
| `status.status.attempted.amount` | `attempt_amount_dot` | Apply denomination |
| `status.status.attempted.id` | `attempt_id` | Direct |

### Claimant Status Extraction

```python
def extract_status_info(status_obj):
    status = status_obj.get('status', {})

    if 'attempted' in status:
        return {
            'status_type': 'attempted',
            'registered_amount': status['attempted'].get('registered', 0),
            'attempt_id': status['attempted'].get('id', 0),
            'attempt_amount': status['attempted'].get('amount', 0)
        }
    elif 'registered' in status:
        return {
            'status_type': 'registered',
            'registered_amount': status['registered'],
            'attempt_id': 0,
            'attempt_amount': 0
        }
    elif 'nothing' in status:
        return {
            'status_type': 'nothing',
            'registered_amount': 0,
            'attempt_id': 0,
            'attempt_amount': 0
        }
    else:
        return {
            'status_type': 'unknown',
            'registered_amount': 0,
            'attempt_id': 0,
            'attempt_amount': 0
        }
```

### Name Resolution

Names are resolved in priority order:
1. Provided `name_mapping` dict
2. If not found: truncated address `{first6}...{last4}`

### Final Column Order

```python
["display_name", "name", "short_address", "status_type",
 "registered_amount_dot", "attempt_amount_dot", "attempt_id",
 "last_active_time", "rank"]
```

---

## Fellowship Salary Payments Parsing

### API Response (feeds endpoint) → DataFrame Column Mapping

Filter for `event == "Paid"` before processing.

| API Field | DataFrame Column | Transformation |
|-----------|------------------|----------------|
| (auto-generated) | `payment_id` (index) | Auto-incrementing |
| `args.who` | `who` | Direct |
| `args.beneficiary` | `beneficiary` | Direct |
| `args.amount` | `amount_dot` | Apply denomination |
| `args.memberInfo.salary` | `salary_dot` | Apply denomination |
| `args.memberInfo.rank` | `rank` | Direct |
| `args.memberInfo.isActive` | `is_active` | Boolean → 1/0 |
| `indexer.blockHeight` | `block_height` | Direct |
| `indexer.blockTime` | `block_time` | **milliseconds** → UTC datetime |

**Critical:** The `blockTime` in feeds is in **milliseconds**, not seconds like other endpoints!

### Final Column Order

```python
["cycle", "who", "who_name", "beneficiary", "beneficiary_name",
 "amount_dot", "salary_dot", "rank", "is_active",
 "block_height", "block_time", "url"]
```

---

## Missing Field Handling

| Scenario | Behavior |
|----------|----------|
| Missing `title` | Empty string `""` |
| Missing `description` | Empty string `""` |
| Missing `onchainData.timeline` | Raise exception (logged) |
| Missing `assetKind` | `AssetKind.INVALID`, bag marked NaN |
| Missing `amount` | `0` |
| Missing `beneficiary` | Empty string `""` |
| Missing name in mapping | Use truncated address |
| Empty API response | Return empty DataFrame |
| HTTP 404 | Stop pagination, return collected data |
| HTTP 500+ | Log error, stop pagination |

---

## XCM Asset Parsing

See `business-logic.md` for full XCM asset parsing rules. Key mapping:

| General Index | Asset |
|---------------|-------|
| (native/here) | DOT or KSM |
| 1337 | USDC |
| 1984 | USDT |
| 30 | DED |

**Invalid asset handling:** Returns `AssetKind.INVALID`, sets `bag.set_nan()`, propagates NaN to all value columns.

---

## Denomination

All raw amounts are denominated using:

```python
def apply_denomination(amount, asset):
    decimals = {
        AssetKind.DOT: 10,
        AssetKind.KSM: 12,
        AssetKind.USDT: 6,
        AssetKind.USDC: 6,
        AssetKind.DED: 10,
    }
    return amount / (10 ** decimals[asset])
```
