-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CourierKind" AS ENUM ('INDIVIDUAL', 'COMPANY');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'WHATSAPP', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "HandoverPoint" ADD COLUMN     "address" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "openingHours" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "ownerUserId" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT,
ADD COLUMN     "status" "PartnerStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Leg" ADD COLUMN     "courierId" TEXT;

-- CreateTable
CREATE TABLE "Courier" (
    "id" TEXT NOT NULL,
    "kind" "CourierKind" NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "vehicle" TEXT,
    "webhookUrl" TEXT,
    "webhookSecret" TEXT,
    "status" "PartnerStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Courier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "template" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "toUserId" TEXT,
    "forStaff" BOOLEAN NOT NULL DEFAULT false,
    "toPhone" TEXT,
    "courierId" TEXT,
    "parcelId" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Courier_city_status_idx" ON "Courier"("city", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Courier_userId_kind_key" ON "Courier"("userId", "kind");

-- CreateIndex
CREATE INDEX "Notification_status_nextAttemptAt_idx" ON "Notification"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "Notification_toUserId_createdAt_idx" ON "Notification"("toUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_forStaff_createdAt_idx" ON "Notification"("forStaff", "createdAt");

-- CreateIndex
CREATE INDEX "HandoverPoint_status_city_idx" ON "HandoverPoint"("status", "city");

-- AddForeignKey
ALTER TABLE "Leg" ADD CONSTRAINT "Leg_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Centres that existed before registration was added were set up by staff: keep them live.
UPDATE "HandoverPoint" SET "status" = 'APPROVED';
