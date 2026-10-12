import Link from "next/link";
import { notFound } from "next/navigation";
import { AnimalCollection } from "@/components/blog/animal-collection";
import { BlogTitleBar } from "@/components/blog/blog-header";
import { BlogSearchBox, BlogSearchResults } from "@/components/blog/blog-search";
import {
  BlogFindBox,
  PopularPostsWidget,
  RecentCommentsWidget,
  RecentPostsWidget,
  TagsWidget,
  VisitorsWidget,
} from "@/components/blog/blog-sidebar";
import { OwnerToolbar } from "@/components/blog/owner-toolbar";
import { HouseRoom } from "@/components/blog/house-room";
import { CategoryNav } from "@/components/blog/category-nav";
import { PostCard } from "@/components/blog/post-card";
import { Pagination, parsePage } from "@/components/pagination";
import { parseSearchQuery } from "@/lib/blog";
import { formatDate } from "@/lib/format";
import { animalName } from "@/lib/farm";
import { REWARD_RULES } from "@/lib/game";
import { currentRoof, houseInfo, roofOrder } from "@/lib/house";
import { parseId } from "@/lib/ids";
import {
  getBlogBySlug,
  getBlogSidebar,
  getBlogVisitStats,
  getCategories,
  getGrownAnimals,
  isFollowing,
  listBlogPosts,
  listFeed,
  searchBlogs,
} from "@/server/blog";
import { getViewer } from "@/server/dal";
import { getOwnedFurniture, getPlacedFurniture } from "@/server/house";
import { getWallet } from "@/server/points";

export async function generateMetadata(props: PageProps<"/blog/[slug]">) {
  const { slug } = await props.params;
  const blog = await getBlogBySlug(slug);
  return { title: blog ? blog.title : "블로그를 찾을 수 없어요" };
}

/**
 * 블로그 홈 (BLOG-02·04·05 / contracts/blog-home.md 1절).
 * 주소 값: ?sub=(소분류, category보다 먼저) ?category=(대분류) ?page= — 숫자는 parseId, 이상한 값은 무시 (FR-057, research R-13).
 * ?q= 는 주인일 때만 마을 검색 모드 (FR-050, research R-15). 주인이 아니면 q를 무시하고 검색 쿼리를 돌리지 않는다.
 * ?s= 는 이 블로그 안 검색, ?tag= 는 이 블로그의 그 태그 글 (모두에게, 주인이면 비공개 글도. 사용자 요청 2026-10-11).
 * 아래쪽은 넓은 화면에서 글 목록 + 오른쪽 옆 칸(위젯), 좁은 화면에서는 글 목록 아래에 위젯을 쌓는다
 */
export default async function BlogHomePage(props: PageProps<"/blog/[slug]">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const blog = await getBlogBySlug(slug);
  if (!blog) notFound();

  const viewer = await getViewer();
  const viewerId = viewer?.profile ? viewer.userId : null;
  const isOwner = viewerId === blog.ownerId;
  const page = parsePage(sp.page);
  const subcategoryId = parseId(sp.sub) ?? undefined; // 이상한 값이면 category 또는 전체 글
  const categoryId = subcategoryId ? undefined : (parseId(sp.category) ?? undefined);
  const search = isOwner ? parseSearchQuery(sp.q) : null; // 51자 이상은 null → 보통 블로그 홈
  const find = search ? null : parseSearchQuery(sp.s); // 블로그 안 검색 (마을 검색이 먼저)
  const rawTag = typeof sp.tag === "string" ? sp.tag.trim() : "";
  const tag = !search && !find && rawTag && [...rawTag].length <= 50 ? rawTag : null;
  const base = `/@${blog.slug}`;

  const welcome = isOwner && Boolean(sp.welcome);
  const [cats, list, following, visits, grown, found, ownerWallet, placed, owned, side] = await Promise.all([
    getCategories(blog.id, isOwner),
    search
      ? search.empty
        ? null
        : listFeed({ page, search: search.q })
      : find
        ? find.empty
          ? null
          : listBlogPosts({ blogId: blog.id, isOwner, search: find.q, page })
        : tag
          ? listBlogPosts({ blogId: blog.id, isOwner, tag, page })
          : listBlogPosts({ blogId: blog.id, isOwner, categoryId, subcategoryId, page }),
    viewerId && !isOwner ? isFollowing(viewerId, blog.ownerId) : false,
    getBlogVisitStats(blog.id),
    getGrownAnimals(blog.ownerId),
    search && !search.empty && page === 1 ? searchBlogs(search.q) : [],
    getWallet(blog.ownerId),
    getPlacedFurniture(blog.ownerId),
    isOwner ? getOwnedFurniture(blog.ownerId) : null,
    getBlogSidebar(blog.id, isOwner),
  ]);
  // 문: 마을의 이 집 앞으로 나간다. 처음 가입한 회원은 환영 문구가 있는 마을로 (마을 개편 2차)
  const doorHref = welcome ? "/town?welcome=1" : `/town?at=${blog.slug}`;

  // 전시 동물은 주인의 다 키운 동물 목록에서 찾는다. 없으면(지워짐·다 자라지 않음) 빈 자리 (spec Edge Cases)
  const shown = grown.find((a) => a.id === blog.showcaseAnimalId) ?? null;
  const house = houseInfo(ownerWallet.level);
  const currentCat = categoryId ? cats.find((c) => c.id === categoryId) : undefined;
  const currentSub = subcategoryId ? cats.flatMap((c) => c.subcategories).find((s) => s.id === subcategoryId) : undefined;
  const selected = search || find || tag
    ? null
    : currentSub
      ? ({ kind: "sub", id: currentSub.id } as const)
      : currentCat
        ? ({ kind: "category", id: currentCat.id } as const)
        : !categoryId && !subcategoryId
          ? ({ kind: "all" } as const)
          : null; // 없는 번호·다른 블로그 번호: 선택 표시 없음, 제목 `전체 글 0개`
  const pageHref = (n: number) =>
    `${base}?${new URLSearchParams({
      ...(search
        ? { q: search.q }
        : find
          ? { s: find.q }
          : tag
            ? { tag }
            : subcategoryId
              ? { sub: String(subcategoryId) }
              : categoryId
                ? { category: String(categoryId) }
                : {}),
      page: String(n),
    })}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {welcome && (
        <div className="pixel-panel mb-6 flex items-start gap-3 bg-[#fff3d6] p-4" data-welcome>
          <span className="text-3xl" aria-hidden>
            🎉
          </span>
          <p className="flex-1 text-sm sm:text-base">
            <b>{blog.nickname}</b>님, Blogville에 오신 걸 환영해요! 가입 선물 🪙 {REWARD_RULES.signup.coins}에 첫 출석 보상까지 받았어요. 여기는 {blog.nickname}님의 블로그이자 집 안이에요.{" "}
            <span className="phone:hidden">
              아래 <b>우리 집</b>의 <b>🚪 문</b>을 눌러 밖으로 나가 마을을 구경해 보세요.
            </span>
            <span className="hidden phone:inline">화면 아래 탭으로 마을 소식·상점·알림을 오가고, ☰ 메뉴에서 출석·농장·낚시터에 갈 수 있어요.</span>
          </p>
        </div>
      )}
      {/* 위쪽 (사용자 요청 2026-10-11 "프로필 카드를 아예 없애도 될 듯"): 블로그 제목 줄 → 너비를 다 쓰는 "우리 집" 방.
          주인 캐릭터와 전시 동물은 방 안을 걷고, [🏅 도감]은 방 도구 줄에 있다. 휴대폰도 같은 순서로 쌓인다 */}
      <BlogTitleBar blog={blog} viewerId={viewerId} following={following} wallet={ownerWallet} />
      <HouseRoom
        house={house}
        placed={placed}
        owned={owned}
        roof={isOwner ? { current: currentRoof(blog.id, blog.roofColor), order: roofOrder(blog.id), unlocked: house.stage } : null}
        doorHref={doorHref}
        highlightDoor={welcome}
        resident={{ characterAsset: blog.characterAsset, outfit: blog.outfit }}
        // 꾸미기에서 고른 배경은 창밖 풍경으로 보인다
        view={blog.backgroundAsset}
        pet={shown && { assetKey: shown.assetKey, name: animalName(shown.name, shown.variant), skinKey: shown.skinKey, size: shown.size, sex: shown.sex, variant: shown.variant, form: shown.form }}
        collection={
          // 도감: [🏅 도감] 버튼 → 다 키운 동물 창 (FR-029, research R-20). 누구에게나, 전시 버튼은 주인에게만
          <AnimalCollection
            animals={grown.map((a) => ({ id: a.id, name: animalName(a.name, a.variant), assetKey: a.assetKey, skinKey: a.skinKey, sex: a.sex, variant: a.variant, grownDate: a.grownAt ? formatDate(a.grownAt) : "" }))}
            showcaseId={shown?.id ?? null}
            isOwner={isOwner}
          />
        }
        className="mt-4"
      />

      {isOwner && <OwnerToolbar postCount={blog.postCount} privateCount={side.privateCount} />}

      <div className="mt-8 grid gap-7 md:grid-cols-[minmax(0,1fr)_260px] lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0" aria-label="글 목록">
          {search ? (
            <BlogSearchResults q={search.q} empty={search.empty} blogs={found} posts={list?.items ?? []} total={list?.total ?? 0} />
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <h2 className="pixel-wood px-3 pt-1 pb-1.5 font-display text-xl break-words" data-list-heading>
                  {find ? (
                    <>🔍 &apos;{find.q}&apos; 블로그 검색</>
                  ) : tag ? (
                    <>#{tag}</>
                  ) : currentSub ? (
                    currentSub.name
                  ) : currentCat ? (
                    currentCat.name
                  ) : (
                    "전체 글"
                  )}{" "}
                  {!(find?.empty) && <span className="text-base text-[#fff3d6]">{list?.total ?? 0}개</span>}
                </h2>
                {(find || tag) && (
                  <Link href={base} className="inline-flex min-h-11 items-center text-sm text-ink-soft hover:text-ink">
                    ← 전체 글 보기
                  </Link>
                )}
              </div>
              {find?.empty ? (
                <p className="pixel-card p-10 text-center text-ink-soft">찾을 말을 적어 주세요</p>
              ) : list?.items.length ? (
                <div className="grid gap-5">
                  {list.items.map((p) => (
                    <PostCard key={p.id} post={p} />
                  ))}
                </div>
              ) : find || tag ? (
                <p className="pixel-card p-10 text-center text-ink-soft">이 블로그에서 찾은 글이 없어요</p>
              ) : (
                <div className="pixel-card p-10 text-center text-ink-soft">
                  <p className="text-4xl">🌱</p>
                  <p className="mt-2">아직 글이 없어요.</p>
                  {isOwner && (
                    <Link href="/write" className="pixel-btn mt-5 min-h-11 min-w-11 whitespace-nowrap bg-leaf px-5 text-white">
                      첫 글 쓰기
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
          {list && <Pagination page={list.page} pageCount={list.pageCount} hrefFor={pageHref} />}
        </section>

        {/* 옆 칸 위젯 (티스토리처럼). 검색 → 카테고리 → 최근 글 → 인기 글 → 최근 댓글 → 태그 → 방문자 */}
        <aside className="grid min-w-0 content-start gap-6" aria-label="블로그 옆 칸" data-blog-sidebar>
          <BlogFindBox base={base} s={find?.q ?? ""} />
          {/* 마을의 글·블로그 검색은 주인에게만 (FR-050) */}
          {isOwner && <BlogSearchBox base={base} q={search?.q ?? ""} />}
          <CategoryNav base={base} tree={cats} publicCount={blog.postCount} selected={selected} />
          <RecentPostsWidget base={base} posts={side.recent} />
          <PopularPostsWidget base={base} posts={side.popular} />
          <RecentCommentsWidget base={base} comments={side.comments} />
          <TagsWidget base={base} tags={side.tags} current={tag} />
          <VisitorsWidget blogId={blog.id} initial={visits} isOwner={isOwner} />
        </aside>
      </div>
    </div>
  );
}
