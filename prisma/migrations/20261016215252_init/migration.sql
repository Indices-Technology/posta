-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('OPEN', 'FULL', 'DONE');

-- CreateEnum
CREATE TYPE "ParcelStatus" AS ENUM ('NEW', 'MATCHED', 'IN_TRANSIT', 'AT_HUB', 'OUT_FOR_DELIVERY', 'DELIVERED');

-- CreateEnum
CREATE TYPE "LegKind" AS ENUM ('LINEHAUL', 'LASTMILE');

-- CreateEnum
CREATE TYPE "LegStatus" AS ENUM ('ASSIGNED', 'COLLECTED', 'HANDED_OVER');

-- CreateTable
CREATE TABLE "HandoverPoint" (
    "id" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "contactPhone" TEXT NOT NULL,

    CONSTRAINT "HandoverPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "driverUserId" TEXT,
    "driverName" TEXT NOT NULL,
    "driverPhone" TEXT NOT NULL,
    "fromCity" TEXT NOT NULL,
    "toCity" TEXT NOT NULL,
    "departAt" TIMESTAMP(3) NOT NULL,
    "arriveBy" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "TripStatus" NOT NULL DEFAULT 'OPEN',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parcel" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderPhone" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "pickupPostcode" TEXT NOT NULL,
    "dropPostcode" TEXT NOT NULL,
    "fromCity" TEXT NOT NULL,
    "toCity" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "valueKobo" INTEGER NOT NULL,
    "status" "ParcelStatus" NOT NULL DEFAULT 'NEW',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Parcel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Leg" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "kind" "LegKind" NOT NULL,
    "tripId" TEXT,
    "carrierName" TEXT NOT NULL,
    "carrierPhone" TEXT NOT NULL,
    "fromPostcode" TEXT NOT NULL,
    "toPostcode" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "collectCode" TEXT NOT NULL,
    "handoverCode" TEXT NOT NULL,
    "linkToken" TEXT NOT NULL,
    "status" "LegStatus" NOT NULL DEFAULT 'ASSIGNED',
    "collectedAt" TIMESTAMP(3),
    "handedOverAt" TIMESTAMP(3),
    "handoverPostcode" TEXT,
    "photoUrl" TEXT,

    CONSTRAINT "Leg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Parcel_ref_key" ON "Parcel"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "Leg_linkToken_key" ON "Leg"("linkToken");

-- CreateIndex
CREATE UNIQUE INDEX "Leg_parcelId_seq_key" ON "Leg"("parcelId", "seq");

-- CreateIndex
CREATE INDEX "Event_parcelId_at_idx" ON "Event"("parcelId", "at");

-- AddForeignKey
ALTER TABLE "Leg" ADD CONSTRAINT "Leg_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Leg" ADD CONSTRAINT "Leg_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
