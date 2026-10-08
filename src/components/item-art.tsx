import { CharacterArt } from "@/components/character";
import { backgroundDataUri } from "@/lib/assets";
import { furnitureDataUri } from "@/lib/art/furniture";

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
  if (type === "furniture") {
    return (
      <div className={`grid place-items-center rounded-xl bg-[#f6ead7] ${className}`} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI) */}
        <img src={furnitureDataUri(assetKey, 160)} alt="" width={characterSize} height={characterSize} />
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
