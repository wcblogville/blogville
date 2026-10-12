import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { outfitOf } from "@/server/inventory";
import { db } from "@/db";
import { animalSkins, animalSpecies, blogs, blogVisits, follows, items, pointLedger, posts, profiles, userAnimals, users } from "@/db/schema";
import { hasAnimalArt } from "@/lib/art/animals";
import { ROOF_HEX } from "@/lib/art/town";
import { townThemeOf, type TownThemeKey } from "@/lib/art/town-theme";
import type { AnimalDisplaySize } from "@/lib/farm";
import { levelFromExp } from "@/lib/game";
import { currentRoof } from "@/lib/house";
import { assignLots } from "@/lib/town-lots";
import { talkLines } from "@/lib/town-talk";
import { getHeaderNotifications, listNotifications } from "@/server/notifications";
import { getWallet } from "@/server/points";
import type { TownHudMember } from "@/components/town/town-hud";
import type { TownFriend, TownHouse, TownNeighbor, TownPet } from "@/components/town/types";

const characterItem = alias(items, "character_item");

/** 마을 이웃집 자리 수 (내 집 1 + 즐겨찾기 10, 사용자 요청 2026-10-08) */
export const FAVORITE_LIMIT = 10;
/** 방문자 광장은 인기 블로그 이만큼 중에서 고른다 (TOWN-04) */
const POPULAR_POOL = 100;
/** 이웃 말풍선 문장을 고르는 최근 공개 글 수와 글마다 읽는 글자 수 */
const TALK_POSTS = 5;
const TALK_READ = 2000;
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

/** 관리자 블로그(Blogville 공지사항)는 남의 마을 집·텔레포트에 나오지 않는다. 관리자 본인에게는 내 집으로 보인다 (사용자 요청 2026-10-08) */
const notAdminBlog = sql`NOT EXISTS (SELECT 1 FROM ${users} WHERE ${users.id} = ${blogs.ownerId} AND ${users.role} = 'admin')`;

function houseQuery() {
  return db
    .select({
      blogId: blogs.id,
      ownerId: blogs.ownerId,
      slug: blogs.slug,
      title: blogs.title,
      nickname: profiles.nickname,
      characterAsset: characterItem.assetKey,
      outfit: outfitOf(blogs.ownerId),
      roofColor: blogs.roofColor,
      exp: ownerExp,
      greeting: profiles.greeting,
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
      // 말풍선 문장 후보 (공개 글만, 앞부분만 읽는다)
      text: sql<string>`LEFT(${posts.contentText}, ${TALK_READ})`.as("talk_text"),
      rank: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${posts.blogId} ORDER BY ${posts.createdAt} DESC, ${posts.id} DESC)`.as("rank"),
    })
    .from(posts)
    .where(and(inArray(posts.blogId, rows.map((r) => r.blogId)), eq(posts.visibility, "public")))
    .as("ranked");
  const pets = await getShowcasePets(rows.map((r) => r.ownerId));
  const recent = await db.select().from(ranked).where(sql`${ranked.rank} <= ${Math.max(RECENT_POSTS, TALK_POSTS)}`).orderBy(asc(ranked.rank));

  return rows.map(({ blogId, ownerId, exp, roofColor, greeting, ...h }) => {
    const mine = recent.filter((p) => p.blogId === blogId);
    return {
      ...h,
      roof: ROOF_HEX[currentRoof(blogId, roofColor)],
      level: levelFromExp(exp),
      recentPosts: mine.slice(0, RECENT_POSTS).map((p) => ({ id: p.id, title: p.title })),
      // 마을 말풍선: 마을 한마디가 있으면 그것, 없으면 최근 공개 글의 문장들 (비공개 글은 위 조건으로 빠진다)
      talk: talkLines(greeting, mine.slice(0, TALK_POSTS).map((p) => p.text)),
      // 마을을 걸을 때 데리고 다니는 전시 동물 (사용자 요청 2026-10-12 "전시해둔 펫 데리고 다니게")
      pet: pets.get(ownerId) ?? null,
    };
  });
}

/** 블로그 누적 방문자 수 (BLOG-06: 같은 사람은 하루 1번) */
const totalVisits = sql`(SELECT COUNT(*) FROM ${blogVisits} WHERE ${blogVisits.blogId} = ${blogs.id})`;

/**
 * 로그인하지 않은 방문자의 둘레 집 (TOWN-04): 공개 글이 있는 블로그 중 인기 100곳에서 광장을 열 때마다 무작위 10곳.
 * 인기 = 누적 방문자 수, 같으면 최근 공개 글 순 (문서의 열린 질문이라 2026-10-09에 정함). 공지 블로그는 빠진다
 */
export async function getGuestHouses(): Promise<TownNeighbor[]> {
  const popular = db
    .select({ id: blogs.id })
    .from(blogs)
    .where(and(isNotNull(lastPublicPostAt), notAdminBlog))
    .orderBy(sql`${totalVisits} DESC`, sql`${lastPublicPostAt} DESC`, desc(blogs.id))
    .limit(POPULAR_POOL);
  const rows = await houseQuery().where(inArray(blogs.id, popular)).orderBy(sql`random()`).limit(FAVORITE_LIMIT);
  return (await toHouses(rows)).map((h, i) => ({ ...h, lot: i + 1 }));
}

/**
 * 회원 마을의 이웃 집: 즐겨찾기한 이웃 (먼저 이웃이 된 순, 최대 10). 집 자리는 회원이 골라 준 자리(town_lot)가 먼저,
 * 안 고른 이웃은 남은 자리를 차례로 (TOWN-18, lib/town-lots.ts)
 */
export async function getFavoriteHouses(userId: string): Promise<TownNeighbor[]> {
  const rows = await houseQuery()
    .innerJoin(follows, and(eq(follows.followeeId, blogs.ownerId), eq(follows.followerId, userId), eq(follows.isFavorite, true)))
    .where(notAdminBlog)
    // 같은 순서를 집 자리 고르기(app/town/actions.ts setTownLot)도 쓴다
    .orderBy(asc(follows.createdAt), asc(follows.followeeId))
    .limit(FAVORITE_LIMIT);
  if (!rows.length) return [];
  const lots = await db
    .select({ blogId: blogs.id, townLot: follows.townLot })
    .from(follows)
    .innerJoin(blogs, eq(blogs.ownerId, follows.followeeId))
    .where(and(eq(follows.followerId, userId), inArray(blogs.id, rows.map((r) => r.blogId))));
  const lotOf = new Map(lots.map((l) => [l.blogId, l.townLot]));
  const houses = await toHouses(rows);
  return assignLots(houses.map((h, i) => ({ ...h, townLot: lotOf.get(rows[i].blogId) ?? null }))).map((h) => {
    const { townLot, ...house } = h;
    void townLot;
    return house;
  });
}

export async function getMyHouse(userId: string): Promise<TownHouse | null> {
  const [house] = await toHouses(await houseQuery().where(eq(blogs.ownerId, userId)));
  return house ?? null;
}

/**
 * 마을에서 나를 따라다니는 동물 (사용자 요청 2026-10-11): 내 블로그 우리 집에 전시한 다 키운 동물 한 마리.
 * 전시하지 않았거나, 다 자라지 않았거나, 그림이 없으면 null (블로그의 전시 자리와 같은 규칙)
 */
export async function getTownPet(userId: string): Promise<TownPet | null> {
  return (await getShowcasePets([userId])).get(userId) ?? null;
}

/** 여러 회원의 전시 동물을 한 번에 (이웃 NPC가 데리고 다니는 동물도 같은 규칙). 회원 id → 동물 */
async function getShowcasePets(userIds: string[]): Promise<Map<string, TownPet>> {
  if (!userIds.length) return new Map();
  const rows = await db
    .select({
      userId: blogs.ownerId,
      assetKey: animalSpecies.assetKey,
      name: animalSpecies.name,
      skinKey: animalSkins.assetKey,
      size: sql<AnimalDisplaySize>`${userAnimals.displaySize}`,
    })
    .from(blogs)
    .innerJoin(userAnimals, and(eq(userAnimals.id, blogs.showcaseAnimalId), eq(userAnimals.userId, blogs.ownerId)))
    .innerJoin(animalSpecies, eq(animalSpecies.id, userAnimals.speciesId))
    .leftJoin(animalSkins, eq(animalSkins.id, userAnimals.skinId))
    .where(and(inArray(blogs.ownerId, userIds), eq(userAnimals.status, "grown")));
  return new Map(rows.filter((r) => hasAnimalArt(r.assetKey)).map(({ userId, ...pet }) => [userId, pet]));
}

/**
 * 마을 테마 (사용자 요청 2026-10-12 "눈배경이다 하면 마을에 눈쌓여있고"): 그 회원의 블로그 배경(꾸미기에서 고른 것) → 테마.
 * 블로그가 없거나 모르는 배경이면 기본(초원)
 */
export async function getTownTheme(userId: string): Promise<TownThemeKey> {
  const [row] = await db
    .select({ assetKey: items.assetKey })
    .from(blogs)
    .innerJoin(items, eq(items.id, blogs.backgroundItemId))
    .where(eq(blogs.ownerId, userId));
  return townThemeOf(row?.assetKey);
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
      townLot: follows.townLot,
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
 * 관리자 블로그는 남의 마을에도 나오지 않는다 (notAdminBlog)
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

/** 내 마을 한마디 (내 정보 화면) */
export async function getGreeting(userId: string): Promise<string | null> {
  const [row] = await db.select({ greeting: profiles.greeting }).from(profiles).where(eq(profiles.userId, userId));
  return row?.greeting ?? null;
}
