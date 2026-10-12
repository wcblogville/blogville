ALTER TABLE "user_animals" ADD COLUMN "sex" text;--> statement-breakpoint
ALTER TABLE "user_animals" ADD COLUMN "variant" text;--> statement-breakpoint
ALTER TABLE "user_animals" ADD COLUMN "display_form" text DEFAULT 'adult' NOT NULL;--> statement-breakpoint
-- 이미 깨어난 동물은 암수를 반반으로 정해 준다 (손으로 더한 줄, 2026-10-12)
UPDATE "user_animals" SET "sex" = CASE WHEN random() < 0.5 THEN 'female' ELSE 'male' END WHERE "status" <> 'egg';--> statement-breakpoint
ALTER TABLE "user_animals" ADD CONSTRAINT "user_animals_sex_check" CHECK (("user_animals"."status" = 'egg') = ("user_animals"."sex" IS NULL) AND ("user_animals"."sex" IS NULL OR "user_animals"."sex" IN ('female', 'male')));--> statement-breakpoint
ALTER TABLE "user_animals" ADD CONSTRAINT "user_animals_variant_check" CHECK ("user_animals"."variant" IS NULL OR "user_animals"."status" = 'grown');--> statement-breakpoint
ALTER TABLE "user_animals" ADD CONSTRAINT "user_animals_display_form_check" CHECK ("user_animals"."display_form" IN ('adult', 'baby'));