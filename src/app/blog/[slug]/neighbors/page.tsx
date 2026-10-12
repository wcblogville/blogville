import Link from "next/link";
import { notFound } from "next/navigation";
import { NEIGHBOR_TAB_LABEL, NeighborLine } from "@/components/blog/neighbor-list";
import { CharacterBadge } from "@/components/character";
import { Pagination, parsePage } from "@/components/pagination";
import { getBlogBySlug } from "@/server/blog";
import { requireMember } from "@/server/dal";
import { getNeighborCounts, listNeighbors, parseNeighborTab, type NeighborTab } from "@/server/neighbors";

export async function generateMetadata(props: PageProps<"/blog/[slug]/neighbors">) {
  const { slug } = await props.params;
  const blog = await getBlogBySlug(slug);
  return { title: blog ? `${blog.nickname}님의 이웃` : "이웃" };
}

/**
 * 블로그 주인의 이웃 목록 (SOC-06, 사용자 요청 2026-10-12): ?tab=following(기본, 주인이 추가한 이웃) | followers(주인을 이웃으로 둔 주민).
 * 회원에게만 (방문자는 첫 화면으로). 한 줄을 누르면 그 블로그로 가고, [+ 이웃 추가]로 바로 이웃이 될 수 있다
 */
export default async function NeighborsPage(props: PageProps<"/blog/[slug]/neighbors">) {
  const viewer = await requireMember();
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const blog = await getBlogBySlug(slug);
  if (!blog) notFound();

  const tab = parseNeighborTab(sp.tab);
  const page = parsePage(sp.page);
  const base = `/@${blog.slug}`;
  const [counts, list] = await Promise.all([
    getNeighborCounts(blog.ownerId),
    listNeighbors({ ownerId: blog.ownerId, tab, viewerId: viewer.userId, page }),
  ]);
  const isOwner = viewer.userId === blog.ownerId;
  const hrefOf = (t: NeighborTab, n = 1) => {
    const q = new URLSearchParams({ ...(t === "followers" ? { tab: t } : {}), ...(n > 1 ? { page: String(n) } : {}) }).toString();
    return `${base}/neighbors${q ? `?${q}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* 블로그로 돌아가는 나무 간판 (글 화면과 같다) */}
      <Link href={base} className="pixel-wood mb-6 inline-flex min-h-11 max-w-full items-center gap-2 px-3 py-1 text-sm hover:brightness-105">
        <CharacterBadge asset={blog.characterAsset} size={28} outfit={blog.outfit} />
        <b className="truncate font-display text-base">{blog.title}</b>
        <span className="shrink-0 text-[#fff3d6]">· {blog.nickname}</span>
      </Link>

      <section className="pixel-card" aria-labelledby="neighbors-title" data-neighbors-page={tab}>
        <h1 id="neighbors-title" className="pb-plank px-4 py-2 font-display text-xl">
          👫 {isOwner ? "내" : `${blog.nickname}님의`} 이웃
        </h1>
        <div className="p-3 sm:p-4">
          <nav className="mb-3 flex flex-wrap gap-2" aria-label="이웃 목록 종류">
            {(["following", "followers"] as const).map((t) => (
              <Link key={t} href={hrefOf(t)} aria-current={t === tab ? "page" : undefined} className="pixel-tab min-h-11 px-3 text-sm" data-neighbor-tab={t}>
                {NEIGHBOR_TAB_LABEL[t]} <b>{counts[t].toLocaleString("ko-KR")}</b>
              </Link>
            ))}
          </nav>
          <p className="mb-2 px-1 text-xs text-ink-soft">
            {tab === "following"
              ? `${isOwner ? "내가" : `${blog.nickname}님이`} 이웃으로 추가한 주민이에요. 눌러서 블로그에 놀러 가 보세요.`
              : `${isOwner ? "나를" : `${blog.nickname}님을`} 이웃으로 추가한 주민이에요.`}
          </p>
          {list.rows.length ? (
            <ul className="space-y-1" data-neighbor-list>
              {list.rows.map((row) => (
                <NeighborLine key={row.userId} row={row} viewerId={viewer.userId} />
              ))}
            </ul>
          ) : (
            <p className="px-2 py-8 text-center text-ink-soft">{tab === "following" ? "아직 이웃이 없어요" : "아직 이웃으로 둔 주민이 없어요"}</p>
          )}
          <Pagination page={list.page} pageCount={list.pageCount} hrefFor={(n) => hrefOf(tab, n)} />
        </div>
      </section>
    </div>
  );
}
