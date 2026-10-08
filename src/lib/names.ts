// 아이디·블로그 주소·닉네임 공용 규칙 (AUTH-01 / FR-002, FR-009, FR-010)
// DB를 쓰지 않는 순수 함수만 둔다: 화면·서버·테스트 어디서나 import 할 수 있다.
// 모듈은 auth 담당, 예약어 값(RESERVED_NAMES)은 blog FR-009가 정한다.

/** 회원 아이디로도, 블로그 주소로도 쓸 수 없는 이름 (라우트 이름과 겹치거나 오해를 부르는 것) */
export const RESERVED_NAMES: ReadonlySet<string> = new Set([
  "admin",
  "api",
  "town",
  "feed",
  "shop",
  "closet",
  "write",
  "settings",
  "blog",
  "onboarding",
  "farm",
  "attendance",
  "tags",
  "wallet",
  "files",
  "notice",
]);

/** 아이디 형식: 영문 소문자·숫자·_ 4~20자 (DB CHECK users_username_check와 같다) */
export const USERNAME_RE = /^[a-z0-9_]{4,20}$/;

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 20;

/** 앞뒤 공백을 지우고 소문자로 바꾼다. 아이디는 이 값으로 저장·비교한다 */
export function normalizeName(raw: string): string {
  return raw.trim().toLowerCase();
}

/** 예약어인지 (대소문자·앞뒤 공백 무시) */
export function isReservedName(name: string): boolean {
  return RESERVED_NAMES.has(normalizeName(name));
}

/** 정규화한 아이디가 형식에 맞는지 */
export function isValidUsername(name: string): boolean {
  return USERNAME_RE.test(name);
}

/** 닉네임 길이 2~20자 (DB CHECK profiles_nickname_check의 char_length와 같게 글자(코드 포인트) 단위, 앞뒤 공백 제외) */
export function isValidNicknameLength(nickname: string): boolean {
  const n = Array.from(nickname.trim()).length;
  return n >= NICKNAME_MIN && n <= NICKNAME_MAX;
}
