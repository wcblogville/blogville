import "server-only";
import { and, asc, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { outfitOf } from "@/server/inventory";
import { db } from "@/db";
import type { AnimalDisplaySize } from "@/lib/farm";
import {
  animalSkins,
  animalSpecies,
  blogs,
  blogVisits,
  categories,
  comments,
  follows,
  items,
  postLikes,
  posts,
  postTags,
  profiles,
  replies,
  subcategories,
  tags,
  userAnimals,
  users,
} from "@/db/schema";
import { buildCategoryTree, toLikePattern } from "@/lib/blog";
import { favoriteWindowStart } from "@/lib/social";
import { liveCommentCountSql } from "@/server/social";
import { previousDay, todayKST } from "@/lib/game";
import { NOTICE_CATEGORY, RELEASE_CATEGORY } from "@/lib/welcome-notice";

const characterItem = alias(items, "character_item");
const backgroundItem = alias(items, "background_item");

export const PAGE_SIZE = 8;

// ===== 블로그 =====
export async function getBlogBySlug(slug: string) {
  const [row] = await db
    .select({
      id: blogs.id,
      slug: blogs.slug,
      title: blogs.title,
      description: blogs.description,
      ownerId: blogs.ownerId,
      createdAt: blogs.createdAt,
      nickname: profiles.nickname,
      // 주인 프로필 사진 (BLOG-04 / FR-028). 없으면 캐릭터 얼굴
      photoKey: profiles.photoKey,
      // 전시 동물 (BLOG-04 / FR-030). 그릴 때는 getGrownAnimals 목록에서 찾는다 (없으면 빈 자리)
      showcaseAnimalId: blogs.showcaseAnimalId,
      characterAsset: characterItem.assetKey,
      outfit: outfitOf(blogs.ownerId),
      backgroundAsset: backgroundItem.assetKey,
      roofColor: blogs.roofColor,
      followerCount: sql<number>`(SELECT COUNT(*)::int FROM ${follows} WHERE ${follows.followeeId} = ${blogs.ownerId})`,
      postCount: sql<number>`(SELECT COUNT(*)::int FROM ${posts} WHERE ${posts.blogId} = ${blogs.id} AND ${posts.visibility} = 'public')`,
      // 공지 블로그(관리자). 마을이 없어 [🏘 마을 구경]을 보여 주지 않는다
      isNotice: sql<boolean>`EXISTS (SELECT 1 FROM ${users} WHERE ${users.id} = ${blogs.ownerId} AND ${users.role} = 'admin')`,
    })
    .from(blogs)
    .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
    .innerJoin(characterItem, eq(characterItem.id, profiles.characterItemId))
    .innerJoin(backgroundItem, eq(backgroundItem.id, blogs.backgroundItemId))
    .where(eq(blogs.slug, slug));
  return row ?? null;
}

/** 블로그 방문자 수: 오늘·어제(한국 시간)와 전체 (BLOG-06) */
export async function getBlogVisitStats(blogId: number) {
  const today = todayKST();
  const [row] = await db
    .select({
      today: sql<number>`COUNT(*) FILTER (WHERE ${blogVisits.date} = ${today})::int`,
      yesterday: sql<number>`COUNT(*) FILTER (WHERE ${blogVisits.date} = ${previousDay(today)})::int`,
      total: sql<number>`COUNT(*)::int`,
    })
    .from(blogVisits)
    .where(eq(blogVisits.blogId, blogId));
  return { today: row?.today ?? 0, yesterday: row?.yesterday ?? 0, total: row?.total ?? 0 };
}

/** 최근 7일(오늘 포함) 날짜별 방문자 수. 방문이 없는 날은 0 (블로그 관리 그래프, BLOG-06) */
export async function getBlogVisitDays(blogId: number, days = 7) {
  const dates = [todayKST()];
  while (dates.length < days) dates.unshift(previousDay(dates[0]));
  const rows = await db
    .select({ date: blogVisits.date, count: sql<number>`COUNT(*)::int` })
    .from(blogVisits)
    .where(and(eq(blogVisits.blogId, blogId), sql`${blogVisits.date} >= ${dates[0]}`))
    .groupBy(blogVisits.date);
  const byDate = new Map(rows.map((r) => [String(r.date), r.count]));
  return dates.map((date) => ({ date, count: byDate.get(date) ?? 0 }));
}

export async function getBlogByOwner(ownerId: string) {
  const [row] = await db.select().from(blogs).where(eq(blogs.ownerId, ownerId));
  return row ?? null;
}

/**
 * 카테고리 트리 (BLOG-05 / FR-039·040, research R-14): 대분류마다 subcategories 배열, 정렬은 position → id.
 * 대분류 글 수는 그 대분류의 글(소분류 글 포함). includePrivate(주인·관리 화면)이면 비공개 글도 센다.
 * 소분류 글 수는 posts.subcategory_id로 센다 (POST-03, 같은 공개 범위 규칙).
 */
export async function getCategories(blogId: number, includePrivate: boolean) {
  const cats = await db
    .select({
      id: categories.id,
      name: categories.name,
      position: categories.position,
      // 표 하나만 읽는 select에서는 drizzle이 칸 이름을 표 이름 없이("id") 쓰므로, 안쪽 조회의 칸과 섞이지 않게
      // 표 이름을 붙여 적는다 (그대로 두면 "category_id" = "id"가 posts.id와 비교되어 글 수가 틀렸다)
      postCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${posts} AS p
        WHERE p.category_id = "categories"."id"
        ${includePrivate ? sql`` : sql`AND p.visibility = 'public'`}
      )`,
    })
    .from(categories)
    .where(eq(categories.blogId, blogId))
    .orderBy(asc(categories.position), asc(categories.id));
  const subs = cats.length
    ? await db
        .select({
          id: subcategories.id,
          categoryId: subcategories.categoryId,
          name: subcategories.name,
          position: subcategories.position,
          postCount: sql<number>`(
            SELECT COUNT(*)::int FROM ${posts} AS p
            WHERE p.subcategory_id = "subcategories"."id"
            ${includePrivate ? sql`` : sql`AND p.visibility = 'public'`}
          )`,
        })
        .from(subcategories)
        .where(
          inArray(
            subcategories.categoryId,
            cats.map((c) => c.id),
          ),
        )
    : [];
  return buildCategoryTree(cats, subs);
}

export type CategoryTree = Awaited<ReturnType<typeof getCategories>>;

/**
 * 주인의 다 키운 동물 = 도감 카드 (BLOG-04 / FR-029, research R-20). 다 키운 시각 최신순.
 * 인덱스 user_animals_user_status_idx (user_id, status)
 */
export async function getGrownAnimals(ownerId: string) {
  return db
    .select({
      id: userAnimals.id,
      name: animalSpecies.name,
      assetKey: animalSpecies.assetKey,
      skinKey: animalSkins.assetKey,
      size: sql<AnimalDisplaySize>`${userAnimals.displaySize}`,
      grownAt: userAnimals.grownAt,
    })
    .from(userAnimals)
    .innerJoin(animalSpecies, eq(animalSpecies.id, userAnimals.speciesId))
    // 입힌 스킨 (없으면 기본 색, 2026-10-11 "펫 종류별로 스킨")
    .leftJoin(animalSkins, eq(animalSkins.id, userAnimals.skinId))
    .where(and(eq(userAnimals.userId, ownerId), eq(userAnimals.status, "grown")))
    .orderBy(sql`${userAnimals.grownAt} DESC NULLS LAST`, desc(userAnimals.id));
}

export type GrownAnimal = Awaited<ReturnType<typeof getGrownAnimals>>[number];

/**
 * 블로그 검색 (BLOG-06 검색 / FR-052, research R-17): 블로그 이름이나 주인 닉네임에 검색어가 든 블로그 최대 8곳.
 * 최근 공개 글 순 (공개 글이 없으면 뒤, 만든 순). 검색어는 바인딩하고 %·_·\ 는 글자 그대로 찾는다
 */
export async function searchBlogs(q: string, limit = 8) {
  const pattern = toLikePattern(q);
  const lastPublic = sql`(SELECT MAX(${posts.createdAt}) FROM ${posts} WHERE ${posts.blogId} = ${blogs.id} AND ${posts.visibility} = 'public')`;
  return db
    .select({
      slug: blogs.slug,
      title: blogs.title,
      nickname: profiles.nickname,
      characterAsset: characterItem.assetKey,
      photoKey: profiles.photoKey,
    })
    .from(blogs)
    .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
    .innerJoin(characterItem, eq(characterItem.id, profiles.characterItemId))
    .where(or(sql`${blogs.title} ILIKE ${pattern} ESCAPE '\\'`, sql`${profiles.nickname} ILIKE ${pattern} ESCAPE '\\'`))
    .orderBy(sql`${lastPublic} DESC NULLS LAST`, asc(blogs.createdAt), asc(blogs.id))
    .limit(limit);
}

export async function isFollowing(followerId: string, followeeId: string) {
  const [row] = await db
    .select({ x: follows.followerId })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)));
  return Boolean(row);
}

// ===== 글 목록 =====
const listColumns = {
  id: posts.id,
  title: posts.title,
  excerpt: sql<string>`left(${posts.contentText}, 160)`,
  visibility: posts.visibility,
  viewCount: posts.viewCount,
  createdAt: posts.createdAt,
  categoryName: categories.name,
  // 카드 배지 `대분류 › 소분류` (POST-03 / FR-033)
  subcategoryName: subcategories.name,
  likeCount: sql<number>`(SELECT COUNT(*)::int FROM ${postLikes} WHERE ${postLikes.postId} = ${posts.id})`,
  // 삭제 안 된 댓글 + 답글 (SOC-01 / FR-016)
  commentCount: liveCommentCountSql(posts.id),
};

/** orderFirst: 기존 정렬(최신순) 앞에 붙일 정렬 (이웃 새 글의 즐겨찾기 우선, SOC-04). 없으면 최신순만 */
async function paged<T>(
  where: SQL | undefined,
  page: number,
  extra: (q: ReturnType<typeof baseList>) => Promise<T[]>,
  orderFirst?: SQL,
  size = PAGE_SIZE,
) {
  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(posts)
    .innerJoin(blogs, eq(blogs.id, posts.blogId))
    .where(where);
  const items = await extra(baseList(where, orderFirst));
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / size)) };
}

function baseList(where: SQL | undefined, orderFirst?: SQL) {
  return db
    .select({
      ...listColumns,
      blogSlug: blogs.slug,
      blogTitle: blogs.title,
      nickname: profiles.nickname,
      characterAsset: characterItem.assetKey,
      // 앞 정렬(즐겨찾는 이웃의 최근 글)로 위에 올라온 글. 카드에 ⭐로 이유를 보여 준다
      pinned: orderFirst ? sql<boolean>`(${orderFirst}) = 0` : sql<boolean>`false`,
    })
    .from(posts)
    .innerJoin(blogs, eq(blogs.id, posts.blogId))
    .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
    .innerJoin(characterItem, eq(characterItem.id, profiles.characterItemId))
    .leftJoin(categories, eq(categories.id, posts.categoryId))
    .leftJoin(subcategories, eq(subcategories.id, posts.subcategoryId))
    .where(where)
    .orderBy(...(orderFirst ? [orderFirst] : []), desc(posts.createdAt), desc(posts.id));
}

/**
 * 블로그 홈 글 목록. 주인이 보면 비공개 글도 보인다.
 * categoryId: 대분류 거르기(소분류 글 포함). subcategoryId: 소분류 거르기 (categoryId보다 먼저, BLOG-05 / FR-040, research R-13).
 */
export async function listBlogPosts(opts: {
  blogId: number;
  isOwner: boolean;
  categoryId?: number;
  subcategoryId?: number;
  /** 블로그 안 검색: 제목·본문 부분 일치 (%·_·\ 는 글자 그대로). 주인이면 비공개 글도 찾는다 (사용자 요청 2026-10-11) */
  search?: string;
  /** 이 블로그에서 그 태그가 붙은 글 */
  tag?: string;
  /** 비공개 글만 / 공개 글만 (글 관리 화면, 주인만) */
  visibility?: "public" | "private";
  page: number;
  pageSize?: number;
}) {
  const pattern = opts.search ? toLikePattern(opts.search) : null;
  const where = and(
    eq(posts.blogId, opts.blogId),
    opts.isOwner ? (opts.visibility ? eq(posts.visibility, opts.visibility) : undefined) : eq(posts.visibility, "public"),
    opts.subcategoryId ? eq(posts.subcategoryId, opts.subcategoryId) : opts.categoryId ? eq(posts.categoryId, opts.categoryId) : undefined,
    pattern ? or(sql`${posts.title} ILIKE ${pattern} ESCAPE '\\'`, sql`${posts.contentText} ILIKE ${pattern} ESCAPE '\\'`) : undefined,
    opts.tag
      ? inArray(
          posts.id,
          db.select({ id: postTags.postId }).from(postTags).innerJoin(tags, eq(tags.id, postTags.tagId)).where(eq(tags.name, opts.tag)),
        )
      : undefined,
  );
  const size = opts.pageSize ?? PAGE_SIZE;
  return paged(where, opts.page, (q) => q.limit(size).offset((opts.page - 1) * size), undefined, size);
}

/**
 * 마을 최신 글 (공개 글만). followerId가 있으면 이웃 글만.
 * search가 있으면 제목·본문 부분 일치 (BLOG-06 검색 / FR-051, research R-16): %·_·\ 는 글자 그대로 찾는다
 */
/** 관리자 블로그(Blogville 공지사항)가 아니다. 공지는 마을 소식 맨 위 카드(getPinnedNotice)로만 보인다 */
const notNoticeBlog = sql`NOT EXISTS (SELECT 1 FROM ${users} WHERE ${users.id} = ${blogs.ownerId} AND ${users.role} = 'admin')`;

/**
 * 공개 글 목록. followerId를 주면 그 회원의 이웃 글만 (모르는 사람 글은 없다, 사용자 요청 2026-10-12):
 * - favoritesOnly: 마을 소식 [🏘 마을 전체] = ⭐ 즐겨찾는 이웃의 글
 * - 아니면 [💛 이웃 새 글] = 모든 이웃의 글 (즐겨찾는 이웃의 최근 7일 글이 맨 위)
 * 이웃은 자기 자신이 아니므로(follows_not_self_check) 내 글은 빠지고, 공지 블로그(관리자)도 빠진다.
 * followerId 없이 부르는 태그 목록·마을 검색은 마을 전체 공개 글이다
 */
export async function listFeed(opts: { page: number; followerId?: string; favoritesOnly?: boolean; tag?: string; search?: string }) {
  const pattern = opts.search ? toLikePattern(opts.search) : null;
  const where = and(
    eq(posts.visibility, "public"),
    pattern ? or(sql`${posts.title} ILIKE ${pattern} ESCAPE '\\'`, sql`${posts.contentText} ILIKE ${pattern} ESCAPE '\\'`) : undefined,
    opts.followerId
      ? and(
          inArray(
            blogs.ownerId,
            db
              .select({ id: follows.followeeId })
              .from(follows)
              .where(and(eq(follows.followerId, opts.followerId), opts.favoritesOnly ? eq(follows.isFavorite, true) : undefined)),
          ),
          notNoticeBlog,
        )
      : undefined,
    opts.tag
      ? inArray(
          posts.id,
          db.select({ id: postTags.postId }).from(postTags).innerJoin(tags, eq(tags.id, postTags.tagId)).where(eq(tags.name, opts.tag)),
        )
      : undefined,
  );
  // 이웃 새 글: 최근 7일(한국 날짜, 오늘 포함) 안에 쓴 즐겨찾는 이웃의 글이 맨 위 (SOC-04 / FR-042, D15).
  // 마을 전체는 모두 즐겨찾는 이웃이라 최신순만
  const favoriteFirst =
    opts.followerId && !opts.favoritesOnly
      ? sql`CASE WHEN ${posts.createdAt} >= (${favoriteWindowStart(todayKST())}::date::timestamp AT TIME ZONE 'Asia/Seoul')
        AND EXISTS (SELECT 1 FROM ${follows} WHERE ${follows.followerId} = ${opts.followerId}
          AND ${follows.followeeId} = ${blogs.ownerId} AND ${follows.isFavorite}) THEN 0 ELSE 1 END`
      : undefined;
  return paged(where, opts.page, (q) => q.limit(PAGE_SIZE).offset((opts.page - 1) * PAGE_SIZE), favoriteFirst);
}

/** 빈 목록 (방문자의 마을 소식: 이웃이 없으니 글을 읽지 않는다) */
export function emptyFeed(page: number) {
  return { items: [], total: 0, page, pageCount: 1 };
}

/**
 * 마을 소식 [📜 릴리스 노트] (사용자 요청 2026-10-12): 공지 블로그(관리자)의 "릴리스 노트" 분류 공개 글, 최신순.
 * 시드가 src/content/release-notes.ts에서 넣은 글과 관리자가 그 분류로 직접 쓴 글이 같이 나온다 (다른 분류 글은 없다)
 */
export async function listReleaseNotes(page: number) {
  const releaseCategories = db
    .select({ id: categories.id })
    .from(categories)
    .innerJoin(blogs, eq(blogs.id, categories.blogId))
    .innerJoin(users, and(eq(users.id, blogs.ownerId), eq(users.role, "admin")))
    .where(eq(categories.name, RELEASE_CATEGORY));
  const where = and(eq(posts.visibility, "public"), inArray(posts.categoryId, releaseCategories));
  return paged(where, page, (q) => q.limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE));
}

export type PinnedNotice = { id: number; title: string; excerpt: string; blogSlug: string; createdAt: Date };

/**
 * 마을 소식 맨 위에 거는 공지 (사용자 요청 2026-10-12): 공지 블로그(관리자)의 "공지" 분류 공개 글 중 가장 최근 글 하나.
 * 처음에는 시드가 넣은 사용법 안내(src/lib/welcome-notice.ts)이고, 관리자가 공지를 새로 쓰면 그 글로 바뀐다
 */
export async function getPinnedNotice(): Promise<PinnedNotice | null> {
  const [row] = await db
    .select({ id: posts.id, title: posts.title, excerpt: sql<string>`regexp_replace(left(${posts.contentText}, 300), '\\n{2,}', chr(10), 'g')`, blogSlug: blogs.slug, createdAt: posts.createdAt })
    .from(posts)
    .innerJoin(blogs, eq(blogs.id, posts.blogId))
    .innerJoin(users, and(eq(users.id, blogs.ownerId), eq(users.role, "admin")))
    .innerJoin(categories, and(eq(categories.id, posts.categoryId), eq(categories.name, NOTICE_CATEGORY)))
    .where(eq(posts.visibility, "public"))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(1);
  return row ?? null;
}

// ===== 블로그 옆 칸 위젯 (사용자 요청 2026-10-11 "내 블로그에 글쓰기랑 다른 부가기능들이 부족") =====

/**
 * 블로그 옆 칸: 최근 글·인기 글(조회수)·최근 댓글(댓글 + 답글)·태그 목록.
 * 주인이 아니면 공개 글과 그 글의 댓글만 (비공개 글은 제목도 내보내지 않는다). 지운 댓글·답글은 뺀다.
 * 글은 posts_blog_created_idx(blog_id, created_at)로 이 블로그 글만 읽는다
 */
export async function getBlogSidebar(blogId: number, isOwner: boolean, limit = 5) {
  const visible = and(eq(posts.blogId, blogId), isOwner ? undefined : eq(posts.visibility, "public"));
  const visibleSql = isOwner ? sql`` : sql`AND p.visibility = 'public'`;
  const short = { id: posts.id, title: posts.title, visibility: posts.visibility, viewCount: posts.viewCount, createdAt: posts.createdAt };
  const [recent, popular, recentComments, blogTags, privateCount] = await Promise.all([
    db.select(short).from(posts).where(visible).orderBy(desc(posts.createdAt), desc(posts.id)).limit(limit),
    db
      .select(short)
      .from(posts)
      .where(and(visible, sql`${posts.viewCount} > 0`))
      .orderBy(desc(posts.viewCount), desc(posts.createdAt), desc(posts.id))
      .limit(limit),
    db
      .execute<{ kind: "comment" | "reply"; id: number; post_id: number; post_title: string; content: string; created_at: string; nickname: string | null }>(
        sql`SELECT x.kind, x.id, x.post_id, p.title AS post_title, left(x.content, 60) AS content, x.created_at, pr.nickname
            FROM (
              SELECT 'comment' AS kind, c.id, c.post_id, c.content, c.created_at, c.author_id
              FROM ${comments} c JOIN ${posts} p ON p.id = c.post_id
              WHERE p.blog_id = ${blogId} AND c.deleted_at IS NULL ${visibleSql}
              UNION ALL
              SELECT 'reply', r.id, c.post_id, r.content, r.created_at, r.author_id
              FROM ${replies} r JOIN ${comments} c ON c.id = r.comment_id JOIN ${posts} p ON p.id = c.post_id
              WHERE p.blog_id = ${blogId} AND r.deleted_at IS NULL ${visibleSql}
            ) x
            JOIN ${posts} p ON p.id = x.post_id
            LEFT JOIN ${profiles} pr ON pr.user_id = x.author_id
            ORDER BY x.created_at DESC, x.id DESC
            LIMIT ${limit}`,
      )
      .then((r) => r.rows),
    db
      .select({ name: tags.name, count: sql<number>`COUNT(*)::int` })
      .from(postTags)
      .innerJoin(tags, eq(tags.id, postTags.tagId))
      .innerJoin(posts, eq(posts.id, postTags.postId))
      .where(visible)
      .groupBy(tags.id)
      .orderBy(desc(sql`COUNT(*)`), asc(tags.name))
      .limit(30),
    // 주인 도구 막대의 글 수 (공개 + 비공개)
    isOwner
      ? db
          .select({ n: sql<number>`COUNT(*)::int` })
          .from(posts)
          .where(and(eq(posts.blogId, blogId), eq(posts.visibility, "private")))
          .then((r) => r[0].n)
      : 0,
  ]);
  return {
    privateCount,
    recent,
    popular,
    comments: recentComments.map((c) => ({
      kind: c.kind,
      id: c.id,
      postId: c.post_id,
      postTitle: c.post_title,
      content: c.content,
      createdAt: new Date(c.created_at),
      nickname: c.nickname,
    })),
    tags: blogTags,
  };
}

export type BlogSidebar = Awaited<ReturnType<typeof getBlogSidebar>>;

// ===== 글 상세 =====
export async function getPost(blogId: number, postId: number) {
  const [row] = await db
    .select({
      id: posts.id,
      blogId: posts.blogId,
      title: posts.title,
      contentHtml: posts.contentHtml,
      contentText: posts.contentText,
      visibility: posts.visibility,
      viewCount: posts.viewCount,
      categoryId: posts.categoryId,
      categoryName: categories.name,
      subcategoryId: posts.subcategoryId,
      subcategoryName: subcategories.name,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
    })
    .from(posts)
    .leftJoin(categories, eq(categories.id, posts.categoryId))
    .leftJoin(subcategories, eq(subcategories.id, posts.subcategoryId))
    .where(and(eq(posts.id, postId), eq(posts.blogId, blogId)));
  return row ?? null;
}

export async function getPostTags(postId: number) {
  const rows = await db
    .select({ name: tags.name })
    .from(postTags)
    .innerJoin(tags, eq(tags.id, postTags.tagId))
    .where(eq(postTags.postId, postId))
    // 글쓴이가 적은 순서 (같은 순서 값은 옛 글뿐이라 이름으로 정한다)
    .orderBy(asc(postTags.position), asc(tags.name));
  return rows.map((r) => r.name);
}

export async function getLikeState(postId: number, viewerId: string | null) {
  const [row] = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
      liked: viewerId ? sql<boolean>`BOOL_OR(${postLikes.userId} = ${viewerId})` : sql<boolean>`false`,
    })
    .from(postLikes)
    .where(eq(postLikes.postId, postId));
  return { count: row.count, liked: Boolean(row.liked) };
}

/**
 * 같은 블로그 안에서 바로 이전 / 다음 글.
 * 기준 글의 시각은 DB 값(마이크로초)과 그대로 비교한다. JS Date(밀리초)로 넘기면 같은 글이 "더 새 글"이 된다
 */
export async function getAdjacentPosts(blogId: number, postId: number, isOwner: boolean) {
  const visible = isOwner ? undefined : eq(posts.visibility, "public");
  const self = sql`(SELECT ${posts.createdAt}, ${posts.id} FROM ${posts} WHERE ${posts.id} = ${postId})`;
  const older = sql`(${posts.createdAt}, ${posts.id}) < ${self}`;
  const newer = sql`(${posts.createdAt}, ${posts.id}) > ${self}`;
  const [prev] = await db
    .select({ id: posts.id, title: posts.title })
    .from(posts)
    .where(and(eq(posts.blogId, blogId), visible, older))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(1);
  const [next] = await db
    .select({ id: posts.id, title: posts.title })
    .from(posts)
    .where(and(eq(posts.blogId, blogId), visible, newer))
    .orderBy(asc(posts.createdAt), asc(posts.id))
    .limit(1);
  return { prev: prev ?? null, next: next ?? null };
}

export async function getAllTags(limit = 30) {
  return db
    .select({ name: tags.name, count: sql<number>`COUNT(*)::int` })
    .from(tags)
    .innerJoin(postTags, eq(postTags.tagId, tags.id))
    .innerJoin(posts, and(eq(posts.id, postTags.postId), eq(posts.visibility, "public")))
    // 공지 블로그 글의 표시 태그(이용안내·v0.1 …)는 회원 글을 찾는 인기 태그에 넣지 않는다 (1.34)
    .innerJoin(blogs, and(eq(blogs.id, posts.blogId), notNoticeBlog))
    .groupBy(tags.id)
    .orderBy(desc(sql`COUNT(*)`), asc(tags.name))
    .limit(limit);
}
