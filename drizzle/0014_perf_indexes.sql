CREATE INDEX IF NOT EXISTS "att_student_date_idx" ON "attendance" USING btree ("student_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "charges_sub_idx" ON "charges" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "charges_sgm_idx" ON "charges" USING btree ("student_id","group_id","month") WHERE kind = 'oylik';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "groups_teacher_idx" ON "groups" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_assigned_idx" ON "leads" USING btree ("assigned_to_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_updated_idx" ON "leads" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notes_author_idx" ON "notes" USING btree ("author_id","created_at");