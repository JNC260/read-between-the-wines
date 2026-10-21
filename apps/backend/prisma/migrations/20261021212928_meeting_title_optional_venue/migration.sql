/*
  Warnings:

  - Added the required column `title` to the `Meeting` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Meeting" DROP CONSTRAINT "Meeting_venueId_fkey";

-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "title" TEXT NOT NULL,
ALTER COLUMN "venueId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
