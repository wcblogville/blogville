import Link from "next/link";
import { CharacterBadge } from "@/components/character";
import { PixelIcon } from "@/components/pixel-icon";
import { PlaceHeader } from "@/components/place-banner";
import { catchDataUri, catchSilhouetteDataUri } from "@/lib/art/catches";
import { availabilityText, CATCHES, catchByKey, formatSize, isAvailable, TIER_CLASS, TIER_LABEL } from "@/lib/fishing";
import { FISHING_RULES, kstClock } from "@/lib/game";
import { requireMember } from "@/server/dal";
import { getFishDex, getRecentCatches, getTodayCasts, getWeeklyRanking } from "@/server/fishing";
import { FishingView } from "./fishing-view";

export const metadata = { title: "낚시터" };

const shortDate = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

// 연못 낚시터 (사용자 요청 2026-10-08, 2026-10-12 "낚시 컨텐츠 더 풍성하게"): 하루 세 번 던지고, 도감·이번 주 랭킹을 본다
export default async function FishingPage() {
  const viewer = await requireMember();
  const [casts, dex, ranking, recent] = await Promise.all([
    getTodayCasts(viewer.userId),
    getFishDex(viewer.userId),
    getWeeklyRanking(),
    getRecentCatches(viewer.userId),
  ]);
  const now = kstClock();
  const found = CATCHES.filter((c) => dex.has(c.key)).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <PlaceHeader place="fishing" icon="rod" title="연못 낚시터">
        <p className="text-sm">
          하루에 {FISHING_RULES.castsPerDay}번 낚싯대를 던질 수 있어요. 찌가 쑥 잠길 때 딱 맞춰 당기면 희귀한 물고기와 큰 물고기가 잘 나와요. 밤이나 계절에만
          나오는 물고기도 있어요.
        </p>
      </PlaceHeader>
      <FishingView casts={casts} />

      <section className="mt-10" data-fish-dex>
        <h2 className="pixel-heading mb-4 flex-wrap text-xl">
          <PixelIcon name="book" />
          물고기 도감
          <span className="pixel-badge text-sm" data-dex-count>
            {found} / {CATCHES.length}
          </span>
        </h2>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
          {CATCHES.map((c) => {
            const entry = dex.get(c.key);
            const when = availabilityText(c);
            const src = entry ? catchDataUri(c.key, 2) : catchSilhouetteDataUri(c.key, 2);
            return (
              <li key={c.key} className="pixel-card flex items-start gap-3 p-2 text-sm" data-catch={c.key} data-dex-found={entry ? "1" : "0"}>
                <span className="pixel-slot grid size-12 shrink-0 place-items-center" aria-hidden>
                  {/* 도트 그림 20칸 × 2배 = 40px. 아직 못 낚았으면 그림자 */}
                  {/* eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 도트 SVG(data URI) */}
                  {src && <img src={src} alt="" width={40} height={40} className="pixelated" />}
                </span>
                <span className="min-w-0">
                  <b className={`block ${entry ? "" : "text-ink-soft"}`}>{c.name}</b>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1 text-xs">
                    <span className={`pixel-badge px-1! py-0! text-[11px]! ${TIER_CLASS[c.tier]}`}>{TIER_LABEL[c.tier]}</span>
                    {c.itemCode ? (
                      <span className="text-ink-soft">동물 먹이 1개</span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-ink-soft">
                        <PixelIcon name="coin" scale={1} /> {c.coins}
                        {c.sizeMm && `~${c.coins + Math.floor(c.coins * FISHING_RULES.sizeBonusRatio)}`}
                      </span>
                    )}
                  </span>
                  {when && (
                    <span
                      className={`block text-xs ${isAvailable(c, now) ? "font-bold text-[#2f78b8]" : "text-ink-soft"}`}
                      data-when={isAvailable(c, now) ? "now" : "later"}
                    >
                      {when}
                      {isAvailable(c, now) && " · 지금 나와요"}
                    </span>
                  )}
                  {entry && (
                    <span className="block text-xs text-ink-soft" data-dex-entry>
                      처음 {shortDate(entry.firstDate)} · {entry.count}번{entry.maxSizeMm ? ` · 최대 ${formatSize(entry.maxSizeMm)}` : ""}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-10" data-fish-ranking>
        <h2 className="pixel-heading mb-1 text-xl">
          <PixelIcon name="crown" />
          이번 주 대물 랭킹
        </h2>
        <p className="mb-4 text-xs text-ink-soft">{shortDate(ranking.from)}(월)부터 낚은 물고기 중 회원마다 가장 큰 한 마리. 월요일에 새로 시작해요.</p>
        {ranking.rows.length === 0 ? (
          <p className="pixel-card p-4 text-sm text-ink-soft">이번 주에는 아직 아무도 물고기를 낚지 않았어요. 첫 대물의 주인공이 되어 보세요!</p>
        ) : (
          <ol className="pixel-card pixel-rows text-sm">
            {ranking.rows.map((r, i) => {
              const c = catchByKey(r.catchKey);
              const art = catchDataUri(r.catchKey, 1);
              return (
                <li key={r.blogSlug} className="flex items-center gap-3 px-3 py-2" data-rank={i + 1}>
                  <span className={`font-display w-6 text-center text-lg ${i === 0 ? "text-[#d99a36]" : ""}`}>{i + 1}</span>
                  <CharacterBadge asset={r.characterAsset} outfit={r.outfit} size={32} />
                  <Link href={`/@${r.blogSlug}`} className="min-w-0 flex-1 truncate font-bold hover:underline">
                    {r.nickname}
                  </Link>
                  <span className="flex shrink-0 items-center gap-1">
                    {/* eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 도트 SVG(data URI) */}
                    {art && <img src={art} alt="" width={20} height={20} className="pixelated" />}
                    <span className="hidden sm:inline">{c?.name}</span>
                    <b>{formatSize(r.sizeMm)}</b>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {recent.length > 0 && (
        <section className="mt-10">
          <h2 className="pixel-heading mb-4 text-xl">
            <PixelIcon name="calendar" />
            최근 낚시 기록
          </h2>
          <ul className="pixel-card pixel-rows text-sm" data-fishing-log>
            {recent.map((r) => {
              const c = catchByKey(r.catchKey);
              const art = catchDataUri(r.catchKey, 1);
              return (
                <li key={`${r.date}-${r.castNo}`} className="flex justify-between gap-2 px-3 py-2">
                  <span className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 도트 SVG(data URI) */}
                    {art && <img src={art} alt="" width={20} height={20} className="pixelated" />}
                    {c?.name ?? r.catchKey}
                    {r.sizeMm !== null && <span className="text-ink-soft">{formatSize(r.sizeMm)}</span>}
                  </span>
                  <span className="text-ink-soft">{r.date}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
