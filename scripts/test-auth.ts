// 회원/인증 규칙 테스트 (AUTH-01, AUTH-07, AUTH-09 / FR-002, FR-009, FR-010, FR-025, FR-026)
// 실행: npm run test:auth
// 요구사항: AUTH-03 이름 겹침
import { randomInt } from "node:crypto";
import { isLocked, LOGIN_LOCK_MS, LOGIN_MAX_FAILURES, reserveAttempt, type LoginAttemptState } from "../src/lib/login-limit";
import { isReservedName, isValidNicknameLength, isValidUsername, normalizeName, RESERVED_NAMES, USERNAME_RE } from "../src/lib/names";
import { ADMIN_PASSWORD_MIN } from "../src/lib/password";
import {
  FRESH_SESSION_MS,
  freshMinutesLeft,
  isFreshSession,
  isSocialNext,
  makeTempPassword,
  NEW_PASSWORD_PATH,
  TEMP_PASSWORD_ALPHABET,
  TEMP_PASSWORD_LENGTH,
} from "../src/lib/password-reset";

let failed = 0;
function expect(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "✅" : "❌"} ${name}: ${JSON.stringify(got)}${ok ? "" : ` (기대: ${JSON.stringify(want)})`}`);
}

// FR-002 아이디 정규화·형식
const username = (raw: string) => {
  const n = normalizeName(raw);
  return isValidUsername(n) ? n : null;
};
expect('" Tester_1 " → tester_1', username(" Tester_1 "), "tester_1");
expect("TESTER → tester", username("TESTER"), "tester");
expect("한글 거부", username("테스터1234"), null);
expect("특수문자 거부", username("test-1"), null);
expect("가운데 공백 거부", username("te st"), null);
expect("3자 거부", username("abc"), null);
expect("4자 통과", username("abcd"), "abcd");
expect("20자 통과", username("a".repeat(20)), "a".repeat(20));
expect("21자 거부", username("a".repeat(21)), null);
expect("빈 값 거부", username("   "), null);
expect("USERNAME_RE는 DB CHECK와 같은 식", USERNAME_RE.source, "^[a-z0-9_]{4,20}$");

// FR-010 예약어 16개 (blog FR-009) + 나중에 생긴 화면 3개
expect("예약어 21개", RESERVED_NAMES.size, 21);
for (const name of ["admin", "Admin", " ADMIN ", "settings", "notice", "onboarding", "api", "town", "wallet", "files", "tags", "attendance"]) {
  expect(`${JSON.stringify(name)}는 예약어`, isReservedName(name), true);
}
expect("tester1은 예약어 아님", isReservedName("tester1"), false);
expect("admin1은 예약어 아님", isReservedName("admin1"), false);

// FR-009 닉네임 길이 2~20
expect("닉네임 1자 거부", isValidNicknameLength("가"), false);
expect("닉네임 2자 통과", isValidNicknameLength("가나"), true);
expect("닉네임 20자 통과", isValidNicknameLength("가".repeat(20)), true);
expect("닉네임 21자 거부", isValidNicknameLength("가".repeat(21)), false);
expect("닉네임 앞뒤 공백은 세지 않음", isValidNicknameLength("  가  "), false);
expect("아이디 4~20자는 닉네임으로 늘 통과", [4, 20].map((n) => isValidNicknameLength("a".repeat(n))), [true, true]);

// FR-025, FR-026 로그인 시도 제한 예약 계산 (data-model 2.4 상태 전이)
expect("규칙 숫자 5번·5분", [LOGIN_MAX_FAILURES, LOGIN_LOCK_MS], [5, 300_000]);
{
  const t0 = new Date("2026-10-08T00:00:00Z");
  const at = (ms: number) => new Date(t0.getTime() + ms);
  // 행 없음에서 4번 시도: 1, 2, 3, 4 (잠금 아님)
  let state: LoginAttemptState | null = null;
  const counts: number[] = [];
  for (let i = 0; i < 4; i++) {
    const r = reserveAttempt(state, t0);
    if (!r.allowed) break;
    state = r.next;
    counts.push(r.next.failedCount);
  }
  expect("1~4번째 시도: 1,2,3,4 잠금 아님", { counts, locked: isLocked(state, t0) }, { counts: [1, 2, 3, 4], locked: false });

  // 5번째 시도 예약 → 허용(비밀번호는 확인), 다음 상태는 5분 잠금·n=0
  const fifth = reserveAttempt(state, t0);
  expect("5번째 시도는 확인으로 넘어감", fifth.allowed, true);
  const locked = fifth.allowed ? fifth.next : null;
  expect("5번째 시도 예약 → n=0, 5분 잠금", locked && { n: locked.failedCount, until: locked.lockedUntil?.toISOString() }, {
    n: 0,
    until: at(LOGIN_LOCK_MS).toISOString(),
  });

  // 잠금 중 시도 → 거부 (상태 변화 없음: 거부 결과에는 다음 상태가 없다)
  expect("잠금 중 시도(바로) → 거부", reserveAttempt(locked, at(1)), { allowed: false });
  expect("잠금 중 시도(4분 59초) → 거부", reserveAttempt(locked, at(LOGIN_LOCK_MS - 1000)), { allowed: false });
  expect("잠금 중 isLocked", isLocked(locked, at(LOGIN_LOCK_MS - 1)), true);

  // 잠금이 풀린 뒤(locked_until ≤ now) 시도 → n=1, 잠금 없음
  expect("잠금이 풀린 시각 정각 → n=1", reserveAttempt(locked, at(LOGIN_LOCK_MS)), { allowed: true, next: { failedCount: 1, lockedUntil: null } });
  expect("잠금이 풀린 뒤 → n=1", reserveAttempt(locked, at(LOGIN_LOCK_MS + 60_000)), { allowed: true, next: { failedCount: 1, lockedUntil: null } });

  // 성공 → 행 삭제(= 행 없음)이므로 다음 시도는 다시 1부터. 3번 실패 → 성공 → 4번 실패도 잠기지 않음 (US6 #3)
  let s2: LoginAttemptState | null = null;
  for (let i = 0; i < 3; i++) {
    const r = reserveAttempt(s2, t0);
    s2 = r.allowed ? r.next : s2;
  }
  s2 = null; // 성공: clearLoginAttempts가 행을 지운다
  for (let i = 0; i < 4; i++) {
    const r = reserveAttempt(s2, t0);
    s2 = r.allowed ? r.next : s2;
  }
  expect("성공 → 초기화: 3번 실패·성공·4번 실패 뒤 n=4, 잠금 아님", { n: s2?.failedCount, locked: isLocked(s2, t0) }, { n: 4, locked: false });
}

// AUTH-12 비밀번호 찾기: 새 세션 10분, 소셜 뒤 갈 곳 허용 목록, 임시 비밀번호
{
  const now = Date.parse("2026-10-13T12:00:00Z");
  expect("새 세션 10분은 10 * 60초", FRESH_SESSION_MS, 600_000);
  expect("방금 만든 세션 → 새 세션", isFreshSession(new Date(now - 1000), now), true);
  expect("정확히 10분 → 새 세션", isFreshSession(new Date(now - FRESH_SESSION_MS), now), true);
  expect("10분 1초 → 오래된 세션", isFreshSession(new Date(now - FRESH_SESSION_MS - 1000), now), false);
  expect("문자열 시각도 읽는다", isFreshSession(new Date(now - 60_000).toISOString(), now), true);
  expect("이상한 시각 → 오래된 세션", isFreshSession("not a date", now), false);
  expect("남은 분: 3분 지남 → 7분", freshMinutesLeft(new Date(now - 3 * 60_000), now), 7);
  expect("남은 분: 지났으면 0", freshMinutesLeft(new Date(now - 11 * 60_000), now), 0);
  expect("새 비밀번호 화면은 갈 수 있는 곳", isSocialNext(NEW_PASSWORD_PATH), true);
  for (const bad of ["/town", "https://evil.example/settings/account/new-password", "//evil.example", "/settings/account/new-password?x=1", undefined, ""]) {
    expect(`${JSON.stringify(bad)}는 갈 수 없는 곳`, isSocialNext(bad), false);
  }
  expect("임시 비밀번호는 관리자 최소 길이 이상", TEMP_PASSWORD_LENGTH >= ADMIN_PASSWORD_MIN, true);
  expect("헷갈리는 글자 없음 (0 O o 1 l I)", /[0Oo1lI]/.test(TEMP_PASSWORD_ALPHABET), false);
  expect("글자 겹침 없음", new Set(TEMP_PASSWORD_ALPHABET).size, TEMP_PASSWORD_ALPHABET.length);
  let i = 0;
  const seq = makeTempPassword(() => i++ % TEMP_PASSWORD_ALPHABET.length);
  expect("고른 자리 그대로 12자", seq, TEMP_PASSWORD_ALPHABET.slice(0, TEMP_PASSWORD_LENGTH));
  const sample = makeTempPassword((max) => randomInt(max));
  expect("무작위 임시 비밀번호 12자·허용 글자만", sample.length === TEMP_PASSWORD_LENGTH && [...sample].every((c) => TEMP_PASSWORD_ALPHABET.includes(c)), true);
}

if (failed) process.exit(1);
