/*
  Warnings:

  - You are about to drop the column `source` on the `Article` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Article" DROP COLUMN "source",
ADD COLUMN     "source_name" TEXT;
