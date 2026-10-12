ALTER TABLE "post_tags" ADD COLUMN "position" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
-- 이미 있는 글은 지금까지 보이던 순서(태그 이름 가나다 순)를 그대로 순서로 적는다
UPDATE "post_tags" SET "position" = o."rn"
FROM (
  SELECT pt."post_id", pt."tag_id", (ROW_NUMBER() OVER (PARTITION BY pt."post_id" ORDER BY t."name") - 1)::smallint AS "rn"
  FROM "post_tags" pt JOIN "tags" t ON t."id" = pt."tag_id"
) o
WHERE "post_tags"."post_id" = o."post_id" AND "post_tags"."tag_id" = o."tag_id";
