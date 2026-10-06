"use client";

import { useState, useTransition } from "react";
import { animalSvg, eggSvg, toAnimalDataUri } from "@/lib/art/animals";
import { animalStage, CARE_ACTIONS, STAGE_LABEL } from "@/lib/farm";
import type { FarmAnimal } from "@/server/farm";
import { buyEgg, careAnimal, claimEgg, type FarmResult, hatchEgg } from "./actions";

type FreeEgg = { kind: "starter"; label: string } | { kind: "level"; level: number; label: string };

/* eslint-disable @next/next/no-img-element -- 코드로 만든 SVG(data URI)라 next/image 최적화가 필요 없다 */
function AnimalImage({ animal, size }: { animal: FarmAnimal; size: number }) {
  const svg =
    animal.status === "egg" || !animal.assetKey || !animal.growExp
      ? eggSvg(size * 2)
      : animalSvg(animal.assetKey, animalStage(animal.growth, animal.growExp), size * 2);
  return <img src={toAnimalDataUri(svg)} alt="" width={size} height={size} aria-hidden />;
}
/* eslint-enable @next/next/no-img-element */

export function FarmView({
  active,
  grown,
  freeEggs,
  slotsLeft,
  coins,
  eggPrice,
  eggEvery,
}: {
  active: FarmAnimal[];
  grown: FarmAnimal[];
  freeEggs: FreeEgg[];
  slotsLeft: number;
  coins: number;
  eggPrice: number;
  eggEvery: number;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<FarmResult | null>(null);
  const run = (fn: () => Promise<FarmResult>) => start(async () => setMessage(await fn()));

  return (
    <>
      <p role="status" aria-live="polite" className={`mt-4 min-h-6 text-center font-bold ${message?.ok ? "text-leaf-dark" : "text-berry"}`}>
        {message?.text}
      </p>

      {/* 알 받기 */}
      <section className="card mt-2 flex flex-wrap items-center gap-3 p-4">
        <span className="font-bold">🥚 알 받기</span>
        {freeEggs.map((egg) => (
          <button
            key={egg.kind === "level" ? egg.level : "starter"}
            type="button"
            disabled={pending || slotsLeft <= 0}
            onClick={() => run(() => claimEgg(egg.kind, egg.kind === "level" ? egg.level : undefined))}
            className="btn bg-sun py-1.5 text-sm text-ink"
          >
            🎁 {egg.label} (무료)
          </button>
        ))}
        <button
          type="button"
          disabled={pending || slotsLeft <= 0 || coins < eggPrice}
          onClick={() => run(buyEgg)}
          className="btn bg-white py-1.5 text-sm text-ink"
        >
          🪙 {eggPrice}으로 알 사기
        </button>
        <span className="text-xs text-ink-soft">
          {slotsLeft <= 0 ? "자리가 꽉 찼어요. 다 키운 뒤에 받을 수 있어요" : `레벨 ${eggEvery}마다 무료 알을 하나씩 받아요`}
        </span>
      </section>

      {/* 키우는 동물 */}
      <section className="mt-6">
        <h2 className="mb-3 font-display text-2xl">🌾 키우는 중</h2>
        {active.length === 0 ? (
          <p className="card p-6 text-center text-ink-soft">아직 키우는 동물이 없어요. 위에서 알을 받아 보세요!</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((a) => (
              <li key={a.id} className="card flex flex-col items-center p-4 text-center">
                <AnimalImage animal={a} size={112} />
                {a.status === "egg" ? (
                  <>
                    <h3 className="font-display text-lg">알</h3>
                    <p className="text-xs text-ink-soft">무엇이 나올지 몰라요</p>
                    <button type="button" disabled={pending} onClick={() => run(() => hatchEgg(a.id))} className="btn mt-3 bg-leaf py-1.5 text-sm text-white">
                      🐣 부화시키기
                    </button>
                  </>
                ) : (
                  <>
                    <h3 className="font-display text-lg">
                      {a.name} <span className="text-sm text-ink-soft">· {STAGE_LABEL[animalStage(a.growth, a.growExp!)]}</span>
                    </h3>
                    <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={a.growth} aria-valuemax={a.growExp!} aria-label="성장">
                      <div className="h-full bg-leaf" style={{ width: `${Math.min(100, (a.growth / a.growExp!) * 100)}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-ink-soft">
                      성장 {a.growth} / {a.growExp} · 다 키우면 ✨ {a.rewardExp} · 🪙 {a.rewardCoins}
                    </p>
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      {CARE_ACTIONS.map((c) => {
                        const done = a.caredToday.includes(c.action);
                        return (
                          <button
                            key={c.action}
                            type="button"
                            disabled={pending || done}
                            onClick={() => run(() => careAnimal(a.id, c.action))}
                            className="btn bg-white px-2.5 py-1.5 text-xs text-ink"
                            title={done ? "오늘은 했어요" : `성장 +${c.growth}`}
                          >
                            {c.emoji} {done ? "완료" : c.label}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 다 키운 동물 카드 (도감은 2차에서 블로그로) */}
      <section className="mt-8">
        <h2 className="mb-3 font-display text-2xl">🏅 다 키운 동물 {grown.length > 0 && <span className="text-base text-ink-soft">{grown.length}</span>}</h2>
        {grown.length === 0 ? (
          <p className="text-sm text-ink-soft">다 키운 동물은 여기에 카드로 모여요.</p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {grown.map((a) => (
              <li key={a.id} className="card flex w-28 flex-col items-center border-sun bg-[#fff3d6] p-2 text-center">
                <AnimalImage animal={a} size={72} />
                <span className="font-display">{a.name}</span>
                <span className="text-[11px] text-ink-soft">{a.grownAt ? new Date(a.grownAt).toLocaleDateString("ko-KR") : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
