CREATE TABLE "course_lessons" (
	"id" serial PRIMARY KEY NOT NULL,
	"module_id" integer NOT NULL,
	"course_id" integer NOT NULL,
	"title" text NOT NULL,
	"kind" text DEFAULT 'video' NOT NULL,
	"video_url" text,
	"duration_min" integer,
	"content" text,
	"is_free" boolean DEFAULT false NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_modules" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"title" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"learner_id" integer NOT NULL,
	"course_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"original_price" integer NOT NULL,
	"promo_code" text,
	"method" text DEFAULT 'click' NOT NULL,
	"status" text DEFAULT 'kutilmoqda' NOT NULL,
	"paid_at" date,
	"access_until" date,
	"note" text,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learners" (
	"id" serial PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"telegram" text,
	"city" text,
	"source" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learners_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "lesson_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"learner_id" integer NOT NULL,
	"lesson_id" integer NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "online_courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"subtitle" text,
	"description" text,
	"level" text DEFAULT 'boshlangich' NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"old_price" integer,
	"cover_url" text,
	"color" text DEFAULT '#008A70' NOT NULL,
	"status" text DEFAULT 'qoralama' NOT NULL,
	"access_days" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "online_courses_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "promo_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"percent" integer,
	"amount" integer,
	"course_id" integer,
	"max_uses" integer,
	"used" integer DEFAULT 0 NOT NULL,
	"valid_until" date,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promo_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_module_id_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."course_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_course_id_online_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."online_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_course_id_online_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."online_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_orders" ADD CONSTRAINT "course_orders_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_orders" ADD CONSTRAINT "course_orders_course_id_online_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."online_courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_orders" ADD CONSTRAINT "course_orders_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_course_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."course_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_course_id_online_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."online_courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lessons_module_idx" ON "course_lessons" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "lessons_course_idx" ON "course_lessons" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "modules_course_idx" ON "course_modules" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "orders_learner_idx" ON "course_orders" USING btree ("learner_id");--> statement-breakpoint
CREATE INDEX "orders_course_idx" ON "course_orders" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "orders_paid_idx" ON "course_orders" USING btree ("paid_at");--> statement-breakpoint
CREATE UNIQUE INDEX "progress_uq" ON "lesson_progress" USING btree ("learner_id","lesson_id");