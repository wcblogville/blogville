-- AUTH-01 (2026-10-08): 가입 미완료 회원 정리 (FR-007, research R15, data-model 4장 A1)
-- 가입이 한 트랜잭션(회원·로그인 수단·프로필·블로그…)으로 바뀌어 "가입했지만 프로필이 없는 회원"(예전 온보딩 전) 상태가 없어진다.
-- 남아 있는 그런 회원을 지운다. 세션·로그인 수단은 FK ON DELETE CASCADE로 함께 지워진다.
-- 이런 회원은 글·댓글·원장·첨부를 가질 수 없다 (모든 회원 기능이 프로필을 확인한다). 여러 번 실행해도 안전하다.
DELETE FROM "users" u
WHERE NOT EXISTS (SELECT 1 FROM "profiles" p WHERE p."user_id" = u."id");
