import { backgroundDataUri, characterDataUri } from "@/lib/assets";

/** 동그란 캐릭터 얼굴 (헤더, 댓글, 글 목록) */
export function CharacterBadge({ asset, size = 36 }: { asset: string; size?: number }) {
  return (
    <span
      className="inline-grid shrink-0 place-items-center overflow-hidden rounded-full border-2 border-line bg-cream"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI)라 최적화가 필요 없다 */}
      <img src={characterDataUri(asset, 96)} alt="" width={size * 1.15} height={size * 1.15} style={{ marginTop: size * 0.2 }} />
    </span>
  );
}

/** 캐릭터 전신 그림 */
export function CharacterArt({ asset, size = 96, className = "" }: { asset: string; size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI)
  return <img src={characterDataUri(asset, size * 2)} alt="" width={size} height={size} className={className} aria-hidden />;
}

/** 미니룸: 장착한 배경 장면 위에 캐릭터가 서 있는 작은 방 */
export function MiniRoom({
  characterAsset,
  backgroundAsset: bgKey,
  nickname,
  className = "",
}: {
  characterAsset: string;
  backgroundAsset: string;
  nickname?: string;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border-2 border-line bg-cover bg-bottom ${className}`}
      // 미니룸은 넓은 배너로 쓰이므로 넓게 그린 장면을 쓴다 (확대돼서 흐려지지 않게)
      style={{ backgroundImage: `url("${backgroundDataUri(bgKey, 760)}")` }}
    >
      <div className="absolute inset-x-0 bottom-[6%] flex flex-col items-center">
        <CharacterArt asset={characterAsset} size={112} className="animate-bounce drop-shadow-md [animation-duration:2s]" />
        {nickname && (
          <span className="-mt-1 rounded-full bg-white/90 px-3 py-0.5 text-sm font-bold text-ink shadow">{nickname}</span>
        )}
      </div>
    </div>
  );
}
