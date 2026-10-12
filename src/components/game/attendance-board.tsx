// 출석 체크 창의 조각들 (GAME-04): 오늘 출석 결과, 1~7일차 보상표, 이번 달 달력.
// 출석은 버튼 없이 자동(getViewer)이라 여기에는 누르는 [출석하기]가 없다. /attendance와 마을 게시판 창(/feed?board=1)이 같이 쓴다.
// 보상표만 <li>를 쓴다 (출석 화면 시험이 main 안의 목록 칸 7개를 센다). 달력은 <span> 칸.
import type { AttendanceBoardData } from "@/server/attendance";
import { PixelIcon, IconText } from "@/components/pixel-icon";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** 오늘 받은 보상과 내일 받을 보상 (7일차 다음은 1일차) */
export function rewardOf(data: AttendanceBoardData, day: number) {
  return data.rewards.find((r) => r.day === day) ?? null;
}
export function nextDay(data: AttendanceBoardData) {
  return data.cycleDay >= data.rewards.length ? 1 : data.cycleDay + 1;
}

/** 오늘 출석 결과: 큰 도장 + 받은 보상 */
export function AttendanceToday({ data, compact = false }: { data: AttendanceBoardData; compact?: boolean }) {
  const got = rewardOf(data, data.cycleDay);
  return (
    <div className={`flex items-center gap-4 ${compact ? "" : "flex-col text-center"}`} data-attendance-today>
      <span
        aria-hidden
        className={`grid shrink-0 place-items-center bg-[#fff1ee] font-display text-berry shadow-[inset_0_0_0_3px_#fff1ee,inset_0_0_0_6px_#c62828,0_0_0_3px_#c6282833] [clip-path:polygon(9px_0,calc(100%-9px)_0,100%_9px,100%_calc(100%-9px),calc(100%-9px)_100%,9px_100%,0_calc(100%-9px),0_9px)] ${
          compact ? "h-16 w-16 rotate-[-6deg] text-sm leading-tight" : "h-24 w-24 rotate-[-6deg] text-lg leading-tight"
        }`}
      >
        출석
        <br />
        완료
      </span>
      <div className="min-w-0">
        <p className={`flex items-center gap-2 font-display ${compact ? "text-xl" : "text-2xl"}`}>
          <PixelIcon name="gift" scale={2} />출석 완료! {data.cycleDay}일차
        </p>
        <p className="mt-0.5 flex items-center gap-1 font-bold text-leaf-dark">
          오늘 {data.cycleDay}일차 출석 완료 <PixelIcon name="check" scale={1} label="완료" />
        </p>
        {got && (
          <p className="mt-1 text-sm text-ink-soft" data-attendance-got>
            받은 보상{" "}
            <b className="text-ink">
              <IconText icon="star" label="경험치">{got.exp}</IconText>
            </b>{" "}
            ·{" "}
            <b className="text-ink">
              <IconText icon="coin" label="코인">{got.coins}</IconText>
            </b>
          </p>
        )}
      </div>
    </div>
  );
}

/** 1~7일차 보상표. 지난 일차는 받음, 오늘은 강조, 다음 일차는 `내일` */
export function AttendanceRewards({ data }: { data: AttendanceBoardData }) {
  const next = nextDay(data);
  const tomorrow = rewardOf(data, next);
  return (
    <div>
      <ol className="grid grid-cols-7 gap-1 whitespace-nowrap text-center text-[10px] sm:gap-2 sm:text-sm" aria-label="일차별 출석 보상">
        {data.rewards.map((r) => {
          const isToday = r.day === data.cycleDay;
          const done = r.day < data.cycleDay;
          const isNext = r.day === next && next > data.cycleDay;
          return (
            <li
              key={r.day}
              aria-current={isToday ? "true" : undefined}
              data-reward-day={r.day}
              className={`relative flex min-w-0 flex-col items-center gap-0.5 px-0.5 py-2 ${
                isToday
                  ? "bg-[#fff3d6] font-bold shadow-[inset_0_0_0_3px_#d99a36]"
                  : done
                    ? "bg-[#f3e8d4] text-ink-soft shadow-[inset_0_0_0_3px_#e2cfae]"
                    : isNext
                      ? "bg-white shadow-[inset_0_0_0_3px_#64b85a]"
                      : "bg-white shadow-[inset_0_0_0_3px_#ead9c0]"
              }`}
            >
              <span>{r.day}일차</span>
              <IconText icon="star" label="경험치" className="gap-0.5">{r.exp}</IconText>
              <IconText icon="coin" label="코인" className="gap-0.5">{r.coins}</IconText>
              <span className={`text-[9px] sm:text-xs ${isToday ? "text-sun-dark" : isNext ? "text-leaf-dark" : "text-ink-soft"}`}>
                {isToday ? "오늘" : done ? "받음" : isNext ? "내일" : " "}
              </span>
            </li>
          );
        })}
      </ol>
      {tomorrow && (
        <p className="mt-3 text-center text-xs text-ink-soft sm:text-sm" data-attendance-next>
          내일 오면 <b className="text-ink">{next}일차</b> 보상 <IconText icon="star" label="경험치">{tomorrow.exp}</IconText> · <IconText icon="coin" label="코인">{tomorrow.coins}</IconText>. 하루라도 빠지면 1일차부터 다시 시작해요.
        </p>
      )}
    </div>
  );
}

/** 이번 달 달력: 출석한 날은 🌟 도장, 오늘은 노란 테두리 */
export function AttendanceCalendar({ data, compact = false }: { data: AttendanceBoardData; compact?: boolean }) {
  const [y, m] = data.today.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const attended = new Set(data.attendedDates);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-1">
        <h2 className={`pixel-heading ${compact ? "text-lg" : "text-xl"}`}>
          {y}년 {m}월
        </h2>
        <p className="text-sm text-ink-soft">
          이번 달 {data.attendedDates.length}일 출석 · 현재 {data.cycleDay}일차
        </p>
      </div>
      <div className={`grid grid-cols-7 text-center ${compact ? "gap-1 text-xs" : "gap-1.5 text-sm"}`}>
        {WEEKDAYS.map((d, i) => (
          <span key={d} className={`py-1 font-bold ${i === 0 ? "text-berry" : i === 6 ? "text-sky" : "text-ink-soft"}`}>
            {d}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const key = `${data.today.slice(0, 7)}-${String(d).padStart(2, "0")}`;
          const done = attended.has(key);
          const isToday = key === data.today;
          return (
            <span
              key={key}
              data-date={key}
              data-today={isToday || undefined}
              className={`grid place-items-center ${compact ? "h-9" : "aspect-square"} ${done ? "bg-[#e8f5e9] font-bold" : "bg-[#fbf0dc]"} ${
                isToday ? "shadow-[inset_0_0_0_3px_#d99a36]" : done ? "shadow-[inset_0_0_0_3px_#64b85a]" : ""
              }`}
              title={done ? `${d}일 출석` : undefined}
            >
              {done ? <PixelIcon name="star" scale={compact ? 1 : 2} label={`${d}일 출석`} /> : d}
            </span>
          );
        })}
      </div>
    </div>
  );
}
