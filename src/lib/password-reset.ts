// 비밀번호 찾기 규칙 (AUTH-12, 사용자 요청 2026-10-13 "로그인 창에 비밀번호 찾기 버튼 만들어줘").
// 회원 이메일은 가짜(아이디@users.blogville.invalid)라 메일로 재설정할 수 없다. 길은 둘이다.
// 1) 간편 로그인을 연동했다면: 소셜로 로그인한 직후(새 세션 10분 안)에 지금 비밀번호 없이 새 비밀번호를 정한다
// 2) 연동하지 않았다면: 관리자가 임시 비밀번호를 만들어 준다
// DB 없는 순수 함수라 서버·화면·단위 테스트에서 함께 쓴다

/** 새 비밀번호 정하기 화면 */
export const NEW_PASSWORD_PATH = "/settings/account/new-password";
/** 비밀번호 찾기 화면 */
export const FIND_PASSWORD_PATH = "/find-password";

/** 로그인한 지 이 시간 안의 세션만 지금 비밀번호 없이 새 비밀번호를 정할 수 있다 */
export const FRESH_SESSION_MS = 10 * 60_000;

/** 세션을 만든 시각(sessions.created_at)이 FRESH_SESSION_MS 안인지. 미래 시각(시계 어긋남)도 막지 않는다 */
export function isFreshSession(createdAt: Date | string | number, now: number = Date.now()): boolean {
  const t = new Date(createdAt).getTime();
  return Number.isFinite(t) && now - t <= FRESH_SESSION_MS;
}

/** 새 세션이 몇 분 더 쓸 수 있는지 (화면 안내용, 1분 단위 올림, 0 이상) */
export function freshMinutesLeft(createdAt: Date | string | number, now: number = Date.now()): number {
  const left = FRESH_SESSION_MS - (now - new Date(createdAt).getTime());
  return Math.max(0, Math.ceil(left / 60_000));
}

/** 간편 로그인 뒤 갈 수 있는 곳 (허용 목록). 다른 값은 광장(/town)으로 간다 — 열린 리다이렉트를 막는다 */
const SOCIAL_NEXT = [NEW_PASSWORD_PATH] as const;
export type SocialNext = (typeof SOCIAL_NEXT)[number];
export const isSocialNext = (v: unknown): v is SocialNext => SOCIAL_NEXT.includes(v as SocialNext);

/** 임시 비밀번호: 12자 (관리자 최소 길이 ADMIN_PASSWORD_MIN과 같아 누구에게나 맞는다) */
export const TEMP_PASSWORD_LENGTH = 12;
/** 헷갈리는 글자(0·O·o, 1·l·I, 5·S 등)를 뺀 글자들 */
export const TEMP_PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRTUVWXYZ2346789";

/** 임시 비밀번호 만들기. randomInt(n)은 0 이상 n 미만의 정수 (서버는 node:crypto randomInt를 넘긴다) */
export function makeTempPassword(randomInt: (max: number) => number): string {
  let out = "";
  for (let i = 0; i < TEMP_PASSWORD_LENGTH; i++) out += TEMP_PASSWORD_ALPHABET[randomInt(TEMP_PASSWORD_ALPHABET.length)];
  return out;
}
