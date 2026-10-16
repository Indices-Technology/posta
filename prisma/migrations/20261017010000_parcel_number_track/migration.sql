-- DropIndex
DROP INDEX "Parcel_ref_key";

-- AlterTable
ALTER TABLE "Parcel" DROP COLUMN "ref",
ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "number" SERIAL NOT NULL,
ADD COLUMN     "trackToken" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Parcel_number_key" ON "Parcel"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Parcel_trackToken_key" ON "Parcel"("trackToken");


-- Parcel numbers start at #1001
ALTER SEQUENCE "Parcel_number_seq" RESTART WITH 1001;
