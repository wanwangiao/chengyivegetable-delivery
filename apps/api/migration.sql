-- DropForeignKey
ALTER TABLE "DeliveryProof" DROP CONSTRAINT "DeliveryProof_orderId_fkey";

-- DropForeignKey
ALTER TABLE "DeliveryProof" DROP CONSTRAINT "DeliveryProof_driverId_fkey";

-- DropForeignKey
ALTER TABLE "PriceChangeAlert" DROP CONSTRAINT "PriceChangeAlert_orderId_fkey";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "deliveryDate",
DROP COLUMN "isPreOrder",
DROP COLUMN "priceAlertSent",
DROP COLUMN "priceAlertSentAt",
DROP COLUMN "priceConfirmed";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "nextDayPrice",
DROP COLUMN "nextDayWeightPricePerUnit";

-- DropTable
DROP TABLE "DeliveryProof";

-- DropTable
DROP TABLE "SystemConfig";

-- DropTable
DROP TABLE "PriceChangeAlert";

