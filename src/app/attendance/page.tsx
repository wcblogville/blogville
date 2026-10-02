import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { attendances } from "@/db/schema";
import { formatDate } from "@/lib/format";
import { ATTENDANCE_STREAK_BONUS_EVERY, currentStreak, REWARD_RULES, todayKST } from "@/lib/game";
import { requireMember } from "@/server/dal";
import { AttendButton } from "./attend-button";

export const metadata = { title: "출석 우체통" };

export default async function AttendancePage() {
  const viewer = await requireMember();
  const today = todayKST();
  const monthStart = `${today.slice(0, 7)}-01`;

  const [rows, [last]] = await Promise.all([
    // 달력용: 이번 달 출석
    db
      .select({ date: attendances.date, streak: attendances.streak })
      .from(attendances)
      .where(and(eq(attendances.userId, viewer.userId), gte(attendances.date, monthStart)))
      .orderBy(desc(attendances.date)),
    // 연속 일수용: 달과 상관없이 가장 최근 출석 1건 (GAME-04)
    db
      .select({ date: attendances.date, streak: attendances.streak })
      .from(attendances)
      .where(eq(attendances.userId, viewer.userId))
      .orderBy(desc(attendances.date))
      .limit(1),
  ]);
  const attendedDates = new Set(rows.map((r) => r.date));
  const attendedToday = attendedDates.has(today);

  // 이번 달 달력
  const [y, m] = today.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const streak = currentStreak(last, today);
  const streakText = streak
    ? `현재 연속 ${streak}일`
    : last
      ? `연속 출석이 끊겼어요 (마지막 출석 ${formatDate(new Date(`${last.date}T00:00:00+09:00`))})`
      : "아직 출석 기록이 없어요";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-3xl">📮 출석 우체통</h1>
      <p className="mt-1 text-ink-soft">
        하루 한 번 ✨ {REWARD_RULES.attendance.exp} · 🪙 {REWARD_RULES.attendance.coins}, {ATTENDANCE_STREAK_BONUS_EVERY}일 연속마다 🪙{" "}
        {REWARD_RULES.attendance_streak.coins} 보너스
      </p>

      <section className="card mt-6 flex min-h-48 flex-col items-center justify-center p-8">
        <AttendButton attended={attendedToday} />
      </section>

      <section className="card mt-6 p-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-xl">
            {y}년 {m}월
          </h2>
          <p className="text-sm text-ink-soft">
            이번 달 {rows.length}일 출석 · {streakText}
          </p>
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-center text-sm">
          {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
            <span key={d} className="py-1 font-bold text-ink-soft">
              {d}
            </span>
          ))}
          {cells.map((d, i) => {
            if (!d) return <span key={`e${i}`} />;
            const key = `${today.slice(0, 7)}-${String(d).padStart(2, "0")}`;
            const done = attendedDates.has(key);
            return (
              <span
                key={key}
                className={`grid aspect-square place-items-center rounded-xl border-2 ${
                  done ? "border-leaf bg-[#e8f5e9] font-bold" : key === today ? "border-sun" : "border-transparent bg-cream"
                }`}
                title={done ? "출석" : undefined}
              >
                {done ? "🌟" : d}
              </span>
            );
          })}
        </div>
      </section>
    </div>
  );
}
