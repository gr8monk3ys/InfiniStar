-- Adds the CreatorTransactionStatus values the schema declares but no migration
-- ever created (the enum shipped with only COMPLETED and REFUNDED).
--
-- Kept in its own migration because Postgres will not let a newly added enum
-- value be *used* in the same transaction that adds it, and the following
-- migration sets 'PENDING' as a column default.

ALTER TYPE "CreatorTransactionStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "CreatorTransactionStatus" ADD VALUE IF NOT EXISTS 'FAILED';
