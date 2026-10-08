import Link from "next/link";
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
  backgroundAsset: string;
  followerCount: number;
  postCount: number;
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

/** 블로그 상단: 미니룸(+ 전시 동물) + 블로그 정보(주인 프로필) */
export function BlogHeader({
  blog,
  viewerId,
  following,
  visits,
  showcase = null,
}: {
  blog: Blog;
  viewerId: string | null;
  following: boolean;
  visits: { today: number; yesterday: number; total: number };
  showcase?: { assetKey: string; name: string } | null;
}) {
  const isOwner = viewerId === blog.ownerId;
  return (
    <section className="card overflow-hidden">
      <MiniRoom
        characterAsset={blog.characterAsset}
        backgroundAsset={blog.backgroundAsset}
        // 배지는 블로그 이름이 아니라 주인 닉네임 (FR-023)
        nickname={blog.nickname}
        showcase={showcase}
        className="h-56 border-b-2 border-line sm:h-64"
      />
      <div className="flex flex-wrap items-end justify-between gap-4 p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {/* 주인 프로필: 사진 또는 캐릭터 얼굴 + 닉네임 (FR-028). 누구에게나 같다 (US4-10) */}
            <OwnerAvatar photoKey={blog.photoKey} characterAsset={blog.characterAsset} nickname={blog.nickname} />
            <div className="min-w-0">
              {/* 블로그 이름 링크도 누르는 영역 44px 이상 (FR-059, research R-24) */}
              <Link href={`/@${blog.slug}`} className="inline-flex min-h-11 min-w-11 items-center">
                <h1 className="font-display text-2xl break-words sm:text-3xl">{blog.title}</h1>
              </Link>
              <p data-owner-nickname className="-mt-1 text-sm font-bold text-ink-soft">
                {blog.nickname}
              </p>
            </div>
          </div>
          {blog.description && <p className="mt-1 text-ink-soft">{blog.description}</p>}
          <p className="mt-2 text-sm text-ink-soft">
            @{blog.slug} · 글 {blog.postCount} · 이웃 {blog.followerCount} ·{" "}
            <VisitCount blogId={blog.id} initial={visits} isOwner={isOwner} />
          </p>
        </div>
        {/* 좁은 화면에서는 버튼 3개를 한 줄에 같은 너비로 놓고, 글자가 두 줄로 깨지지 않게 한다 (이슈 #5).
            375px에서도 누르는 영역 44×44px 이상 (FR-059, research R-24) */}
        <div className={isOwner ? "grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto" : "flex gap-2"}>
          {isOwner ? (
            <>
              <Link href="/write" className="btn min-h-11 min-w-11 whitespace-nowrap bg-leaf text-white max-sm:gap-1 max-sm:px-2 max-sm:text-sm">✏️ 글쓰기</Link>
              <Link href="/closet" className="btn min-h-11 min-w-11 whitespace-nowrap bg-white text-ink max-sm:gap-1 max-sm:px-2 max-sm:text-sm">🎨 꾸미기</Link>
              <Link href="/settings/blog" className="btn min-h-11 min-w-11 whitespace-nowrap bg-white text-ink max-sm:gap-1 max-sm:px-2 max-sm:text-sm">⚙️ 관리</Link>
            </>
          ) : viewerId ? (
            <form action={toggleFollow.bind(null, blog.ownerId)}>
              <button className={`btn whitespace-nowrap ${following ? "bg-white text-ink" : "bg-sky text-white"}`}>
                {following ? "✓ 이웃" : "+ 이웃 추가"}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </section>
  );
}
