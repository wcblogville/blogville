-- 관리자 테스트 지급 (AUTH-10, 사용자 요청 2026-10-11): 원장 사유 admin_grant.
-- 이 마이그레이션은 값을 더하기만 하고 쓰지 않는다 (같은 트랜잭션에서 새 enum 값을 쓰면 PostgreSQL이 막는다)
ALTER TYPE "public"."ledger_reason" ADD VALUE 'admin_grant';