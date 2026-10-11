import { StyleStudio } from "@/components/style-studio";
import { AVATAR_PARTS, type AvatarSlot } from "@/lib/art/avatar";
import { hasHair } from "@/lib/art/characters";
import { STYLE_PLACES } from "@/lib/style";
import { requireMember } from "@/server/dal";
import { getEquipped } from "@/server/inventory";
import { getWallet } from "@/server/points";
import { listStyleItems } from "@/server/style";
import { saveClothesStyle } from "./actions";

export const metadata = { title: "옷가게" };

// 옷가게 (SHOP-08, 사용자 요청 2026-10-11): 광장 건물 입구와 휴대폰 ☰ 메뉴로 들어온다
export default async function ClothesPage() {
  const viewer = await requireMember();
  const place = "clothes" as const;
  const slots: readonly AvatarSlot[] = STYLE_PLACES[place].slots;
  const [items, equipped, wallet] = await Promise.all([listStyleItems(viewer.userId, place), getEquipped(viewer.userId), getWallet(viewer.userId)]);
  const worn = Object.fromEntries(slots.map((s) => [s, equipped.avatar[s] ?? null]));
  // 이 가게가 다루지 않는 부위에 입은 것은 미리보기에 그대로 입힌다
  const baseOutfit = viewer.profile.outfit.filter((k) => !slots.includes(AVATAR_PARTS[k]?.slot));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">👗 꼬까 옷가게</h1>
          <p className="mt-1 max-w-2xl text-ink-soft">옷·모자·소품을 마음껏 입어 보세요. 거울 속 내 캐릭터가 걸어 다니며 보여 줘요. 마음에 들면 사서 바로 입어요.</p>
        </div>
        <div className="card flex gap-4 px-4 py-2 text-sm">
          <span>
            Lv.<b>{wallet.level}</b>
          </span>
          <span>
            🪙 <b>{wallet.coins.toLocaleString()}</b>
          </span>
        </div>
      </div>
      <StyleStudio
        place={place}
        items={items}
        worn={worn}
        character={viewer.profile.characterAsset}
        baseOutfit={baseOutfit}
        level={wallet.level}
        coins={wallet.coins}
        hairVisible={hasHair(viewer.profile.characterAsset)}
        save={saveClothesStyle}
      />
    </div>
  );
}
