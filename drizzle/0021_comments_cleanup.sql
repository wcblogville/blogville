-- SOC-02 (2026-10-07): 답글 이전 3단계(구조). 옮긴 뒤 comments.parent_id를 지우고, 삭제한 댓글은 내용이 빈 글자(CHECK),
-- 작성자 없는(탈퇴) 댓글은 삭제 자리만 허용하는 CHECK를 더한다.
ALTER TABLE "comments" DROP CONSTRAINT "comments_parent_fk";
--> statement-breakpoint
ALTER TABLE "comments" DROP COLUMN "parent_id";--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_content_check" CHECK (("comments"."deleted_at" IS NULL AND char_length("comments"."content") BETWEEN 1 AND 1000) OR ("comments"."deleted_at" IS NOT NULL AND "comments"."content" = ''));--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_check" CHECK ("comments"."author_id" IS NOT NULL OR "comments"."deleted_at" IS NOT NULL);