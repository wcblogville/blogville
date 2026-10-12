import { PlaceHeader, WalletChips } from "@/components/place-banner";
import { StyleStudio } from "@/components/style-studio";
import { AVATAR_PARTS, type AvatarSlot } from "@/lib/art/avatar";
import { hasHair } from "@/lib/art/characters";
import { STYLE_PLACES } from "@/lib/style";
import { requireMember } from "@/server/dal";
import { getEquipped } from "@/server/inventory";
import { getWallet } from "@/server/points";
import { listStyleItems } from "@/server/style";
import { saveSalonStyle } from "./actions";

export const metadata = { title: "미용실" };

// 미용실 (SHOP-07, 사용자 요청 2026-10-11): 광장 건물 입구와 휴대폰 ☰ 메뉴로 들어온다
export default async function SalonPage() {
  const viewer = await requireMember();
  const place = "salon" as const;
  const slots: readonly AvatarSlot[] = STYLE_PLACES[place].slots;
  const [items, equipped, wallet] = await Promise.all([listStyleItems(viewer.userId, place), getEquipped(viewer.userId), getWallet(viewer.userId)]);
  const worn = Object.fromEntries(slots.map((s) => [s, equipped.avatar[s] ?? null]));
  // 이 가게가 다루지 않는 부위에 입은 것은 미리보기에 그대로 입힌다
  const baseOutfit = viewer.profile.outfit.filter((k) => !slots.includes(AVATAR_PARTS[k]?.slot));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <PlaceHeader place="salon" icon="scissors" title="반짝 미용실" aside={<WalletChips level={wallet.level} coins={wallet.coins} />}>
        <p className="max-w-2xl">머리 모양과 머리 색을 골라 보세요. 거울 속 내 캐릭터에 바로 입혀 보고, 마음에 들면 적용해요. 기본 머리와 기본 색은 무료예요.</p>
      </PlaceHeader>
      <StyleStudio
        place={place}
        items={items}
        worn={worn}
        character={viewer.profile.characterAsset}
        baseOutfit={baseOutfit}
        level={wallet.level}
        coins={wallet.coins}
        hairVisible={hasHair(viewer.profile.characterAsset)}
        save={saveSalonStyle}
      />
    </div>
  );
}
