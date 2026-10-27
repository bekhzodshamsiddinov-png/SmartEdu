CREATE TABLE "cash_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_id" integer NOT NULL,
	"to_id" integer NOT NULL,
	"method" text DEFAULT 'naqd' NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'kutilmoqda' NOT NULL,
	"note" text,
	"created_by_id" integer,
	"confirmed_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cashboxes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"branch_id" integer,
	"owner_id" integer,
	"is_main" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "charges" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"enrollment_id" integer,
	"group_id" integer,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"date" date NOT NULL,
	"month" text,
	"attendance_id" integer,
	"note" text,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"charges" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salary_payouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"month" text NOT NULL,
	"amount" integer NOT NULL,
	"breakdown" text,
	"transaction_id" integer,
	"paid_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"month" text NOT NULL,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"note" text,
	"transaction_id" integer,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "reason_id" integer;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "billing" text DEFAULT 'oylik' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "cashbox_id" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "cancelled_by_id" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "billing_default" text DEFAULT 'oylik' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "charge_absent" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "prorate_first_month" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "freeze_until" date;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "cashbox_id" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "teacher_percent" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cash_transfers" ADD CONSTRAINT "cash_transfers_from_id_cashboxes_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."cashboxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transfers" ADD CONSTRAINT "cash_transfers_to_id_cashboxes_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."cashboxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transfers" ADD CONSTRAINT "cash_transfers_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transfers" ADD CONSTRAINT "cash_transfers_confirmed_by_id_users_id_fk" FOREIGN KEY ("confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashboxes" ADD CONSTRAINT "cashboxes_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashboxes" ADD CONSTRAINT "cashboxes_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_payouts" ADD CONSTRAINT "salary_payouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_payouts" ADD CONSTRAINT "salary_payouts_paid_by_id_users_id_fk" FOREIGN KEY ("paid_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_adjustments" ADD CONSTRAINT "staff_adjustments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_adjustments" ADD CONSTRAINT "staff_adjustments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "charges_student_idx" ON "charges" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "charges_date_idx" ON "charges" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "charges_att_uq" ON "charges" USING btree ("attendance_id") WHERE attendance_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "charges_month_uq" ON "charges" USING btree ("enrollment_id","month") WHERE kind = 'oylik';--> statement-breakpoint
CREATE UNIQUE INDEX "payout_user_month_uq" ON "salary_payouts" USING btree ("user_id","month");--> statement-breakpoint
CREATE INDEX "adj_user_month_idx" ON "staff_adjustments" USING btree ("user_id","month");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_cancelled_by_id_users_id_fk" FOREIGN KEY ("cancelled_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Asosiy kassa va mavjud yozuvlarni unga biriktirish
INSERT INTO "cashboxes" ("name", "is_main") SELECT 'Asosiy kassa', true WHERE NOT EXISTS (SELECT 1 FROM "cashboxes" WHERE "is_main");--> statement-breakpoint
UPDATE "payments" SET "cashbox_id" = (SELECT id FROM "cashboxes" WHERE "is_main" ORDER BY id LIMIT 1) WHERE "cashbox_id" IS NULL;--> statement-breakpoint
UPDATE "transactions" SET "cashbox_id" = (SELECT id FROM "cashboxes" WHERE "is_main" ORDER BY id LIMIT 1) WHERE "cashbox_id" IS NULL;--> statement-breakpoint
-- Avvalgi oylik hisobni hisob daftariga ko'chirish (balanslar o'zgarmaydi)
INSERT INTO "charges" ("student_id", "enrollment_id", "group_id", "kind", "amount", "date", "month")
SELECT e.student_id, e.id, e.group_id, 'oylik', e.monthly_fee,
       GREATEST(m.d::date, e.start_date), to_char(m.d, 'YYYY-MM')
FROM "enrollments" e
CROSS JOIN LATERAL generate_series(
  date_trunc('month', e.start_date),
  date_trunc('month', LEAST(COALESCE(e.end_date, (now() AT TIME ZONE 'Asia/Tashkent')::date), (now() AT TIME ZONE 'Asia/Tashkent')::date)),
  interval '1 month') AS m(d)
WHERE e.start_date <= (now() AT TIME ZONE 'Asia/Tashkent')::date
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Standart sabablar
INSERT INTO "reasons" ("kind", "title", "charges", "position") VALUES
 ('davomat', 'Kasal', false, 1), ('davomat', 'Oilaviy sabab', false, 2), ('davomat', 'Ogohlantirib kelmadi', true, 3),
 ('ketdi', 'Narx qimmat', false, 1), ('ketdi', 'Vaqt to''g''ri kelmadi', false, 2), ('ketdi', 'Ko''chib ketdi', false, 3),
 ('ketdi', 'Boshqa markazga o''tdi', false, 4), ('ketdi', 'O''qituvchi yoqmadi', false, 5), ('ketdi', 'Qiziqishi yo''qoldi', false, 6),
 ('muzlatish', 'Sog''lig''i', false, 1), ('muzlatish', 'Imtihonlar', false, 2), ('muzlatish', 'Safar', false, 3), ('muzlatish', 'Moliyaviy qiyinchilik', false, 4),
 ('lid', 'Qimmat', false, 1), ('lid', 'Vaqt mos emas', false, 2), ('lid', 'Javob bermadi', false, 3), ('lid', 'Boshqa markazni tanladi', false, 4);
