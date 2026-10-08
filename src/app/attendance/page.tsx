import { todayKST } from "@/lib/game";
import { ensureTodayAttendance, listAttendanceRewards, listMonthAttendances } from "@/server/attendance";
import { requireMember } from "@/server/dal";

export const metadata = { title: "출석 체크" };

// 출석은 버튼 없이 자동으로 된다 (GAME-04 / FR-021). 이 화면은 결과와 보상표, 이번 달 달력만 보여 준다
export default async function AttendancePage() {
  const viewer = await requireMember();
  const today = todayKST();
  // 헤더의 자동 출석이 실패했으면 한 번 더. 또 실패하면 오류 화면으로
  const attendance = viewer.attendance ?? (await ensureTodayAttendance(viewer.userId, viewer.sessionId));
  const [rows, rewards] = await Promise.all([listMonthAttendances(viewer.userId, today), listAttendanceRewards()]);
  const attendedDates = new Set(rows.map((r) => r.date));

  // 이번 달 달력
  const [y, m] = today.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-3xl">📮 출석 체크</h1>

      <section className="card mt-6 flex flex-col items-center justify-center p-8 text-center">
        <p className="text-6xl" aria-hidden>
          🎁
        </p>
        <p className="mt-2 font-display text-2xl">🎁 출석 완료! {attendance.cycleDay}일차</p>
        <p className="mt-1 font-bold text-leaf-dark">오늘 {attendance.cycleDay}일차 출석 완료</p>
      </section>

      <section className="card mt-6 p-4 sm:p-6" aria-label="일차별 출석 보상">
        <ol className="grid grid-cols-7 gap-1 whitespace-nowrap text-center text-[10px] sm:gap-2 sm:text-sm">
          {rewards.map((r) => {
            const isToday = r.day === attendance.cycleDay;
            return (
              <li
                key={r.day}
                aria-current={isToday ? "true" : undefined}
                className={`flex min-w-0 flex-col items-center gap-0.5 rounded-xl border-2 px-0.5 py-2 ${
                  isToday ? "border-sun bg-[#fff8e1] font-bold" : "border-line bg-white"
                }`}
              >
                <span>{r.day}일차</span>
                <span>✨ {r.exp}</span>
                <span>🪙 {r.coins}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="card mt-6 p-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-1">
          <h2 className="font-display text-xl">
            {y}년 {m}월
          </h2>
          <p className="text-sm text-ink-soft">
            이번 달 {rows.length}일 출석 · 현재 {attendance.cycleDay}일차
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
            const isToday = key === today;
            return (
              <span
                key={key}
                data-date={key}
                className={`grid aspect-square place-items-center rounded-xl border-2 ${done ? "bg-[#e8f5e9] font-bold" : "bg-cream"} ${
                  isToday ? "border-sun" : done ? "border-leaf" : "border-transparent"
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
