/** PostgreSQL integer(serial) 컬럼의 최댓값. 글·댓글·카테고리 ID, 페이지 번호의 상한 */
export const MAX_DB_INT = 2_147_483_647;

/**
 * 주소나 요청으로 받은 값을 DB 정수 ID(1 ~ 2147483647)로 바꾼다. 아니면 null.
 * 문자열은 숫자만 적힌 것만 받는다 ("1.5", "1e3", "Infinity", "-1", 범위 밖은 null).
 * DB에 범위 밖 값을 넘기면 쿼리 오류(500)가 나므로, 주소·Server Action 인자는 먼저 여기를 거친다 (#21)
 */
export function parseId(value: unknown): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw === "number") return Number.isInteger(raw) && raw >= 1 && raw <= MAX_DB_INT ? raw : null;
  if (typeof raw !== "string" || !/^[1-9][0-9]{0,9}$/.test(raw)) return null;
  const n = Number(raw);
  return n <= MAX_DB_INT ? n : null;
}
