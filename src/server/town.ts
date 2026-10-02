import "server-only";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { attendances, blogs, items, posts, profiles } from "@/db/schema";
import { todayKST } from "@/lib/game";
import type { TownHouse } from "@/components/town/types";

const characterItem = alias(items, "character_item");
const backgroundItem = alias(items, "background_item");

/** 광장에 보여줄 집: 최근 공개 글을 쓴 블로그 순 (글이 없으면 새로 생긴 순) */
export async function getTownHouses(excludeUserId: string | null, limit = 8): Promise<TownHouse[]> {
  const lastPostAt = sql<Date | null>`(
    SELECT MAX(${posts.createdAt}) FROM ${posts}
    WHERE ${posts.blogId} = ${blogs.id} AND ${posts.visibility} = 'public'
  )`;

  return db
    .select({
      slug: blogs.slug,
      title: blogs.title,
      nickname: profiles.nickname,
      characterAsset: characterItem.assetKey,
      backgroundAsset: backgroundItem.assetKey,
    })
    .from(blogs)
    .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
    .innerJoin(characterItem, eq(characterItem.id, profiles.characterItemId))
    .innerJoin(backgroundItem, eq(backgroundItem.id, blogs.backgroundItemId))
    .where(excludeUserId ? ne(blogs.ownerId, excludeUserId) : undefined)
    .orderBy(sql`${lastPostAt} DESC NULLS LAST`, desc(blogs.createdAt))
    .limit(limit);
}

export async function getMyHouse(userId: string): Promise<TownHouse | null> {
  const [row] = await db
    .select({
      slug: blogs.slug,
      title: blogs.title,
      nickname: profiles.nickname,
      characterAsset: characterItem.assetKey,
      backgroundAsset: backgroundItem.assetKey,
    })
    .from(blogs)
    .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
    .innerJoin(characterItem, eq(characterItem.id, profiles.characterItemId))
    .innerJoin(backgroundItem, eq(backgroundItem.id, blogs.backgroundItemId))
    .where(eq(blogs.ownerId, userId));
  return row ?? null;
}

export async function hasAttendedToday(userId: string) {
  const [row] = await db
    .select({ userId: attendances.userId })
    .from(attendances)
    .where(and(eq(attendances.userId, userId), eq(attendances.date, todayKST())));
  return Boolean(row);
}
