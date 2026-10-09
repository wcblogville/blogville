-- 광장 꾸미기 (사용자 요청 2026-10-09): 광장 장식 아이템 종류와 내 광장의 자리별 장식
ALTER TYPE "public"."item_type" ADD VALUE 'deco';--> statement-breakpoint
CREATE TABLE "town_decorations" (
	"user_id" text NOT NULL,
	"slot" integer NOT NULL,
	"item_id" integer NOT NULL,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "town_decorations_user_id_slot_pk" PRIMARY KEY("user_id","slot"),
	CONSTRAINT "town_decorations_item_uq" UNIQUE("user_id","item_id"),
	CONSTRAINT "town_decorations_slot_check" CHECK ("town_decorations"."slot" BETWEEN 0 AND 7)
);
--> statement-breakpoint
ALTER TABLE "town_decorations" ADD CONSTRAINT "town_decorations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "town_decorations" ADD CONSTRAINT "town_decorations_owned_fk" FOREIGN KEY ("user_id","item_id") REFERENCES "public"."user_items"("user_id","item_id") ON DELETE cascade ON UPDATE no action;