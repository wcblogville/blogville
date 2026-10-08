-- BLOG-03, TOWN-07 (2026-10-07): 소개 160자 CHECK, 지붕 색 칸 (data-model B-M2, research R-22·R-23)
ALTER TABLE "blogs" ADD COLUMN "roof_color" text;--> statement-breakpoint
ALTER TABLE "blogs" ADD CONSTRAINT "blogs_description_check" CHECK (char_length("blogs"."description") <= 160);--> statement-breakpoint
ALTER TABLE "blogs" ADD CONSTRAINT "blogs_roof_color_check" CHECK ("blogs"."roof_color" IS NULL OR "blogs"."roof_color" IN ('red', 'orange', 'yellow', 'green', 'sky', 'blue', 'purple', 'brown'));