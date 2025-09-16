-- AlterTable
ALTER TABLE "public"."Article" ADD COLUMN     "is_synced" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "synced_at" TIMESTAMP(3);
