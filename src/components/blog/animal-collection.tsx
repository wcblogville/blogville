"use client";

// 동물 도감 (BLOG-04 / FR-029·030, contracts/profile-showcase.md 2절, research R-20)
// 우리 집 방 도구 줄의 [🏅 도감] 버튼을 누르면 창(<dialog>)에 주인의 다 키운 동물 카드가 보인다 (사용자 요청 2026-10-09, 2026-10-11 카드에서 방으로).
// 전시한 동물은 방 안에서 주인을 따라 걷고, 마을에서는 주인을 따라다닌다.
// 누구에게나 같고 (US4-10), 주인에게만 전시 버튼이 보인다 (판정은 서버, setShowcaseAnimal).
// 버튼 [전시하기] / `전시 중` + [전시 빼기]는 plan 임시 문구.
import { useRef, useTransition } from "react";
import { AnimalArt } from "@/components/character";
import { setShowcaseAnimal } from "@/app/settings/blog/actions";
import { SexMark } from "@/components/game/sex-mark";
import type { AnimalSex } from "@/lib/farm";

/** 도감 카드. 특별 진화한 동물(variant)은 그 이름·반짝이로 따로 보인다 (2026-10-12) */
export type CollectionCard = { id: number; name: string; assetKey: string; skinKey?: string | null; sex?: AnimalSex | null; variant?: string | null; grownDate: string };

export function AnimalCollection({ animals, showcaseId, isOwner }: { animals: CollectionCard[]; showcaseId: number | null; isOwner: boolean }) {
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        aria-haspopup="dialog"
        className="pixel-btn pixel-btn-sm shrink-0 gap-1 whitespace-nowrap bg-[#fffaf0] px-3 text-ink"
        data-collection-open
      >
        🏅 도감 <span className="text-ink-soft">{animals.length}</span>
      </button>
      <dialog
        ref={ref}
        aria-labelledby="collection-title"
        data-collection
        // 창 밖(어두운 곳)을 누르면 닫는다
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="pixel-dialog m-auto max-h-[85dvh] w-[min(92vw,40rem)] overflow-y-auto p-0 backdrop:bg-[#2b2118]/60"
      >
        <div className="p-5">
          <div className="pb-plank -mx-5 -mt-5 mb-4 flex items-center justify-between gap-2 px-5 py-2.5">
            <h2 id="collection-title" className="font-display text-xl">
              🏅 동물 도감 <span className="text-sm text-[#fff3d6]">{animals.length}마리</span>
            </h2>
            <button type="button" onClick={() => ref.current?.close()} aria-label="도감 닫기" className="pixel-btn pixel-btn-sm min-w-11 bg-[#fffaf0] px-3 text-ink [text-shadow:none]">
              ✕
            </button>
          </div>
          {animals.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-soft">아직 다 키운 동물이 없어요. 농장에서 동물을 키우면 여기에 모여요.</p>
          ) : (
            <>
              {isOwner && <p className="mb-2 text-sm text-ink-soft">한 마리를 골라 우리 집에 전시하면 방 안에서, 그리고 마을을 돌아다닐 때 나를 따라다녀요.</p>}
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
                      {a.variant && <span className="pixel-badge bg-[#fff0a8] px-1.5 text-[10px] font-bold">✨ 특별</span>}
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
