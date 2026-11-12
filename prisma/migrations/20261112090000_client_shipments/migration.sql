-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "clientId" TEXT;

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "clientRef" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "waybill" TEXT,
    "tempCode" TEXT,
    "dropoffCentre" JSONB,
    "labelUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PRE_TRANSIT',
    "statusAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origin" JSONB NOT NULL,
    "destination" JSONB NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "declaredValueMinor" INTEGER NOT NULL,
    "settlementMode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_code_key" ON "Shipment"("code");

-- CreateIndex
CREATE INDEX "Shipment_status_idx" ON "Shipment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_client_clientRef_key" ON "Shipment"("client", "clientRef");
