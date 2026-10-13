"use server";

// 새 비밀번호 정하기 (AUTH-12 비밀번호 찾기). 간편 로그인 직후의 새 세션에서만 지금 비밀번호 없이 바꾼다.
// 새 세션인지는 화면이 아니라 여기서 DB(sessions.created_at)로 다시 확인한다 (폼을 열어 두고 10분이 지나도 막힌다).
// 바꾸면 이 브라우저만 남기고 다른 기기의 로그인을 끊는다 (비밀번호 변경 password-actions.ts와 같게).
import { z } from "zod";
import { ADMIN_PASSWORD_MIN, PASSWORD_ERRORS, passwordField } from "@/lib/password";
import { isFreshSession } from "@/lib/password-reset";
import { requireMember } from "@/server/dal";
import { sessionCreatedAt, setMemberPassword } from "@/server/password-reset";

export type NewPasswordState = { error?: string; ok?: number };

const NEW_PASSWORD_ERRORS = {
  stale: "로그인한 지 오래됐어요. 로그아웃한 뒤 간편 로그인으로 다시 들어와 주세요",
  failed: "비밀번호를 정하지 못했어요. 다시 시도해 주세요",
} as const;

// 검사 순서: 새 비밀번호 길이 → 새 비밀번호 확인
const schema = z
  .object({ newPassword: passwordField, newPasswordConfirm: z.string() })
  .refine((v) => v.newPassword === v.newPasswordConfirm, { message: PASSWORD_ERRORS.mismatch, path: ["newPasswordConfirm"] });

export async function setNewPassword(_prev: NewPasswordState, formData: FormData): Promise<NewPasswordState> {
  const viewer = await requireMember();
  const createdAt = await sessionCreatedAt(viewer.sessionId);
  if (!createdAt || !isFreshSession(createdAt)) return { error: NEW_PASSWORD_ERRORS.stale };

  const parsed = schema.safeParse({
    newPassword: String(formData.get("newPassword") ?? ""),
    newPasswordConfirm: String(formData.get("newPasswordConfirm") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { newPassword } = parsed.data;
  // 관리자 계정은 만들 때와 같은 12자 규칙 (scripts/create-admin.ts)
  if (viewer.user.role === "admin" && newPassword.length < ADMIN_PASSWORD_MIN) return { error: PASSWORD_ERRORS.adminShort };

  try {
    await setMemberPassword(viewer.userId, newPassword, { keepSessionId: viewer.sessionId });
  } catch (err) {
    console.error("새 비밀번호 저장 실패", viewer.userId, err);
    return { error: NEW_PASSWORD_ERRORS.failed };
  }
  return { ok: Date.now() };
}
