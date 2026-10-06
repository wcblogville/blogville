import "server-only";
import { and, asc, desc, eq, inArray, lt, gt, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
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
  tags,
} from "@/db/schema";
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
      characterAsset: characterItem.assetKey,
      backgroundAsset: backgroundItem.assetKey,
      followerCount: sql<number>`(SELECT COUNT(*)::int FROM ${follows} WHERE ${follows.followeeId} = ${blogs.ownerId})`,
      postCount: sql<number>`(SELECT COUNT(*)::int FROM ${posts} WHERE ${posts.blogId} = ${blogs.id} AND ${posts.visibility} = 'public')`,
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

export async function getCategories(blogId: number, includePrivate: boolean) {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      position: categories.position,
      postCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${posts}
        WHERE ${posts.categoryId} = ${categories.id}
        ${includePrivate ? sql`` : sql`AND ${posts.visibility} = 'public'`}
      )`,
    })
    .from(categories)
    .where(eq(categories.blogId, blogId))
    .orderBy(asc(categories.position), asc(categories.id));
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
  likeCount: sql<number>`(SELECT COUNT(*)::int FROM ${postLikes} WHERE ${postLikes.postId} = ${posts.id})`,
  commentCount: sql<number>`(SELECT COUNT(*)::int FROM ${comments} WHERE ${comments.postId} = ${posts.id} AND ${comments.deletedAt} IS NULL)`,
};

async function paged<T>(where: SQL | undefined, page: number, extra: (q: ReturnType<typeof baseList>) => Promise<T[]>) {
  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(posts)
    .innerJoin(blogs, eq(blogs.id, posts.blogId))
    .where(where);
  const items = await extra(baseList(where));
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

function baseList(where: SQL | undefined) {
  return db
    .select({
      ...listColumns,
      blogSlug: blogs.slug,
      blogTitle: blogs.title,
      nickname: profiles.nickname,
      characterAsset: characterItem.assetKey,
    })
    .from(posts)
    .innerJoin(blogs, eq(blogs.id, posts.blogId))
    .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
    .innerJoin(characterItem, eq(characterItem.id, profiles.characterItemId))
    .leftJoin(categories, eq(categories.id, posts.categoryId))
    .where(where)
    .orderBy(desc(posts.createdAt), desc(posts.id));
}

/** 블로그 홈 글 목록. 주인이 보면 비공개 글도 보인다 */
export async function listBlogPosts(opts: { blogId: number; isOwner: boolean; categoryId?: number; page: number }) {
  const where = and(
    eq(posts.blogId, opts.blogId),
    opts.isOwner ? undefined : eq(posts.visibility, "public"),
    opts.categoryId ? eq(posts.categoryId, opts.categoryId) : undefined,
  );
  return paged(where, opts.page, (q) => q.limit(PAGE_SIZE).offset((opts.page - 1) * PAGE_SIZE));
}

/** 마을 최신 글 (공개 글만). followerId가 있으면 이웃 글만 */
export async function listFeed(opts: { page: number; followerId?: string; tag?: string }) {
  const where = and(
    eq(posts.visibility, "public"),
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
  return paged(where, opts.page, (q) => q.limit(PAGE_SIZE).offset((opts.page - 1) * PAGE_SIZE));
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
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
    })
    .from(posts)
    .leftJoin(categories, eq(categories.id, posts.categoryId))
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

export async function getComments(postId: number) {
  return db
    .select({
      id: comments.id,
      parentId: comments.parentId,
      content: comments.content,
      createdAt: comments.createdAt,
      deletedAt: comments.deletedAt,
      authorId: comments.authorId,
      nickname: profiles.nickname,
      characterAsset: characterItem.assetKey,
      blogSlug: blogs.slug,
    })
    .from(comments)
    .innerJoin(profiles, eq(profiles.userId, comments.authorId))
    .innerJoin(characterItem, eq(characterItem.id, profiles.characterItemId))
    .innerJoin(blogs, eq(blogs.ownerId, comments.authorId))
    .where(eq(comments.postId, postId))
    .orderBy(asc(comments.createdAt), asc(comments.id));
}

/** 같은 블로그 안에서 바로 이전 / 다음 글 */
export async function getAdjacentPosts(blogId: number, post: { id: number; createdAt: Date }, isOwner: boolean) {
  const visible = isOwner ? undefined : eq(posts.visibility, "public");
  const older = or(lt(posts.createdAt, post.createdAt), and(eq(posts.createdAt, post.createdAt), lt(posts.id, post.id)));
  const newer = or(gt(posts.createdAt, post.createdAt), and(eq(posts.createdAt, post.createdAt), gt(posts.id, post.id)));
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

export async function incrementViewCount(postId: number) {
  // updated_at은 글 내용이 바뀔 때만 갱신되어야 하므로 그대로 둔다 ($onUpdate 덮어쓰기)
  await db
    .update(posts)
    .set({ viewCount: sql`${posts.viewCount} + 1`, updatedAt: sql`${posts.updatedAt}` })
    .where(eq(posts.id, postId));
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
