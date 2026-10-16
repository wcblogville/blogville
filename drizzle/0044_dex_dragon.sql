ALTER TYPE "public"."egg_source" ADD VALUE 'reward';--> statement-breakpoint
ALTER TABLE "animal_species" DROP CONSTRAINT "animal_species_obtainable_check";--> statement-breakpoint
ALTER TABLE "animal_species" ADD COLUMN "reward_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "animal_species" ADD CONSTRAINT "animal_species_obtainable_check" CHECK ("animal_species"."hatch_weight" > 0 OR "animal_species"."price" IS NOT NULL OR "animal_species"."reward_only");