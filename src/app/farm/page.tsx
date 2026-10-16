import { PlaceHeader } from "@/components/place-banner";
import { CARE_ACTIONS, EGG_LEVEL_EVERY, EGG_PRICE, MAX_ACTIVE_ANIMALS, POST_GROWTH } from "@/lib/farm";
import { requireMember } from "@/server/dal";
import { getFarm } from "@/server/farm";
import { listGrowthItems } from "@/server/inventory";
import { getWallet } from "@/server/points";
import { getShowcaseId } from "@/server/showcase";
import { FarmInfo } from "./farm-info";
import { FarmView } from "./farm-view";
import { IconText } from "@/components/pixel-icon";

export const metadata = { title: "동물 농장" };

// 동물 농장 1차 (TOWN-09): 알 받기 → 부화 → 돌보기 → 다 자라면 보상과 카드
export default async function FarmPage() {
  const viewer = await requireMember();
  const wallet = await getWallet(viewer.userId);
  const [farm, growthItems, followId] = await Promise.all([getFarm(viewer.userId, wallet.level), listGrowthItems(viewer.userId), getShowcaseId(viewer.userId)]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <PlaceHeader
        place="farm"
        icon="paw"
        title="동물 농장"
        aside={
          <div className="flex items-center gap-2">
            <p className="pixel-badge bg-[#e9f6e4] text-sm">
              키우는 중 <b>{MAX_ACTIVE_ANIMALS - farm.slotsLeft}</b> / {MAX_ACTIVE_ANIMALS}
            </p>
            {/* ⓘ 알 확률·암수·특별 진화·아기 모습 안내 (2026-10-12) */}
            <FarmInfo odds={farm.hatchOdds} />
          </div>
        }
      >
        <p className="text-sm">
          알을 부화시켜 동물을 키워요.{" "}
          {CARE_ACTIONS.map((c, i) => (
            <span key={c.action}>
              {i > 0 && " · "}
              <IconText icon={c.icon}>{c.label}</IconText>
            </span>
          ))}
          는 하루 한 번씩,
          공개 글로 보상을 받으면 동물마다 성장 +{POST_GROWTH}. 다 키우면 경험치와 코인을 받아요.
        </p>
      </PlaceHeader>
      <FarmView
        active={farm.active}
        grown={farm.grown}
        freeEggs={farm.freeEggs}
        slotsLeft={farm.slotsLeft}
        coins={wallet.coins}
        eggPrice={EGG_PRICE}
        eggEvery={EGG_LEVEL_EVERY}
        growthItems={growthItems}
        adoptable={farm.adoptable}
        skins={farm.skins}
        followId={followId}
      />
    </div>
  );
}
