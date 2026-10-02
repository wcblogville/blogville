"use server";

import { and, desc, eq, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { attendances } from "@/db/schema";
import { ATTENDANCE_STREAK_BONUS_EVERY, previousDay, REWARD_RULES, todayKST } from "@/lib/game";
import { requireMember } from "@/server/dal";
import { grantReward, lockUser } from "@/server/points";

export type AttendState =
  | { status: "idle" }
  | { status: "done"; streak: number; coins: number; exp: number; bonus: boolean }
  | { status: "already" };

export async function attend(): Promise<AttendState> {
  const viewer = await requireMember();
  const today = todayKST();

  const result = await db.transaction(async (tx) => {
    await lockUser(tx, viewer.userId);

    // (user_id, date)가 기본 키라서 같은 날 두 번 넣으면 아무것도 들어가지 않는다
    const [last] = await tx
      .select({ date: attendances.date, streak: attendances.streak })
      .from(attendances)
      .where(and(eq(attendances.userId, viewer.userId), lt(attendances.date, today)))
      .orderBy(desc(attendances.date))
      .limit(1);
    const streak = last && last.date === previousDay(today) ? last.streak + 1 : 1;

    const inserted = await tx
      .insert(attendances)
      .values({ userId: viewer.userId, date: today, streak })
      .onConflictDoNothing()
      .returning({ streak: attendances.streak });
    if (!inserted.length) return { status: "already" } as const;

    await grantReward(tx, viewer.userId, "attendance", today);
    const bonus = streak % ATTENDANCE_STREAK_BONUS_EVERY === 0;
    if (bonus) await grantReward(tx, viewer.userId, "attendance_streak", today);

    return {
      status: "done",
      streak,
      bonus,
      exp: REWARD_RULES.attendance.exp,
      coins: REWARD_RULES.attendance.coins + (bonus ? REWARD_RULES.attendance_streak.coins : 0),
    } as const;
  });

  revalidatePath("/", "layout");
  return result;
}
