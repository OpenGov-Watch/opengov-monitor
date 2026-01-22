# Error Logging

The DataErrors table provides centralized error tracking for data validation and insertion failures across all tables.

## Storage

**Table:** `DataErrors`
**Schema:** `backend/data_sinks/sqlite/schema.py:356-375`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Auto-increment primary key |
| `table_name` | TEXT | Source table (e.g., "Treasury", "Referenda") |
| `record_id` | TEXT | ID of failed record |
| `error_type` | TEXT | Category: `missing_value`, `invalid_asset`, `historical_null` |
| `error_message` | TEXT | Specific error details |
| `raw_data` | TEXT | JSON from source API (may be NULL) |
| `metadata` | TEXT | JSON context (status, description, null_columns) |
| `timestamp` | TIMESTAMP | UTC timestamp (ISO 8601 with +00:00) |

**Indexes:** `table_name`, `(table_name, record_id)`, `error_type`, `timestamp`

## Error Flow

```
Subsquare API → SubsquareProvider
                     ↓
            _validate_and_log_treasury_spends()   (Treasury)
            _validate_and_log_spender_referenda() (Referenda)
                     ↓
            sink.log_data_error()
                     ↓
            INSERT INTO DataErrors
                     ↓
            Data table (still writes invalid rows)
```

## Implementation

### Backend Logging

**Method:** `SQLiteSink.log_data_error()` (`backend/data_sinks/sqlite/sink.py:630`)

```python
sink.log_data_error(
    table_name="Treasury",
    record_id="123",
    error_type="missing_value",
    error_message="NULL values in: DOT_proposal_time, USD_proposal_time",
    raw_data={...},      # Optional: full API response
    metadata={           # Optional: additional context
        'status': 'Paid',
        'description': 'Project X',
        'null_columns': ['DOT_proposal_time', 'USD_proposal_time']
    }
)
```

**Timestamp:** Uses `datetime.now(timezone.utc).isoformat()` for consistency with migrations.

### Treasury Validation

**Validator:** `SubsquareProvider._validate_and_log_treasury_spends()` (`backend/data_providers/subsquare.py:525`)

Checks required columns: `DOT_proposal_time`, `USD_proposal_time`, `DOT_component`, `USDC_component`, `USDT_component`

**Behavior:**
- Logs errors for records with NULL/NaN in required columns
- Does NOT filter invalid rows from insertion
- Treasury table schema allows NULLs intentionally

### Referenda Validation

**Validator:** `SubsquareProvider._validate_and_log_spender_referenda()` (`backend/data_providers/subsquare.py:579`)

Only validates referenda from spender tracks: `SmallSpender`, `MediumSpender`, `BigSpender`, `SmallTipper`, `BigTipper`, `Treasurer`

Checks required columns: `DOT_proposal_time`, `USD_proposal_time`, `DOT_component`, `USDC_component`, `USDT_component`

**Behavior:**
- Logs errors for spender track referenda with NULL/NaN in required columns
- Non-spender tracks (Root, FellowshipAdmin, etc.) are ignored
- Does NOT filter invalid rows from insertion

### Migration Backfill

**Migration 004:** Logs pre-existing Treasury NULLs with `error_type: "historical_null"`

Source: `backend/migrations/versions/004_log_historical_treasury_nulls.py`

## Frontend Access

**Route:** `/manage/data-errors` (authenticated)
**API:** `GET /api/data-errors?table_name=Treasury&error_type=missing_value`
**Component:** `frontend/src/routes/manage/data-errors.tsx`

## Error Types

| Type | Source | Description |
|------|--------|-------------|
| `missing_value` | Live validation | NULL/NaN in required columns |
| `invalid_asset` | Future | Invalid asset ID in XCM parsing |
| `historical_null` | Migration 004 | Pre-existing NULLs backfilled during migration |

## Design Decisions

**Why allow invalid rows?**
Treasury spends with incomplete asset breakdowns still provide value (status, description, timestamps). Logging errors separately enables:
- Full data preservation
- Analytics on data quality
- Debugging without data loss
- Gradual backfill as API improves

**No unique constraint:**
Same record can generate multiple errors over time if repeatedly fetched with issues.
