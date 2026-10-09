import { CharacterArt } from "@/components/character";
import { backgroundDataUri, decoDataUri, furnitureDataUri, growthDataUri, MANNEQUIN } from "@/lib/assets";

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
  // 아바타 꾸미기: 회색 몸 위에 그 아이템만 입혀 보여 준다 (SHOP-06)
  if (type === "avatar") {
    return (
      <div className={`grid place-items-center rounded-xl bg-cream ${className}`} aria-hidden>
        <CharacterArt asset={MANNEQUIN} outfit={[assetKey]} size={characterSize} />
      </div>
    );
  }
  if (type === "furniture" || type === "growth" || type === "deco") {
    const uri = type === "furniture" ? furnitureDataUri(assetKey, 160) : type === "deco" ? decoDataUri(assetKey, 160) : growthDataUri(assetKey, 160);
    return (
      <div className={`grid place-items-center rounded-xl ${type === "furniture" ? "bg-[#f6ead7]" : type === "deco" ? "bg-[#e3f3dd]" : "bg-[#e9f6e4]"} ${className}`} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI) */}
        <img src={uri} alt="" width={characterSize} height={characterSize} />
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
