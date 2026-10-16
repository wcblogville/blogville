"use server";

import { and, eq, gt, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { avatarEquips, avatarSlot, blogs, items, profiles, userItems } from "@/db/schema";
import { parseId } from "@/lib/ids";
import { CLOSET_ERRORS } from "@/lib/shop";
import { requireMember } from "@/server/dal";

type Result = { ok: boolean; error?: string };

type Slot = (typeof avatarSlot.enumValues)[number];
const isSlot = (v: unknown): v is Slot => typeof v === "string" && (avatarSlot.enumValues as readonly string[]).includes(v);
const MAX_CHANGES = 20;

/** 꾸미기에서 바꾼 것 하나: 캐릭터·배경은 그 아이템으로, 아바타는 부위마다 아이템(없으면 벗기) */
export type ClosetChange = { kind: "character"; itemId: number } | { kind: "background"; itemId: number } | { kind: "avatar"; slot: Slot; itemId: number | null };

function parseChanges(raw: unknown): ClosetChange[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_CHANGES) return null;
  const out: ClosetChange[] = [];
  for (const c of raw as unknown[]) {
    if (!c || typeof c !== "object") return null;
    const { kind, slot, itemId } = c as Record<string, unknown>;
    if (kind === "character" || kind === "background") {
      const id = parseId(itemId);
      if (id === null) return null;
      out.push({ kind, itemId: id });
    } else if (kind === "avatar" && isSlot(slot)) {
      const id = itemId === null ? null : parseId(itemId);
      if (itemId !== null && id === null) return null;
      out.push({ kind, slot, itemId: id });
    } else return null;
  }
  return out;
}

/**
 * 꾸미기 저장 (SHOP-04·06, contracts/closet.md 2장; 2026-10-16 "옷 입을 때 저장 버튼 만들어서 저장 누르면 적용"):
 * 화면에서 눌러 본 것은 미리보기만 하고, [저장]을 누르면 바꾼 것을 한 트랜잭션으로 적용한다.
 * 가진 것만 입을 수 있다 (복합 외래 키가 DB에서 한 번 더 막는다). 하나라도 안 되면 아무것도 바꾸지 않는다
 */
export async function saveCloset(raw: unknown): Promise<Result> {
  const viewer = await requireMember();
  const changes = parseChanges(raw);
  if (!changes) return { ok: false, error: CLOSET_ERRORS.notOwned };
  const ids = changes.flatMap((c) => (c.itemId === null ? [] : [c.itemId]));
  const owned = ids.length
    ? await db
        .select({ id: items.id, type: items.type, avatarSlot: items.avatarSlot })
        .from(userItems)
        .innerJoin(items, eq(items.id, userItems.itemId))
        .where(and(eq(userItems.userId, viewer.userId), inArray(userItems.itemId, ids), gt(userItems.quantity, 0)))
    : [];
  const byId = new Map(owned.map((o) => [o.id, o]));
  for (const c of changes) {
    if (c.itemId === null) continue;
    const it = byId.get(c.itemId);
    if (!it) return { ok: false, error: CLOSET_ERRORS.notOwned };
    const fits = c.kind === "avatar" ? it.type === "avatar" && it.avatarSlot === c.slot : it.type === c.kind;
    if (!fits) return { ok: false, error: CLOSET_ERRORS.cannotEquip };
  }
  await db.transaction(async (tx) => {
    for (const c of changes) {
      if (c.kind === "character") await tx.update(profiles).set({ characterItemId: c.itemId }).where(eq(profiles.userId, viewer.userId));
      else if (c.kind === "background") await tx.update(blogs).set({ backgroundItemId: c.itemId }).where(eq(blogs.ownerId, viewer.userId));
      else if (c.itemId === null) await tx.delete(avatarEquips).where(and(eq(avatarEquips.userId, viewer.userId), eq(avatarEquips.slot, c.slot)));
      else {
        // 부위마다 하나: 같은 부위를 입고 있으면 바꾼다
        const itemId = c.itemId;
        await tx
          .insert(avatarEquips)
          .values({ userId: viewer.userId, slot: c.slot, itemId })
          .onConflictDoUpdate({ target: [avatarEquips.userId, avatarEquips.slot], set: { itemId } });
      }
    }
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
