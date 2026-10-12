"use server";

// 회원정보 수정: 비밀번호 변경 (AUTH-11, 사용자 요청 2026-10-12 "비밀번호 변경이라던가 정보 수정하게")
// 대상은 늘 로그인한 나(requireMember)다. 라이브러리 HTTP /change-password는 닫혀 있고 서버에서 auth.api.changePassword를 부른다.
// 바꾸면 다른 기기의 로그인(세션 행)은 모두 지우고, 이 브라우저의 세션은 그대로 둔다 ([로그인 상태 유지]도 그대로).
// 라이브러리의 revokeOtherSessions는 지금 세션까지 새로 만들어 쿠키를 바꾸는데, 그러면 Server Action 뒤 화면을 다시 그릴 때
// 요청 헤더의 옛 쿠키로 세션을 찾다가 로그아웃으로 보인다. 그래서 다른 세션 지우기는 우리가 한다.
import { APIError } from "better-auth/api";
import { and, eq, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { ADMIN_PASSWORD_MIN, PASSWORD_ERRORS, PASSWORD_MAX, passwordField } from "@/lib/password";
import { requireMember } from "@/server/dal";

export type PasswordFormState = { error?: string; ok?: number };

const PASSWORD_CHANGE_ERRORS = {
  current: "지금 비밀번호를 적어 주세요",
  wrong: "지금 비밀번호가 맞지 않아요",
  same: "지금과 다른 비밀번호를 적어 주세요",
  failed: "비밀번호를 바꾸지 못했어요. 다시 시도해 주세요",
} as const;

// 검사 순서: 지금 비밀번호 → 새 비밀번호 길이 → 새 비밀번호 확인 (위에서 처음 걸린 것 하나만)
const schema = z
  .object({
    currentPassword: z.string().min(1, PASSWORD_CHANGE_ERRORS.current).max(PASSWORD_MAX, PASSWORD_CHANGE_ERRORS.wrong),
    newPassword: passwordField,
    newPasswordConfirm: z.string(),
  })
  .refine((v) => v.newPassword === v.newPasswordConfirm, { message: PASSWORD_ERRORS.mismatch, path: ["newPasswordConfirm"] })
  .refine((v) => v.newPassword !== v.currentPassword, { message: PASSWORD_CHANGE_ERRORS.same, path: ["newPassword"] });

/**
 * 비밀번호 바꾸기. 성공·실패 모두 폼의 비밀번호 칸은 비운다 (폼 action이 끝나면 React가 폼을 초기화한다).
 * 비밀번호 원문은 비교·해시에만 쓰고 저장·기록하지 않는다.
 */
export async function changePassword(_prev: PasswordFormState, formData: FormData): Promise<PasswordFormState> {
  const viewer = await requireMember();
  const parsed = schema.safeParse({
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    newPasswordConfirm: String(formData.get("newPasswordConfirm") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { currentPassword, newPassword } = parsed.data;
  // 관리자 계정은 만들 때와 같은 12자 규칙 (scripts/create-admin.ts)
  if (viewer.user.role === "admin" && newPassword.length < ADMIN_PASSWORD_MIN) return { error: PASSWORD_ERRORS.adminShort };

  try {
    await auth.api.changePassword({
      body: { currentPassword, newPassword },
      headers: await headers(),
    });
  } catch (err) {
    if (err instanceof APIError && err.body?.code === "INVALID_PASSWORD") return { error: PASSWORD_CHANGE_ERRORS.wrong };
    console.error("비밀번호 변경 실패", viewer.userId, err);
    return { error: PASSWORD_CHANGE_ERRORS.failed };
  }
  await db.delete(sessions).where(and(eq(sessions.userId, viewer.userId), ne(sessions.id, viewer.sessionId)));
  return { ok: Date.now() };
}
