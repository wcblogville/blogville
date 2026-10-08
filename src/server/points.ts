import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { items, type ledgerReason, notifications, pointLedger } from "@/db/schema";
import { levelProgress, levelsGained, REWARD_RULES, type RewardReason } from "@/lib/game";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

/** 한국 시간 기준 오늘 0시 (timestamptz) */
export const startOfTodayKST = sql`(date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul')`;

/**
 * 같은 회원의 보상·구매가 동시에 처리되지 않도록 트랜잭션 동안 회원 단위로 잠근다.
 * (버튼을 연달아 눌러도 하루 상한이나 잔액 확인이 어긋나지 않게)
 */
export async function lockUser(tx: Tx, userId: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
}

/** 원장 합계로 계산한 코인·경험치·레벨 */
export async function getWallet(userId: string, executor: Executor = db) {
  const [row] = await executor
    .select({
      coins: sql<number>`COALESCE(SUM(${pointLedger.coinDelta}), 0)::int`,
      exp: sql<number>`COALESCE(SUM(${pointLedger.expDelta}), 0)::int`,
    })
    .from(pointLedger)
    .where(eq(pointLedger.userId, userId));
  return { coins: row.coins, exp: row.exp, ...levelProgress(row.exp) };
}

export type LedgerReason = (typeof ledgerReason.enumValues)[number];

/** 누적 경험치 (같은 tx로 읽어야 잠금 안의 값이 된다) */
async function totalExp(tx: Tx, userId: string) {
  const [row] = await tx
    .select({ exp: sql<number>`COALESCE(SUM(${pointLedger.expDelta}), 0)::int` })
    .from(pointLedger)
    .where(eq(pointLedger.userId, userId));
  return row.exp;
}

/**
 * 원장 1줄을 넣고, 경험치로 레벨이 오르면 오른 레벨마다 레벨업 알림을 같은 트랜잭션에 넣는다 (GAME-06 / FR-037).
 * 경험치가 생기는 기록은 모두 이 함수(또는 grantReward)로 넣는다. 반드시 lockUser를 건 트랜잭션 안에서 부른다.
 */
export async function addLedgerEntry(
  tx: Tx,
  entry: { userId: string; reason: LedgerReason; expDelta?: number; coinDelta?: number; refId?: string | number | null },
): Promise<{ levelUps: number[] }> {
  const expDelta = entry.expDelta ?? 0;
  const before = expDelta > 0 ? await totalExp(tx, entry.userId) : 0;
  await tx.insert(pointLedger).values({
    userId: entry.userId,
    reason: entry.reason,
    expDelta,
    coinDelta: entry.coinDelta ?? 0,
    refId: entry.refId === undefined || entry.refId === null ? null : String(entry.refId),
  });
  if (expDelta <= 0) return { levelUps: [] };

  const levelUps = levelsGained(before, before + expDelta);
  if (levelUps.length) {
    await tx
      .insert(notifications)
      .values(levelUps.map((level) => ({ userId: entry.userId, kind: "level_up" as const, level })))
      .onConflictDoNothing();
  }
  return { levelUps };
}

export type RewardResult = { granted: false } | { granted: true; exp: number; coins: number };

/**
 * 활동 보상 지급. 오늘 같은 사유로 이미 상한만큼 받았으면 지급하지 않는다.
 * 반드시 lockUser를 건 트랜잭션 안에서 호출한다.
 */
export async function grantReward(
  tx: Tx,
  userId: string,
  reason: RewardReason,
  refId?: string | number,
): Promise<RewardResult> {
  const rule = REWARD_RULES[reason];
  const [{ count }] = await tx
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(pointLedger)
    .where(
      and(
        eq(pointLedger.userId, userId),
        eq(pointLedger.reason, reason),
        gte(pointLedger.createdAt, startOfTodayKST),
      ),
    );
  if (count >= rule.dailyLimit) return { granted: false };

  await addLedgerEntry(tx, { userId, reason, expDelta: rule.exp, coinDelta: rule.coins, refId });
  return { granted: true, exp: rule.exp, coins: rule.coins };
}

export const LEDGER_PAGE_SIZE = 20;

/** 경험치·코인 내역 (GAME-07): 최신순, 구매는 아이템 이름을 붙인다 */
export async function listLedger(userId: string, page: number) {
  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(pointLedger)
    .where(eq(pointLedger.userId, userId));
  const rows = await db
    .select({
      id: pointLedger.id,
      reason: pointLedger.reason,
      expDelta: pointLedger.expDelta,
      coinDelta: pointLedger.coinDelta,
      createdAt: pointLedger.createdAt,
      itemName: items.name,
    })
    .from(pointLedger)
    .leftJoin(items, and(eq(pointLedger.reason, "purchase"), sql`${items.id}::text = ${pointLedger.refId}`))
    .where(eq(pointLedger.userId, userId))
    .orderBy(desc(pointLedger.createdAt), desc(pointLedger.id))
    .limit(LEDGER_PAGE_SIZE)
    .offset((page - 1) * LEDGER_PAGE_SIZE);
  return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / LEDGER_PAGE_SIZE)) };
}
