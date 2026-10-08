import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { fishingCatches } from "@/db/schema";
import { CATCHES } from "@/lib/fishing";
import { todayKST } from "@/lib/game";
import { requireMember } from "@/server/dal";
import { FishingView } from "./fishing-view";

export const metadata = { title: "낚시터" };

// 연못 낚시터 (사용자 요청 2026-10-08): 하루 한 번 낚싯대를 던져 코인이나 동물 먹이를 받는다
export default async function FishingPage() {
  const viewer = await requireMember();
  const today = todayKST();
  const [todayRow] = await db
    .select({ catchKey: fishingCatches.catchKey })
    .from(fishingCatches)
    .where(and(eq(fishingCatches.userId, viewer.userId), eq(fishingCatches.date, today)));
  const recent = await db
    .select({ date: fishingCatches.date, catchKey: fishingCatches.catchKey })
    .from(fishingCatches)
    .where(eq(fishingCatches.userId, viewer.userId))
    .orderBy(desc(fishingCatches.date))
    .limit(7);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-3xl">🎣 연못 낚시터</h1>
      <p className="mt-1 text-sm text-ink-soft">하루에 한 번 낚싯대를 던질 수 있어요. 물고기를 낚으면 코인을, 먹이 꾸러미를 건지면 동물 농장에서 쓸 먹이를 받아요.</p>
      <FishingView todayKey={todayRow?.catchKey ?? null} />

      <section className="mt-8">
        <h2 className="mb-2 font-display text-xl">🐟 낚을 수 있는 것</h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CATCHES.map((c) => (
            <li key={c.key} className="card flex items-center gap-2 p-2 text-sm">
              <span className="text-2xl" aria-hidden>
                {c.emoji}
              </span>
              <span>
                <b>{c.name}</b>
                <span className="block text-xs text-ink-soft">{c.itemCode ? "동물 먹이 1개" : `🪙 ${c.coins}`}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {recent.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 font-display text-xl">📒 최근 낚시 기록</h2>
          <ul className="card divide-y-2 divide-line text-sm" data-fishing-log>
            {recent.map((r) => {
              const c = CATCHES.find((x) => x.key === r.catchKey);
              return (
                <li key={r.date} className="flex justify-between px-3 py-2">
                  <span>
                    {c?.emoji} {c?.name ?? r.catchKey}
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
