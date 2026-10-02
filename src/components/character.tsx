import { backgroundAsset, characterEmoji } from "@/lib/assets";

/** 동그란 캐릭터 얼굴 */
export function CharacterBadge({ asset, size = 36 }: { asset: string; size?: number }) {
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full border-2 border-line bg-cream"
      style={{ width: size, height: size, fontSize: size * 0.6 }}
      aria-hidden
    >
      {characterEmoji(asset)}
    </span>
  );
}

/** 미니룸: 장착한 배경 위에 캐릭터가 서 있는 작은 방 */
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
  const bg = backgroundAsset(bgKey);
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border-2 border-line ${className}`}
      style={{ background: bg.css }}
    >
      <div className="absolute inset-x-0 bottom-[12%] flex flex-col items-center">
        <span className="animate-bounce text-6xl drop-shadow-md [animation-duration:2s] sm:text-7xl">
          {characterEmoji(characterAsset)}
        </span>
        {nickname && (
          <span className="mt-1 rounded-full bg-white/85 px-3 py-0.5 text-sm font-bold text-ink shadow">
            {nickname}
          </span>
        )}
      </div>
    </div>
  );
}
