"use client";

// 동물 도감 (BLOG-04 / FR-029·030, contracts/profile-showcase.md 2절, research R-20)
// 주인의 다 키운 동물 카드. 누구에게나 같고 (US4-10), 주인에게만 전시 버튼이 보인다 (판정은 서버, setShowcaseAnimal).
// 제목 `🏅 동물 도감`, 버튼 [전시하기] / `전시 중` + [전시 빼기]는 plan 임시 문구.
import { useTransition } from "react";
import { AnimalArt } from "@/components/character";
import { setShowcaseAnimal } from "@/app/settings/blog/actions";

export type CollectionCard = { id: number; name: string; assetKey: string; grownDate: string };

export function AnimalCollection({ animals, showcaseId, isOwner }: { animals: CollectionCard[]; showcaseId: number | null; isOwner: boolean }) {
  const [pending, start] = useTransition();
  return (
    <section className="card mt-4 p-4" aria-labelledby="collection-title">
      <h2 id="collection-title" className="mb-2 font-display text-lg">
        🏅 동물 도감 {animals.length > 0 && <span className="text-sm text-ink-soft">{animals.length}</span>}
      </h2>
      {animals.length === 0 ? (
        <p className="text-sm text-ink-soft">아직 다 키운 동물이 없어요</p>
      ) : (
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
      )}
    </section>
  );
}
