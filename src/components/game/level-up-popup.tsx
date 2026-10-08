import { backgroundDataUri, characterDataUri, furnitureDataUri, growthDataUri, MANNEQUIN } from "@/lib/assets";
import { levelUpTitle } from "@/lib/notifications";
import { getPendingLevelUp } from "@/server/notifications";
import { LevelUpDialog } from "./level-up-dialog";

/** 안 본 레벨업이 있을 때만 팝업을 그린다. 범위는 헤더가 이미 읽은 값(getHeaderNotifications)을 받는다 */
export async function LevelUpPopup({ userId, minLevel, maxLevel }: { userId: string; minLevel: number; maxLevel: number }) {
  const pending = await getPendingLevelUp(userId, { min: minLevel, max: maxLevel });
  if (!pending) return null;
  const items = pending.items.map((i) => ({
    id: i.id,
    name: i.name,
    image: itemImage(i.type, i.assetKey),
  }));
  return <LevelUpDialog key={pending.level} level={pending.level} title={levelUpTitle(pending.level)} items={items} moreCount={pending.moreCount} />;
}

/** 새로 열린 아이템 미리보기 그림 (상점 카드와 같은 그림) */
function itemImage(type: string, assetKey: string) {
  if (type === "background") return backgroundDataUri(assetKey, 128);
  if (type === "furniture") return furnitureDataUri(assetKey, 128);
  if (type === "growth") return growthDataUri(assetKey, 128);
  if (type === "avatar") return characterDataUri(MANNEQUIN, 128, [assetKey]);
  return characterDataUri(assetKey, 128);
}
