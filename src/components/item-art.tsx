import { CharacterArt } from "@/components/character";
import { backgroundDataUri } from "@/lib/assets";

/** 아이템 미리보기 그림 (상점, 꾸미기) */
export function ItemArt({
  type,
  assetKey,
  className = "h-28",
  characterSize = 92,
}: {
  type: string;
  assetKey: string;
  className?: string;
  characterSize?: number;
}) {
  if (type === "character") {
    return (
      <div className={`grid place-items-center rounded-xl bg-cream ${className}`} aria-hidden>
        <CharacterArt asset={assetKey} size={characterSize} />
      </div>
    );
  }
  return (
    <div
      className={`rounded-xl border-2 border-line bg-cover bg-bottom ${className}`}
      style={{ backgroundImage: `url("${backgroundDataUri(assetKey)}")` }}
      aria-hidden
    />
  );
}
