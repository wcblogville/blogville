// 미용실·옷가게 규칙 (SHOP-07·SHOP-08, 사용자 요청 2026-10-11 "캐릭터 스타일링").
// DB를 쓰지 않는 순수 함수만 둔다: 화면(미리보기·버튼)과 서버(src/server/style.ts)가 같은 계산을 쓴다.
// 고른 것 중 아직 없는 아이템은 그 자리에서 사고(0코인은 그냥 받는다), 가진 것은 바로 입는다.
import type { AvatarSlot } from "@/lib/art/avatar";
import { parseId } from "@/lib/ids";
import { withJosa } from "@/lib/josa";

/** 가게마다 고를 수 있는 부위 (앞에서부터 탭 순서) */
export const STYLE_PLACES = {
  salon: { slots: ["hair", "hair_color"], title: "미용실", emoji: "💇", href: "/salon" },
  clothes: { slots: ["outfit", "hat", "accessory"], title: "옷가게", emoji: "👗", href: "/clothes" },
} as const satisfies Record<string, { slots: readonly AvatarSlot[]; title: string; emoji: string; href: string }>;
export type StylePlace = keyof typeof STYLE_PLACES;

export const SLOT_LABELS: Record<AvatarSlot, string> = {
  hair: "머리 모양",
  hair_color: "머리 색",
  outfit: "옷",
  hat: "모자",
  accessory: "소품",
};

/** 가게 진열 아이템 한 개 */
export type StyleItem = {
  id: number;
  slot: AvatarSlot;
  name: string;
  description: string | null;
  price: number;
  requiredLevel: number;
  assetKey: string;
  owned: boolean;
};

/** 부위마다 고른 아이템 id. null = 아무것도 안 입음(원래 머리·원래 색) */
export type StyleSelection = Partial<Record<AvatarSlot, number | null>>;

export type Checkout = {
  /** 새로 사야 하는 아이템 (0코인 포함) */
  toBuy: StyleItem[];
  /** 낼 코인 합계 */
  cost: number;
  /** 지금 입은 것과 달라지는 부위 수 */
  changes: number;
  /** 레벨이 모자라 못 사는 것 중 가장 높은 필요 레벨 (없으면 null) */
  lockedLevel: number | null;
  /** 모자란 코인 (0 = 충분) */
  short: number;
};

/** 고른 모습을 적용하려면 무엇을 사야 하고 얼마인지 (지금 입은 것 worn과 비교) */
export function checkout(items: readonly StyleItem[], selection: StyleSelection, worn: StyleSelection, me: { level: number; coins: number }): Checkout {
  const byId = new Map(items.map((i) => [i.id, i]));
  const toBuy: StyleItem[] = [];
  let changes = 0;
  for (const [slot, id] of Object.entries(selection) as [AvatarSlot, number | null][]) {
    if ((worn[slot] ?? null) !== (id ?? null)) changes++;
    const item = id === null ? undefined : byId.get(id);
    if (item && !item.owned) toBuy.push(item);
  }
  const cost = toBuy.reduce((n, i) => n + i.price, 0);
  const locked = toBuy.filter((i) => i.requiredLevel > me.level).map((i) => i.requiredLevel);
  return { toBuy, cost, changes, lockedLevel: locked.length ? Math.max(...locked) : null, short: Math.max(0, cost - me.coins) };
}

export type CheckoutState = "same" | "locked" | "short" | "buy" | "apply";

/** [적용하기] 버튼 상태: 바뀐 게 없음 → 레벨 잠금 → 코인 부족 → 사고 적용 → 그냥 적용 */
export function checkoutState(c: Checkout): CheckoutState {
  if (c.changes === 0) return "same";
  if (c.lockedLevel !== null) return "locked";
  if (c.short > 0) return "short";
  return c.cost > 0 ? "buy" : "apply";
}

export const STYLE_ERRORS = {
  badItem: "이 가게에서 고를 수 없는 아이템이에요",
  notForSale: "지금은 팔지 않는 아이템이에요",
  notOwned: "가지고 있지 않은 아이템이에요. 코인을 내고 사야 입을 수 있어요",
  priceChanged: "가격이 바뀌었어요. 다시 확인하고 눌러 주세요",
  level: (n: number) => `레벨 ${n}부터 살 수 있어요`,
  coins: (n: number) => `코인이 ${n}개 부족해요`,
  failed: "저장하지 못했어요. 잠시 뒤 다시 시도해 주세요",
} as const;

/** 적용한 뒤 안내 */
export function styleMessage(place: StylePlace, bought: readonly string[], cost: number): string {
  const done = place === "salon" ? "새 머리가 잘 어울려요!" : "새 옷이 잘 어울려요!";
  if (!bought.length) return `✨ ${done}`;
  return `🎉 ${withJosa(bought.join(", "), "을/를")} ${cost > 0 ? `🪙 ${cost}에 샀어요` : "받았어요"}. ${done}`;
}

/**
 * 화면에서 받은 고른 값 검사 (서버). 그 가게의 부위만, id는 양의 정수 또는 null.
 * 맞지 않으면 null
 */
export function parseSelection(place: StylePlace, raw: unknown): StyleSelection | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const allowed: readonly AvatarSlot[] = STYLE_PLACES[place].slots;
  const out: StyleSelection = {};
  for (const [slot, id] of Object.entries(raw as Record<string, unknown>)) {
    if (!allowed.includes(slot as AvatarSlot)) return null;
    if (id === null) {
      out[slot as AvatarSlot] = null;
      continue;
    }
    const n = parseId(id);
    if (n === null) return null;
    out[slot as AvatarSlot] = n;
  }
  return Object.keys(out).length ? out : null;
}
