ALTER TABLE "outbox" ADD COLUMN "sending_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "telegram_link_expires" timestamp with time zone;