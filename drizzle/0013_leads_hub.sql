CREATE TABLE "ad_spend" (
	"id" serial PRIMARY KEY NOT NULL,
	"month" text NOT NULL,
	"source" text NOT NULL,
	"campaign" text DEFAULT '' NOT NULL,
	"branch_id" integer,
	"amount" integer NOT NULL,
	"note" text,
	"created_by_id" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "graduate_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"date" date NOT NULL,
	"channel" text NOT NULL,
	"note" text,
	"by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"key" text PRIMARY KEY NOT NULL,
	"secret" text,
	"info" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_by_id" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_touches" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"source" text NOT NULL,
	"campaign" text,
	"ad" text,
	"via" text NOT NULL,
	"detail" text,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meta_leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"leadgen_id" text NOT NULL,
	"page_id" text,
	"form_id" text,
	"ad_id" text,
	"status" text DEFAULT 'kutilmoqda' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"lead_id" integer,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "meta_leads_leadgen_id_unique" UNIQUE("leadgen_id")
);
--> statement-breakpoint
ALTER TABLE "graduates" ADD COLUMN "field" text;--> statement-breakpoint
ALTER TABLE "graduates" ADD COLUMN "socials" text;--> statement-breakpoint
ALTER TABLE "graduates" ADD COLUMN "next_contact_at" date;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "campaign" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "ad" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "referred_by_student_id" integer;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "created_by_id" integer;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "touches" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "last_touch_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "results" ADD COLUMN "place" text;--> statement-breakpoint
ALTER TABLE "results" ADD COLUMN "level" text;--> statement-breakpoint
ALTER TABLE "results" ADD COLUMN "link" text;--> statement-breakpoint
ALTER TABLE "results" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "results" ADD COLUMN "created_by_id" integer;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "lead_auto_assign" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "alumni_contact_days" integer DEFAULT 90 NOT NULL;--> statement-breakpoint
ALTER TABLE "ad_spend" ADD CONSTRAINT "ad_spend_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_spend" ADD CONSTRAINT "ad_spend_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graduate_contacts" ADD CONSTRAINT "graduate_contacts_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graduate_contacts" ADD CONSTRAINT "graduate_contacts_by_id_users_id_fk" FOREIGN KEY ("by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_touches" ADD CONSTRAINT "lead_touches_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_touches" ADD CONSTRAINT "lead_touches_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta_leads" ADD CONSTRAINT "meta_leads_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ad_spend_month_idx" ON "ad_spend" USING btree ("month");--> statement-breakpoint
CREATE INDEX "graduate_contacts_student_idx" ON "graduate_contacts" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "lead_touches_lead_idx" ON "lead_touches" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_touches_src_idx" ON "lead_touches" USING btree ("source","created_at");--> statement-breakpoint
CREATE INDEX "meta_leads_status_idx" ON "meta_leads" USING btree ("status");--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_referred_by_student_id_students_id_fk" FOREIGN KEY ("referred_by_student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leads_phone_idx" ON "leads" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "leads_source_idx" ON "leads" USING btree ("source","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_external_uq" ON "leads" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "results_date_idx" ON "results" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "ad_spend_uq" ON "ad_spend" USING btree ("month","source","campaign",coalesce("branch_id",0));--> statement-breakpoint
UPDATE "leads" SET "source" = 'Instagram target' WHERE "source" = 'Target';--> statement-breakpoint
UPDATE "leads" SET "source" = 'uitc.uz' WHERE "source" = 'Sayt' AND "note" LIKE 'uitc.uz%';--> statement-breakpoint
UPDATE "leads" SET "source" = 'Akademiya sayti' WHERE "source" = 'Sayt';--> statement-breakpoint
UPDATE "students" SET "source" = 'Instagram target' WHERE "source" = 'Target';--> statement-breakpoint
UPDATE "students" SET "source" = 'Akademiya sayti' WHERE "source" = 'Sayt';--> statement-breakpoint
UPDATE "leads" SET "last_touch_at" = "created_at";--> statement-breakpoint
INSERT INTO "lead_touches" ("lead_id","source","via","created_at") SELECT "id","source",'qolda',"created_at" FROM "leads";
