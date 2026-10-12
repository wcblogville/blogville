"use server";

// 마을 한마디 (사용자 요청 2026-10-12): 이웃이 마을에서 나(걸어 다니는 이웃)에게 말을 걸면 말풍선으로 보이는 한 줄.
// 앞뒤 공백을 지우고 공백을 한 칸으로, 60자까지 (DB CHECK profiles_greeting_check). 비우면 지운다(NULL → 공개 글의 한 문장).
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { GREETING_MAX, normalizeGreeting } from "@/lib/town-talk";
import { requireMember } from "@/server/dal";
import type { FormState } from "@/app/settings/blog/actions";

export async function updateGreeting(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireMember();
  const raw = formData.get("greeting");
  const sent = typeof raw === "string" ? raw : "";
  const greeting = normalizeGreeting(sent);
  if (greeting === "long") return { error: `마을 한마디는 ${GREETING_MAX}자까지예요`, values: { greeting: sent } };
  await db.update(profiles).set({ greeting }).where(eq(profiles.userId, viewer.userId));
  revalidatePath("/settings/account");
  return { ok: Date.now(), values: { greeting: greeting ?? "" } };
}
