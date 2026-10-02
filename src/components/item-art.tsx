import { backgroundAsset, characterEmoji } from "@/lib/assets";

/** 아이템 미리보기 그림: 캐릭터는 이모지, 배경은 그라데이션 */
export function ItemArt({ type, assetKey, className = "h-28" }: { type: string; assetKey: string; className?: string }) {
  if (type === "character") {
    return (
      <div className={`grid place-items-center rounded-xl bg-cream text-6xl ${className}`} aria-hidden>
        {characterEmoji(assetKey)}
      </div>
    );
  }
  return <div className={`rounded-xl border-2 border-line ${className}`} style={{ background: backgroundAsset(assetKey).css }} aria-hidden />;
}
