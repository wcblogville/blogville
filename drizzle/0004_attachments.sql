-- POST-07·POST-09 (2026-10-02): 글 첨부(사진·파일) 정보. 파일 내용은 저장소에 두고 DB에는 이름·형식·크기만
CREATE TABLE "attachments" (
	"key" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attachments_kind_check" CHECK ("attachments"."kind" IN ('image', 'file')),
	CONSTRAINT "attachments_key_check" CHECK ("attachments"."key" ~ '^[a-f0-9]{32}$'),
	CONSTRAINT "attachments_name_check" CHECK (char_length("attachments"."name") BETWEEN 1 AND 255),
	CONSTRAINT "attachments_size_check" CHECK ("attachments"."size" > 0)
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachments_user_created_idx" ON "attachments" USING btree ("user_id","created_at");