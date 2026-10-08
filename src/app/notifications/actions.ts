"use server";

import { and, eq, isNull, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { MAX_LEVEL } from "@/lib/game";
import { parseId } from "@/lib/ids";
import { notificationHref } from "@/lib/notifications";
import { requireMember } from "@/server/dal";
import { getOwnNotification } from "@/server/notifications";

// 모든 Action은 맨 앞에서 requireMember() (트랜잭션 밖, 방문자는 / 로)
// 모든 변경은 user_id = 나 조건을 붙인다 (US6-4)

const dismissSchema = z.object({
  level: z.string().regex(/^[0-9]{1,2}$/).transform(Number).pipe(z.number().int().min(2).max(MAX_LEVEL)),
  go: z.enum(["shop", "stay"]),
});

/** 레벨업 팝업 [확인]·[상점 가기]·Esc: 보여 준 레벨과 그보다 낮은 안 읽은 레벨업을 모두 읽음 (FR-040·041) */
export async function dismissLevelUp(formData: FormData) {
  const viewer = await requireMember();
  const parsed = dismissSchema.safeParse({ level: formData.get("level"), go: formData.get("go") });
  if (!parsed.success) return;

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, viewer.userId),
        eq(notifications.kind, "level_up"),
        isNull(notifications.readAt),
        lte(notifications.level, parsed.data.level),
      ),
    );
  revalidatePath("/", "layout");
  if (parsed.data.go === "shop") redirect("/shop");
}

/** 알림 한 줄을 누름: 읽음으로 바꾸고 관련 화면으로 (FR-044). 남의 알림·잘못된 ID는 아무것도 바꾸지 않는다 */
export async function openNotification(formData: FormData) {
  const viewer = await requireMember();
  const id = parseId(formData.get("id"));
  const row = id ? await getOwnNotification(viewer.userId, id) : null;
  if (!id || !row) redirect("/notifications");

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, viewer.userId), isNull(notifications.readAt)));
  revalidatePath("/", "layout");
  redirect(notificationHref(row));
}

/** [모두 읽음] (FR-044) */
export async function markAllNotificationsRead() {
  const viewer = await requireMember();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, viewer.userId), isNull(notifications.readAt)));
  revalidatePath("/", "layout");
}
