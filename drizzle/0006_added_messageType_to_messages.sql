CREATE TYPE "public"."message_type" AS ENUM('marketing', 'authentication', 'utility', 'text');--> statement-breakpoint
ALTER TYPE "public"."message_status" ADD VALUE 'received';--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "wamid" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "message_type" "message_type" DEFAULT 'text' NOT NULL;
