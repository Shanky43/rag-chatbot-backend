-- CreateTable
CREATE TABLE "public"."chat_sessions" (
    "id" UUID NOT NULL,
    "session_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."chat_messages" (
    "id" UUID NOT NULL,
    "session_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "metadata" TEXT,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chat_sessions_session_id_key" ON "public"."chat_sessions"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_session_id_message_id_key" ON "public"."chat_messages"("session_id", "message_id");

-- AddForeignKey
ALTER TABLE "public"."chat_messages" ADD CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("session_id") ON DELETE CASCADE ON UPDATE CASCADE;
