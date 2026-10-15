import { CharacterArt } from "@/components/character";
import { backgroundSky, previewLook } from "@/lib/assets";
import { itemArtSrc } from "@/lib/art/item-src";

/** 아이템 미리보기 그림 (상점, 꾸미기) */
export function ItemArt({
  type,
  assetKey,
  className = "h-28",
  characterSize = 96,
}: {
  type: string;
  assetKey: string;
  className?: string;
  /** 그림 한 변 px. 캐릭터는 24, 가구·성장 아이템은 32의 배수여야 도트가 고르다 (96은 둘 다) */
  characterSize?: number;
}) {
  if (type === "character") {
    return (
      <div className={`pixel-slot grid place-items-center ${className}`} aria-hidden>
        <CharacterArt asset={assetKey} size={characterSize} />
      </div>
    );
  }
  // 아바타 꾸미기: 회색 몸 위에 그 아이템만 입혀 보여 준다 (SHOP-06). 머리 모양·색은 사람 주민에게 (SHOP-07)
  if (type === "avatar") {
    const look = previewLook(assetKey);
    return (
      <div className={`pixel-slot grid place-items-center ${className}`} aria-hidden>
        <CharacterArt asset={look.asset} outfit={look.outfit} size={characterSize} />
      </div>
    );
  }
  if (type === "furniture" || type === "growth" || type === "deco") {
    const src = itemArtSrc(type, assetKey, characterSize);
    return (
      <div className={`pixel-slot grid place-items-center ${type === "furniture" ? "bg-[#f6ead7]!" : type === "deco" ? "bg-[#e3f3dd]!" : "bg-[#e9f6e4]!"} ${className}`} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 도트 SVG (/px/item/…, 한 번 받아 캐시). 화면 밖 카드는 늦게 받는다 */}
        <img src={src} alt="" width={characterSize} height={characterSize} loading="lazy" decoding="async" className="pixelated" />
      </div>
    );
  }
  return (
    <div
      className={`pixelated bg-bottom shadow-[inset_0_0_0_3px_#4a342633] ${className}`}
      // 2배 도트 그대로 아래 가운데에 (늘이지 않는다)
      style={{ backgroundImage: `url("${itemArtSrc("background", assetKey)}")`, backgroundColor: backgroundSky(assetKey) }}
      aria-hidden
    />
  );
}
