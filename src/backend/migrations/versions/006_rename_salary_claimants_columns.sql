-- Migration: Rename Fellowship Salary Claimants columns from DOT to USDC
-- Version: 006
-- Created: 2026-01-15
-- Description: Rename registered_amount_dot, attempt_amount_dot to *_usdc
-- Note: Values will be corrected by re-fetching data with updated transformation code

ALTER TABLE "Fellowship Salary Claimants" RENAME COLUMN "registered_amount_dot" TO "registered_amount_usdc";
ALTER TABLE "Fellowship Salary Claimants" RENAME COLUMN "attempt_amount_dot" TO "attempt_amount_usdc";
