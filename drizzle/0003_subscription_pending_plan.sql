ALTER TABLE "subscriptions" ADD COLUMN "pending_plan_id" integer;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "pending_plan_change_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_pending_plan_id_plans_id_fk" FOREIGN KEY ("pending_plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;