-- CreateEnum
CREATE TYPE "FirstMile" AS ENUM ('DROP_OFF', 'PICKUP');

-- CreateEnum
CREATE TYPE "LastMile" AS ENUM ('DOOR', 'COLLECT');

-- CreateEnum
CREATE TYPE "Party" AS ENUM ('SENDER', 'COURIER', 'CENTRE', 'TRAVELLER', 'RECIPIENT');

-- CreateEnum
CREATE TYPE "HandoverStatus" AS ENUM ('WAITING', 'READY', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('OFFERED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "LegKind" ADD VALUE 'FIRST_MILE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ParcelStatus" ADD VALUE 'AWAITING_DROPOFF';
ALTER TYPE "ParcelStatus" ADD VALUE 'AWAITING_PICKUP';
ALTER TYPE "ParcelStatus" ADD VALUE 'WITH_COURIER';
ALTER TYPE "ParcelStatus" ADD VALUE 'AT_ORIGIN';
ALTER TYPE "ParcelStatus" ADD VALUE 'READY_FOR_COLLECTION';

-- AlterTable
ALTER TABLE "Courier" ADD COLUMN     "availableUntil" TIMESTAMP(3),
ADD COLUMN     "lastLat" DOUBLE PRECISION,
ADD COLUMN     "lastLng" DOUBLE PRECISION,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Leg" ALTER COLUMN "carrierName" DROP NOT NULL,
ALTER COLUMN "carrierPhone" DROP NOT NULL,
ALTER COLUMN "collectCode" DROP NOT NULL,
ALTER COLUMN "handoverCode" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Parcel" ADD COLUMN     "destHubId" TEXT,
ADD COLUMN     "firstMile" "FirstMile" NOT NULL DEFAULT 'DROP_OFF',
ADD COLUMN     "lastMile" "LastMile" NOT NULL DEFAULT 'DOOR',
ADD COLUMN     "originHubId" TEXT,
ADD COLUMN     "preferredCourierId" TEXT;

-- CreateTable
CREATE TABLE "Handover" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "fromParty" "Party" NOT NULL,
    "toParty" "Party" NOT NULL,
    "fromHubId" TEXT,
    "toHubId" TEXT,
    "fromLegId" TEXT,
    "toLegId" TEXT,
    "token" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "HandoverStatus" NOT NULL DEFAULT 'WAITING',
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "doneAt" TIMESTAMP(3),
    "doneBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Handover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobOffer" (
    "id" TEXT NOT NULL,
    "legId" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'OFFERED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Handover_token_key" ON "Handover"("token");

-- CreateIndex
CREATE INDEX "Handover_toHubId_status_idx" ON "Handover"("toHubId", "status");

-- CreateIndex
CREATE INDEX "Handover_fromHubId_status_idx" ON "Handover"("fromHubId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Handover_parcelId_seq_key" ON "Handover"("parcelId", "seq");

-- CreateIndex
CREATE INDEX "JobOffer_courierId_status_idx" ON "JobOffer"("courierId", "status");

-- CreateIndex
CREATE INDEX "JobOffer_legId_status_idx" ON "JobOffer"("legId", "status");

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_originHubId_fkey" FOREIGN KEY ("originHubId") REFERENCES "HandoverPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_destHubId_fkey" FOREIGN KEY ("destHubId") REFERENCES "HandoverPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Handover" ADD CONSTRAINT "Handover_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Handover" ADD CONSTRAINT "Handover_fromHubId_fkey" FOREIGN KEY ("fromHubId") REFERENCES "HandoverPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Handover" ADD CONSTRAINT "Handover_toHubId_fkey" FOREIGN KEY ("toHubId") REFERENCES "HandoverPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Handover" ADD CONSTRAINT "Handover_fromLegId_fkey" FOREIGN KEY ("fromLegId") REFERENCES "Leg"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Handover" ADD CONSTRAINT "Handover_toLegId_fkey" FOREIGN KEY ("toLegId") REFERENCES "Leg"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOffer" ADD CONSTRAINT "JobOffer_legId_fkey" FOREIGN KEY ("legId") REFERENCES "Leg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOffer" ADD CONSTRAINT "JobOffer_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ── Data: existing legs become handovers, keeping their codes ─────────────────────────────
-- Each leg L gives two handovers: into the carrier (seq 2L-1) and out of the carrier (seq 2L).
INSERT INTO "Handover" ("id","parcelId","seq","fromParty","toParty","fromHubId","toLegId","token","code","status","failedAttempts","doneAt","doneBy")
SELECT gen_random_uuid()::text, l."parcelId", (l."seq" - 1) * 2 + 1,
       CASE WHEN l."seq" = 1 THEN 'SENDER'::"Party" ELSE 'CENTRE'::"Party" END,
       CASE WHEN l."kind" = 'LINEHAUL' THEN 'TRAVELLER'::"Party" ELSE 'COURIER'::"Party" END,
       CASE WHEN l."seq" = 1 THEN NULL ELSE (SELECT h."id" FROM "HandoverPoint" h WHERE h."postcode" = l."fromPostcode" LIMIT 1) END,
       l."id", replace(gen_random_uuid()::text, '-', ''),
       COALESCE(l."collectCode", lpad(floor(random() * 1000000)::int::text, 6, '0')),
       CASE WHEN l."status" IN ('COLLECTED', 'HANDED_OVER') THEN 'DONE'::"HandoverStatus" ELSE 'READY'::"HandoverStatus" END,
       CASE WHEN l."status" = 'ASSIGNED' THEN l."failedAttempts" ELSE 0 END,
       l."collectedAt", CASE WHEN l."collectedAt" IS NOT NULL THEN 'legacy' END
FROM "Leg" l;

INSERT INTO "Handover" ("id","parcelId","seq","fromParty","toParty","fromLegId","toHubId","token","code","status","failedAttempts","doneAt","doneBy")
SELECT gen_random_uuid()::text, l."parcelId", (l."seq" - 1) * 2 + 2,
       CASE WHEN l."kind" = 'LINEHAUL' THEN 'TRAVELLER'::"Party" ELSE 'COURIER'::"Party" END,
       CASE WHEN l."kind" = 'LINEHAUL' THEN 'CENTRE'::"Party" ELSE 'RECIPIENT'::"Party" END,
       l."id",
       CASE WHEN l."kind" = 'LINEHAUL' THEN (SELECT h."id" FROM "HandoverPoint" h WHERE h."postcode" = l."toPostcode" LIMIT 1) END,
       replace(gen_random_uuid()::text, '-', ''),
       COALESCE(l."handoverCode", lpad(floor(random() * 1000000)::int::text, 6, '0')),
       CASE WHEN l."status" = 'HANDED_OVER' THEN 'DONE'::"HandoverStatus"
            WHEN l."status" = 'COLLECTED' THEN 'READY'::"HandoverStatus"
            ELSE 'WAITING'::"HandoverStatus" END,
       CASE WHEN l."status" = 'COLLECTED' THEN l."failedAttempts" ELSE 0 END,
       l."handedOverAt", CASE WHEN l."handedOverAt" IS NOT NULL THEN 'legacy' END
FROM "Leg" l;

-- Existing parcels: their destination centre is where leg 1 ended.
UPDATE "Parcel" p SET "destHubId" = (
  SELECT h."id" FROM "Leg" l JOIN "HandoverPoint" h ON h."postcode" = l."toPostcode"
  WHERE l."parcelId" = p."id" AND l."seq" = 1 LIMIT 1
);
