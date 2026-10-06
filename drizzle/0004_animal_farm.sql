CREATE TYPE "public"."animal_status" AS ENUM('egg', 'growing', 'grown');--> statement-breakpoint
CREATE TYPE "public"."care_action" AS ENUM('feed', 'water', 'pet');--> statement-breakpoint
CREATE TYPE "public"."egg_source" AS ENUM('starter', 'level', 'shop');--> statement-breakpoint
ALTER TYPE "public"."ledger_reason" ADD VALUE 'farm_care';--> statement-breakpoint
ALTER TYPE "public"."ledger_reason" ADD VALUE 'farm_grown';--> statement-breakpoint
ALTER TYPE "public"."ledger_reason" ADD VALUE 'egg_purchase';--> statement-breakpoint
CREATE TABLE "animal_cares" (
	"animal_id" integer NOT NULL,
	"action" "care_action" NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "animal_cares_animal_id_action_date_pk" PRIMARY KEY("animal_id","action","date")
);
--> statement-breakpoint
CREATE TABLE "animal_species" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "animal_species_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"asset_key" text NOT NULL,
	"grow_exp" integer NOT NULL,
	"reward_exp" integer NOT NULL,
	"reward_coins" integer NOT NULL,
	"hatch_weight" integer NOT NULL,
	CONSTRAINT "animal_species_code_unique" UNIQUE("code"),
	CONSTRAINT "animal_species_grow_check" CHECK ("animal_species"."grow_exp" > 0),
	CONSTRAINT "animal_species_reward_check" CHECK ("animal_species"."reward_exp" >= 0 AND "animal_species"."reward_coins" >= 0),
	CONSTRAINT "animal_species_weight_check" CHECK ("animal_species"."hatch_weight" > 0)
);
--> statement-breakpoint
CREATE TABLE "user_animals" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_animals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"species_id" integer,
	"status" "animal_status" DEFAULT 'egg' NOT NULL,
	"growth" integer DEFAULT 0 NOT NULL,
	"source" "egg_source" NOT NULL,
	"source_level" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hatched_at" timestamp with time zone,
	"grown_at" timestamp with time zone,
	CONSTRAINT "user_animals_species_check" CHECK (("user_animals"."status" = 'egg') = ("user_animals"."species_id" IS NULL)),
	CONSTRAINT "user_animals_growth_check" CHECK ("user_animals"."growth" >= 0),
	CONSTRAINT "user_animals_level_check" CHECK (("user_animals"."source" = 'level') = ("user_animals"."source_level" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "animal_cares" ADD CONSTRAINT "animal_cares_animal_id_user_animals_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."user_animals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_animals" ADD CONSTRAINT "user_animals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_animals" ADD CONSTRAINT "user_animals_species_id_animal_species_id_fk" FOREIGN KEY ("species_id") REFERENCES "public"."animal_species"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_animals_starter_uq" ON "user_animals" USING btree ("user_id") WHERE "user_animals"."source" = 'starter';--> statement-breakpoint
CREATE UNIQUE INDEX "user_animals_level_uq" ON "user_animals" USING btree ("user_id","source_level") WHERE "user_animals"."source" = 'level';--> statement-breakpoint
CREATE INDEX "user_animals_user_status_idx" ON "user_animals" USING btree ("user_id","status");