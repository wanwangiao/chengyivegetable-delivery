-- Add selectionType field to ProductOption table
ALTER TABLE "ProductOption" ADD COLUMN "selectionType" TEXT NOT NULL DEFAULT 'single';
