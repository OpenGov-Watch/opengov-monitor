-- Migration: Rename Fellowship Salary Payments columns from DOT to USDC
-- Version: 017
-- Created: 2026-01-21
-- Description: Fellowship salaries are paid in USDC, not DOT. Rename amount_dot and salary_dot to amount_usdc and salary_usdc.

ALTER TABLE "Fellowship Salary Payments" RENAME COLUMN "amount_dot" TO "amount_usdc";
ALTER TABLE "Fellowship Salary Payments" RENAME COLUMN "salary_dot" TO "salary_usdc";
