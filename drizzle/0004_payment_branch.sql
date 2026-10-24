ALTER TABLE "payments" ADD COLUMN "branch_id" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
UPDATE "payments" p SET "branch_id" = s."branch_id" FROM "students" s WHERE s."id" = p."student_id" AND p."branch_id" IS NULL;
