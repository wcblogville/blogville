-- BLOG-04 (2026-10-07): 전시 동물 한 마리, 복합 FK로 내 동물만 (ERD 3.11)
-- ON DELETE 줄은 손질함: Drizzle 생성 값 "set null"은 FK의 모든 열(owner_id 포함)을 비우려 해 실패하므로
-- showcase_animal_id만 비우는 SET NULL ("showcase_animal_id")로 고쳤다 (research R-18, PostgreSQL 15+)
ALTER TABLE "blogs" ADD COLUMN "showcase_animal_id" integer;--> statement-breakpoint
ALTER TABLE "blogs" ADD CONSTRAINT "blogs_showcase_owned_fk" FOREIGN KEY ("owner_id","showcase_animal_id") REFERENCES "public"."user_animals"("user_id","id") ON DELETE SET NULL ("showcase_animal_id") ON UPDATE no action;
