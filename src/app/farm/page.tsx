import { CARE_ACTIONS, EGG_LEVEL_EVERY, EGG_PRICE, MAX_ACTIVE_ANIMALS, POST_GROWTH } from "@/lib/farm";
import { requireMember } from "@/server/dal";
import { getFarm } from "@/server/farm";
import { listGrowthItems } from "@/server/inventory";
import { getWallet } from "@/server/points";
import { FarmView } from "./farm-view";

export const metadata = { title: "동물 농장" };

// 동물 농장 1차 (TOWN-09): 알 받기 → 부화 → 돌보기 → 다 자라면 보상과 카드
export default async function FarmPage() {
  const viewer = await requireMember();
  const wallet = await getWallet(viewer.userId);
  const [farm, growthItems] = await Promise.all([getFarm(viewer.userId, wallet.level), listGrowthItems(viewer.userId)]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">🐮 동물 농장</h1>
          <p className="mt-1 text-sm text-ink-soft">
            알을 부화시켜 동물을 키워요. {CARE_ACTIONS.map((c) => `${c.emoji} ${c.label}`).join(" · ")}는 하루 한 번씩,
            공개 글로 보상을 받으면 동물마다 성장 +{POST_GROWTH}. 다 키우면 경험치와 코인을 받아요.
          </p>
        </div>
        <p className="rounded-full bg-white px-3 py-1 text-sm shadow-sm">
          키우는 중 <b>{MAX_ACTIVE_ANIMALS - farm.slotsLeft}</b> / {MAX_ACTIVE_ANIMALS}
        </p>
      </div>
      <FarmView
        active={farm.active}
        grown={farm.grown}
        freeEggs={farm.freeEggs}
        slotsLeft={farm.slotsLeft}
        coins={wallet.coins}
        eggPrice={EGG_PRICE}
        eggEvery={EGG_LEVEL_EVERY}
        growthItems={growthItems}
      />
    </div>
  );
}
