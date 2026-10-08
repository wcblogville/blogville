// 회원·로그인 수단 ID 만들기 (AUTH-01, AUTH-08 / FR-049)
// Better Auth가 가입 때 만드는 것과 같은 형식: 영문 대소문자·숫자 32자 (ERD: users.id VARCHAR(32))
// 가입(src/server/signup.ts)과 관리자 스크립트(scripts/create-admin.ts)가 같이 쓴다.
// 스크립트가 tsx로 바로 가져오므로 "server-only"를 import하지 않는다.
import { generateRandomString } from "better-auth/crypto";

export const AUTH_ID_LENGTH = 32;

export function newAuthId(): string {
  return generateRandomString(AUTH_ID_LENGTH, "a-z", "A-Z", "0-9");
}
