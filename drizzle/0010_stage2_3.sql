CREATE TABLE "coins" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"auto_key" text,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"key" text PRIMARY KEY NOT NULL,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_templates" (
	"event" text PRIMARY KEY NOT NULL,
	"body" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" serial PRIMARY KEY NOT NULL,
	"event" text NOT NULL,
	"student_id" integer,
	"branch_id" integer,
	"channel" text NOT NULL,
	"to" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'navbatda' NOT NULL,
	"error" text,
	"dedupe_key" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"branch_id" integer,
	"capacity" integer DEFAULT 12 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"month" text NOT NULL,
	"target" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "call_status" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "next_call_at" date;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "contract_template" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "coins_per_lesson" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "coins_on_time_pay" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "debt_notice_min" integer DEFAULT 100000 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "absent_task_after" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "birth_date" date;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "cabinet_hash" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "telegram_chat_id" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "telegram_link_code" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "auto_key" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "entity_type" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "entity_id" integer;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "done_note" text;--> statement-breakpoint
ALTER TABLE "coins" ADD CONSTRAINT "coins_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coins" ADD CONSTRAINT "coins_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_plans" ADD CONSTRAINT "sales_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coins_student_idx" ON "coins" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coins_auto_uq" ON "coins" USING btree ("auto_key");--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_dedupe_uq" ON "outbox" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "outbox_status_idx" ON "outbox" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_plan_uq" ON "sales_plans" USING btree ("user_id","month");--> statement-breakpoint
CREATE UNIQUE INDEX "students_cabinet_uq" ON "students" USING btree ("cabinet_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "students_tglink_uq" ON "students" USING btree ("telegram_link_code");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_auto_uq" ON "tasks" USING btree ("auto_key");--> statement-breakpoint
INSERT INTO "rooms" ("name", "branch_id")
SELECT DISTINCT trim(g.room), g.branch_id FROM "groups" g WHERE g.room IS NOT NULL AND trim(g.room) <> '';
--> statement-breakpoint
INSERT INTO "message_templates" ("event", "body") VALUES
('tolov', 'Hurmatli ota-ona! {oquvchi} uchun {summa} to''lov qabul qilindi. Hisobdagi qoldiq: {qoldiq}. {markaz}'),
('kelmadi', '{oquvchi} bugun {guruh} darsiga kelmadi. Sababini bilish uchun bog''laning: {telefon}. {markaz}'),
('qarz', '{oquvchi} bo''yicha {qarz} to''lanmagan summa bor. Iltimos, to''lovni amalga oshiring. {markaz}'),
('tugilgan_kun', '{oquvchi}, tug''ilgan kuningiz bilan! Sizga bilim va omad tilaymiz. {markaz} jamoasi'),
('birinchi_dars', '{oquvchi}, ertaga soat {vaqt} da {guruh} guruhidagi birinchi darsingiz. Manzil: {manzil}. {markaz}')
ON CONFLICT DO NOTHING;
