import Link from "next/link";
import { CharacterBadge } from "@/components/character";
import { toggleFollow } from "@/app/blog/actions";

type Blog = {
  id: number;
  slug: string;
  title: string;
  description: string;
  ownerId: string;
  nickname: string;
  photoKey: string | null;
  characterAsset: string;
  /** 주인이 지금 입은 아바타 (꾸민 모습) */
  outfit?: string[];
  followerCount: number;
  postCount: number;
  /** 공지 블로그(관리자): 마을이 없다 */
  isNotice?: boolean;
};

/**
 * 주인 프로필 사진(48px 원형) 또는 캐릭터 얼굴 (BLOG-04 / FR-028, research R-20·R-21).
 * 사진이 있으면 사진이 먼저다. 사진이 없으면 지금 꾸민 모습(옷·머리·얼굴형, 2026-10-12)의 캐릭터 얼굴.
 * 사진은 post 소유 /files/{키}가 누구에게나 내려준다 (프로필 사진 첨부는 비공개 글 보호와 별개)
 */
export function OwnerAvatar({
  photoKey,
  characterAsset,
  outfit = [],
  nickname,
  size = 48,
}: {
  photoKey: string | null;
  characterAsset: string;
  outfit?: string[];
  nickname: string;
  size?: number;
}) {
  if (!photoKey) return <CharacterBadge asset={characterAsset} outfit={outfit} size={size} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 회원이 올린 사진 첨부(/files)라 next/image 최적화 대상이 아니다
    <img
      src={`/files/${photoKey}`}
      alt={`${nickname} 프로필 사진`}
      width={size}
      height={size}
      className="pixelated shrink-0 bg-cream object-cover shadow-[0_0_0_3px_#4a3426]"
      style={{ width: size, height: size }}
    />
  );
}

/**
 * 블로그 제목 줄 (BLOG-04, 사용자 요청 2026-10-11 "프로필 카드를 아예 없애도 될 듯"): 우리 집 방 바로 위 한 줄.
 * 왼쪽: 주인 사진(또는 캐릭터 얼굴)·블로그 이름·닉네임·주소·소개, 가운데: 주인 레벨과 경험치 막대(모두에게)·글·이웃 수,
 * 오른쪽: 다른 회원에게만 [🏘 마을 구경] [+ 이웃 추가]. 주인 버튼은 아래 주인 도구 막대에, 코인은 헤더에, 방문자 수는 옆 칸 위젯에 있다.
 * 캐릭터와 전시 동물은 방 안(RoomResident), [🏅 도감]은 방 도구 줄로 옮겼다
 */
export function BlogTitleBar({
  blog,
  viewerId,
  following,
  wallet,
  className = "",
}: {
  blog: Blog;
  viewerId: string | null;
  following: boolean;
  /** 주인의 레벨·경험치 (모두에게) */
  wallet: { level: number; current: number; needed: number; ratio: number; isMax: boolean };
  className?: string;
}) {
  const isOwner = viewerId === blog.ownerId;
  const exp = wallet.isMax ? "최고 레벨" : `경험치 ${wallet.current.toLocaleString()} / ${wallet.needed.toLocaleString()}`;
  return (
    <section className={`pixel-card flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 ${className}`} aria-label="블로그 이름과 주인" data-blog-title-bar>
      <div className="flex min-w-0 flex-[1_1_18rem] items-center gap-3">
        {/* 주인 프로필: 사진 또는 캐릭터 얼굴 (FR-028). 누구에게나 같다 (US4-10) */}
        <OwnerAvatar photoKey={blog.photoKey} characterAsset={blog.characterAsset} outfit={blog.outfit} nickname={blog.nickname} />
        <div className="min-w-0">
          {/* 블로그 이름 링크도 누르는 영역 44px 이상 (FR-059, research R-24) */}
          <Link href={`/@${blog.slug}`} className="inline-flex min-h-11 min-w-11 items-center">
            <h1 className="pb-title font-display text-2xl leading-tight break-words">{blog.title}</h1>
          </Link>
          <p className="-mt-1 text-sm text-ink-soft">
            <b data-owner-nickname>{blog.nickname}</b> · @{blog.slug}
            {blog.description && <span className="block break-words sm:inline sm:before:content-['_·_']">{blog.description}</span>}
          </p>
        </div>
      </div>

      {/* 주인 레벨(모두에게)과 글·이웃 수. 방문자 수는 옆 칸 👣 방문자 위젯에 */}
      <div className="flex items-center gap-3 text-sm" data-profile-level>
        <span className="pixel-wood shrink-0 px-2.5 py-0.5 font-display text-base" title={exp}>
          Lv.{wallet.level}
        </span>
        <span className="grid w-28 gap-1.5 px-[3px] pt-[3px]">
          <span className="pixel-bar block h-3" aria-hidden>
            <span className="pixel-bar-fill block bg-sun" style={{ width: `${Math.round(wallet.ratio * 100)}%` }} />
          </span>
          <span className="text-xs text-ink-soft">{wallet.isMax ? "최고 레벨" : `${wallet.current.toLocaleString()} / ${wallet.needed.toLocaleString()}`}</span>
        </span>
        <span className="whitespace-nowrap text-ink-soft" data-blog-counts>
          글 <b className="text-ink">{blog.postCount}</b> · 이웃 <b className="text-ink">{blog.followerCount}</b>
        </span>
      </div>

      {/* 다른 회원에게만: 마을 구경·이웃 추가. 375px에서도 누르는 영역 44×44px 이상 (FR-059) */}
      {viewerId && !isOwner && (
        <div className="flex flex-[1_1_100%] gap-2 sm:ml-auto sm:flex-none">
          {/* 이 회원의 마을 구경 (사용자 요청 2026-10-09). 휴대폰에는 광장이 없어 숨긴다 */}
          {!blog.isNotice && (
            <Link href={`/town/${blog.slug}`} className="pixel-btn pixel-btn-sm flex-1 whitespace-nowrap bg-[#fffaf0] px-4 text-ink phone:hidden" data-visit-town>
              🏘 마을 구경
            </Link>
          )}
          <form action={toggleFollow.bind(null, blog.ownerId)} className="flex flex-1">
            <button className={`pixel-btn pixel-btn-sm w-full flex-1 whitespace-nowrap px-4 ${following ? "bg-[#fffaf0] text-ink" : "bg-sky text-white"}`}>
              {following ? "✓ 이웃" : "+ 이웃 추가"}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
