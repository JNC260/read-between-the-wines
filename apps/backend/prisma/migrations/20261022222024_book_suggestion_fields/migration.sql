-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "goodreadsUrl" TEXT,
ADD COLUMN     "normalizedTitle" TEXT NOT NULL,
ADD COLUMN     "openLibraryWorkId" TEXT,
ADD COLUMN     "pageCount" INTEGER,
ADD COLUMN     "synopsis" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Book_openLibraryWorkId_key" ON "Book"("openLibraryWorkId");

-- CreateIndex
CREATE INDEX "Book_normalizedTitle_idx" ON "Book"("normalizedTitle");
