import { backgroundDataUri, characterDataUri, lookKey } from "@/lib/assets";
import { animalSvg, hasAnimalArt, toAnimalDataUri } from "@/lib/art/animals";

/** 동그란 캐릭터 얼굴 (헤더, 댓글, 글 목록) */
export function CharacterBadge({ asset, size = 36, outfit = [] }: { asset: string; size?: number; outfit?: string[] }) {
  return (
    <span
      className="inline-grid shrink-0 place-items-center overflow-hidden rounded-full border-2 border-line bg-cream"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI)라 최적화가 필요 없다 */}
      <img
        src={characterDataUri(asset, 96, outfit)}
        alt=""
        data-look={lookKey(asset, outfit)}
        width={size * 1.15}
        height={size * 1.15}
        style={{ marginTop: size * 0.2 }}
      />
    </span>
  );
}

/** 캐릭터 전신 그림 */
export function CharacterArt({
  asset,
  size = 96,
  className = "",
  outfit = [],
}: {
  asset: string;
  size?: number;
  className?: string;
  /** 입은 아바타 아이템 asset_key (SHOP-06) */
  outfit?: string[];
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI)
    <img src={characterDataUri(asset, size * 2, outfit)} alt="" data-look={lookKey(asset, outfit)} width={size} height={size} className={className} aria-hidden />
  );
}

/** 다 키운 동물 그림 (도감 카드, 미니룸 전시). 어른 단계로 그린다 */
export function AnimalArt({ assetKey, size = 64, className = "" }: { assetKey: string; size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI)
  return <img src={toAnimalDataUri(animalSvg(assetKey, "adult", size * 2))} alt="" width={size} height={size} className={className} aria-hidden />;
}

/** 미니룸: 장착한 배경 장면 위에 캐릭터가 서 있는 작은 방.
 *  테두리·둥근 모서리는 쓰는 쪽이 className으로 정한다. 기본에 넣으면 클래스 순서 때문에 덮어쓰지 못한다 (#23)
 *  showcase: 전시 동물 한 마리 (BLOG-04 / FR-030, research R-20). 캐릭터 오른쪽에 그리고, 없거나 그림을 못 찾으면 빈 자리.
 *  캐릭터는 가운데에 그대로 둔다 (동물은 캐릭터 기준 오른쪽에 붙는다). shop의 가구 층은 이 둘 뒤(배경 위)에 놓는다 */
export function MiniRoom({
  characterAsset,
  backgroundAsset: bgKey,
  nickname,
  showcase = null,
  outfit = [],
  className = "",
}: {
  characterAsset: string;
  outfit?: string[];
  backgroundAsset: string;
  nickname?: string;
  showcase?: { assetKey: string; name: string } | null;
  className?: string;
}) {
  const animal = showcase && hasAnimalArt(showcase.assetKey) ? showcase : null;
  return (
    <div
      className={`relative overflow-hidden bg-cover bg-bottom ${className}`}
      // 미니룸은 넓은 배너로 쓰이므로 넓게 그린 장면을 쓴다 (확대돼서 흐려지지 않게)
      style={{ backgroundImage: `url("${backgroundDataUri(bgKey, 760)}")` }}
    >
      <div className="absolute inset-x-0 bottom-[6%] flex flex-col items-center">
        <div className="relative">
          <CharacterArt asset={characterAsset} outfit={outfit} size={112} className="animate-bounce drop-shadow-md [animation-duration:2s]" />
          {animal && (
            <span data-showcase className="absolute bottom-0 left-full -ml-3 flex w-16 flex-col items-center" title={animal.name}>
              {/* 절대 위치라 쓸 수 있는 너비가 0이 되므로 max-width를 풀어 64px 그대로 그린다 */}
              <AnimalArt assetKey={animal.assetKey} size={64} className="max-w-none drop-shadow-md" />
              <span className="sr-only">전시 동물 {animal.name}</span>
            </span>
          )}
        </div>
        {nickname && (
          <span className="-mt-1 rounded-full bg-white/90 px-3 py-0.5 text-sm font-bold text-ink shadow">{nickname}</span>
        )}
      </div>
    </div>
  );
}
