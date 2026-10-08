-- SOC-02 (2026-10-07): 답글을 replies 표로 나누는 1단계(구조). replies를 만들고, comments.content CHECK를 잠시 지우고(삭제한 댓글 내용을 비우기 위해),
-- comments.author_id를 NULL 허용 + ON DELETE SET NULL로 바꾼다(탈퇴 회원 댓글에 남의 답글이 있으면 자리로 남김). parent_id는 0020 이전 뒤 0021에서 지운다.
CREATE TABLE "replies" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "replies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"comment_id" integer NOT NULL,
	"author_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "replies_content_check" CHECK (("replies"."deleted_at" IS NULL AND char_length("replies"."content") BETWEEN 1 AND 1000) OR ("replies"."deleted_at" IS NOT NULL AND "replies"."content" = ''))
);
--> statement-breakpoint
ALTER TABLE "comments" DROP CONSTRAINT "comments_content_check";--> statement-breakpoint
ALTER TABLE "comments" DROP CONSTRAINT "comments_author_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "comments" ALTER COLUMN "author_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "replies" ADD CONSTRAINT "replies_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replies" ADD CONSTRAINT "replies_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "replies_comment_created_idx" ON "replies" USING btree ("comment_id","created_at");--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;