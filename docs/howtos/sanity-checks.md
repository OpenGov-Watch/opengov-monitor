# Database Sanity Checks

The sanity check script (`backend/scripts/sanity_check.py`) validates that ID sequences in key database tables are continuous with no gaps.

## Tables Checked

- **Referenda** (`id` column)
- **Treasury** (`id` column)
- **Fellowship** (`id` column)
- **Fellowship Salary Cycles** (`cycle` column)

**Skipped tables:**
- Child Bounties (uses composite TEXT identifiers)
- Fellowship Salary Claimants (uses wallet address keys)

## Usage

### Check All Tables

```bash
pnpm sanity:check
```

Output example:
```
================================================================================
DATABASE ID CONTINUITY CHECK
================================================================================
Database: D:\Code\data\opengov-monitor\data\polkadot.db
Timestamp: 2026-01-15 07:13:31

[1/4] Checking Referenda...
  Column: id
  Total records: 1,828
  ID range: 0 -> 1827
  Missing IDs: 0
  Continuity: 100.00%
  Status: OK CONTINUOUS

[2/4] Checking Treasury...
  Column: id
  Total records: 208
  ID range: 0 -> 207
  Missing IDs: 0
  Continuity: 100.00%
  Status: OK CONTINUOUS

...

SUMMARY
Tables checked: 4
Tables with gaps: 0
Total gaps found: 0

Exit code: 0 (all tables continuous)
```

### Verbose Mode (Show Gap Details)

```bash
pnpm sanity:check:verbose
```

When gaps are found, verbose mode shows the exact missing IDs:
```
[1/4] Checking Referenda...
  Column: id
  Total records: 1,247
  ID range: 1 -> 1,250
  Missing IDs: 3
  Continuity: 99.76%
  Gap details:
    - ID 45
    - ID 127
    - ID 891
  Status: ! GAPS FOUND
```

### Check Specific Table

```bash
cd backend
.venv/bin/python scripts/sanity_check.py --table Referenda
```

Available table options:
- `Referenda`
- `Treasury`
- `Fellowship`
- `Fellowship Salary Cycles`
- `all` (default)

### Quiet Mode (Summary Only)

```bash
cd backend
.venv/bin/python scripts/sanity_check.py --quiet
```

Output:
```
Database ID Continuity Check: 0/4 tables with gaps (0 total gaps)
```

### Direct Python Invocation

```bash
cd backend
.venv/bin/python scripts/sanity_check.py --db ../data/polkadot.db

# With options
.venv/bin/python scripts/sanity_check.py --db ../data/polkadot.db --verbose
.venv/bin/python scripts/sanity_check.py --db ../data/polkadot.db --table Treasury
.venv/bin/python scripts/sanity_check.py --db ../data/polkadot.db --quiet
```

**Windows users**: Replace `.venv/bin/python` with `.venv/Scripts/python.exe`

## Exit Codes

The script uses exit codes for CI/CD integration:

- **0** - All tables continuous (no gaps)
- **1** - Gaps found in one or more tables
- **2** - Script error (database not found, connection failed, etc.)

Example in CI:
```bash
if pnpm sanity:check; then
  echo "Database integrity check passed"
else
  echo "Warning: Database has gaps"
fi
```

## Command-Line Options

| Option | Short | Description |
|--------|-------|-------------|
| `--db PATH` | | Path to SQLite database (default: `../data/polkadot.db`) |
| `--table NAME` | | Check specific table or `all` (default: `all`) |
| `--verbose` | `-v` | Show detailed gap information (exact missing IDs) |
| `--quiet` | `-q` | Only show summary (no per-table details) |

## Understanding Results

### Continuity Percentage

The continuity percentage indicates data completeness:
- **100%** - Perfect sequence, no gaps
- **99.5%+** - A few gaps (may be acceptable depending on context)
- **<95%** - Major data issues, investigate immediately

### Common Causes of Gaps

1. **API fetch failures** - Subsquare API returned errors for specific records
2. **Cancelled referenda** - On-chain items cancelled before being indexed
3. **Data migration issues** - Records lost during schema changes
4. **Fetch configuration** - `backend/config.yaml` limits may skip records

### What to Do When Gaps Are Found

1. **Investigate the cause**:
   - Check backend logs for fetch errors
   - Verify Subsquare API status for those IDs
   - Check if gaps correspond to known on-chain events

2. **Re-fetch if needed**:
   ```bash
   cd backend
   source .venv/bin/activate
   python scripts/run_sqlite.py --db ../data/polkadot.db
   ```

3. **Document expected gaps**:
   - If gaps are expected (e.g., cancelled referenda), document them
   - Consider logging to `DataErrors` table for tracking

## Limitations

- **Console output only** - Results are not persisted to database
- **No auto-repair** - Script is diagnostic only, doesn't fetch missing records
- **Single database snapshot** - Doesn't track changes over time
- **Sequential ID assumption** - Assumes IDs should be continuous from min to max

## Integration with Other Tools

### Pre-deployment Check

Add to your deployment workflow:
```bash
pnpm sanity:check || echo "Warning: Database has gaps, review before deploying"
```

### Monitoring

Run periodically to detect data quality issues:
```bash
# Cron job example (daily at 2am)
0 2 * * * cd /path/to/opengov-monitor && pnpm sanity:check > /var/log/sanity-check.log 2>&1
```

### Development Workflow

Run after major data sync operations:
```bash
cd backend
python scripts/run_sqlite.py --db ../data/polkadot.db
cd ..
pnpm sanity:check
```
