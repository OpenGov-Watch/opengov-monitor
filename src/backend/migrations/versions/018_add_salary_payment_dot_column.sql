-- Migration: Add DOT equivalent column to Fellowship Salary Payments
-- Version: 018
-- Created: 2026-01-21
-- Description: Add amount_dot column calculated from USDC at block_time

ALTER TABLE "Fellowship Salary Payments" ADD COLUMN "amount_dot" REAL;
