-- Baseline schema generated from migrated database
-- Do not edit manually - regenerate after migrations
-- This file represents the current state of the database schema
-- For fresh databases, use: python migration_runner.py --db new.db --baseline

-- Schema migrations tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    checksum TEXT NOT NULL,
    execution_time_ms INTEGER
);

-- Mark all migrations as applied (baseline includes all schema changes)
INSERT INTO schema_migrations (version, name, checksum, execution_time_ms) VALUES (1, 'drop_url_columns', 'd51c5667af1fc60b0442000e21258912b059364b432c018fb6757e8736171bf7', 0);
INSERT INTO schema_migrations (version, name, checksum, execution_time_ms) VALUES (2, 'fix_all_spending_view', 'bbec6ce4bfd654ddb55f5c95cae515a3c1c3ec2c6303c68e7cf6e5c5d753e4f0', 0);
INSERT INTO schema_migrations (version, name, checksum, execution_time_ms) VALUES (3, 'remove_treasury_netflows_unique_constraint', '32703d53b33366c9a84de8c2bf2695ec6b6a01624c91959e80f65f25ba6a94ad', 0);
INSERT INTO schema_migrations (version, name, checksum, execution_time_ms) VALUES (4, 'log_historical_treasury_nulls', 'fdfe6278c06e3505bf445eaa6c94b17c0569e37292fbed343d3c21116b862551', 0);
INSERT INTO schema_migrations (version, name, checksum, execution_time_ms) VALUES (5, 'rename_salary_cycle_columns', '6ee5a8e6871653eb8ac917b7655cd2e950cc9d13522e20ba38cbbf9696182c1d', 0);
INSERT INTO schema_migrations (version, name, checksum, execution_time_ms) VALUES (6, 'rename_salary_claimants_columns', 'a5d6b2488c1c0676690484ccb43df0221036c88cf00a75bb54d6d0dee0150307', 0);
INSERT INTO schema_migrations (version, name, checksum, execution_time_ms) VALUES (7, 'add_custom_spending', '39c1168f4a2ab20863857aab5b062ad54c5d18cde6af70267e172f42ae5f40a1', 0);
INSERT INTO schema_migrations (version, name, checksum, execution_time_ms) VALUES (8, 'add_other_subcategories', 'be866b78332bf8d22e59c84f16e8b1f53fd97fe24fb1366a8fb68894284b3b21', 0);
INSERT INTO schema_migrations (version, name, checksum, execution_time_ms) VALUES (9, 'add_unique_constraint_categories', 'a0e7e345fcffde2b10af22a8ee04cc19442e38855ba1af9e999e69eef8750deb', 0);
INSERT INTO schema_migrations (version, name, checksum, execution_time_ms) VALUES (10, 'add_flow_tables', 'b6ec9ab1075554419b1cdc74452d75d3fab783f79c92a57036da2cd1fc11de3a', 0);
INSERT INTO schema_migrations (version, name, checksum, execution_time_ms) VALUES (11, 'remove_local_flows_pk', 'e12275ea7fd9e01d7acb722d29082b7b5cf84951bdf6572d5cbb282932eb7c55', 0);
INSERT INTO schema_migrations (version, name, checksum, execution_time_ms) VALUES (12, 'null_subcategory_for_other', 'ba6b08d1e7aaaecd8ed6f0b598eb3d804229b6c743811eab4357bd25b37a9f45', 0);
INSERT INTO schema_migrations (version, name, checksum, execution_time_ms) VALUES (13, 'add_treasury_netflows_view', 'cb08541bdd4ac7a3ffcbdd99e06ca5bdd26cbcfbe951ceb709f11156fb287ab5', 0);
INSERT INTO schema_migrations (version, name, checksum, execution_time_ms) VALUES (14, 'filter_all_spending_2023q3', '124cff26592b830bfc8841ec9a63b7bd419f21eb847c6593f916e7d74ae00acd', 0);
INSERT INTO schema_migrations (version, name, checksum, execution_time_ms) VALUES (15, 'add_custom_spending_to_view', '48f8bcd81e788191ba3f4b6177ea605df1fce7465a76c32213a83c974ed5cf2c', 0);
INSERT INTO schema_migrations (version, name, checksum, execution_time_ms) VALUES (16, 'fix_fellowship_salary_usdc', 'b46f042fb18ac2caf857a3acb413cb04360f5680478da77da6b6313e26ceb318', 0);
INSERT INTO schema_migrations (version, name, checksum, execution_time_ms) VALUES (17, 'rename_salary_payment_columns', 'e3109684b3eb5ef1089a99f0b850a30a0ccfcbb46ee41d41439a0f134f75b262', 0);
INSERT INTO schema_migrations (version, name, checksum, execution_time_ms) VALUES (18, 'add_salary_payment_dot_column', '55920a140c49c0216cdff7930aa5d467a50076e904e7f305050e99c4db32133d', 0);
INSERT INTO schema_migrations (version, name, checksum, execution_time_ms) VALUES (19, 'fellowship_salary_view_from_payments', '94a27a81f2900ad0e9d29d0ad3a0e99ed9b3dfd610a6d54671fd60d5f8dec69c', 0);
INSERT INTO schema_migrations (version, name, checksum, execution_time_ms) VALUES (20, 'fix_fellowship_salary_usd_latest', 'a4f3f7ab169f9f0f03bf0e820ba126ac9ff2f6983eda9a1ed3a45188eaa86fee', 0);
INSERT INTO schema_migrations (version, name, checksum, execution_time_ms) VALUES (21, 'filter_treasury_by_hidden_referenda', 'PLACEHOLDER', 0);
INSERT INTO schema_migrations (version, name, checksum, execution_time_ms) VALUES (22, 'fix_custom_spending_foreign_key', 'PLACEHOLDER', 0);

-- Tables
-- Table: Bounties
CREATE TABLE "Bounties" ("id" INTEGER PRIMARY KEY, "name" TEXT, "category_id" INTEGER, "remaining_dot" REAL);

-- Table: Categories
CREATE TABLE "Categories" (
    "id" INTEGER PRIMARY KEY,
    "category" TEXT NOT NULL,
    "subcategory" TEXT
);

-- Table: Child Bounties
CREATE TABLE "Child Bounties" ("identifier" TEXT PRIMARY KEY, "index" INTEGER, "parentBountyId" INTEGER, "status" TEXT, "description" TEXT, "DOT" REAL, "USD_proposal_time" REAL, "beneficiary" TEXT, "proposal_time" TIMESTAMP, "latest_status_change" TIMESTAMP, "USD_latest" REAL, "category_id" INTEGER, "notes" TEXT, "hide_in_spends" INTEGER);

-- Table: Cross Chain Flows
CREATE TABLE "Cross Chain Flows" (
    "message_hash" TEXT,
    "from_account" TEXT,
    "to_account" TEXT,
    "block" INTEGER,
    "origin_event_index" TEXT,
    "dest_event_index" TEXT,
    "time" TEXT,
    "from_chain_id" TEXT,
    "destination_chain_id" TEXT,
    "value" TEXT,
    "protocol" TEXT,
    "status" TEXT
);

-- Table: Custom Spending
CREATE TABLE "Custom Spending" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "latest_status_change" TIMESTAMP,
    "DOT_latest" REAL,
    "USD_latest" REAL,
    "DOT_component" REAL,
    "USDC_component" REAL,
    "USDT_component" REAL,
    "category_id" INTEGER,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("category_id") REFERENCES "Categories"("id")
);

-- Table: Dashboard Components
CREATE TABLE "Dashboard Components" ("id" INTEGER PRIMARY KEY, "dashboard_id" INTEGER, "name" TEXT, "type" TEXT, "query_config" TEXT, "grid_config" TEXT, "chart_config" TEXT, "created_at" TIMESTAMP, "updated_at" TIMESTAMP);

-- Table: Dashboards
CREATE TABLE "Dashboards" ("id" INTEGER PRIMARY KEY, "name" TEXT, "description" TEXT, "created_at" TIMESTAMP, "updated_at" TIMESTAMP);

-- Table: DataErrors
CREATE TABLE DataErrors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                table_name TEXT NOT NULL,
                record_id TEXT NOT NULL,
                error_type TEXT NOT NULL,
                error_message TEXT NOT NULL,
                raw_data TEXT,
                metadata TEXT,
                timestamp TIMESTAMP NOT NULL
            );

-- Table: Fellowship
CREATE TABLE "Fellowship" ("id" INTEGER PRIMARY KEY, "status" TEXT, "description" TEXT, "DOT" REAL, "USD_proposal_time" REAL, "proposal_time" TIMESTAMP, "latest_status_change" TIMESTAMP, "USD_latest" REAL);

-- Table: Fellowship Salary Claimants
CREATE TABLE "Fellowship Salary Claimants" ("address" TEXT PRIMARY KEY, "display_name" TEXT, "name" TEXT, "short_address" TEXT, "status_type" TEXT, "registered_amount_usdc" REAL, "attempt_amount_usdc" REAL, "attempt_id" INTEGER, "last_active_time" TIMESTAMP, "rank" INTEGER);

-- Table: Fellowship Salary Cycles
CREATE TABLE "Fellowship Salary Cycles" ("cycle" INTEGER PRIMARY KEY, "budget_usdc" REAL, "registeredCount" INTEGER, "registeredPaidCount" INTEGER, "registered_paid_amount_usdc" REAL, "total_registrations_usdc" REAL, "unregistered_paid_usdc" REAL, "registration_period" INTEGER, "payout_period" INTEGER, "start_block" INTEGER, "end_block" INTEGER, "start_time" TIMESTAMP, "end_time" TIMESTAMP);

-- Table: Fellowship Salary Payments
CREATE TABLE "Fellowship Salary Payments" ("payment_id" INTEGER PRIMARY KEY, "cycle" INTEGER, "who" TEXT, "who_name" TEXT, "beneficiary" TEXT, "beneficiary_name" TEXT, "amount_usdc" REAL, "salary_usdc" REAL, "rank" INTEGER, "is_active" INTEGER, "block_height" INTEGER, "block_time" TIMESTAMP, "amount_dot" REAL);

-- Table: Local Flows
CREATE TABLE "Local Flows" (
    "extrinsic_id" TEXT,
    "date" TEXT,
    "block" INTEGER,
    "hash" TEXT,
    "symbol" TEXT,
    "from_account" TEXT,
    "to_account" TEXT,
    "value" TEXT,
    "result" TEXT,
    "year_month" TEXT,
    "quarter" TEXT
);

-- Table: Referenda
CREATE TABLE "Referenda" ("id" INTEGER PRIMARY KEY, "title" TEXT, "status" TEXT, "DOT_proposal_time" REAL, "USD_proposal_time" REAL, "track" TEXT, "tally.ayes" REAL, "tally.nays" REAL, "proposal_time" TIMESTAMP, "latest_status_change" TIMESTAMP, "DOT_latest" REAL, "USD_latest" REAL, "DOT_component" REAL, "USDC_component" REAL, "USDT_component" REAL, "category_id" INTEGER, "notes" TEXT, "hide_in_spends" INTEGER);

-- Table: Subtreasury
CREATE TABLE "Subtreasury" ("id" INTEGER PRIMARY KEY, "title" TEXT, "description" TEXT, "DOT_latest" REAL, "USD_latest" REAL, "DOT_component" REAL, "USDC_component" REAL, "USDT_component" REAL, "category_id" INTEGER, "latest_status_change" TIMESTAMP);

-- Table: Treasury
CREATE TABLE "Treasury" ("id" INTEGER PRIMARY KEY, "referendumIndex" INTEGER, "status" TEXT, "description" TEXT, "DOT_proposal_time" REAL, "USD_proposal_time" REAL, "proposal_time" TIMESTAMP, "latest_status_change" TIMESTAMP, "DOT_latest" REAL, "USD_latest" REAL, "DOT_component" REAL, "USDC_component" REAL, "USDT_component" REAL, "validFrom" TIMESTAMP, "expireAt" TIMESTAMP);

-- Table: Treasury Netflows
CREATE TABLE "Treasury Netflows" (
  "month" TEXT,
  "asset_name" TEXT,
  "flow_type" TEXT,
  "amount_usd" REAL,
  "amount_dot_equivalent" REAL
);

-- Table: Users
CREATE TABLE Users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

-- Indexes
CREATE INDEX "idx_bounties_category_id" ON "Bounties" ("category_id");
CREATE INDEX "idx_categories_category" ON "Categories" ("category");
CREATE UNIQUE INDEX "idx_categories_unique" ON "Categories" ("category", COALESCE("subcategory", ''));
CREATE INDEX "idx_child_bounty_category_id" ON "Child Bounties" ("category_id");
CREATE INDEX "idx_child_bounty_parent" ON "Child Bounties" ("parentBountyId");
CREATE INDEX "idx_child_bounty_status" ON "Child Bounties" ("status");
CREATE INDEX "idx_claimant_rank" ON "Fellowship Salary Claimants" ("rank");
CREATE INDEX "idx_claimant_status" ON "Fellowship Salary Claimants" ("status_type");
CREATE INDEX "idx_cross_chain_flows_from_account" ON "Cross Chain Flows" ("from_account");
CREATE INDEX "idx_cross_chain_flows_message_hash" ON "Cross Chain Flows" ("message_hash");
CREATE INDEX "idx_cross_chain_flows_time" ON "Cross Chain Flows" ("time");
CREATE INDEX "idx_cross_chain_flows_to_account" ON "Cross Chain Flows" ("to_account");
CREATE INDEX "idx_custom_spending_category" ON "Custom Spending" ("category_id");
CREATE INDEX "idx_custom_spending_type" ON "Custom Spending" ("type");
CREATE INDEX "idx_dashboard_components_dashboard" ON "Dashboard Components" ("dashboard_id");
CREATE INDEX idx_data_errors_record ON DataErrors(table_name, record_id)
        ;
CREATE INDEX idx_data_errors_table ON DataErrors(table_name)
        ;
CREATE INDEX idx_data_errors_timestamp ON DataErrors(timestamp)
        ;
CREATE INDEX idx_data_errors_type ON DataErrors(error_type)
        ;
CREATE INDEX "idx_fellowship_status" ON "Fellowship" ("status");
CREATE INDEX "idx_local_flows_date" ON "Local Flows" ("date");
CREATE INDEX "idx_local_flows_from_account" ON "Local Flows" ("from_account");
CREATE INDEX "idx_local_flows_quarter" ON "Local Flows" ("quarter");
CREATE INDEX "idx_local_flows_to_account" ON "Local Flows" ("to_account");
CREATE INDEX "idx_local_flows_year_month" ON "Local Flows" ("year_month");
CREATE INDEX "idx_netflows_asset" ON "Treasury Netflows" ("asset_name");
CREATE INDEX "idx_netflows_month" ON "Treasury Netflows" ("month");
CREATE INDEX "idx_netflows_type" ON "Treasury Netflows" ("flow_type");
CREATE INDEX "idx_referenda_category_id" ON "Referenda" ("category_id");
CREATE INDEX "idx_referenda_proposal_time" ON "Referenda" ("proposal_time");
CREATE INDEX "idx_referenda_status" ON "Referenda" ("status");
CREATE INDEX "idx_referenda_track" ON "Referenda" ("track");
CREATE INDEX "idx_salary_payment_cycle" ON "Fellowship Salary Payments" ("cycle");
CREATE INDEX "idx_salary_payment_rank" ON "Fellowship Salary Payments" ("rank");
CREATE INDEX "idx_salary_payment_who" ON "Fellowship Salary Payments" ("who");
CREATE INDEX "idx_subtreasury_category_id" ON "Subtreasury" ("category_id");
CREATE INDEX "idx_treasury_referendum" ON "Treasury" ("referendumIndex");
CREATE INDEX "idx_treasury_status" ON "Treasury" ("status");
CREATE INDEX idx_users_username ON Users (username);

-- Views
-- View: all_spending
CREATE VIEW all_spending AS
SELECT
    spending.*,
    strftime('%Y', spending.latest_status_change) AS year,
    strftime('%Y-%m', spending.latest_status_change) AS year_month,
    strftime('%Y', spending.latest_status_change) || '-Q' ||
        ((CAST(strftime('%m', spending.latest_status_change) AS INTEGER) + 2) / 3) AS year_quarter
FROM (
    SELECT
        'Direct Spend' AS type,
        'ref-' || r.id AS id,
        r.latest_status_change,
        r.DOT_latest,
        r.USD_latest,
        cat.category,
        cat.subcategory,
        r.title,
        r.DOT_component,
        r.USDC_component,
        r.USDT_component
    FROM Referenda r
    LEFT JOIN Treasury t ON r.id = t.referendumIndex
    LEFT JOIN Categories cat ON r.category_id = cat.id
    WHERE t.id IS NULL
      AND r.DOT_latest > 0
      AND r.status = 'Executed'
      AND (r.hide_in_spends IS NULL OR r.hide_in_spends = 0)
    UNION ALL
    SELECT
        'Claim' AS type,
        'treasury-' || t.id AS id,
        t.latest_status_change,
        t.DOT_latest,
        t.USD_latest,
        cat.category,
        cat.subcategory,
        t.description AS title,
        t.DOT_component,
        t.USDC_component,
        t.USDT_component
    FROM Treasury t
    LEFT JOIN Referenda r ON t.referendumIndex = r.id
    LEFT JOIN Categories cat ON r.category_id = cat.id
    WHERE t.status IN ('Paid', 'Processed')
    UNION ALL
    SELECT
        'Bounty' AS type,
        'cb-' || cb.identifier AS id,
        cb.latest_status_change,
        cb.DOT AS DOT_latest,
        cb.USD_latest,
        COALESCE(cb_cat.category, b_cat.category) AS category,
        COALESCE(cb_cat.subcategory, b_cat.subcategory) AS subcategory,
        cb.description AS title,
        cb.DOT AS DOT_component,
        NULL AS USDC_component,
        NULL AS USDT_component
    FROM "Child Bounties" cb
    LEFT JOIN Bounties b ON cb.parentBountyId = b.id
    LEFT JOIN Categories cb_cat ON cb.category_id = cb_cat.id
    LEFT JOIN Categories b_cat ON b.category_id = b_cat.id
    WHERE cb.status = 'Claimed'
      AND (cb.hide_in_spends IS NULL OR cb.hide_in_spends = 0)
    UNION ALL
    SELECT
        'Subtreasury' AS type,
        'sub-' || s.id AS id,
        s.latest_status_change,
        s.DOT_latest,
        s.USD_latest,
        c.category,
        c.subcategory,
        s.title,
        s.DOT_component,
        s.USDC_component,
        s.USDT_component
    FROM Subtreasury s
    LEFT JOIN Categories c ON s.category_id = c.id
    UNION ALL
    SELECT
        'Fellowship Salary' AS type,
        'fs-' || p.cycle AS id,
        MAX(p.block_time) AS latest_status_change,
        SUM(p.amount_dot) AS DOT_latest,
        SUM(p.amount_usdc) AS USD_latest,
        'Development' AS category,
        'Polkadot Protocol & SDK' AS subcategory,
        'Fellowship Salary Cycle ' || p.cycle AS title,
        NULL AS DOT_component,
        SUM(p.amount_usdc) AS USDC_component,
        NULL AS USDT_component
    FROM "Fellowship Salary Payments" p
    GROUP BY p.cycle
    UNION ALL
    SELECT
        'Fellowship Grants' AS type,
        'fg-' || f.id AS id,
        f.latest_status_change,
        f.DOT AS DOT_latest,
        f.USD_latest,
        'Development' AS category,
        'Polkadot Protocol & SDK' AS subcategory,
        f.description AS title,
        f.DOT AS DOT_component,
        NULL AS USDC_component,
        NULL AS USDT_component
    FROM Fellowship f
    WHERE f.status IN ('Paid', 'Approved')
    UNION ALL
    SELECT
        cs.type AS type,
        'custom-' || cs.id AS id,
        cs.latest_status_change,
        cs.DOT_latest,
        cs.USD_latest,
        c.category,
        c.subcategory,
        cs.title,
        cs.DOT_component,
        cs.USDC_component,
        cs.USDT_component
    FROM "Custom Spending" cs
    LEFT JOIN Categories c ON cs.category_id = c.id
) AS spending
WHERE spending.latest_status_change >= '2023-07-01';

-- View: expired_claims
CREATE VIEW expired_claims AS
            SELECT
                id, referendumIndex, status, description,
                DOT_proposal_time, USD_proposal_time,
                DOT_latest, USD_latest,
                DOT_component, USDC_component, USDT_component,
                proposal_time, latest_status_change, validFrom, expireAt,
                CAST((julianday('now') - julianday(expireAt)) AS INTEGER) AS days_since_expiry
            FROM Treasury
            WHERE status = 'Approved'
              AND expireAt < datetime('now');

-- View: outstanding_claims
CREATE VIEW outstanding_claims AS
            SELECT
                id, referendumIndex, status, description,
                DOT_proposal_time, USD_proposal_time,
                DOT_latest, USD_latest,
                DOT_component, USDC_component, USDT_component,
                proposal_time, latest_status_change, validFrom, expireAt,
                CASE WHEN validFrom <= datetime('now') THEN 'active' ELSE 'upcoming' END AS claim_type,
                CAST((julianday(expireAt) - julianday('now')) AS INTEGER) AS days_until_expiry,
                CAST((julianday(validFrom) - julianday('now')) AS INTEGER) AS days_until_valid
            FROM Treasury
            WHERE status = 'Approved'
              AND expireAt > datetime('now');

-- View: treasury_netflows_view
CREATE VIEW treasury_netflows_view AS
            SELECT
                month,
                asset_name,
                flow_type,
                amount_usd,
                amount_dot_equivalent,
                SUBSTR(month, 1, 4) AS year,
                month AS year_month,
                SUBSTR(month, 1, 4) || '-Q' || ((CAST(SUBSTR(month, 6, 2) AS INTEGER) + 2) / 3) AS year_quarter
            FROM "Treasury Netflows";

