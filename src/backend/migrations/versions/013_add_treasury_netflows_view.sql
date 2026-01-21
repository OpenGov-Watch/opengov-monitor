-- Migration: Add Treasury Netflows view with computed date columns
-- Version: 013
-- Created: 2026-01-21
-- Description: Add computed year, year_month, and year_quarter columns to Treasury Netflows

DROP VIEW IF EXISTS treasury_netflows_view;

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
