import { backgroundDataUri, characterDataUri } from "@/lib/assets";
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
    image: i.type === "background" ? backgroundDataUri(i.assetKey, 128) : characterDataUri(i.assetKey, 128),
  }));
  return <LevelUpDialog key={pending.level} level={pending.level} title={levelUpTitle(pending.level)} items={items} moreCount={pending.moreCount} />;
}
