-- SOC-03 (2026-10-08): 같은 사람·같은 글 공감 보상 1번을 DB로도 막는다 (game 요청 D-7, 출석의 부분 UNIQUE와 같은 방식).
-- 적용 전 중복 확인: SELECT user_id, ref_id FROM point_ledger WHERE reason = 'like_received' GROUP BY 1, 2 HAVING count(*) > 1; (0행이어야 한다)
CREATE UNIQUE INDEX "point_ledger_like_received_uq" ON "point_ledger" USING btree ("user_id","ref_id") WHERE "point_ledger"."reason" = 'like_received';