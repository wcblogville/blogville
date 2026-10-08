-- POST-07·POST-09 (FR-047, data-model 7.1, research R18): 기존 첨부를 글에 잇는 데이터 이전.
-- 붙지 않은 첨부마다, 올린 회원의 블로그 글 중 본문에 '/files/키'가 든 가장 먼저 쓴 글에 붙인다. 없으면 NULL(정리 대상) 그대로.
-- post_id IS NULL 행만 고치므로 다시 돌려도 결과가 같다. NULL→값이라 트리거는 detached_at을 NULL로 둔다
UPDATE attachments a
SET post_id = (
  SELECT p.id FROM posts p JOIN blogs b ON b.id = p.blog_id
  WHERE b.owner_id = a.user_id AND position('/files/' || a.key IN p.content_html) > 0
  ORDER BY p.created_at, p.id
  LIMIT 1
)
WHERE a.post_id IS NULL;
