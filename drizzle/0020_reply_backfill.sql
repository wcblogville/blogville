-- SOC-02 (2026-10-07): 답글 이전 2단계(데이터). comments.parent_id가 있는 행을 replies로 옮긴다 (data-model 6.2).
-- 여러 번 실행해도 안전하다 (ON CONFLICT DO NOTHING, 두 번째 실행에서 UPDATE·DELETE는 0행). point_ledger는 건드리지 않는다.
--
-- 이전 전 확인 (직접 실행해 PR에 적는다)
--   답글 수 A:            SELECT count(*) FROM comments WHERE parent_id IS NOT NULL;
--   깊이 2 이상 답글 수:  SELECT count(*) FROM comments c JOIN comments p ON p.id = c.parent_id WHERE p.parent_id IS NOT NULL;
--   다른 글 부모 답글 수: SELECT count(*) FROM comments c JOIN comments p ON p.id = c.parent_id WHERE p.post_id <> c.post_id;

-- 1) 각 답글의 원댓글(parent_id가 NULL인 첫 조상)을 찾아 옮긴다. 원댓글의 글이 다르면 옮기지 않는다
INSERT INTO "replies" ("id", "comment_id", "author_id", "content", "created_at", "deleted_at") OVERRIDING SYSTEM VALUE
WITH RECURSIVE chain AS (
  SELECT c.id AS reply_id, c.parent_id AS ancestor_id
  FROM "comments" c
  WHERE c.parent_id IS NOT NULL
  UNION ALL
  SELECT chain.reply_id, p.parent_id
  FROM chain
  JOIN "comments" p ON p.id = chain.ancestor_id
  WHERE p.parent_id IS NOT NULL
),
root AS (
  SELECT chain.reply_id, chain.ancestor_id AS root_id
  FROM chain
  JOIN "comments" a ON a.id = chain.ancestor_id
  WHERE a.parent_id IS NULL
)
SELECT r.id, root.root_id, r.author_id,
       CASE WHEN r.deleted_at IS NOT NULL THEN '' ELSE r.content END,
       r.created_at, r.deleted_at
FROM "comments" r
JOIN root ON root.reply_id = r.id
JOIN "comments" top ON top.id = root.root_id
WHERE top.post_id = r.post_id
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
-- 2) replies.id의 다음 값을 MAX(id) + 1로 (옮긴 행이 없으면 1부터)
SELECT setval(pg_get_serial_sequence('replies', 'id'), COALESCE((SELECT MAX("id") FROM "replies"), 0) + 1, false);
--> statement-breakpoint
-- 3) 옮기지 않은 답글(원댓글이 다른 글)은 일반 댓글로 만든다
UPDATE "comments" SET "parent_id" = NULL
WHERE "parent_id" IS NOT NULL AND "id" NOT IN (SELECT "id" FROM "replies");
--> statement-breakpoint
-- 4) 옮긴 행을 comments에서 지운다 (남은 parent_id 행은 모두 옮긴 행이라 CASCADE가 다른 행을 지우지 않는다)
DELETE FROM "comments" WHERE "id" IN (SELECT "id" FROM "replies");
--> statement-breakpoint
-- 5) 삭제한 댓글의 내용을 비운다 (원래 내용은 DB에도 남기지 않는다, FR-014)
UPDATE "comments" SET "content" = '' WHERE "deleted_at" IS NOT NULL AND "content" <> '';

-- 이전 후 확인
--   SELECT count(*) FROM replies;                                              -- = A (옮기지 않은 행 빼고)
--   SELECT count(*) FROM comments WHERE parent_id IS NOT NULL;                  -- 0
--   SELECT count(*) FROM comments WHERE deleted_at IS NOT NULL AND content <> ''; -- 0
--   SELECT count(*) FROM replies WHERE deleted_at IS NOT NULL AND content <> '';  -- 0
