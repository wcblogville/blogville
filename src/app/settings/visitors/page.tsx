// 방문자 기록 (BLOG-10, 사용자 요청 2026-10-12 "방문자기록 볼 수 있으면 좋을듯"): 내 블로그에 온 사람을 날짜별로.
// 주인만 본다 (주소에 블로그가 없고 로그인한 회원의 블로그만 읽는다). 다른 사람은 옆 칸 👣 방문자 위젯의 숫자만 본다.
// 회원은 얼굴·닉네임·블로그 링크·처음 온 시각, 손님(로그인 안 함)은 날짜마다 "손님 N명"으로 묶는다
import Link from "next/link";
import { CharacterBadge } from "@/components/character";
import { PixelIcon } from "@/components/pixel-icon";
import { getBlogVisitStats } from "@/server/blog";
import { requireMember } from "@/server/dal";
import { getVisitLog, VISIT_LOG_RANGES, type VisitLogMember, type VisitLogRange } from "@/server/visits";

export const metadata = { title: "방문자 기록" };

const n = (v: number) => v.toLocaleString("ko-KR");
const shortDate = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const weekday = (d: string) => WEEKDAYS[new Date(`${d}T00:00:00Z`).getUTCDay()];

export default async function VisitorsPage(props: PageProps<"/settings/visitors">) {
  const viewer = await requireMember();
  const sp = await props.searchParams;
  const days: VisitLogRange = sp.days === "30" ? 30 : 14;
  const blogId = viewer.profile.blogId;
  const [log, stats] = await Promise.all([getVisitLog(blogId, days), getBlogVisitStats(blogId)]);
  const peak = Math.max(1, ...log.chart.map((d) => d.total));
  const today = log.chart[log.chart.length - 1].date;
  const periodTotal = log.chart.reduce((s, d) => s + d.total, 0);
  const periodMembers = log.chart.reduce((s, d) => s + d.members, 0);

  // 목록: 방문이 있었던 날만 최신순, 날마다 회원 줄 + 손님 수
  const membersByDate = new Map<string, VisitLogMember[]>();
  for (const m of log.members) membersByDate.set(m.date, [...(membersByDate.get(m.date) ?? []), m]);
  const dayList = [...log.chart].reverse().filter((d) => d.total > 0);
  // 30일 그래프는 칸이 좁아 날짜 글자를 5일마다(오늘은 늘) 쓴다. 14일도 휴대폰에서는 이틀마다
  const back = (i: number) => log.chart.length - 1 - i;
  const showLabel = (i: number) => days === 14 || back(i) % 5 === 0;
  const phoneHidden = (i: number) => (days === 14 && back(i) % 2 === 1 ? "max-sm:invisible" : "");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="pixel-sign text-2xl sm:text-3xl">
          <PixelIcon name="foot" scale={2} />방문자 기록
        </h1>
        <Link
          href={`/@${viewer.profile.blogSlug}`}
          className="inline-flex min-h-11 min-w-11 items-center whitespace-nowrap px-1 text-sm text-ink-soft hover:text-ink"
        >
          내 블로그로 →
        </Link>
      </div>
      <p className="mt-4 text-sm text-ink-soft">내 블로그에 온 사람을 날짜별로 볼 수 있어요. 이 화면은 나만 볼 수 있고, 다른 사람에게는 방문자 수만 보여요.</p>

      <dl className="mt-6 grid grid-cols-3 gap-2 text-center sm:gap-3" data-visit-summary>
        {[
          ["오늘", stats.today],
          ["어제", stats.yesterday],
          ["전체", stats.total],
        ].map(([label, value]) => (
          <div key={label} className={`px-1 pt-2 pb-2.5 ${label === "오늘" ? "bg-[#ffe7a3] shadow-[inset_0_0_0_3px_#d99a36]" : "pixel-card"}`}>
            <dt className="text-xs text-ink-soft">{label}</dt>
            <dd className="font-display text-2xl">{n(value as number)}</dd>
          </div>
        ))}
      </dl>

      <section className="pixel-card mt-8 p-5 sm:p-6" aria-labelledby="visit-chart-title">
        <div className="pb-plank -mx-5 -mt-5 mb-4 flex flex-wrap items-center justify-between gap-2 px-5 py-2 sm:-mx-6 sm:-mt-6 sm:px-6">
          <h2 id="visit-chart-title" className="font-display text-xl">
            날짜별 방문
          </h2>
          <nav className="flex gap-2" aria-label="기간">
            {VISIT_LOG_RANGES.map((r) => (
              <Link
                key={r}
                href={r === 14 ? "/settings/visitors" : `/settings/visitors?days=${r}`}
                aria-current={r === days ? "page" : undefined}
                className="pixel-tab min-h-9! px-3! text-sm whitespace-nowrap"
                data-range={r}
              >
                {r}일
              </Link>
            ))}
          </nav>
        </div>
        <p className="mb-3 text-sm">
          최근 {days}일 방문 <b data-period-total>{n(periodTotal)}</b> (회원 {n(periodMembers)} · 손님 {n(periodTotal - periodMembers)})
        </p>
        {/* 막대 = 회원(초록) 위에 손님(하늘색)을 쌓는다. 오늘은 아래 날짜를 굵게. 높이는 기간 중 가장 많은 날 기준, 0인 날도 얇게 보인다 */}
        <ol
          className={`pixel-slot flex h-48 items-end px-2 pt-2 pb-2 ${days === 14 ? "gap-1.5" : "gap-0.5"}`}
          aria-label={`최근 ${days}일 방문자 수`}
          data-visit-chart={days}
        >
          {log.chart.map((d, i) => {
            const isToday = d.date === today;
            const label = isToday ? "오늘" : shortDate(d.date);
            const h = (v: number) => `${Math.round((v / peak) * 100)}%`;
            return (
              <li
                key={d.date}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                aria-label={`${label} ${d.total}명 (회원 ${d.members}, 손님 ${d.guests})`}
                data-day={d.date}
              >
                {(days === 14 || d.total > 0) && (
                  <span className={`text-ink ${days === 14 ? "text-xs" : "text-[10px]"} font-bold`}>{d.total > 0 ? n(d.total) : days === 14 ? "0" : ""}</span>
                )}
                <span className="flex w-full flex-1 flex-col justify-end">
                  {d.total === 0 && <span className="h-1 w-full bg-ink/15" />}
                  {d.guests > 0 && (
                    <span className={`w-full bg-[#8cc8e8] shadow-[inset_0_2px_0_0_#ffffff66]`} style={{ height: h(d.guests) }} />
                  )}
                  {d.members > 0 && (
                    <span className={`w-full bg-leaf shadow-[inset_0_2px_0_0_#ffffff66]`} style={{ height: h(d.members) }} />
                  )}
                </span>
                <span className={`h-4 text-[11px] whitespace-nowrap ${isToday ? "font-bold text-ink" : "text-ink-soft"} ${phoneHidden(i)}`}>{showLabel(i) ? label : ""}</span>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
          <span className="flex items-center gap-1">
            <span className="inline-block size-3 bg-leaf" /> 회원
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-3 bg-[#8cc8e8]" /> 손님 (로그인 안 함)
          </span>
          <span>같은 사람은 하루 1번만 세고, 내 방문은 세지 않아요.</span>
        </p>
      </section>

      <section className="mt-8" aria-labelledby="visit-list-title" data-visit-list>
        <h2 id="visit-list-title" className="pixel-heading mb-4 text-xl">
          최근 다녀간 사람
        </h2>
        {dayList.length === 0 ? (
          <p className="pixel-card p-4 text-sm text-ink-soft">최근 {days}일 동안 다녀간 사람이 없어요. 글을 쓰고 마을 소식에 올려 보세요!</p>
        ) : (
          <ol className="flex flex-col gap-4">
            {dayList.map((d) => {
              const members = membersByDate.get(d.date) ?? [];
              return (
                <li key={d.date} className="pixel-card" data-visit-day={d.date}>
                  <h3 className="pb-plank flex flex-wrap items-baseline justify-between gap-x-2 px-4 py-1.5">
                    <span className="font-display text-lg">
                      {shortDate(d.date)} ({weekday(d.date)}){d.date === today && " · 오늘"}
                    </span>
                    <span className="text-sm font-bold text-[#fff3d6]">
                      {n(d.total)}명 · 회원 {n(d.members)} · 손님 {n(d.guests)}
                    </span>
                  </h3>
                  <ul className="pixel-rows text-sm">
                    {members.map((m) => (
                      <li key={`${m.blogSlug}-${m.time}`} className="flex items-center gap-3 px-4 py-2" data-visit-member={m.blogSlug}>
                        <CharacterBadge asset={m.characterAsset} outfit={m.outfit} size={32} />
                        <span className="min-w-0 flex-1">
                          <b className="block truncate">{m.nickname}</b>
                          <Link href={`/@${m.blogSlug}`} className="inline-flex min-h-6 items-center text-xs text-leaf-dark hover:underline">
                            @{m.blogSlug} 블로그 가기 →
                          </Link>
                        </span>
                        <time className="shrink-0 text-xs text-ink-soft">{m.time}</time>
                      </li>
                    ))}
                    {d.guests > 0 && (
                      <li className="flex items-center gap-3 px-4 py-2 text-ink-soft" data-visit-guests={d.guests}>
                        <span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-line bg-cream" aria-hidden>
                          <PixelIcon name="people" />
                        </span>
                        손님 {n(d.guests)}명
                      </li>
                    )}
                  </ul>
                </li>
              );
            })}
          </ol>
        )}
        {log.truncated && <p className="mt-3 text-xs text-ink-soft">회원 방문은 최근 {log.members.length}줄까지만 보여요.</p>}
      </section>
    </div>
  );
}
