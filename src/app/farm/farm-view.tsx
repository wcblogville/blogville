"use client";

import Link from "next/link";
import { PixelIcon } from "@/components/pixel-icon";
import { useState, useTransition } from "react";
import { ANIMAL_SIZE, type AnimalTier, animalSvg, displaySizeChoices, eggSvg, toAnimalDataUri } from "@/lib/art/animals";
import { growthDataUri } from "@/lib/art/growth";
import { animalStage, CARE_ACTIONS, DISPLAY_SIZE_LABEL, STAGE_LABEL } from "@/lib/farm";
import type { AdoptableSpecies, FarmAnimal, FarmSkin } from "@/server/farm";
import { adoptAnimal, buyEgg, careAnimal, claimEgg, type FarmResult, feedGrowthItem, hatchEgg, setAnimalSize, wearSkin } from "./actions";

const TIER_LABEL: Record<AnimalTier, string> = { small: "작은 동물", medium: "중간 동물", large: "큰 동물" };

type FreeEgg = { kind: "starter"; label: string } | { kind: "level"; level: number; label: string };

/* eslint-disable @next/next/no-img-element -- 코드로 만든 SVG(data URI)라 next/image 최적화가 필요 없다 */
function AnimalImage({ animal, size }: { animal: FarmAnimal; size: number }) {
  const svg =
    animal.status === "egg" || !animal.assetKey || !animal.growExp
      ? eggSvg(size)
      : animalSvg(animal.assetKey, animalStage(animal.growth, animal.growExp), size, animal.skinKey, animal.status === "grown" ? animal.displaySize : "normal");
  return <img src={toAnimalDataUri(svg)} alt="" width={size} height={size} className="pixelated" aria-hidden />;
}

/** 어른 그림 (분양·스킨 미리보기) */
function AdultImage({ assetKey, skinKey = null, size }: { assetKey: string; skinKey?: string | null; size: number }) {
  return <img src={toAnimalDataUri(animalSvg(assetKey, "adult", size, skinKey))} alt="" width={size} height={size} className="pixelated" aria-hidden />;
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
  growthItems = [],
  adoptable = [],
  skins = [],
}: {
  active: FarmAnimal[];
  grown: FarmAnimal[];
  freeEggs: FreeEgg[];
  slotsLeft: number;
  coins: number;
  eggPrice: number;
  eggEvery: number;
  /** 상점에서 산 성장 아이템 (SHOP FR-044) */
  growthItems?: { id: number; name: string; assetKey: string; growthValue: number | null; quantity: number }[];
  /** 코인으로 분양하는 동물 (2026-10-11 "펫 종류") */
  adoptable?: AdoptableSpecies[];
  /** 동물 스킨 목록과 산 것 (2026-10-11 "펫 종류별로 스킨") */
  skins?: FarmSkin[];
}) {
  const [pending, start] = useTransition();
  const dressable = [...active, ...grown].filter((a) => a.status !== "egg" && a.assetKey && a.speciesId !== null);
  const [dressId, setDressId] = useState<number | null>(null);
  const dressing = dressable.find((a) => a.id === dressId) ?? dressable[0] ?? null;
  const [message, setMessage] = useState<FarmResult | null>(null);
  const run = (fn: () => Promise<FarmResult>) => start(async () => setMessage(await fn()));
  const growing = active.filter((a) => a.status === "growing");

  return (
    <>
      <p role="status" aria-live="polite" className={`mt-4 min-h-6 text-center font-bold ${message?.ok ? "text-leaf-dark" : "text-berry"}`}>
        {message?.text}
      </p>

      {/* 알 받기 */}
      <section className="pixel-card mt-2 flex flex-wrap items-center gap-3 p-4">
        <span className="pixel-heading text-xl">
          <PixelIcon name="egg" />알 받기
        </span>
        {freeEggs.map((egg) => (
          <button
            key={egg.kind === "level" ? egg.level : "starter"}
            type="button"
            disabled={pending || slotsLeft <= 0}
            onClick={() => run(() => claimEgg(egg.kind, egg.kind === "level" ? egg.level : undefined))}
            className="pixel-btn pixel-btn-sm bg-sun text-ink"
          >
            🎁 {egg.label} (무료)
          </button>
        ))}
        <button
          type="button"
          disabled={pending || slotsLeft <= 0 || coins < eggPrice}
          onClick={() => run(buyEgg)}
          className="pixel-btn pixel-btn-sm bg-white text-ink"
        >
          🪙 {eggPrice}으로 알 사기
        </button>
        <span className="text-xs text-ink-soft">
          {slotsLeft <= 0 ? "자리가 꽉 찼어요. 다 키운 뒤에 받을 수 있어요" : `레벨 ${eggEvery}마다 무료 알을 하나씩 받아요`}
        </span>
      </section>

      {/* 성장 아이템 가방 (SHOP-01, TOWN-09): 상점에서 산 먹이·성장 촉진제. 쓰는 버튼은 동물 카드마다 있다 */}
      <section className="pixel-card mt-6 p-4" aria-labelledby="growth-bag-title" data-growth-bag>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="growth-bag-title" className="pixel-heading text-xl">
            <PixelIcon name="bag" />
            성장 아이템
          </h2>
          <Link href="/shop#growth" className="inline-flex min-h-11 items-center text-sm text-ink-soft underline">
            🛒 상점에서 더 사기
          </Link>
        </div>
        {growthItems.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">
            가진 성장 아이템이 없어요. 상점에서 동물 먹이·고급 먹이·성장 촉진제를 사면 여기에 모이고, 키우는 동물에게 바로 쓸 수 있어요.
          </p>
        ) : (
          <>
            <ul className="mt-3 flex flex-wrap gap-3">
              {growthItems.map((g) => (
                <li key={g.id} className="pixel-slot flex items-center gap-2 py-1 pl-1 pr-3" data-growth-bag-item={g.assetKey}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI) */}
                  <img src={growthDataUri(g.assetKey, 64)} alt="" width={64} height={64} className="pixelated" />
                  <span className="text-sm">
                    <b>{g.name}</b> ×{g.quantity}
                    <br />
                    <span className="text-xs text-leaf-dark">한 번에 성장 +{g.growthValue ?? 0}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-soft">
              {growing.length > 0
                ? "아래 동물 카드의 🌱 버튼을 누르면 하나를 써요. 하루 횟수 제한 없이 가진 만큼 쓸 수 있어요."
                : "알을 부화시키면 키우는 동물에게 쓸 수 있어요."}
            </p>
          </>
        )}
      </section>

      {/* 동물 분양: 코인으로 아기를 바로 데려온다. 크기(작은·중간·큰)는 광장·우리 집에서 보이는 크기 */}
      {adoptable.length > 0 && (
        <section className="mt-10" data-adopt-list>
          <h2 className="pixel-heading mb-1">
            <PixelIcon name="paw" />
            동물 분양
          </h2>
          <p className="mb-3 text-sm text-ink-soft">알 없이 아기를 바로 데려와요. 키우는 자리를 함께 써요.</p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
            {adoptable.map((sp) => (
              <li key={sp.id} className="pixel-card flex flex-col items-center p-3 text-center" data-adopt={sp.code}>
                <AdultImage assetKey={sp.assetKey} size={96} />
                <span className="font-display text-lg">{sp.name}</span>
                <span className="text-xs text-ink-soft">
                  {TIER_LABEL[ANIMAL_SIZE[sp.assetKey]?.tier ?? "medium"]} · 성장 {sp.growExp}
                </span>
                <button
                  type="button"
                  disabled={pending || slotsLeft <= 0 || coins < sp.price}
                  onClick={() => run(() => adoptAnimal(sp.id))}
                  className="pixel-btn pixel-btn-sm mt-3 bg-sun text-ink"
                >
                  🪙 {sp.price} 데려오기
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 키우는 동물 */}
      <section className="mt-10">
        <h2 className="pixel-heading mb-4">
          <PixelIcon name="sprout" />
          키우는 중
        </h2>
        {active.length === 0 ? (
          <p className="pixel-paper p-6 text-center">아직 키우는 동물이 없어요. 위에서 알을 받아 보세요!</p>
        ) : (
          <ul className="grid gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((a) => (
              <li key={a.id} className="pixel-card flex flex-col items-center p-4 text-center">
                <span className="pixel-slot grid w-full place-items-center py-1">
                  <AnimalImage animal={a} size={96} />
                </span>
                {a.status === "egg" ? (
                  <>
                    <h3 className="font-display text-lg">알</h3>
                    <p className="text-xs text-ink-soft">무엇이 나올지 몰라요</p>
                    <button type="button" disabled={pending} onClick={() => run(() => hatchEgg(a.id))} className="pixel-btn pixel-btn-sm mt-3 bg-leaf-dark text-white">
                      🐣 부화시키기
                    </button>
                  </>
                ) : (
                  <>
                    <h3 className="font-display text-lg">
                      {a.name} <span className="text-sm text-ink-soft">· {STAGE_LABEL[animalStage(a.growth, a.growExp!)]}</span>
                    </h3>
                    <div className="pixel-bar mt-3 w-full" role="progressbar" aria-valuenow={a.growth} aria-valuemax={a.growExp!} aria-label="성장">
                      <div className="pixel-bar-fill" style={{ width: `${Math.min(100, (a.growth / a.growExp!) * 100)}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-ink-soft">
                      성장 {a.growth} / {a.growExp} · 다 키우면 ✨ {a.rewardExp} · 🪙 {a.rewardCoins}
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-3">
                      {CARE_ACTIONS.map((c) => {
                        const done = a.caredToday.includes(c.action);
                        return (
                          <button
                            key={c.action}
                            type="button"
                            disabled={pending || done}
                            onClick={() => run(() => careAnimal(a.id, c.action))}
                            className="pixel-btn pixel-btn-sm bg-white px-2.5 font-sans text-xs font-bold text-ink"
                            title={done ? "오늘은 했어요" : `성장 +${c.growth}`}
                          >
                            {c.emoji} {done ? "완료" : c.label}
                          </button>
                        );
                      })}
                    </div>
                    {growthItems.length > 0 && (
                      <div className="mt-4 flex flex-wrap justify-center gap-3" data-growth-items>
                        {growthItems.map((g) => {
                          const value = g.growthValue ?? 0;
                          // 이 아이템 하나로 다 자라면 미리 알려 준다
                          const finishes = a.growExp !== null && a.growth + value >= a.growExp;
                          return (
                            <button
                              key={g.id}
                              type="button"
                              disabled={pending}
                              onClick={() => run(() => feedGrowthItem(a.id, g.id))}
                              className="pixel-btn pixel-btn-sm flex items-center gap-1 bg-[#e9f6e4] py-1 pl-1 pr-2.5 font-sans text-xs text-ink"
                              title={finishes ? `성장 +${value}, 이걸 쓰면 다 자라요` : `성장 +${value}`}
                              data-use-growth={g.assetKey}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI) */}
                              <img src={growthDataUri(g.assetKey, 32)} alt="" width={32} height={32} className="pixelated" />
                              🌱 {g.name} ×{g.quantity}
                              <span className="font-bold text-leaf-dark">{finishes ? "🎉 다 자라요" : `+${value}`}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 스킨 입히기: 동물을 고르고 그 종류의 색·무늬를 입힌다 (안 산 스킨은 코인으로 사서 바로) */}
      {dressing && (
        <section className="mt-10" data-skin-shop>
          <h2 className="pixel-heading mb-1">
            <PixelIcon name="palette" />
            스킨 입히기
          </h2>
          <p className="mb-3 text-sm text-ink-soft">한 번 산 스킨은 같은 종류의 내 동물 모두에게 입힐 수 있어요. 광장·우리 집에서도 그 색으로 보여요.</p>
          <div className="pixel-card p-3">
            <ul className="flex gap-3 overflow-x-auto p-1 pb-2" aria-label="스킨을 입힐 동물">
              {dressable.map((a) => (
                <li key={a.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setDressId(a.id)}
                    aria-pressed={a.id === dressing.id}
                    data-dress={a.id}
                    className={`pixel-tab flex w-20 flex-col gap-0 p-1 font-sans text-xs ${a.id === dressing.id ? "" : "bg-white"}`}
                  >
                    <AnimalImage animal={a} size={64} />
                    <span className="truncate">{a.name}</span>
                  </button>
                </li>
              ))}
            </ul>
            <ul className="mt-4 flex flex-wrap gap-4 p-1" data-skins={dressing.id}>
              {[{ id: null, name: "기본", price: 0, assetKey: null, owned: true }, ...skins.filter((k) => k.speciesId === dressing.speciesId)].map((k) => {
                const wearing = dressing.skinId === k.id;
                return (
                  <li key={k.id ?? "base"} className="pixel-card flex w-28 flex-col items-center p-2 text-center" data-selected={wearing || undefined} data-skin={k.assetKey ?? "base"}>
                    <AdultImage assetKey={dressing.assetKey!} skinKey={k.assetKey} size={64} />
                    <span className="text-sm font-bold">{k.name}</span>
                    <button
                      type="button"
                      disabled={pending || wearing || (!k.owned && coins < k.price)}
                      onClick={() => run(() => wearSkin(dressing.id, k.id))}
                      className={`pixel-btn pixel-btn-sm mt-2 px-2 font-sans text-xs font-bold ${k.owned ? "bg-white text-ink" : "bg-sun text-ink"}`}
                    >
                      {wearing ? "✓ 입는 중" : k.owned ? "입히기" : `🪙 ${k.price} 사서 입히기`}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {/* 다 키운 동물 카드 (도감은 2차에서 블로그로) */}
      <section className="mt-10">
        <h2 className="pixel-heading mb-4">
          <PixelIcon name="medal" />
          다 키운 동물 {grown.length > 0 && <span className="pixel-badge text-sm">{grown.length}</span>}
        </h2>
        {grown.length === 0 ? (
          <p className="text-sm text-ink-soft">다 키운 동물은 여기에 카드로 모여요.</p>
        ) : (
          <ul className="flex flex-wrap gap-4 p-1">
            {grown.map((a) => (
              <li key={a.id} className="pixel-card flex w-36 flex-col items-center p-2 text-center" data-selected data-grown={a.id} data-display-size={a.displaySize}>
                <AnimalImage animal={a} size={96} />
                <span className="font-display">{a.name}</span>
                <span className="text-[11px] text-ink-soft">{a.grownAt ? new Date(a.grownAt).toLocaleDateString("ko-KR") : ""}</span>
                {/* 크기 고르기 (2026-10-12): 광장·우리 집에서 이 크기로 데리고 다닌다. 이미 가장 큰 동물은 "크게"가 없다 */}
                {a.assetKey && (
                  <div className="mt-2 grid w-full grid-cols-2 gap-1" role="group" aria-label={`${a.name} 크기`}>
                    {displaySizeChoices(a.assetKey).map((z) => (
                      <button
                        key={z}
                        type="button"
                        disabled={pending || a.displaySize === z}
                        aria-pressed={a.displaySize === z}
                        onClick={() => run(() => setAnimalSize(a.id, z))}
                        data-size-choice={z}
                        className={`pixel-btn pixel-btn-sm px-1 py-0.5 font-sans text-[11px] ${a.displaySize === z ? "bg-sun font-bold text-ink" : "bg-white text-ink"}`}
                      >
                        {DISPLAY_SIZE_LABEL[z]}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
