-- Rename tally.ayes and tally.nays to tally_ayes and tally_nays
-- This eliminates the need for workaround code in TanStack Table (which can't use accessorKey with dots)

ALTER TABLE "Referenda" RENAME COLUMN "tally.ayes" TO "tally_ayes";
ALTER TABLE "Referenda" RENAME COLUMN "tally.nays" TO "tally_nays";
