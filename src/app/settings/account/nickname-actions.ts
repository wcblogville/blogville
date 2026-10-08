"use server";

// 닉네임 변경 (BLOG-03 / FR-019, FR-020, contracts/profile-showcase.md 1절, research R-03·R-04·R-29)
// 파일은 blog 소유. 화면은 nickname-form.tsx, 자리는 auth 소유 내 정보(page.tsx)의 "닉네임" 영역.
// 대상은 늘 로그인한 나의 프로필이다 (nickname 칸만 읽는다).
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { charCount } from "@/lib/blog";
import { NICKNAME_MAX, NICKNAME_MIN } from "@/lib/names";
import { requireMember } from "@/server/dal";
import { uniqueViolation } from "@/server/db-errors";
import { findNameConflict, lockName } from "@/server/names";
import type { FormState } from "@/app/settings/blog/actions";

const NICKNAME_ERRORS = {
  short: "닉네임은 2자 이상이에요",
  long: "닉네임은 20자까지예요",
  taken: "이미 있는 닉네임이에요",
} as const;

class Rejected extends Error {}

/**
 * 닉네임 바꾸기. 길이는 앞뒤 공백을 지운 뒤 코드 포인트로 센다 (😀 하나 → 2자 미만 문구, 500 없음).
 * 다른 회원의 아이디와는 대소문자 무시로 겹치면 거부 (자기 아이디는 허용), 닉네임끼리는 글자 그대로 UNIQUE.
 * 예약어 검사는 하지 않는다 (FR-019에 없음).
 */
export async function updateNickname(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireMember();
  const raw = formData.get("nickname");
  const sent = typeof raw === "string" ? raw : "";
  const nickname = sent.trim();
  const fail = (error: string): FormState => ({ error, values: { nickname: sent } });

  const length = charCount(nickname);
  if (length < NICKNAME_MIN) return fail(NICKNAME_ERRORS.short);
  if (length > NICKNAME_MAX) return fail(NICKNAME_ERRORS.long);
  if (nickname === viewer.profile.nickname) return { ok: Date.now(), values: { nickname } };

  try {
    await db.transaction(async (tx) => {
      // 같은 이름의 가입과 줄을 세운다 (research R-04)
      await lockName(tx, nickname);
      const conflict = await findNameConflict(tx, nickname, { exceptUserId: viewer.userId });
      // nickname 결과(대소문자 무시)는 쓰지 않는다: 닉네임끼리는 profiles_nickname_unique(글자 그대로)로만 막는다 (R-03)
      if (conflict.username) throw new Rejected(NICKNAME_ERRORS.taken);
      await tx.update(profiles).set({ nickname }).where(eq(profiles.userId, viewer.userId));
    });
  } catch (err) {
    if (err instanceof Rejected) return fail(err.message);
    if (uniqueViolation(err) === "profiles_nickname_unique") return fail(NICKNAME_ERRORS.taken);
    throw err;
  }
  revalidatePath("/", "layout");
  return { ok: Date.now(), values: { nickname } };
}
