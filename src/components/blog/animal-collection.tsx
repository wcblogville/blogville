"use client";

// 동물 도감 (BLOG-04 / FR-029·030, contracts/profile-showcase.md 2절, research R-20)
// 프로필 카드의 [🏅 도감] 버튼을 누르면 창(<dialog>)에 주인의 다 키운 동물 카드가 보인다 (사용자 요청 2026-10-09).
// 누구에게나 같고 (US4-10), 주인에게만 전시 버튼이 보인다 (판정은 서버, setShowcaseAnimal).
// 버튼 [전시하기] / `전시 중` + [전시 빼기]는 plan 임시 문구.
import { useRef, useTransition } from "react";
import { AnimalArt } from "@/components/character";
import { setShowcaseAnimal } from "@/app/settings/blog/actions";

export type CollectionCard = { id: number; name: string; assetKey: string; grownDate: string };

export function AnimalCollection({ animals, showcaseId, isOwner }: { animals: CollectionCard[]; showcaseId: number | null; isOwner: boolean }) {
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        aria-haspopup="dialog"
        className="btn min-h-11 shrink-0 gap-1 whitespace-nowrap bg-white px-3 text-sm text-ink"
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
        className="m-auto max-h-[85dvh] overflow-y-auto w-[min(92vw,40rem)] rounded-3xl border-4 border-line bg-cream p-0 shadow-2xl backdrop:bg-black/50"
      >
        <div className="p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 id="collection-title" className="font-display text-xl">
              🏅 동물 도감 <span className="text-sm text-ink-soft">{animals.length}마리</span>
            </h2>
            <button type="button" onClick={() => ref.current?.close()} aria-label="도감 닫기" className="btn min-h-11 min-w-11 bg-white px-3 text-ink">
              ✕
            </button>
          </div>
          {animals.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-soft">아직 다 키운 동물이 없어요. 농장에서 동물을 키우면 여기에 모여요.</p>
          ) : (
            <>
              {isOwner && <p className="mb-2 text-sm text-ink-soft">한 마리를 골라 블로그 프로필에 전시할 수 있어요.</p>}
              <ul className="flex flex-wrap gap-2">
                {animals.map((a) => {
                  const shown = a.id === showcaseId;
                  return (
                    <li
                      key={a.id}
                      data-animal-card
                      className={`flex w-28 flex-col items-center rounded-xl border-2 p-2 text-center ${shown ? "border-sun bg-[#fff3d6]" : "border-line bg-white"}`}
                    >
                      <AnimalArt assetKey={a.assetKey} size={64} />
                      <span className="font-display leading-tight">{a.name}</span>
                      <span className="text-[11px] text-ink-soft">{a.grownDate}</span>
                      {shown && <span className="mt-1 text-xs font-bold text-sun-dark">전시 중</span>}
                      {isOwner && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => start(() => setShowcaseAnimal(shown ? null : a.id))}
                          className={`btn mt-1 min-h-11 min-w-11 whitespace-nowrap px-2 text-sm ${shown ? "bg-white text-ink" : "bg-leaf text-white"}`}
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
