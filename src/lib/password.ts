// 비밀번호 규칙: 회원가입(AUTH-07)과 회원정보 수정의 비밀번호 변경이 같은 숫자·문구를 쓴다.
// 라이브러리 설정(src/lib/auth.ts emailAndPassword)도 이 숫자를 쓴다. 관리자는 12자 이상 (scripts/create-admin.ts)
import { z } from "zod";

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 64;
export const ADMIN_PASSWORD_MIN = 12;

export const PASSWORD_ERRORS = {
  short: `비밀번호는 ${PASSWORD_MIN}자 이상이에요`,
  long: `비밀번호는 ${PASSWORD_MAX}자까지예요`,
  mismatch: "비밀번호가 서로 달라요",
  adminShort: `관리자 비밀번호는 ${ADMIN_PASSWORD_MIN}자 이상이에요`,
} as const;

/** 새 비밀번호 칸 (가입·비밀번호 변경 공용) */
export const passwordField = z.string().min(PASSWORD_MIN, PASSWORD_ERRORS.short).max(PASSWORD_MAX, PASSWORD_ERRORS.long);
