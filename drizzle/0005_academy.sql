CREATE TABLE "payme_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"payme_id" text NOT NULL,
	"order_id" integer NOT NULL,
	"amount" bigint NOT NULL,
	"state" integer DEFAULT 1 NOT NULL,
	"reason" integer,
	"payme_time" bigint NOT NULL,
	"create_time" bigint NOT NULL,
	"perform_time" bigint DEFAULT 0 NOT NULL,
	"cancel_time" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "payme_transactions_payme_id_unique" UNIQUE("payme_id")
);
--> statement-breakpoint
ALTER TABLE "course_orders" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "course_orders" ADD COLUMN "provider_tx" text;--> statement-breakpoint
ALTER TABLE "learners" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "learners" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "online_courses" ADD COLUMN "category" text DEFAULT 'ai' NOT NULL;--> statement-breakpoint
ALTER TABLE "online_courses" ADD COLUMN "outcomes" text;--> statement-breakpoint
ALTER TABLE "online_courses" ADD COLUMN "audience" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "pay_card" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "pay_card_holder" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "telegram" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "instagram" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "academy_tagline" text;--> statement-breakpoint
ALTER TABLE "payme_transactions" ADD CONSTRAINT "payme_transactions_order_id_course_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."course_orders"("id") ON DELETE no action ON UPDATE no action;