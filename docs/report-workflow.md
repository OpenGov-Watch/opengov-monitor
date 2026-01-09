# Report Workflow (Legacy)

> **Note:** This document describes the legacy Google Sheets-based reporting workflow. The current application uses SQLite for data storage and a web dashboard for visualization. This document is retained for historical reference only.

---

## 1. Data Architecture
Sheet Hierarchy & Data Flow
┌─────────────────────────────────────────────────────────────────────┐
│                        RAW DATA SOURCES                             │
├─────────────────────────────────────────────────────────────────────┤
│  Parity Data     │ Referenda    │ Treasury    │ Child Bounties      │
│  (472 rows)      │ (1,779 rows) │ (200 rows)  │ (5,480 rows)        │
│                  │              │             │                     │
│  Fellowship      │ Bounties     │ Stable Flows│ Aggregated Income   │
│  (15 rows)       │ (30 rows)    │ (5,656 rows)│ (20 rows)           │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      AGGREGATION LAYER                              │
├─────────────────────────────────────────────────────────────────────┤
│  Aggregated Spends (6,572 rows)                                     │
│  - Consolidates: Direct Spend, Bounty, Claim, Fellowship data       │
│  - Adds: quarter, year-month, half-year columns via formulas        │
│                                                                     │
│  Aggregated Pivots (765 rows × 120 cols)                            │
│  - Multiple pivot table views:                                      │
│    • Quarterly Spend by DOT/USD                                     │
│    • Component breakdown (DOT/USDC/USDT)                            │
│    • Type breakdown (Direct Spend/Claim/Bounty/Fellowship)          │
│    • Category breakdown                                             │
│    • Subcategory breakdown                                          │
│    • Bounty-specific breakdowns                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        OUTPUT LAYER                                 │
├─────────────────────────────────────────────────────────────────────┤
│  Balance Sheet              │ Income Statement                      │
│  (50 formulas)              │ (54 formulas)                         │
│                             │                                       │
│  Side Calculations          │ Outstanding Claims                    │
│  (18 formulas)              │ (manual data)                         │
└─────────────────────────────────────────────────────────────────────┘

2. Data Sources & Collection
2.1 External API Data (via Subsquare API)
SheetSourceRecordsKey FieldsReferendapolkadot.subsquare.io/referenda1,779ID, Title, Status, DOT, USD, Track, Category, SubcategoryTreasurypolkadot.subsquare.io/treasury/spends200ID, Ref, State, DOT, USD, Dates, CategoryChild Bountiespolkadot.subsquare.io/treasury/child-bounties5,480ID, parentBountyID, status, DOT, USD, beneficiary, datesFellowshipcollectives.subsquare.io/fellowship/treasury/spends15ID, Status, Description, DOT, USD
2.2 Parity Data Team (Monthly)
SheetContentKey FieldsParity DataMonthly treasury flow datamonth, asset_name, flow_type, amount_usd, amount_dot_equivalent
Flow types tracked:

fees - Transaction fees
inflation - DOT inflation
burnt - DOT burned
proposals - Treasury proposals
tips - Tips
transfers - Transfers in
bounties - Bounty operations
AH_fellowship_sub_treasury_inflows/outflows

2.3 Manual Data Collection
SheetContentSourceBountiesActive bounty infoSubSquare bounty pagesStable FlowsStablecoin transfersSubscan cross-chain transfersOutstanding ClaimsFuture payment obligationsSubSquare approved referendaAggregated IncomeRefunds to treasuryManual Subscan tracking