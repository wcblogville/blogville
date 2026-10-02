-- GAME-01 결정(2026-10-02): 기본 캐릭터 3종을 모두 지급한다.
-- 이미 온보딩을 마친 회원에게 아직 없는 기본 캐릭터를 채워 준다. 여러 번 실행돼도 중복되지 않는다.
INSERT INTO "user_items" ("user_id", "item_id")
SELECT p."user_id", i."id"
FROM "profiles" p
CROSS JOIN "items" i
WHERE i."type" = 'character' AND i."is_starter" = true
ON CONFLICT ("user_id", "item_id") DO NOTHING;
