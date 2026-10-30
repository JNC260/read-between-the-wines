-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('NEW_POLL', 'VOTE_REMINDER', 'RSVP_REMINDER', 'MEETING_REMINDER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailOptOuts" "NotificationKind"[] DEFAULT ARRAY[]::"NotificationKind"[];

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_userId_kind_subjectId_key" ON "NotificationLog"("userId", "kind", "subjectId");

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
