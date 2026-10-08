-- SHOP-01·SHOP-06, TOWN-09 (2026-10-07): 상점 아이템 종류(아바타·성장), 판매 여부, 성장치, 보유 수량, 아바타 착용
CREATE TYPE "public"."avatar_slot" AS ENUM('hat', 'outfit', 'accessory');--> statement-breakpoint
ALTER TYPE "public"."item_type" ADD VALUE 'avatar';--> statement-breakpoint
ALTER TYPE "public"."item_type" ADD VALUE 'growth';--> statement-breakpoint
CREATE TABLE "avatar_equips" (
	"user_id" text NOT NULL,
	"slot" "avatar_slot" NOT NULL,
	"item_id" integer NOT NULL,
	"equipped_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "avatar_equips_user_id_slot_pk" PRIMARY KEY("user_id","slot")
);
--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "avatar_slot" "avatar_slot";--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "growth_value" integer;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "is_on_sale" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_items" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "avatar_equips" ADD CONSTRAINT "avatar_equips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avatar_equips" ADD CONSTRAINT "avatar_equips_owned_fk" FOREIGN KEY ("user_id","item_id") REFERENCES "public"."user_items"("user_id","item_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_avatar_slot_check" CHECK (("items"."type"::text = 'avatar') = ("items"."avatar_slot" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_growth_type_check" CHECK (("items"."type"::text = 'growth') = ("items"."growth_value" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_growth_value_check" CHECK ("items"."growth_value" IS NULL OR "items"."growth_value" > 0);--> statement-breakpoint
ALTER TABLE "user_items" ADD CONSTRAINT "user_items_quantity_check" CHECK ("user_items"."quantity" >= 0);--> statement-breakpoint
-- SHOP-01·D12: 캐릭터와 기본 아이템은 더 팔지 않는다. 가진 사람은 그대로 쓴다 (user_items·profiles·blogs·원장은 건드리지 않음)
UPDATE "items" SET "is_on_sale" = false WHERE "is_starter" OR "type" = 'character';
