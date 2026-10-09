import "server-only";
import { and, asc, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { outfitOf } from "@/server/inventory";
import { db } from "@/db";
import {
  animalSpecies,
  blogs,
  blogVisits,
  categories,
  follows,
  items,
  postLikes,
  posts,
  postTags,
  profiles,
  subcategories,
  tags,
  userAnimals,
  users,
} from "@/db/schema";
import { buildCategoryTree, toLikePattern } from "@/lib/blog";
import { favoriteWindowStart } from "@/lib/social";
import { liveCommentCountSql } from "@/server/social";
import { previousDay, todayKST } from "@/lib/game";

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
    .select({ id: userAnimals.id, name: animalSpecies.name, assetKey: animalSpecies.assetKey, grownAt: userAnimals.grownAt })
    .from(userAnimals)
    .innerJoin(animalSpecies, eq(animalSpecies.id, userAnimals.speciesId))
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
) {
  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(posts)
    .innerJoin(blogs, eq(blogs.id, posts.blogId))
    .where(where);
  const items = await extra(baseList(where, orderFirst));
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
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
  page: number;
}) {
  const where = and(
    eq(posts.blogId, opts.blogId),
    opts.isOwner ? undefined : eq(posts.visibility, "public"),
    opts.subcategoryId ? eq(posts.subcategoryId, opts.subcategoryId) : opts.categoryId ? eq(posts.categoryId, opts.categoryId) : undefined,
  );
  return paged(where, opts.page, (q) => q.limit(PAGE_SIZE).offset((opts.page - 1) * PAGE_SIZE));
}

/**
 * 마을 최신 글 (공개 글만). followerId가 있으면 이웃 글만.
 * search가 있으면 제목·본문 부분 일치 (BLOG-06 검색 / FR-051, research R-16): %·_·\ 는 글자 그대로 찾는다
 */
export async function listFeed(opts: { page: number; followerId?: string; tag?: string; search?: string }) {
  const pattern = opts.search ? toLikePattern(opts.search) : null;
  const where = and(
    eq(posts.visibility, "public"),
    pattern ? or(sql`${posts.title} ILIKE ${pattern} ESCAPE '\\'`, sql`${posts.contentText} ILIKE ${pattern} ESCAPE '\\'`) : undefined,
    opts.followerId
      ? inArray(blogs.ownerId, db.select({ id: follows.followeeId }).from(follows).where(eq(follows.followerId, opts.followerId)))
      : undefined,
    opts.tag
      ? inArray(
          posts.id,
          db.select({ id: postTags.postId }).from(postTags).innerJoin(tags, eq(tags.id, postTags.tagId)).where(eq(tags.name, opts.tag)),
        )
      : undefined,
  );
  // 이웃 새 글: 최근 7일(한국 날짜, 오늘 포함) 안에 쓴 즐겨찾는 이웃의 글이 맨 위 (SOC-04 / FR-042, D15)
  const favoriteFirst = opts.followerId
    ? sql`CASE WHEN ${posts.createdAt} >= (${favoriteWindowStart(todayKST())}::date::timestamp AT TIME ZONE 'Asia/Seoul')
        AND EXISTS (SELECT 1 FROM ${follows} WHERE ${follows.followerId} = ${opts.followerId}
          AND ${follows.followeeId} = ${blogs.ownerId} AND ${follows.isFavorite}) THEN 0 ELSE 1 END`
    : undefined;
  return paged(where, opts.page, (q) => q.limit(PAGE_SIZE).offset((opts.page - 1) * PAGE_SIZE), favoriteFirst);
}

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
    .orderBy(asc(tags.name));
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
    .groupBy(tags.id)
    .orderBy(desc(sql`COUNT(*)`), asc(tags.name))
    .limit(limit);
}
