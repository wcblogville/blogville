-- AUTH-01 (2026-10-08): 소셜 토큰 비우기 (FR-035, research R9, data-model 4장 A5)
-- 우리 서비스는 소셜 API를 부르지 않으므로 소셜 로그인 수단 행에 토큰을 두지 않는다.
-- 남기는 것: provider_id, account_id(서비스 쪽 계정 식별자), created_at(연동한 날짜).
-- 새로 생기는 행은 src/lib/auth.ts의 databaseHooks.account가 비운다. 이 SQL은 예전에 저장된 값을 지운다.
-- 아이디 로그인(credential) 행은 건드리지 않는다. 여러 번 실행해도 안전하다 (이미 NULL이면 바뀌는 행이 없다).
UPDATE "accounts"
SET "access_token" = NULL,
    "refresh_token" = NULL,
    "id_token" = NULL,
    "access_token_expires_at" = NULL,
    "refresh_token_expires_at" = NULL,
    "scope" = NULL
WHERE "provider_id" <> 'credential'
  AND ("access_token" IS NOT NULL OR "refresh_token" IS NOT NULL OR "id_token" IS NOT NULL
       OR "access_token_expires_at" IS NOT NULL OR "refresh_token_expires_at" IS NOT NULL OR "scope" IS NOT NULL);
