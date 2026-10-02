-- GAME-04 (2026-10-02): 그날 1~3등으로 출석하면 받는 보너스 코인의 원장 사유
ALTER TYPE "public"."ledger_reason" ADD VALUE 'attendance_rank' BEFORE 'post';