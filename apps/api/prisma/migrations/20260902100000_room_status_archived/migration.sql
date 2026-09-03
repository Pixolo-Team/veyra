-- Adds `archived` to RoomStatus.
--
-- Its own migration on purpose: Postgres will not let a newly added enum value
-- be *used* in the same transaction that adds it, so keeping this alone leaves
-- any later migration free to reference it.
ALTER TYPE "RoomStatus" ADD VALUE IF NOT EXISTS 'archived';
