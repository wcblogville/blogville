import "server-only";

/** PostgreSQL 오류 코드 (드라이버 오류가 cause 안에 감싸져 올 수 있다) */
function pgError(err: unknown): { code?: string; constraint?: string } | undefined {
  let cur: unknown = err;
  for (let i = 0; i < 3 && cur && typeof cur === "object"; i++) {
    const e = cur as { code?: unknown; constraint?: string; cause?: unknown };
    if (typeof e.code === "string" && /^[0-9A-Z]{5}$/.test(e.code)) return { code: e.code, constraint: e.constraint };
    cur = e.cause;
  }
  return undefined;
}

/** UNIQUE 제약 위반이면 위반한 제약 이름을, 아니면 null */
export function uniqueViolation(err: unknown): string | null {
  const e = pgError(err);
  return e?.code === "23505" ? (e.constraint ?? "") : null;
}

/** 외래 키 위반(23503)인지. 대상 행이 그 순간 지워진 경우를 가린다 */
export function foreignKeyViolation(err: unknown): boolean {
  return pgError(err)?.code === "23503";
}
