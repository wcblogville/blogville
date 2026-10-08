-- 연못 낚시터 (사용자 요청 2026-10-08): 하루 한 번 낚시, 원장 사유 fishing
ALTER TYPE "public"."ledger_reason" ADD VALUE 'fishing';--> statement-breakpoint
CREATE TABLE "fishing_catches" (
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"catch_key" text NOT NULL,
	"coins" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fishing_catches_user_id_date_pk" PRIMARY KEY("user_id","date"),
	CONSTRAINT "fishing_catches_coins_check" CHECK ("fishing_catches"."coins" >= 0)
);
--> statement-breakpoint
ALTER TABLE "fishing_catches" ADD CONSTRAINT "fishing_catches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;