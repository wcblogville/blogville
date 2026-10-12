// 블로그 주인의 이웃 목록 (SOC-06, 사용자 요청 2026-10-12 "친구 이웃 볼 수 있게 해서 그거 타고 가서 팔로우 할 수 있게 하자").
// 두 가지: 이 주인이 이웃으로 추가한 회원(following) · 이 주인을 이웃으로 추가한 회원(followers).
// 목록은 로그인한 회원에게만 보여 준다 (방문자는 숫자만). 닉네임·블로그 이름·캐릭터는 보여 줄 때 JOIN한다
import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { blogs, follows, items, profiles } from "@/db/schema";
import { outfitOf } from "@/server/inventory";

export type NeighborTab = "following" | "followers";
export const NEIGHBORS_PAGE_SIZE = 20;
/** 옆 칸 위젯에 얼굴을 보여 줄 이웃 수 */
export const NEIGHBOR_PREVIEW = 6;

const characterItem = alias(items, "neighbor_character");

export function parseNeighborTab(value: unknown): NeighborTab {
  return value === "followers" ? "followers" : "following";
}

/** 이 주인의 이웃 수 · 나를 이웃으로 둔 수 */
export async function getNeighborCounts(ownerId: string) {
  const [row] = await db
    .select({
      following: sql<number>`COUNT(*) FILTER (WHERE ${follows.followerId} = ${ownerId})::int`,
      followers: sql<number>`COUNT(*) FILTER (WHERE ${follows.followeeId} = ${ownerId})::int`,
    })
    .from(follows)
    .where(sql`${follows.followerId} = ${ownerId} OR ${follows.followeeId} = ${ownerId}`);
  return row;
}

/**
 * 이웃 목록 한 쪽 (최근에 이웃이 된 순). viewerId가 있으면 보는 사람이 그 회원을 이미 이웃으로 두었는지(viewerFollows)도 준다.
 * 블로그가 없는 회원은 없지만(가입 = 회원·프로필·블로그 한 트랜잭션) 안전하게 INNER JOIN으로 거른다
 */
export async function listNeighbors(opts: { ownerId: string; tab: NeighborTab; viewerId: string | null; page?: number; limit?: number }) {
  const limit = opts.limit ?? NEIGHBORS_PAGE_SIZE;
  const page = opts.page ?? 1;
  // following: 주인이 follower → 상대는 followee. followers: 반대
  const other = opts.tab === "following" ? follows.followeeId : follows.followerId;
  const where = opts.tab === "following" ? eq(follows.followerId, opts.ownerId) : eq(follows.followeeId, opts.ownerId);
  const [{ total }] = await db.select({ total: sql<number>`COUNT(*)::int` }).from(follows).where(where);
  const rows = await db
    .select({
      userId: other,
      nickname: profiles.nickname,
      photoKey: profiles.photoKey,
      characterAsset: characterItem.assetKey,
      outfit: outfitOf(other),
      slug: blogs.slug,
      title: blogs.title,
      since: follows.createdAt,
      // 주인과 서로 이웃(맞이웃)인지
      mutual: (opts.tab === "following"
        ? sql<boolean>`EXISTS (SELECT 1 FROM ${follows} f2 WHERE f2.follower_id = ${other} AND f2.followee_id = ${opts.ownerId})`
        : sql<boolean>`EXISTS (SELECT 1 FROM ${follows} f2 WHERE f2.follower_id = ${opts.ownerId} AND f2.followee_id = ${other})`
      ).mapWith(Boolean),
      viewerFollows: opts.viewerId
        ? sql<boolean>`EXISTS (SELECT 1 FROM ${follows} f3 WHERE f3.follower_id = ${opts.viewerId} AND f3.followee_id = ${other})`.mapWith(Boolean)
        : sql<boolean>`false`.mapWith(Boolean),
    })
    .from(follows)
    .innerJoin(profiles, eq(profiles.userId, other))
    .innerJoin(characterItem, eq(characterItem.id, profiles.characterItemId))
    .innerJoin(blogs, eq(blogs.ownerId, other))
    .where(where)
    .orderBy(desc(follows.createdAt), other)
    .limit(limit)
    .offset((page - 1) * limit);
  return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / limit)) };
}

export type NeighborRow = Awaited<ReturnType<typeof listNeighbors>>["rows"][number];
