-- Add geolocation columns to orders
ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "geocodedAt" TIMESTAMP(3);

-- Create delivery configuration singleton table when missing
CREATE TABLE IF NOT EXISTS "DeliveryConfig" (
  "id" TEXT NOT NULL DEFAULT 'delivery-config',
  "pickupName" TEXT NOT NULL,
  "pickupAddress" TEXT NOT NULL,
  "pickupLat" DOUBLE PRECISION NOT NULL,
  "pickupLng" DOUBLE PRECISION NOT NULL,
  "recommendedBatchMin" INTEGER NOT NULL DEFAULT 5,
  "recommendedBatchMax" INTEGER NOT NULL DEFAULT 8,
  "autoBatchingEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DeliveryConfig_singleton_idx" ON "DeliveryConfig"("id");
