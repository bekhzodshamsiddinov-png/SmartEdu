CREATE TABLE "branches" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"phone" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "branch_id" integer;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "branch_id" integer;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "branch_id" integer;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "branch_id" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "branch_id" integer;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "branches" ("name") SELECT 'Asosiy filial' WHERE NOT EXISTS (SELECT 1 FROM "branches");--> statement-breakpoint
UPDATE "groups" SET "branch_id" = (SELECT min(id) FROM "branches") WHERE "branch_id" IS NULL;--> statement-breakpoint
UPDATE "students" SET "branch_id" = (SELECT min(id) FROM "branches") WHERE "branch_id" IS NULL;--> statement-breakpoint
UPDATE "leads" SET "branch_id" = (SELECT min(id) FROM "branches") WHERE "branch_id" IS NULL;--> statement-breakpoint
UPDATE "transactions" SET "branch_id" = (SELECT min(id) FROM "branches") WHERE "branch_id" IS NULL;
