import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { avatarEquips, items, pointLedger, userItems } from "@/db/schema";
import type { AvatarSlot } from "@/lib/art/avatar";
import { checkout, parseSelection, STYLE_ERRORS, STYLE_PLACES, type StyleItem, type StylePlace, type StyleSelection } from "@/lib/style";
import { requireMember } from "@/server/dal";
import { getWallet, lockUser } from "@/server/points";

/** 가게 진열: 그 가게 부위의 아바타 아이템 중 판매 중이거나 내가 가진 것 (가격·레벨 순) */
export async function listStyleItems(userId: string, place: StylePlace): Promise<StyleItem[]> {
  const slots = [...STYLE_PLACES[place].slots] as AvatarSlot[];
  const rows = await db
    .select({
      id: items.id,
      slot: items.avatarSlot,
      name: items.name,
      description: items.description,
      price: items.price,
      requiredLevel: items.requiredLevel,
      assetKey: items.assetKey,
      isOnSale: items.isOnSale,
      quantity: userItems.quantity,
    })
    .from(items)
    .leftJoin(userItems, and(eq(userItems.itemId, items.id), eq(userItems.userId, userId)))
    .where(and(eq(items.type, "avatar"), inArray(items.avatarSlot, slots)))
    .orderBy(asc(items.requiredLevel), asc(items.price), asc(items.id));
  return rows
    .filter((r) => r.isOnSale || (r.quantity ?? 0) > 0)
    .map((r) => ({
      id: r.id,
      slot: r.slot as AvatarSlot,
      name: r.name,
      description: r.description,
      price: r.price,
      requiredLevel: r.requiredLevel,
      assetKey: r.assetKey,
      owned: (r.quantity ?? 0) > 0,
    }));
}

export type StyleResult = { ok: true; bought: string[]; cost: number; coins: number } | { ok: false; error: string };

/**
 * 미용실·옷가게 [적용하기] (SHOP-07·08). 한 트랜잭션에서 잠금 → 확인 → 사기 → 입기.
 * - selection: 그 가게 부위만 (parseSelection을 거친 값). null이면 그 부위를 벗는다
 * - pay: 화면이 보여 준 코인 합계. 서버가 계산한 값과 다르면 아무것도 바꾸지 않는다
 *   (pay = 0인데 사야 할 유료 아이템이 있으면 "가지고 있지 않은 아이템" → 산다고 하지 않은 것은 입히지 않는다)
 * 0코인 아이템은 고르기만 해도 받는다 (원장에는 0코인 줄을 쓰지 않는다: point_ledger_nonzero_check)
 */
export async function applyStyle(userId: string, place: StylePlace, selection: StyleSelection, pay: number): Promise<StyleResult> {
  const slots: readonly AvatarSlot[] = STYLE_PLACES[place].slots;
  const ids = Object.values(selection).filter((v): v is number => typeof v === "number");

  return db.transaction(async (tx): Promise<StyleResult> => {
    await lockUser(tx, userId);
    const found = ids.length
      ? await tx
          .select({
            id: items.id,
            type: items.type,
            slot: items.avatarSlot,
            name: items.name,
            price: items.price,
            requiredLevel: items.requiredLevel,
            assetKey: items.assetKey,
            isOnSale: items.isOnSale,
            quantity: userItems.quantity,
          })
          .from(items)
          .leftJoin(userItems, and(eq(userItems.itemId, items.id), eq(userItems.userId, userId)))
          .where(inArray(items.id, ids))
      : [];
    const byId = new Map(found.map((f) => [f.id, f]));

    // 부위가 맞는 이 가게 아이템인지, 없는 것은 팔고 있는지
    const list: StyleItem[] = [];
    for (const [slot, id] of Object.entries(selection) as [AvatarSlot, number | null][]) {
      if (!slots.includes(slot)) return { ok: false, error: STYLE_ERRORS.badItem };
      if (id === null) continue;
      const f = byId.get(id);
      if (!f || f.type !== "avatar" || f.slot !== slot) return { ok: false, error: STYLE_ERRORS.badItem };
      const owned = (f.quantity ?? 0) > 0;
      if (!owned && !f.isOnSale) return { ok: false, error: STYLE_ERRORS.notForSale };
      list.push({ id: f.id, slot, name: f.name, description: null, price: f.price, requiredLevel: f.requiredLevel, assetKey: f.assetKey, owned });
    }

    const wallet = await getWallet(userId, tx);
    const bill = checkout(list, selection, {}, wallet);
    if (bill.lockedLevel !== null) return { ok: false, error: STYLE_ERRORS.level(bill.lockedLevel) };
    if (pay !== bill.cost) return { ok: false, error: pay === 0 ? STYLE_ERRORS.notOwned : STYLE_ERRORS.priceChanged };
    if (bill.short > 0) return { ok: false, error: STYLE_ERRORS.coins(bill.short) };

    // 사기: 행이 없으면 새로, 수량 0으로 남은 행이면 1로 (보유 = quantity > 0)
    for (const item of bill.toBuy) {
      await tx
        .insert(userItems)
        .values({ userId, itemId: item.id })
        .onConflictDoUpdate({ target: [userItems.userId, userItems.itemId], set: { quantity: 1 } });
      if (item.price > 0) await tx.insert(pointLedger).values({ userId, reason: "purchase", coinDelta: -item.price, refId: String(item.id) });
    }

    // 입기: 부위마다 하나 (가진 것만 — 복합 FK avatar_equips_owned_fk가 한 번 더 막는다)
    for (const [slot, id] of Object.entries(selection) as [AvatarSlot, number | null][]) {
      if (id === null) {
        await tx.delete(avatarEquips).where(and(eq(avatarEquips.userId, userId), eq(avatarEquips.slot, slot)));
      } else {
        await tx
          .insert(avatarEquips)
          .values({ userId, slot, itemId: id })
          .onConflictDoUpdate({ target: [avatarEquips.userId, avatarEquips.slot], set: { itemId: id, equippedAt: new Date() } });
      }
    }
    return { ok: true, bought: bill.toBuy.map((i) => i.name), cost: bill.cost, coins: wallet.coins - bill.cost };
  });
}

/**
 * 미용실·옷가게 Server Action이 같이 쓰는 처리: 회원 확인(자동 출석 때문에 트랜잭션 밖, 맨 앞) → 값 검사 → 적용.
 * 코인·캐릭터가 바뀌므로 성공하면 헤더까지 다시 그린다 (revalidatePath("/", "layout"))
 */
export async function styleAction(place: StylePlace, rawSelection: unknown, rawPay: unknown): Promise<StyleResult> {
  const viewer = await requireMember();
  const selection = parseSelection(place, rawSelection);
  if (!selection) return { ok: false, error: STYLE_ERRORS.badItem };
  const pay = typeof rawPay === "number" && Number.isSafeInteger(rawPay) && rawPay >= 0 ? rawPay : null;
  if (pay === null) return { ok: false, error: STYLE_ERRORS.priceChanged };
  try {
    const result = await applyStyle(viewer.userId, place, selection, pay);
    if (result.ok) revalidatePath("/", "layout");
    return result;
  } catch (err) {
    // 같은 아이템을 두 탭에서 동시에 사는 등: 잠금 덕분에 드물지만 오류 화면 대신 알려 준다
    console.error("[style] 적용 실패", err);
    return { ok: false, error: STYLE_ERRORS.failed };
  }
}
