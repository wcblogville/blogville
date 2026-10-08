-- GAME-04 (2026-10-07): 자동 출석, 1~7일차 보상표. 기존 출석은 cycle_day = ((streak − 1) % 7) + 1. GAME-05·FR-047: 출석 보상·공감 보상 한 번을 원장 고유 인덱스로
-- (공감 보상 고유 인덱스 point_ledger_like_received_uq는 0023에서 이미 만들었다)
-- ① 보상표
CREATE TABLE "attendance_rewards" (
	"day" integer PRIMARY KEY NOT NULL,
	"exp" integer NOT NULL,
	"coins" integer NOT NULL,
	CONSTRAINT "attendance_rewards_day_check" CHECK ("attendance_rewards"."day" BETWEEN 1 AND 7),
	CONSTRAINT "attendance_rewards_exp_check" CHECK ("attendance_rewards"."exp" >= 0),
	CONSTRAINT "attendance_rewards_coins_check" CHECK ("attendance_rewards"."coins" >= 0),
	CONSTRAINT "attendance_rewards_nonzero_check" CHECK ("attendance_rewards"."exp" > 0 OR "attendance_rewards"."coins" > 0)
);
--> statement-breakpoint
INSERT INTO "attendance_rewards" ("day", "exp", "coins") VALUES
	(1, 10, 10), (2, 10, 20), (3, 15, 30), (4, 15, 40), (5, 20, 50), (6, 20, 70), (7, 30, 100);--> statement-breakpoint
-- ② 새 컬럼 (cycle_day는 이전 뒤에 NOT NULL)
ALTER TABLE "attendances" ADD COLUMN "cycle_day" integer;--> statement-breakpoint
ALTER TABLE "attendances" ADD COLUMN "session_id" text;--> statement-breakpoint
ALTER TABLE "attendances" ADD COLUMN "checked_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
-- ③ 이전: 일차, 출석 시각(같은 날 출석 보상 원장의 가장 이른 시각, 없으면 그날 한국 0시). 옛 출석은 버튼이라 세션 없음
UPDATE "attendances" a SET
	"cycle_day" = ((a."streak" - 1) % 7) + 1,
	"checked_at" = COALESCE(
		(SELECT MIN(l."created_at") FROM "point_ledger" l
			WHERE l."user_id" = a."user_id" AND l."reason" = 'attendance' AND l."ref_id" = a."date"::text),
		a."date"::timestamp AT TIME ZONE 'Asia/Seoul'
	);--> statement-breakpoint
-- ④ 제약
ALTER TABLE "attendances" ALTER COLUMN "cycle_day" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_cycle_day_check" CHECK ("attendances"."cycle_day" BETWEEN 1 AND 7);--> statement-breakpoint
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_cycle_day_attendance_rewards_day_fk" FOREIGN KEY ("cycle_day") REFERENCES "public"."attendance_rewards"("day") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- ⑤ 옛 연속 일수 삭제
ALTER TABLE "attendances" DROP CONSTRAINT "attendances_streak_check";--> statement-breakpoint
ALTER TABLE "attendances" DROP COLUMN "streak";--> statement-breakpoint
-- ⑥ 인덱스
CREATE INDEX "attendances_session_idx" ON "attendances" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "point_ledger_attendance_uq" ON "point_ledger" USING btree ("user_id","ref_id") WHERE "point_ledger"."reason" = 'attendance';
