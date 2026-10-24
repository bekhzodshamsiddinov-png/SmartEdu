CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" integer,
	"actor_name" text,
	"action" text NOT NULL,
	"detail" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "course_orders" ADD COLUMN "promo_reserved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "learners" ADD COLUMN "session_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "session_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "auth_attempts_idx" ON "auth_attempts" USING btree ("scope","key","created_at");--> statement-breakpoint
UPDATE "course_orders" SET "promo_reserved" = true WHERE "status" = 'tolandi' AND "promo_code" IS NOT NULL;
