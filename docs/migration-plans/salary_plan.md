# Fellowship Salary Payments Integration Plan

## Overview
Add a fifth worksheet to the Google Spreadsheet to track individual Fellowship salary payment claims across all cycles, similar to the existing Referenda, Treasury, Child Bounties, and Fellowship worksheets.

## High-Level Flow

### How the System Works
1. **Discovery**: The system iterates through salary cycles sequentially (1, 2, 3, ...) until it receives a 404 error
   - Each cycle has a feeds endpoint: `/fellowship/salary/cycles/{cycle}/feeds`
   - When a cycle doesn't exist, the API returns 404, signaling we've reached the end
   - Current active cycle is approximately 17-20 (as of 2025-10)

2. **Fetching Payment Data**: For each valid cycle:
   - Fetch the feeds endpoint which returns an array of events
   - Filter for "Paid" events (other events like "CycleEnded" are ignored)
   - Each "Paid" event represents one individual salary payment transaction
   - Extract payment details: who, beneficiary, amount, rank, timestamp

3. **Data Transformation**:
   - Convert raw amounts to DOT denomination
   - Create shortened addresses for display
   - Add cycle hyperlinks
   - Sort by payment time (most recent first)

4. **Spreadsheet Update**:
   - Push all payment records to "Fellowship Salary Payments" worksheet
   - Each row = one payment transaction
   - Index by payment_id (unique identifier)

### Cycle Discovery Method
The implementation uses a **sequential probe pattern**:
- Start at `start_cycle` (configurable, default: 1)
- Loop: fetch cycle N, increment N, repeat
- Stop when: (a) 404 error received, (b) `end_cycle` reached, or (c) `limit` records collected
- This pattern matches the existing `fetch_fellowship_salary_cycles()` implementation

## Current State

### Discovered API Endpoint
- **URL**: `https://collectives-api.subsquare.io/fellowship/salary/cycles/{cycle}/feeds`
- **Returns**: Array of payment events with individual claim records
- **Key fields per payment**:
  - `event`: "Paid" for payment records
  - `args.who`: Claimant address
  - `args.beneficiary`: Payment recipient address
  - `args.amount`: Payment amount (raw)
  - `args.paymentId`: Unique payment identifier
  - `args.memberInfo.salary`: Registered salary amount
  - `args.memberInfo.rank`: Fellowship rank (0-7)
  - `args.memberInfo.isActive`: Active status
  - `indexer.blockHeight`: Block number
  - `indexer.blockTime`: Timestamp (milliseconds)
  - `index`: Cycle number

### Existing Implementation
- **subsquare.py** currently has:
  - `fetch_fellowship_salary_cycles()` - Cycle-level aggregate data
  - `fetch_fellowship_salary_claimants()` - Current snapshot of all claimants
- Neither method fetches individual payment records from the feeds endpoint

### Existing Worksheet Pattern
All current worksheets follow this pattern in main.py:
1. Check fetch limit in config.yaml
2. Call provider fetch method
3. Call `spreadsheet_sink.update_worksheet()` with:
   - spreadsheet_id
   - worksheet name
   - DataFrame
   - `allow_empty_first_row=True`
   - Optional: `sort_keys` parameter

## Implementation Plan

### 1. Configuration Updates
**File**: `config.yaml`
- Add new entry under `fetch_limits`:
  ```yaml
  fellowship_salary_payments: 1000000
  ```
- Add cycle range configuration:
  ```yaml
  fellowship_salary_cycles_to_fetch:
    start_cycle: 1
    end_cycle: null  # null means fetch all available
  ```

### 2. SubsquareProvider New Method
**File**: `data_providers/subsquare.py`

#### Add New Method: `fetch_fellowship_salary_payments()`
```python
def fetch_fellowship_salary_payments(self, start_cycle=1, end_cycle=None, limit=None):
    """
    Fetch individual fellowship salary payment records across cycles.

    Args:
        start_cycle (int): Starting cycle number (default: 1)
        end_cycle (int): Ending cycle number (default: None, fetches all available)
        limit (int): Maximum number of payments to return (default: None, returns all)

    Returns:
        pd.DataFrame: DataFrame with individual payment records
    """
    payments_data = []
    current_cycle = start_cycle

    while True:
        if end_cycle and current_cycle > end_cycle:
            break

        url = f"https://collectives-api.subsquare.io/fellowship/salary/cycles/{current_cycle}/feeds"
        self._logger.debug(f"Fetching salary payments for cycle {current_cycle} from {url}")

        try:
            response = requests.get(url)
            if response.status_code == 200:
                data = response.json()
                items = data.get('items', [])

                # Filter for "Paid" events only
                paid_events = [item for item in items if item.get('event') == 'Paid']

                for event in paid_events:
                    event['cycle'] = current_cycle
                    payments_data.append(event)

                self._logger.debug(f"Fetched {len(paid_events)} payments from cycle {current_cycle}")
                current_cycle += 1

                # Check limit
                if limit and len(payments_data) >= limit:
                    payments_data = payments_data[:limit]
                    break

            elif response.status_code == 404:
                self._logger.info(f"No more salary cycles found after cycle {current_cycle - 1}")
                break
            else:
                self._logger.error(f"Error fetching cycle {current_cycle}: {response.status_code}")
                break
        except Exception as e:
            self._logger.error(f"Exception fetching cycle {current_cycle}: {e}")
            break

    if not payments_data:
        self._logger.warning("No salary payment data found")
        return pd.DataFrame()

    df = pd.DataFrame(payments_data)
    df = self._transform_salary_payments(df)

    self._logger.info(f"Fetched {len(df)} salary payments from cycles {start_cycle} to {current_cycle - 1}")
    return df

def _transform_salary_payments(self, df):
    """Transform raw salary payment data into structured format."""
    df = df.copy()

    # Extract args fields to top level
    df['who'] = df['args'].apply(lambda x: x.get('who', ''))
    df['beneficiary'] = df['args'].apply(lambda x: x.get('beneficiary', ''))
    df['amount'] = df['args'].apply(lambda x: x.get('amount', 0))
    df['payment_id'] = df['args'].apply(lambda x: x.get('paymentId', 0))

    # Extract memberInfo fields
    df['salary'] = df['args'].apply(lambda x: x.get('memberInfo', {}).get('salary', 0))
    df['is_active'] = df['args'].apply(lambda x: x.get('memberInfo', {}).get('isActive', False))
    df['rank'] = df['args'].apply(lambda x: x.get('memberInfo', {}).get('rank', None))

    # Extract indexer fields
    df['block_height'] = df['indexer'].apply(lambda x: x.get('blockHeight', 0))
    df['block_time'] = df['indexer'].apply(lambda x: x.get('blockTime', 0))
    # Note: blockTime is in milliseconds for feeds endpoint (unlike cycles endpoint which uses seconds)
    df['payment_time'] = pd.to_datetime(df['block_time'], unit='ms', utc=True)

    # Convert amounts to DOT (both amount and salary can be strings or ints from API)
    df['amount_dot'] = df['amount'].apply(
        lambda x: self.network_info.apply_denomination(int(x), self.network_info.native_asset) if x else 0
    )
    df['salary_dot'] = df['salary'].apply(
        lambda x: self.network_info.apply_denomination(int(x), self.network_info.native_asset) if x else 0
    )

    # Create shortened addresses
    df['short_who'] = df['who'].apply(lambda x: f"{x[:6]}...{x[-6:]}" if x else '')
    df['short_beneficiary'] = df['beneficiary'].apply(lambda x: f"{x[:6]}...{x[-6:]}" if x else '')

    # Create URL for reference (link to cycle page)
    df['url'] = df['cycle'].apply(
        lambda x: f'=HYPERLINK("https://collectives.subsquare.io/fellowship/salary/cycles/{x}", "{x}")'
    )

    # Set payment_id as index and select final columns
    df.set_index('payment_id', inplace=True)
    df = df[['url', 'cycle', 'short_who', 'short_beneficiary', 'rank', 'amount_dot',
             'salary_dot', 'is_active', 'payment_time', 'block_height']]

    # Sort by payment_time descending (most recent first)
    df = df.sort_values('payment_time', ascending=False)

    return df
```

#### Add to API Documentation
Add to the docstring at the top of subsquare.py:
```
11. FELLOWSHIP SALARY PAYMENT FEEDS
    URL: https://collectives-api.subsquare.io/fellowship/salary/cycles/{cycle}/feeds
    Method: GET
    Returns: Event feed for a salary cycle including individual payment records
    Fields: event, args (who, beneficiary, amount, paymentId, memberInfo), indexer
```

### 3. Main.py Integration
**File**: `main.py`

Add new section after fellowship treasury spends (after line 103):

```python
# Fetch and sink fellowship salary payments
if fellowship_salary_payments_to_fetch > 0:
    logger.info("Fetching fellowship salary payments")

    # Determine cycle range (use direct dictionary access to match existing pattern)
    start_cycle = config.get('fellowship_salary_cycles_to_fetch', {}).get('start_cycle', 1)
    end_cycle = config.get('fellowship_salary_cycles_to_fetch', {}).get('end_cycle', None)

    payments_df = provider.fetch_fellowship_salary_payments(
        start_cycle=start_cycle,
        end_cycle=end_cycle,
        limit=fellowship_salary_payments_to_fetch
    )
    logger.debug(f"Fetched {len(payments_df)} fellowship salary payments")

    logger.info("Updating Fellowship Salary Payments worksheet")
    spreadsheet_sink.update_worksheet(
        spreadsheet_id,
        "Fellowship Salary Payments",
        payments_df,
        allow_empty_first_row=True
    )
```

**Variables to add** (around line 35):
```python
fellowship_salary_payments_to_fetch = config['fetch_limits']['fellowship_salary_payments']
```

### 4. Google Sheets Preparation
**Manual Step - User Action Required**:
- Open the target spreadsheet
- Create new worksheet named **"Fellowship Salary Payments"**
- Add header row with column names:
  - url
  - cycle
  - short_who
  - short_beneficiary
  - rank
  - amount_dot
  - salary_dot
  - is_active
  - payment_time
  - block_height

### 5. Testing Strategy

#### Unit Testing
- Test `fetch_fellowship_salary_payments()` with single cycle
- Test with cycle range (start_cycle=1, end_cycle=3)
- Test with limit parameter
- Test `_transform_salary_payments()` DataFrame structure

#### Integration Testing
1. Run `python main.py run` with test spreadsheet
2. Verify "Fellowship Salary Payments" worksheet populates correctly
3. Check that cycle hyperlinks work
4. Verify short addresses display correctly
5. Verify amounts are correctly denominated in DOT
6. Verify sorting by payment_time (most recent first)
7. Test with `fellowship_salary_payments: 0` to ensure skip works
8. Test with limited cycle range

#### Manual Verification
- Compare output with manual inspection of https://collectives.subsquare.io/fellowship/salary/cycles/17
- Verify payment counts match
- Spot-check individual payment amounts and addresses
- Verify timestamp formatting

## Alternative Approaches

### Approach 1: Separate Cycles and Payments Worksheets
- Create two worksheets: "Fellowship Salary Cycles" and "Fellowship Salary Payments"
- Cycles sheet: Aggregate data per cycle (budget, total registrations, total paid)
- Payments sheet: Individual payment records (current plan)
- Pros: Complete data visibility, easier to see both summary and detail
- Cons: Two worksheets to maintain

### Approach 2: Payments Only (Current Plan)
- Single worksheet with individual payments
- Pros: Simpler, focused on transaction-level data
- Cons: No aggregate cycle summary in spreadsheet

**Recommendation**: Start with payments-only (proposed plan), add cycles worksheet later if needed.

## Implementation Checklist

- [ ] Update `config.yaml` with `fellowship_salary_payments` fetch limit and cycle range
- [ ] Add API endpoint documentation to subsquare.py docstring
- [ ] Implement `fetch_fellowship_salary_payments()` method in subsquare.py
- [ ] Implement `_transform_salary_payments()` method in subsquare.py
- [ ] Create "Fellowship Salary Payments" worksheet in target spreadsheet with headers
- [ ] Add config variable extraction in main.py (line ~35)
- [ ] Implement fetch and transform logic in main.py (after line 103)
- [ ] Test with single cycle
- [ ] Test with cycle range
- [ ] Test with limit parameter
- [ ] Verify short addresses display correctly
- [ ] Verify amounts are denominated correctly
- [ ] Verify sorting works (payment_time descending)
- [ ] Test with fetch limit = 0 (skip functionality)
- [ ] Update CLAUDE.md documentation with new worksheet
- [ ] Consider adding to README if user-facing

## Dependencies
- Existing: `subsquare.py` base infrastructure
- Existing: `spreadsheet.py` update_worksheet method
- New: `/fellowship/salary/cycles/{cycle}/feeds` API endpoint
- No new external dependencies required

## Estimated Effort
- Configuration: 5 minutes
- API documentation: 5 minutes
- Code implementation: 45-60 minutes (new method + transform)
- Testing: 20-30 minutes
- Documentation: 10 minutes
- **Total**: ~1.5-2 hours

## Rollout Considerations
- Non-breaking change (new worksheet only)
- Can be disabled via config (`fellowship_salary_payments: 0`)
- Does not affect existing worksheets
- Requires manual worksheet creation in spreadsheet (one-time setup)
- May fetch significant data depending on cycle range (consider starting with limited range)
- Performance: Each cycle = 1 API call, ~30-60 payments per cycle
- Recommended initial config: `start_cycle: 15` to limit initial data volume

## Data Volume Estimates
- Current cycle: ~17-20
- Payments per cycle: ~30-60
- Total payments if fetching all cycles: ~600-1000 rows
- Recommendation: Start with recent cycles (e.g., 15-20) = ~150-300 rows
