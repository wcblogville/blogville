-- AUTH-07 (2026-10-08): 아이디 필수·닉네임 20자 (FR-002, FR-003, FR-009, data-model 4장 A2)
-- 모든 회원이 아이디를 가진다(NOT NULL), 형식은 영문 소문자·숫자·_ 4~20자 (소문자만 저장 → UNIQUE가 대소문자 무시 유일).
-- 닉네임은 가입 때 아이디 그대로라 2~12자 → 2~20자로 넓힌다.
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_nickname_check";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_nickname_check" CHECK (char_length("profiles"."nickname") BETWEEN 2 AND 20);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_check" CHECK ("users"."username" ~ '^[a-z0-9_]{4,20}$');