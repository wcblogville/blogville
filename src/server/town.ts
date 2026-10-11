import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { outfitOf } from "@/server/inventory";
import { db } from "@/db";
import { blogs, blogVisits, follows, items, pointLedger, posts, profiles, users } from "@/db/schema";
import { ROOF_HEX } from "@/lib/art/town";
import { levelFromExp } from "@/lib/game";
import { currentRoof } from "@/lib/house";
import { getHeaderNotifications, listNotifications } from "@/server/notifications";
import { getWallet } from "@/server/points";
import type { TownHudMember } from "@/components/town/town-hud";
import type { TownFriend, TownHouse } from "@/components/town/types";

const characterItem = alias(items, "character_item");

/** 마을 둘레 이웃집 자리 수 (내 집 1 + 즐겨찾기 10, 사용자 요청 2026-10-08) */
export const FAVORITE_LIMIT = 10;
/** 방문자 광장은 인기 블로그 이만큼 중에서 고른다 (TOWN-04) */
const POPULAR_POOL = 100;
/** 우체통에서 보여 줄 최근 공개 글 수 */
const RECENT_POSTS = 3;
/** 메뉴 알림 창에 보여 줄 최근 알림 수 */
const MENU_NOTIFICATIONS = 5;

const ownerExp = sql<number>`(
  SELECT COALESCE(SUM(${pointLedger.expDelta}), 0)::int FROM ${pointLedger} WHERE ${pointLedger.userId} = ${blogs.ownerId}
)`;

const lastPublicPostAt = sql<Date | null>`(
  SELECT MAX(${posts.createdAt}) FROM ${posts}
  WHERE ${posts.blogId} = ${blogs.id} AND ${posts.visibility} = 'public'
)`;

/** 관리자 블로그(Blogville 공지사항)는 남의 마을 둘레 집·텔레포트에 나오지 않는다. 관리자 본인에게는 내 집으로 보인다 (사용자 요청 2026-10-08) */
const notAdminBlog = sql`NOT EXISTS (SELECT 1 FROM ${users} WHERE ${users.id} = ${blogs.ownerId} AND ${users.role} = 'admin')`;

function houseQuery() {
  return db
    .select({
      blogId: blogs.id,
      slug: blogs.slug,
      title: blogs.title,
      nickname: profiles.nickname,
      characterAsset: characterItem.assetKey,
      outfit: outfitOf(blogs.ownerId),
      roofColor: blogs.roofColor,
      exp: ownerExp,
    })
    .from(blogs)
    .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
    .innerJoin(characterItem, eq(characterItem.id, profiles.characterItemId))
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

  return rows.map(({ blogId, exp, roofColor, ...h }) => ({
    ...h,
    roof: ROOF_HEX[currentRoof(blogId, roofColor)],
    level: levelFromExp(exp),
    recentPosts: recent.filter((p) => p.blogId === blogId).map((p) => ({ id: p.id, title: p.title })),
  }));
}

/** 블로그 누적 방문자 수 (BLOG-06: 같은 사람은 하루 1번) */
const totalVisits = sql`(SELECT COUNT(*) FROM ${blogVisits} WHERE ${blogVisits.blogId} = ${blogs.id})`;

/**
 * 로그인하지 않은 방문자의 둘레 집 (TOWN-04): 공개 글이 있는 블로그 중 인기 100곳에서 광장을 열 때마다 무작위 10곳.
 * 인기 = 누적 방문자 수, 같으면 최근 공개 글 순 (문서의 열린 질문이라 2026-10-09에 정함). 공지 블로그는 빠진다
 */
export async function getGuestHouses(): Promise<TownHouse[]> {
  const popular = db
    .select({ id: blogs.id })
    .from(blogs)
    .where(and(isNotNull(lastPublicPostAt), notAdminBlog))
    .orderBy(sql`${totalVisits} DESC`, sql`${lastPublicPostAt} DESC`, desc(blogs.id))
    .limit(POPULAR_POOL);
  const rows = await houseQuery().where(inArray(blogs.id, popular)).orderBy(sql`random()`).limit(FAVORITE_LIMIT);
  return toHouses(rows);
}

/** 회원의 둘레 집: 즐겨찾기한 이웃 (먼저 이웃이 된 순, 최대 10) */
export async function getFavoriteHouses(userId: string): Promise<TownHouse[]> {
  const rows = await houseQuery()
    .innerJoin(follows, and(eq(follows.followeeId, blogs.ownerId), eq(follows.followerId, userId), eq(follows.isFavorite, true)))
    .where(notAdminBlog)
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
      // 공지 블로그(관리자)는 마을에 집이 없어 ⭐로 자리를 차지하지 않게 한다
      isNotice: sql<boolean>`NOT ${notAdminBlog}`,
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

/**
 * 마을을 구경할 회원 (/town/블로그 주소, 사용자 요청 2026-10-09). 없는 주소와 공지 블로그(관리자)는 null.
 * 관리자 블로그는 남의 마을 둘레에도 나오지 않는다 (notAdminBlog)
 */
export async function getTownHost(slug: string) {
  const [row] = await db
    .select({ userId: blogs.ownerId, slug: blogs.slug, nickname: profiles.nickname })
    .from(blogs)
    .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
    .where(and(eq(blogs.slug, slug), notAdminBlog));
  return row ?? null;
}

/** ☰ 메뉴에 필요한 내 정보: 지갑·알림·친구 (내 마을과 남의 마을 구경에서 같이 쓴다) */
export async function getHudMember(
  userId: string,
  isAdmin: boolean,
  profile: { photoKey: string | null; blogTitle: string; blogSlug: string },
): Promise<TownHudMember> {
  const [wallet, header, list, friends] = await Promise.all([
    getWallet(userId),
    getHeaderNotifications(userId),
    listNotifications(userId, 1),
    getFriends(userId),
  ]);
  return {
    userId,
    isAdmin,
    slug: profile.blogSlug,
    photoKey: profile.photoKey,
    blogTitle: profile.blogTitle,
    wallet: { coins: wallet.coins, level: wallet.level, current: wallet.current, needed: wallet.needed, isMax: wallet.isMax },
    unread: header.unread,
    notifications: list.rows.slice(0, MENU_NOTIFICATIONS),
    friends,
  };
}
