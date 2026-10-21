/*
  Warnings:

  - You are about to drop the column `email` on the `Invite` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Invite_email_idx";

-- AlterTable
ALTER TABLE "Invite" DROP COLUMN "email";
