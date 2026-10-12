ALTER TABLE "fishing_catches" ADD COLUMN "cast_no" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "fishing_catches" ADD COLUMN "size_mm" integer;--> statement-breakpoint
ALTER TABLE "fishing_catches" DROP CONSTRAINT "fishing_catches_user_id_date_pk";--> statement-breakpoint
ALTER TABLE "fishing_catches" ADD CONSTRAINT "fishing_catches_user_id_date_cast_no_pk" PRIMARY KEY("user_id","date","cast_no");--> statement-breakpoint
ALTER TABLE "blog_visits" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "blog_visits" ADD CONSTRAINT "blog_visits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blog_visits_user_idx" ON "blog_visits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fishing_catches_date_idx" ON "fishing_catches" USING btree ("date");--> statement-breakpoint
ALTER TABLE "fishing_catches" ADD CONSTRAINT "fishing_catches_cast_no_check" CHECK ("fishing_catches"."cast_no" BETWEEN 1 AND 3);--> statement-breakpoint
ALTER TABLE "fishing_catches" ADD CONSTRAINT "fishing_catches_size_check" CHECK ("fishing_catches"."size_mm" IS NULL OR "fishing_catches"."size_mm" > 0);
