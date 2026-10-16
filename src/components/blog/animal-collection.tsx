"use client";

// 동물 도감 (BLOG-04 / FR-029·030, contracts/profile-showcase.md 2절, research R-20)
// 우리 집 방 도구 줄의 [🏅 도감] 버튼을 누르면 창(<dialog>)이 열린다 (사용자 요청 2026-10-09, 2026-10-11 카드에서 방으로).
// 위는 도감 칸 (2026-10-16 "모든 동물을(특수진화 포함) 그림자 형태 카드로, 얻으면 열리게, 다 해금하면 용"): 모든 종류·특별 진화가
// 실루엣 카드로 있고 얻은 칸만 그림과 이름이 보인다. 다 채우면 오는 용 칸이 맨 위. 칸 목록은 src/lib/dex.ts, 열림은 src/server/dex.ts.
// 아래는 주인의 다 키운 동물 카드(전시하기).
// 전시한 동물은 방 안에서 주인을 따라 걷고, 마을에서는 주인을 따라다닌다.
// 누구에게나 같고 (US4-10), 주인에게만 전시 버튼이 보인다 (판정은 서버, setShowcaseAnimal).
// 버튼 [전시하기] / `전시 중` + [전시 빼기]는 plan 임시 문구.
import { useRef, useTransition } from "react";
import { AnimalArt } from "@/components/character";
import { setShowcaseAnimal } from "@/app/settings/blog/actions";
import { SexMark } from "@/components/game/sex-mark";
import { type AnimalSex, RARITY_ICON, RARITY_LABEL, RARITY_ORDER, subject } from "@/lib/farm";
import type { Dex, DexEntry } from "@/server/dex";
import { PixelIcon, IconText } from "@/components/pixel-icon";

/** 도감 카드. 특별 진화한 동물(variant)은 그 이름·반짝이로 따로 보인다 (2026-10-12) */
export type CollectionCard = { id: number; name: string; assetKey: string; skinKey?: string | null; sex?: AnimalSex | null; variant?: string | null; grownDate: string };

export function AnimalCollection({ animals, showcaseId, isOwner, dex }: { animals: CollectionCard[]; showcaseId: number | null; isOwner: boolean; dex: Dex }) {
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDialogElement>(null);
  const species = dex.entries.filter((e) => e.kind === "species");
  const variants = dex.entries.filter((e) => e.kind === "variant");
  const done = dex.count >= dex.total;
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        aria-haspopup="dialog"
        className="pixel-btn pixel-btn-sm shrink-0 gap-1 whitespace-nowrap bg-[#fffaf0] px-3 text-ink"
        data-collection-open
      >
        <PixelIcon name="medal" scale={1} />도감 <span className="text-ink-soft">{dex.count}/{dex.total}</span>
      </button>
      <dialog
        ref={ref}
        aria-labelledby="collection-title"
        data-collection
        // 창 밖(어두운 곳)을 누르면 닫는다
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="pixel-dialog m-auto max-h-[85dvh] w-[min(94vw,46rem)] overflow-y-auto p-0 backdrop:bg-[#2b2118]/60"
      >
        <div className="p-5">
          <div className="pb-plank sticky top-0 z-10 -mx-5 -mt-5 mb-4 flex items-center justify-between gap-2 px-5 py-2.5">
            <h2 id="collection-title" className="font-display text-xl">
              <IconText icon="medal" scale={2}>동물 도감</IconText>{" "}
              <span className="text-sm text-[#fff3d6]" data-dex-count>
                {dex.count} / {dex.total}
              </span>
            </h2>
            <button type="button" onClick={() => ref.current?.close()} aria-label="도감 닫기" className="pixel-btn pixel-btn-sm min-w-11 bg-[#fffaf0] px-3 text-ink [text-shadow:none]">
              ✕
            </button>
          </div>

          {/* 채운 만큼 막대 + 다 채우면 오는 용 */}
          <div className="mb-4 flex items-center gap-3 pixel-slot p-2.5" data-dex-reward={dex.reward?.received ? "received" : "locked"}>
            {dex.reward && <DexArt assetKey={dex.reward.assetKey} open={dex.reward.received} size={64} />}
            <div className="min-w-0 flex-1">
              <p className="font-display leading-tight">
                {dex.reward?.received ? <IconText icon="crown">전설의 {subject(dex.reward.name)} 함께해요!</IconText> : done ? "도감을 다 채웠어요! 동물이 한 마리 더 다 자라면 전설의 동물이 찾아와요" : "도감을 다 채우면 전설의 동물이 찾아와요"}
              </p>
              <div className="mt-1.5 h-3 w-full bg-[#e9dcc0] shadow-[inset_0_0_0_2px_#5a3a26]" role="progressbar" aria-label="도감 채운 정도" aria-valuemin={0} aria-valuemax={dex.total} aria-valuenow={dex.count}>
                <div className="h-full bg-leaf" style={{ width: `${Math.round((dex.count / Math.max(1, dex.total)) * 100)}%` }} />
              </div>
              <p className="mt-1 text-xs text-ink-soft">동물을 깨우거나 분양받으면 그 칸이, 특별한 모습으로 다 키우면 특별 진화 칸이 열려요.</p>
            </div>
          </div>

          {RARITY_ORDER.map((rarity) => {
            const list = species.filter((e) => e.kind === "species" && e.rarity === rarity);
            if (!list.length) return null;
            return (
              <section key={rarity} className="mb-3">
                <h3 className="mb-1.5 font-display text-sm text-ink-soft">
                  <IconText icon={RARITY_ICON[rarity]}>{RARITY_LABEL[rarity]}</IconText> <span className="text-xs">{list.filter((e) => e.unlocked).length}/{list.length}</span>
                </h3>
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
                  {list.map((e) => <DexCard key={e.key} entry={e} />)}
                </ul>
              </section>
            );
          })}
          <section className="mb-4">
            <h3 className="mb-1.5 font-display text-sm text-ink-soft">
              <IconText icon="sparkle">특별 진화</IconText> <span className="text-xs">{variants.filter((e) => e.unlocked).length}/{variants.length}</span>
            </h3>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
              {variants.map((e) => <DexCard key={e.key} entry={e} />)}
            </ul>
          </section>

          <h3 className="mb-1.5 border-t-2 border-dashed border-[#d8c49c] pt-3 font-display text-base">
            우리 집 동물 <span className="text-sm text-ink-soft">{animals.length}마리</span>
          </h3>
          {animals.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-soft">아직 다 키운 동물이 없어요. 농장에서 동물을 키우면 여기에 모여요.</p>
          ) : (
            <>              {isOwner && <p className="mb-2 text-sm text-ink-soft">한 마리를 골라 우리 집에 전시하면 방 안에서, 그리고 마을을 돌아다닐 때 나를 따라다녀요.</p>}
              <ul className="flex flex-wrap gap-2.5">
                {animals.map((a) => {
                  const shown = a.id === showcaseId;
                  return (
                    <li
                      key={a.id}
                      data-animal-card
                      data-variant={a.variant ?? undefined}
                      className={`flex w-28 flex-col items-center p-2 text-center ${shown ? "bg-[#ffe7a3] shadow-[inset_0_0_0_3px_#d99a36]" : "pixel-slot"}`}
                    >
                      <AnimalArt assetKey={a.assetKey} skinKey={a.skinKey} sex={a.sex} variant={a.variant} size={64} />
                      {a.variant && <span className="pixel-badge bg-[#fff0a8] px-1.5 text-[10px] font-bold"><IconText icon="sparkle">특별</IconText></span>}
                      <span className="font-display leading-tight">
                        {a.name}
                        <SexMark sex={a.sex} className="ml-0.5 text-sm" />
                      </span>
                      <span className="text-[11px] text-ink-soft">{a.grownDate}</span>
                      {shown && <span className="mt-1 text-xs font-bold text-sun-dark">전시 중</span>}
                      {isOwner && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => start(() => setShowcaseAnimal(shown ? null : a.id))}
                          className={`pixel-btn pixel-btn-sm mt-2 mb-1 min-w-11 whitespace-nowrap px-2 ${shown ? "bg-[#fffaf0] text-ink" : "bg-leaf text-white"}`}
                        >
                          {shown ? "전시 빼기" : "전시하기"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}

/** 도감 그림: 아직 못 얻었으면 까만 그림자 */
function DexArt({ assetKey, variant = null, open, size }: { assetKey: string; variant?: string | null; open: boolean; size: number }) {
  return <AnimalArt assetKey={assetKey} variant={variant} size={size} className={open ? "" : "opacity-50 brightness-0"} />;
}

/** 도감 칸 하나. 잠긴 칸은 그림자와 ???, 특별 진화는 어느 동물의 진화인지만 알려 준다 */
function DexCard({ entry: e }: { entry: DexEntry }) {
  return (
    <li
      data-dex-card={e.key}
      data-unlocked={e.unlocked ? "true" : "false"}
      className={`flex flex-col items-center p-1.5 text-center ${e.unlocked ? (e.kind === "variant" ? "bg-[#fff6cf] shadow-[inset_0_0_0_2px_#e2b84e]" : "pixel-slot") : "bg-[#efe6d2] shadow-[inset_0_0_0_2px_#cdbb96]"}`}
    >
      <DexArt assetKey={e.assetKey} variant={e.kind === "variant" ? e.key : null} open={e.unlocked} size={64} />
      <span className="font-display text-sm leading-tight">{e.unlocked ? e.name : "???"}</span>
      {e.kind === "variant" && <span className="text-[10px] leading-tight text-ink-soft">{e.speciesName}의 진화</span>}
    </li>
  );
}
