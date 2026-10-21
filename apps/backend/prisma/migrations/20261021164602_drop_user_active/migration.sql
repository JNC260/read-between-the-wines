-- status (ACTIVE, INACTIVE, BANNED) replaces the old active flag.
ALTER TABLE "User" DROP COLUMN "active";
