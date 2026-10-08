// 자동 출석 (GAME-04): 로그인한 회원이 그날(한국 시간) 처음 화면을 열면 getViewer() 안에서 한 번 기록된다
import "server-only";
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { attendanceRewards, attendances, sessions } from "@/db/schema";
import { nextCycleDay, todayKST } from "@/lib/game";
import { addLedgerEntry, lockUser } from "@/server/points";

export type TodayAttendance = { date: string; cycleDay: number };

/**
 * 오늘 출석과 그 일차 보상을 한 트랜잭션으로 기록한다. 이미 있으면 그 행을 읽기만 한다.
 * 회원 잠금 + PK (user_id, date) + 원장 point_ledger_attendance_uq로 탭·기기 여러 개가 동시에 와도 1번 (SC-003).
 * 안의 조회·기록은 모두 같은 tx로 한다 (연결 풀이 잠금 대기로 찼을 때 멈추지 않게, research R7).
 */
export async function ensureTodayAttendance(userId: string, sessionId: string | null): Promise<TodayAttendance> {
  const today = todayKST();
  return db.transaction(async (tx) => {
    await lockUser(tx, userId);

    const [existing] = await tx
      .select({ cycleDay: attendances.cycleDay })
      .from(attendances)
      .where(and(eq(attendances.userId, userId), eq(attendances.date, today)));
    if (existing) return { date: today, cycleDay: existing.cycleDay };

    const [last] = await tx
      .select({ date: attendances.date, cycleDay: attendances.cycleDay })
      .from(attendances)
      .where(and(eq(attendances.userId, userId), lt(attendances.date, today)))
      .orderBy(desc(attendances.date))
      .limit(1);
    const cycleDay = nextCycleDay(last, today);

    // 세션이 그사이 지워졌으면 NULL로 넣는다 (FK 위반으로 출석이 실패하지 않게)
    const sessionRef = sessionId ? sql`(SELECT ${sessions.id} FROM ${sessions} WHERE ${sessions.id} = ${sessionId})` : null;
    const inserted = await tx
      .insert(attendances)
      .values({ userId, date: today, cycleDay, sessionId: sessionRef })
      .onConflictDoNothing()
      .returning({ cycleDay: attendances.cycleDay });
    if (!inserted.length) {
      const [row] = await tx
        .select({ cycleDay: attendances.cycleDay })
        .from(attendances)
        .where(and(eq(attendances.userId, userId), eq(attendances.date, today)));
      return { date: today, cycleDay: row.cycleDay };
    }

    const [reward] = await tx.select().from(attendanceRewards).where(eq(attendanceRewards.day, cycleDay));
    await addLedgerEntry(tx, { userId, reason: "attendance", expDelta: reward.exp, coinDelta: reward.coins, refId: today });
    return { date: today, cycleDay };
  });
}

/** 이번 달(한국 시간) 출석 날짜와 일차 (출석 화면 달력) */
export function listMonthAttendances(userId: string, today = todayKST()) {
  return db
    .select({ date: attendances.date, cycleDay: attendances.cycleDay })
    .from(attendances)
    .where(and(eq(attendances.userId, userId), gte(attendances.date, `${today.slice(0, 7)}-01`)))
    .orderBy(asc(attendances.date));
}

/** 1~7일차 보상표 */
export function listAttendanceRewards() {
  return db.select().from(attendanceRewards).orderBy(asc(attendanceRewards.day));
}
