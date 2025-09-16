-- CreateTable
CREATE TABLE "public"."Article" (
    "id" UUID NOT NULL,
    "source" TEXT,
    "author" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "urlToImage" TEXT,
    "url" TEXT NOT NULL,
    "content" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);
