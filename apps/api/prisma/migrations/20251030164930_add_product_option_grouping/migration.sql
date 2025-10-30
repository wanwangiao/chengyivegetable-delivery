-- Add option grouping fields to ProductOption table
ALTER TABLE "ProductOption" ADD COLUMN "groupName" TEXT;
ALTER TABLE "ProductOption" ADD COLUMN "isRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProductOption" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
