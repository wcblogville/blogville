-- GAME-06·GAME-08 (2026-10-07): 레벨업·공감·댓글·답글 알림. 레벨업은 회원·레벨마다 한 번
CREATE TYPE "public"."notification_kind" AS ENUM('level_up', 'like', 'comment', 'reply');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"actor_id" text,
	"post_id" integer,
	"level" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	CONSTRAINT "notifications_shape_check" CHECK (("notifications"."kind" = 'level_up' AND "notifications"."level" IS NOT NULL AND "notifications"."actor_id" IS NULL AND "notifications"."post_id" IS NULL) OR ("notifications"."kind" <> 'level_up' AND "notifications"."level" IS NULL AND "notifications"."actor_id" IS NOT NULL AND "notifications"."post_id" IS NOT NULL)),
	CONSTRAINT "notifications_level_check" CHECK ("notifications"."level" IS NULL OR "notifications"."level" BETWEEN 2 AND 99),
	CONSTRAINT "notifications_not_self_check" CHECK ("notifications"."actor_id" IS NULL OR "notifications"."actor_id" <> "notifications"."user_id")
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_level_up_uq" ON "notifications" USING btree ("user_id","level") WHERE "notifications"."kind" = 'level_up';--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("user_id") WHERE "notifications"."read_at" IS NULL;--> statement-breakpoint
CREATE INDEX "notifications_post_idx" ON "notifications" USING btree ("post_id") WHERE "notifications"."post_id" IS NOT NULL;