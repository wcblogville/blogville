-- AUTH-09 (2026-10-08): 로그인 유지·시도 제한 (FR-019~FR-021, FR-025, data-model 4장 A4)
-- sessions.remember_me: [로그인 상태 유지] 여부. 기존 세션은 false → 다음 요청부터 마지막 사용 2시간 규칙을 따른다.
-- login_attempts: 아이디별 연속 실패 수·잠금 해제 시각. 없는 아이디도 기록하므로 users FK가 없다 (빈 표로 시작).
CREATE TABLE "login_attempts" (
	"username" text PRIMARY KEY NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "login_attempts_username_check" CHECK (char_length("login_attempts"."username") BETWEEN 1 AND 64),
	CONSTRAINT "login_attempts_failed_count_check" CHECK ("login_attempts"."failed_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "remember_me" boolean DEFAULT false NOT NULL;