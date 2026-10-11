-- 펫 종류·스킨 (TOWN-09, 사용자 요청 2026-10-11 "펫 종류, 펫 따라다니는 모션, 펫 종류별로 스킨"):
-- 분양 값(animal_species.price, 알에서 안 나오는 종류는 hatch_weight 0), 스킨 카탈로그 animal_skins, 산 스킨 user_animal_skins,
-- 동물이 입은 스킨 user_animals.skin_id (그 종류의 스킨 + 주인이 산 것만, 복합 FK 두 개). 새 enum 값은 이 마이그레이션에서 쓰지 않는다
ALTER TYPE "public"."egg_source" ADD VALUE 'adopt';--> statement-breakpoint
ALTER TYPE "public"."ledger_reason" ADD VALUE 'animal_adopt';--> statement-breakpoint
ALTER TYPE "public"."ledger_reason" ADD VALUE 'skin_purchase';--> statement-breakpoint
CREATE TABLE "animal_skins" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "animal_skins_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"species_id" integer NOT NULL,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"asset_key" text NOT NULL,
	CONSTRAINT "animal_skins_code_unique" UNIQUE("code"),
	CONSTRAINT "animal_skins_asset_key_unique" UNIQUE("asset_key"),
	CONSTRAINT "animal_skins_species_id_id_uq" UNIQUE("species_id","id"),
	CONSTRAINT "animal_skins_price_check" CHECK ("animal_skins"."price" > 0)
);
--> statement-breakpoint
CREATE TABLE "user_animal_skins" (
	"user_id" text NOT NULL,
	"skin_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_animal_skins_user_id_skin_id_pk" PRIMARY KEY("user_id","skin_id")
);
--> statement-breakpoint
ALTER TABLE "animal_species" DROP CONSTRAINT "animal_species_weight_check";--> statement-breakpoint
ALTER TABLE "animal_species" ADD COLUMN "price" integer;--> statement-breakpoint
ALTER TABLE "user_animals" ADD COLUMN "skin_id" integer;--> statement-breakpoint
ALTER TABLE "animal_skins" ADD CONSTRAINT "animal_skins_species_id_animal_species_id_fk" FOREIGN KEY ("species_id") REFERENCES "public"."animal_species"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_animal_skins" ADD CONSTRAINT "user_animal_skins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_animal_skins" ADD CONSTRAINT "user_animal_skins_skin_id_animal_skins_id_fk" FOREIGN KEY ("skin_id") REFERENCES "public"."animal_skins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_animals" ADD CONSTRAINT "user_animals_skin_species_fk" FOREIGN KEY ("species_id","skin_id") REFERENCES "public"."animal_skins"("species_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_animals" ADD CONSTRAINT "user_animals_skin_owned_fk" FOREIGN KEY ("user_id","skin_id") REFERENCES "public"."user_animal_skins"("user_id","skin_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animal_species" ADD CONSTRAINT "animal_species_price_check" CHECK ("animal_species"."price" IS NULL OR "animal_species"."price" > 0);--> statement-breakpoint
ALTER TABLE "animal_species" ADD CONSTRAINT "animal_species_obtainable_check" CHECK ("animal_species"."hatch_weight" > 0 OR "animal_species"."price" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "animal_species" ADD CONSTRAINT "animal_species_weight_check" CHECK ("animal_species"."hatch_weight" >= 0);