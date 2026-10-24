CREATE TYPE "public"."attendance_status" AS ENUM('keldi', 'kelmadi', 'kechikdi', 'sababli');--> statement-breakpoint
CREATE TYPE "public"."lead_stage" AS ENUM('yangi', 'boglanildi', 'sinov_yozildi', 'sinov_keldi', 'tolov_qildi', 'rad_etdi');--> statement-breakpoint
CREATE TYPE "public"."pay_method" AS ENUM('naqd', 'click', 'payme', 'karta', 'bank');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('past', 'orta', 'yuqori');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('rahbar', 'admin', 'oqituvchi', 'support', 'sotuv', 'marketing', 'bugalter');--> statement-breakpoint
CREATE TYPE "public"."student_status" AS ENUM('faol', 'xavf', 'muzlatilgan', 'ketgan', 'bitirgan');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('yangi', 'jarayonda', 'bajarildi');--> statement-breakpoint
CREATE TYPE "public"."tx_type" AS ENUM('kirim', 'chiqim');--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"student_id" integer NOT NULL,
	"date" date NOT NULL,
	"status" "attendance_status" NOT NULL,
	"reason" text,
	"called" boolean DEFAULT false NOT NULL,
	"marked_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"monthly_price" integer DEFAULT 0 NOT NULL,
	"duration_months" integer DEFAULT 3 NOT NULL,
	"color" text DEFAULT '#0F766E' NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"group_id" integer NOT NULL,
	"monthly_fee" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grades" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"group_id" integer,
	"period" text NOT NULL,
	"score" integer NOT NULL,
	"comment" text,
	"teacher_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "graduates" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"workplace" text,
	"position" text,
	"monthly_income" integer,
	"freelance" boolean DEFAULT false NOT NULL,
	"studying_at" text,
	"last_contact_at" date,
	"referrals" integer DEFAULT 0 NOT NULL,
	"in_telegram_group" boolean DEFAULT false NOT NULL,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "graduates_student_id_unique" UNIQUE("student_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"course_id" integer NOT NULL,
	"teacher_id" integer,
	"support_id" integer,
	"days" text DEFAULT 'Du,Chor,Ju' NOT NULL,
	"start_time" text DEFAULT '14:00' NOT NULL,
	"end_time" text DEFAULT '16:00' NOT NULL,
	"room" text,
	"capacity" integer DEFAULT 14 NOT NULL,
	"start_date" date,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"source" text DEFAULT 'Instagram' NOT NULL,
	"course_id" integer,
	"stage" "lead_stage" DEFAULT 'yangi' NOT NULL,
	"max_stage" integer DEFAULT 0 NOT NULL,
	"assigned_to_id" integer,
	"trial_date" date,
	"lost_reason" text,
	"note" text,
	"student_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"date" date NOT NULL,
	"topic" text,
	"teacher_status" text DEFAULT 'vaqtida' NOT NULL,
	"note" text,
	"marked_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"kind" text DEFAULT 'izoh' NOT NULL,
	"text" text NOT NULL,
	"author_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"enrollment_id" integer,
	"amount" integer NOT NULL,
	"method" "pay_method" DEFAULT 'naqd' NOT NULL,
	"for_month" text,
	"paid_at" date NOT NULL,
	"note" text,
	"received_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reconciliations" (
	"id" serial PRIMARY KEY NOT NULL,
	"month" text NOT NULL,
	"bank" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tax" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reconciliations_month_unique" UNIQUE("month")
);
--> statement-breakpoint
CREATE TABLE "results" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"amount" integer,
	"date" date NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"center_name" text DEFAULT 'United IT Clubs' NOT NULL,
	"phone" text,
	"address" text,
	"payment_due_day" integer DEFAULT 5 NOT NULL,
	"salary_day" integer DEFAULT 10 NOT NULL,
	"reserve_percent" integer DEFAULT 10 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "staff_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" date NOT NULL,
	"kind" text DEFAULT 'kunlik' NOT NULL,
	"done" text NOT NULL,
	"problems" text,
	"plan" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" serial PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"parent_name" text,
	"parent_phone" text,
	"birth_year" integer,
	"school" text,
	"address" text,
	"source" text,
	"status" "student_status" DEFAULT 'faol' NOT NULL,
	"joined_at" date NOT NULL,
	"left_at" date,
	"left_reason" text,
	"return_attempt" text,
	"return_result" text,
	"graduated_at" date,
	"note" text,
	"lead_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"assignee_id" integer,
	"creator_id" integer,
	"due_date" date,
	"status" "task_status" DEFAULT 'yangi' NOT NULL,
	"priority" "priority" DEFAULT 'orta' NOT NULL,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "tx_type" NOT NULL,
	"category" text NOT NULL,
	"amount" integer NOT NULL,
	"date" date NOT NULL,
	"method" text DEFAULT 'bank' NOT NULL,
	"counterparty" text,
	"document" text,
	"note" text,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" NOT NULL,
	"position" text,
	"base_salary" integer DEFAULT 0 NOT NULL,
	"bonus_rule" text,
	"active" boolean DEFAULT true NOT NULL,
	"hired_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_marked_by_id_users_id_fk" FOREIGN KEY ("marked_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graduates" ADD CONSTRAINT "graduates_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_support_id_users_id_fk" FOREIGN KEY ("support_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_marked_by_id_users_id_fk" FOREIGN KEY ("marked_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_id_users_id_fk" FOREIGN KEY ("received_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_reports" ADD CONSTRAINT "staff_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "att_uq" ON "attendance" USING btree ("group_id","student_id","date");--> statement-breakpoint
CREATE INDEX "att_date_idx" ON "attendance" USING btree ("date");--> statement-breakpoint
CREATE INDEX "att_student_idx" ON "attendance" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "enr_student_idx" ON "enrollments" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "enr_group_idx" ON "enrollments" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "grades_student_idx" ON "grades" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "leads_stage_idx" ON "leads" USING btree ("stage");--> statement-breakpoint
CREATE UNIQUE INDEX "lessons_group_date_uq" ON "lessons" USING btree ("group_id","date");--> statement-breakpoint
CREATE INDEX "notes_entity_idx" ON "notes" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "notes_kind_idx" ON "notes" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "pay_student_idx" ON "payments" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "pay_date_idx" ON "payments" USING btree ("paid_at");--> statement-breakpoint
CREATE INDEX "results_student_idx" ON "results" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "reports_user_idx" ON "staff_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reports_date_idx" ON "staff_reports" USING btree ("date");--> statement-breakpoint
CREATE INDEX "students_status_idx" ON "students" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tasks_assignee_idx" ON "tasks" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "tx_date_idx" ON "transactions" USING btree ("date");