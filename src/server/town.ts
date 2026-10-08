import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { outfitOf } from "@/server/inventory";
import { db } from "@/db";
import { blogs, follows, items, pointLedger, posts, profiles } from "@/db/schema";
import { levelFromExp } from "@/lib/game";
import type { TownFriend, TownHouse } from "@/components/town/types";

const characterItem = alias(items, "character_item");
const backgroundItem = alias(items, "background_item");

/** 마을 둘레 이웃집 자리 수 (내 집 1 + 즐겨찾기 10, 사용자 요청 2026-10-08) */
export const FAVORITE_LIMIT = 10;
/** 우체통에서 보여 줄 최근 공개 글 수 */
const RECENT_POSTS = 3;

const ownerExp = sql<number>`(
  SELECT COALESCE(SUM(${pointLedger.expDelta}), 0)::int FROM ${pointLedger} WHERE ${pointLedger.userId} = ${blogs.ownerId}
)`;

const lastPublicPostAt = sql<Date | null>`(
  SELECT MAX(${posts.createdAt}) FROM ${posts}
  WHERE ${posts.blogId} = ${blogs.id} AND ${posts.visibility} = 'public'
)`;

function houseQuery() {
  return db
    .select({
      blogId: blogs.id,
      slug: blogs.slug,
      title: blogs.title,
      nickname: profiles.nickname,
      characterAsset: characterItem.assetKey,
      outfit: outfitOf(blogs.ownerId),
      backgroundAsset: backgroundItem.assetKey,
      exp: ownerExp,
    })
    .from(blogs)
    .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
    .innerJoin(characterItem, eq(characterItem.id, profiles.characterItemId))
    .innerJoin(backgroundItem, eq(backgroundItem.id, blogs.backgroundItemId))
    .$dynamic();
}

type HouseRow = Awaited<ReturnType<ReturnType<typeof houseQuery>["execute"]>>[number];

/** 블로그마다 최근 공개 글 3개를 붙이고, 주인 경험치를 레벨(집 단계)로 바꾼다 */
async function toHouses(rows: HouseRow[]): Promise<TownHouse[]> {
  if (!rows.length) return [];
  const ranked = db
    .select({
      id: posts.id,
      blogId: posts.blogId,
      title: posts.title,
      rank: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${posts.blogId} ORDER BY ${posts.createdAt} DESC, ${posts.id} DESC)`.as("rank"),
    })
    .from(posts)
    .where(and(inArray(posts.blogId, rows.map((r) => r.blogId)), eq(posts.visibility, "public")))
    .as("ranked");
  const recent = await db.select().from(ranked).where(sql`${ranked.rank} <= ${RECENT_POSTS}`).orderBy(asc(ranked.rank));

  return rows.map(({ blogId, exp, ...h }) => ({
    ...h,
    level: levelFromExp(exp),
    recentPosts: recent.filter((p) => p.blogId === blogId).map((p) => ({ id: p.id, title: p.title })),
  }));
}

/** 방문자에게 보여 줄 둘레 집: 공개 글이 있는 블로그만, 최근 공개 글 순 (TOWN-04) */
export async function getTownHouses(excludeUserId: string | null, limit = FAVORITE_LIMIT): Promise<TownHouse[]> {
  const rows = await houseQuery()
    .where(and(excludeUserId ? ne(blogs.ownerId, excludeUserId) : undefined, isNotNull(lastPublicPostAt)))
    .orderBy(sql`${lastPublicPostAt} DESC`, desc(blogs.createdAt))
    .limit(limit);
  return toHouses(rows);
}

/** 회원의 둘레 집: 즐겨찾기한 이웃 (먼저 이웃이 된 순, 최대 10) */
export async function getFavoriteHouses(userId: string): Promise<TownHouse[]> {
  const rows = await houseQuery()
    .innerJoin(follows, and(eq(follows.followeeId, blogs.ownerId), eq(follows.followerId, userId), eq(follows.isFavorite, true)))
    .orderBy(asc(follows.createdAt), asc(blogs.id))
    .limit(FAVORITE_LIMIT);
  return toHouses(rows);
}

export async function getMyHouse(userId: string): Promise<TownHouse | null> {
  const [house] = await toHouses(await houseQuery().where(eq(blogs.ownerId, userId)));
  return house ?? null;
}

/** 친구 목록: 내가 이웃으로 추가한 사람 (즐겨찾기 먼저, 그다음 닉네임 순). followsBack = 서로 이웃 */
export async function getFriends(userId: string): Promise<TownFriend[]> {
  return db
    .select({
      userId: blogs.ownerId,
      slug: blogs.slug,
      title: blogs.title,
      nickname: profiles.nickname,
      characterAsset: characterItem.assetKey,
      isFavorite: follows.isFavorite,
      followsBack: sql<boolean>`EXISTS (
        SELECT 1 FROM ${follows} f2 WHERE f2.follower_id = ${blogs.ownerId} AND f2.followee_id = ${userId}
      )`,
    })
    .from(follows)
    .innerJoin(blogs, eq(blogs.ownerId, follows.followeeId))
    .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
    .innerJoin(characterItem, eq(characterItem.id, profiles.characterItemId))
    .where(eq(follows.followerId, userId))
    .orderBy(desc(follows.isFavorite), asc(profiles.nickname))
    .limit(200);
}
