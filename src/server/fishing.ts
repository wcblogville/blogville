// 연못 낚시터 서버 쪽 (TOWN-14, 2026-10-12 "낚시 컨텐츠 더 풍성하게"): 던진 낚싯대 표(서명), 도감·이번 주 랭킹 조회
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, asc, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { fishingCatches, items, profiles, blogs } from "@/db/schema";
import { FISHING_RULES, todayKST, weekStart } from "@/lib/game";
import { outfitOf } from "@/server/inventory";

// ===== 던진 낚싯대 표 =====
// 입질 시각을 서버가 정하고 서명해서 돌려준다. 당길 때 서버 시각과 비교해 타이밍을 판정하므로 화면이 판정을 속일 수 없다.
// DB에 쓰지 않는다 (던지고 그냥 나가도 남는 것이 없다). 몇 번째 낚싯대(castNo)도 표에 들어가 PK(user_id, date, cast_no)가 한 번만 받게 한다

export type CastTicket = {
  userId: string;
  date: string;
  castNo: number;
  biteAt: number;
};

function secret() {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("BETTER_AUTH_SECRET이 없어요");
  return s;
}

function sign(body: string) {
  return createHmac("sha256", secret()).update(`fishing:${body}`).digest("base64url");
}

export function signCast(t: CastTicket): string {
  const body = Buffer.from(JSON.stringify([t.userId, t.date, t.castNo, t.biteAt])).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** 서명이 맞고 너무 오래되지 않았으면 표 내용, 아니면 null */
export function verifyCast(token: unknown, now = Date.now()): CastTicket | null {
  if (typeof token !== "string" || token.length > 400) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const want = Buffer.from(sign(body));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const [userId, date, castNo, biteAt] = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof userId !== "string" || typeof date !== "string" || !Number.isInteger(castNo) || !Number.isInteger(biteAt)) return null;
    if (now - biteAt > FISHING_RULES.castTtlMs) return null;
    return { userId, date, castNo, biteAt };
  } catch {
    return null;
  }
}

// ===== 조회 =====

/** 오늘 던진 결과 (던진 순서대로) */
export async function getTodayCasts(userId: string) {
  return db
    .select({
      castNo: fishingCatches.castNo,
      catchKey: fishingCatches.catchKey,
      sizeMm: fishingCatches.sizeMm,
      coins: fishingCatches.coins,
    })
    .from(fishingCatches)
    .where(and(eq(fishingCatches.userId, userId), eq(fishingCatches.date, todayKST())))
    .orderBy(asc(fishingCatches.castNo));
}

/** 도감: 낚은 것마다 처음 낚은 날·가장 큰 길이·낚은 횟수 */
export async function getFishDex(userId: string) {
  const rows = await db
    .select({
      catchKey: fishingCatches.catchKey,
      firstDate: sql<string>`MIN(${fishingCatches.date})::text`,
      maxSizeMm: sql<number | null>`MAX(${fishingCatches.sizeMm})`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(fishingCatches)
    .where(eq(fishingCatches.userId, userId))
    .groupBy(fishingCatches.catchKey);
  return new Map(rows.map((r) => [r.catchKey, r]));
}

/** 최근 낚시 기록 */
export async function getRecentCatches(userId: string, limit = 9) {
  return db
    .select({
      date: fishingCatches.date,
      castNo: fishingCatches.castNo,
      catchKey: fishingCatches.catchKey,
      sizeMm: fishingCatches.sizeMm,
    })
    .from(fishingCatches)
    .where(eq(fishingCatches.userId, userId))
    .orderBy(desc(fishingCatches.date), desc(fishingCatches.castNo))
    .limit(limit);
}

const characterItem = alias(items, "character_item");

/** 이번 주(월요일부터, 한국 날짜) 가장 큰 물고기 랭킹: 회원마다 가장 큰 한 마리, 길이 → 먼저 낚은 순 */
export async function getWeeklyRanking(limit = 5) {
  const from = weekStart(todayKST());
  const best = db
    .selectDistinctOn([fishingCatches.userId], {
      userId: fishingCatches.userId,
      catchKey: fishingCatches.catchKey,
      sizeMm: fishingCatches.sizeMm,
      createdAt: fishingCatches.createdAt,
    })
    .from(fishingCatches)
    .where(and(gte(fishingCatches.date, from), isNotNull(fishingCatches.sizeMm)))
    .orderBy(fishingCatches.userId, desc(fishingCatches.sizeMm), asc(fishingCatches.createdAt))
    .as("best");
  const rows = await db
    .select({
      catchKey: best.catchKey,
      sizeMm: best.sizeMm,
      nickname: profiles.nickname,
      blogSlug: blogs.slug,
      characterAsset: characterItem.assetKey,
      outfit: outfitOf(best.userId),
    })
    .from(best)
    .innerJoin(profiles, eq(profiles.userId, best.userId))
    .innerJoin(characterItem, eq(characterItem.id, profiles.characterItemId))
    .innerJoin(blogs, eq(blogs.ownerId, best.userId))
    .orderBy(desc(best.sizeMm), asc(best.createdAt))
    .limit(limit);
  return { from, rows: rows.map((r) => ({ ...r, sizeMm: r.sizeMm ?? 0 })) };
}
