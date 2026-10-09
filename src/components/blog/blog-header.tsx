import Link from "next/link";
import type React from "react";
import { CharacterBadge, MiniRoom } from "@/components/character";
import { toggleFollow } from "@/app/blog/actions";
import { VisitCount } from "./visit-count";

type Blog = {
  id: number;
  slug: string;
  title: string;
  description: string;
  ownerId: string;
  nickname: string;
  photoKey: string | null;
  characterAsset: string;
  /** 주인이 입은 아바타 아이템 (SHOP-06) */
  outfit?: string[];
  backgroundAsset: string;
  followerCount: number;
  postCount: number;
  /** 공지 블로그(관리자): 마을이 없다 */
  isNotice?: boolean;
};

/**
 * 주인 프로필 사진(48px 원형) 또는 캐릭터 얼굴 (BLOG-04 / FR-028, research R-20·R-21).
 * 사진은 post 소유 /files/{키}가 누구에게나 내려준다 (프로필 사진 첨부는 비공개 글 보호와 별개)
 */
export function OwnerAvatar({ photoKey, characterAsset, nickname, size = 48 }: { photoKey: string | null; characterAsset: string; nickname: string; size?: number }) {
  if (!photoKey) return <CharacterBadge asset={characterAsset} size={size} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 회원이 올린 사진 첨부(/files)라 next/image 최적화 대상이 아니다
    <img
      src={`/files/${photoKey}`}
      alt={`${nickname} 프로필 사진`}
      width={size}
      height={size}
      className="shrink-0 rounded-full border-2 border-line bg-cream object-cover"
      style={{ width: size, height: size }}
    />
  );
}

/**
 * 블로그 위쪽 오른쪽의 세로 프로필 카드 (BLOG-04, 사용자 요청 2026-10-09).
 * 위: 미니룸(배경 + 주인 캐릭터 + 전시 동물), 아래: 블로그 이름·닉네임·주소, 레벨(모두에게), 코인(주인만),
 * 글·이웃·방문 숫자, 전시 동물 한 줄과 [🏅 도감], 그리고 주인/회원 버튼. 왼쪽의 "우리 집" 방과 높이를 맞춘다
 */
export function BlogHeader({
  blog,
  viewerId,
  following,
  visits,
  showcase = null,
  wallet,
  collection,
  className = "",
}: {
  blog: Blog;
  viewerId: string | null;
  following: boolean;
  visits: { today: number; yesterday: number; total: number };
  showcase?: { assetKey: string; name: string } | null;
  /** 주인의 레벨·경험치(모두에게)와 코인(주인에게만 보인다) */
  wallet: { level: number; current: number; needed: number; ratio: number; isMax: boolean; coins: number };
  /** [🏅 도감] 버튼 (다 키운 동물 창) */
  collection: React.ReactNode;
  className?: string;
}) {
  const isOwner = viewerId === blog.ownerId;
  return (
    <section className={`card flex flex-col overflow-hidden ${className}`} aria-label="블로그 주인 프로필" data-profile-card>
      <MiniRoom
        characterAsset={blog.characterAsset}
        outfit={blog.outfit}
        backgroundAsset={blog.backgroundAsset}
        // 배지는 블로그 이름이 아니라 주인 닉네임 (FR-023)
        nickname={blog.nickname}
        showcase={showcase}
        className="h-44 shrink-0 border-b-2 border-line"
      />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          {/* 주인 프로필: 사진 또는 캐릭터 얼굴 + 닉네임 (FR-028). 누구에게나 같다 (US4-10) */}
          <OwnerAvatar photoKey={blog.photoKey} characterAsset={blog.characterAsset} nickname={blog.nickname} />
          <div className="min-w-0">
            {/* 블로그 이름 링크도 누르는 영역 44px 이상 (FR-059, research R-24) */}
            <Link href={`/@${blog.slug}`} className="inline-flex min-h-11 min-w-11 items-center">
              <h1 className="font-display text-2xl leading-tight break-words">{blog.title}</h1>
            </Link>
            <p className="-mt-1 text-sm text-ink-soft">
              <b data-owner-nickname>{blog.nickname}</b> · @{blog.slug}
            </p>
          </div>
        </div>
        {blog.description && <p className="text-sm text-ink-soft">{blog.description}</p>}

        {/* 레벨은 모두에게, 코인은 주인에게만 */}
        <div className="flex items-center gap-3 text-sm" data-profile-level>
          <span className="shrink-0 rounded-full bg-sun px-2.5 py-0.5 font-display text-base text-ink">Lv.{wallet.level}</span>
          <div className="min-w-0 flex-1">
            <span className="block h-2 overflow-hidden rounded-full bg-cream" aria-hidden>
              <span className="block h-full rounded-full bg-sun" style={{ width: `${Math.round(wallet.ratio * 100)}%` }} />
            </span>
            <span className="text-xs text-ink-soft">
              {wallet.isMax ? "최고 레벨" : `경험치 ${wallet.current.toLocaleString()} / ${wallet.needed.toLocaleString()}`}
            </span>
          </div>
          {isOwner && (
            <span className="shrink-0 font-bold" title="내 코인" data-profile-card-coins>
              🪙 {wallet.coins.toLocaleString()}
            </span>
          )}
        </div>

        <p className="text-sm text-ink-soft">
          글 {blog.postCount} · 이웃 {blog.followerCount}
          <br />
          <VisitCount blogId={blog.id} initial={visits} isOwner={isOwner} />
        </p>

        {/* 전시 동물 한 마리 + 도감 버튼 */}
        <div className="flex items-center justify-between gap-2 rounded-xl bg-cream px-3 py-1.5 text-sm" data-showcase-line>
          <span className="min-w-0 truncate">{showcase ? <>🏅 전시 중: <b>{showcase.name}</b></> : <span className="text-ink-soft">전시한 동물이 없어요</span>}</span>
          {collection}
        </div>

        {/* 버튼은 카드 맨 아래. 3개는 한 줄에 같은 너비로 놓고, 글자가 두 줄로 깨지지 않게 한다 (이슈 #5).
            375px에서도 누르는 영역 44×44px 이상 (FR-059, research R-24) */}
        {isOwner ? (
          <div className="mt-auto grid grid-cols-3 gap-2">
            <Link href="/write" className="btn min-h-11 min-w-11 gap-1 whitespace-nowrap bg-leaf px-2 text-sm text-white">✏️ 글쓰기</Link>
            <Link href="/closet" className="btn min-h-11 min-w-11 gap-1 whitespace-nowrap bg-white px-2 text-sm text-ink">🎨 꾸미기</Link>
            <Link href="/settings/blog" className="btn min-h-11 min-w-11 gap-1 whitespace-nowrap bg-white px-2 text-sm text-ink">⚙️ 관리</Link>
          </div>
        ) : viewerId ? (
          <div className="mt-auto flex gap-2">
            {/* 이 회원의 마을 구경 (사용자 요청 2026-10-09). 휴대폰에는 광장이 없어 숨긴다 */}
            {!blog.isNotice && (
              <Link href={`/town/${blog.slug}`} className="btn min-h-11 flex-1 whitespace-nowrap bg-white text-sm text-ink phone:hidden" data-visit-town>
                🏘 마을 구경
              </Link>
            )}
            <form action={toggleFollow.bind(null, blog.ownerId)} className="flex flex-1">
              <button className={`btn min-h-11 flex-1 whitespace-nowrap text-sm ${following ? "bg-white text-ink" : "bg-sky text-white"}`}>
                {following ? "✓ 이웃" : "+ 이웃 추가"}
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </section>
  );
}
