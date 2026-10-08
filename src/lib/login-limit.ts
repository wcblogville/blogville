// 로그인 시도 제한 규칙 (AUTH-09 / FR-025~FR-027, data-model 2.4, research R8)
// 같은 아이디로 5번 연속 실패하면 5분 동안 아이디·비밀번호 로그인을 막는다. 없는 아이디도 같다.
// 시도는 비밀번호를 확인하기 "전에" 실패로 미리 센다(예약). 성공하면 행을 지워 초기화한다.
// DB를 모르는 순수 함수라 scripts/test-auth.ts가 바로 시험한다. 숫자는 DB CHECK가 아니라 여기에만 둔다.

/** 연속 실패 몇 번째에 잠그는지 */
export const LOGIN_MAX_FAILURES = 5;
/** 잠금 시간 (밀리초) */
export const LOGIN_LOCK_MS = 5 * 60 * 1000;

export const LOGIN_LOCKED_MESSAGE = "로그인을 너무 많이 시도했어요. 5분 뒤에 다시 시도해 주세요";

/** login_attempts 한 행 (행이 없으면 null) */
export type LoginAttemptState = { failedCount: number; lockedUntil: Date | null };

export type ReserveResult =
  /** 잠금 중: 행을 바꾸지 않고 비밀번호도 확인하지 않는다 */
  | { allowed: false }
  /** 이번 시도를 실패로 미리 센 다음 상태. 비밀번호 확인으로 넘어간다 */
  | { allowed: true; next: LoginAttemptState };

export function isLocked(state: LoginAttemptState | null, now: Date): boolean {
  return state?.lockedUntil != null && state.lockedUntil.getTime() > now.getTime();
}

/**
 * 시도 예약 계산 (data-model 2.4 상태 전이).
 * (행 없음) → n=1, n=1~3 → n+1, n=4 → 잠금(now+5분, n=0), 잠금 중 → 거부·그대로, 풀린 뒤 → n=1·잠금 없음
 */
export function reserveAttempt(state: LoginAttemptState | null, now: Date): ReserveResult {
  if (isLocked(state, now)) return { allowed: false };
  // 잠금이 풀린 뒤(locked_until ≤ now)에는 1부터 다시 센다
  const prev = state && state.lockedUntil === null ? state.failedCount : 0;
  const count = prev + 1;
  if (count >= LOGIN_MAX_FAILURES) {
    return { allowed: true, next: { failedCount: 0, lockedUntil: new Date(now.getTime() + LOGIN_LOCK_MS) } };
  }
  return { allowed: true, next: { failedCount: count, lockedUntil: null } };
}
