# External API Reference

## Subsquare API

### Base URLs

| Network | Base URL |
|---------|----------|
| Polkadot | `https://polkadot-api.subsquare.io/` |
| Kusama | `https://kusama-api.subsquare.io/` |
| Collectives | `https://collectives-api.subsquare.io/` |

### Pagination

All list endpoints support:
- `page`: Page number (starts at 1)
- `page_size`: Items per page (max 100)

Response format:
```json
{
  "items": [...],
  "total": 1234
}
```

---

### Endpoints

#### 1. Referenda List
```
GET /{network}-api.subsquare.io/gov2/referendums?page={page}&page_size=100
```

Returns: Paginated list of referenda with basic info

Key fields:
- `referendumIndex`: Unique identifier
- `title`: Proposal title
- `createdAt`: ISO timestamp
- `lastActivityAt`: ISO timestamp
- `state`: Status object with name and indexer
- `onchainData`: Proposal data, tally, and treasury info
- `info`: Origin/track information

#### 2. Referendum Details
```
GET /{network}-api.subsquare.io/gov2/referendums/{referendumIndex}.json
```

Returns: Full referendum data including complete proposal call data

Required for batch calls (utility.batch, utility.batchAll, etc.) where the list endpoint doesn't include full call arguments.

#### 3. Treasury Spends List
```
GET /{network}-api.subsquare.io/treasury/spends?page={page}&page_size=100
```

Returns: Paginated list of treasury spend proposals

#### 4. Treasury Spend Details
```
GET /{network}-api.subsquare.io/treasury/spends/{index}.json
```

Returns: Detailed spend with timeline and metadata

Key fields:
- `onchainData.meta.assetKind`: XCM asset specification
- `onchainData.meta.amount`: Raw amount
- `onchainData.meta.validFrom`: Valid from block
- `onchainData.meta.expireAt`: Expiry block
- `onchainData.timeline`: Status change history

#### 5. Child Bounties List
```
GET /{network}-api.subsquare.io/treasury/child-bounties?page={page}&page_size=100
```

Returns: Paginated list of child bounties

Key fields:
- `index`: Child bounty index
- `parentBountyId`: Parent bounty ID
- `onchainData.value`: Bounty amount
- `onchainData.description`: Description text
- `onchainData.address`: Beneficiary address
- `onchainData.timeline`: Status history

#### 6. Fellowship Treasury Spends
```
GET /collectives-api.subsquare.io/fellowship/treasury/spends?page={page}&page_size=100
GET /collectives-api.subsquare.io/fellowship/treasury/spends/{index}.json
```

Returns: Fellowship treasury spend proposals

#### 7. Fellowship Salary Cycles
```
GET /collectives-api.subsquare.io/fellowship/salary/cycles/{cycle}
```

Returns: Salary cycle data

Response fields:
- `index`: Cycle number
- `status`: Budget and registration totals
- `registeredCount`, `registeredPaidCount`
- `registeredPaid`, `unRegisteredPaid`: Raw amounts
- `registrationPeriod`, `payoutPeriod`
- `startIndexer`, `endIndexer`: Block info with timestamps

#### 8. Fellowship Salary Claimants
```
GET /collectives-api.subsquare.io/fellowship/salary/claimants
```

Returns: Individual claimant data

Response format:
```json
[
  {
    "address": "...",
    "status": {
      "lastActive": 12345678,
      "status": {
        "registered": 1000000000000
      }
    }
  }
]
```

Status variants:
- `{"registered": amount}` - Successfully registered
- `{"attempted": {"registered": amount, "id": n, "amount": m}}` - Attempted claim
- `{"nothing": null}` - No activity

#### 9. Fellowship Members
```
GET /collectives-api.subsquare.io/fellowship/members
```

Returns: Fellowship member addresses with ranks (0-7)

```json
[
  { "address": "...", "rank": 5 }
]
```

---

## Statescan ID Service

### Address Resolution
```
POST /id.statescan.io/{network}/short-ids
Content-Type: application/json

{"addresses": ["address1", "address2", ...]}
```

Returns identity information for addresses:
```json
[
  {
    "address": "...",
    "info": {
      "status": "VERIFIED",
      "display": "Alice",
      "legal": "Alice Corp",
      "web": "https://alice.com"
    }
  }
]
```

Name priority: `display` > `legal` > `web`

---

## Price Services

### Yahoo Finance (Historical)

Used for historical DOT-USD and KSM-USD prices via `yfinance` library.

```python
yf.download("DOT-USD", start_date, end_date)
```

Data available from:
- DOT: 2020-08-20
- KSM: 2019-12-12

### CoinGecko (Current Price)
```
GET /api.coingecko.com/api/v3/simple/price?ids={network}&vs_currencies=usd
```

Returns current price:
```json
{
  "polkadot": { "usd": 7.50 }
}
```

Note: CoinGecko has rate limits on the free tier.
