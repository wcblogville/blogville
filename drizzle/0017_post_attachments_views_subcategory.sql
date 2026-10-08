-- POST-07·POST-09 (FR-047, FR-059): 첨부를 글에 잇는다. post_id(글이 지워지면 NULL)와 떨어진 시각 detached_at(트리거가 기록)
-- POST-06 (FR-046): 조회 기록 post_views. 같은 브라우저는 글마다 하루 1줄
-- POST-03 (FR-030): 글의 소분류 subcategory_id. 복합 FK의 ON DELETE는 drizzle이 못 적는 SET NULL ("subcategory_id")로 손으로 고쳤다 (research R5, PostgreSQL 15 이상)
CREATE TABLE "post_views" (
	"post_id" integer NOT NULL,
	"date" date NOT NULL,
	"visitor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_views_post_id_date_visitor_id_pk" PRIMARY KEY("post_id","date","visitor_id")
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "post_id" integer;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "detached_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "subcategory_id" integer;--> statement-breakpoint
ALTER TABLE "post_views" ADD CONSTRAINT "post_views_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_subcategory_fk" FOREIGN KEY ("category_id","subcategory_id") REFERENCES "public"."subcategories"("category_id","id") ON DELETE SET NULL ("subcategory_id") ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachments_post_idx" ON "attachments" USING btree ("post_id");--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_subcategory_check" CHECK ("posts"."subcategory_id" IS NULL OR "posts"."category_id" IS NOT NULL);
--> statement-breakpoint
-- 첨부가 글에서 떨어지면(값→NULL) 그 시각을, 다시 붙으면(NULL→값) NULL을 적는다 (research R7). 글 삭제의 SET NULL도 여기를 지난다
CREATE FUNCTION attachments_track_detached() RETURNS trigger AS $$
BEGIN
  IF OLD.post_id IS NOT NULL AND NEW.post_id IS NULL THEN
    NEW.detached_at := now();
  ELSIF NEW.post_id IS NOT NULL AND NEW.post_id IS DISTINCT FROM OLD.post_id THEN
    NEW.detached_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER attachments_track_detached BEFORE UPDATE OF post_id ON attachments
  FOR EACH ROW EXECUTE FUNCTION attachments_track_detached();
--> statement-breakpoint
-- 대분류가 비면(대분류 삭제 SET NULL, 회원 삭제 등 어느 경로든) 소분류도 함께 비운다. CHECK posts_subcategory_check를 지킨다 (research R4)
CREATE FUNCTION posts_clear_subcategory() RETURNS trigger AS $$
BEGIN
  IF NEW.category_id IS NULL THEN
    NEW.subcategory_id := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER posts_clear_subcategory BEFORE UPDATE OF category_id ON posts
  FOR EACH ROW EXECUTE FUNCTION posts_clear_subcategory();
