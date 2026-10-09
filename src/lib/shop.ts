// 상점·꾸미기 규칙 (SHOP). DB를 쓰지 않는 순수 함수만 둔다 (화면과 서버 어디서나 import 가능)
import { withJosa } from "@/lib/josa";

export type ItemType = "character" | "background" | "furniture" | "avatar" | "growth" | "deco";

/** 상점 구역 순서와 제목 (FR-003). 캐릭터는 상점에 없다 */
export const SHOP_SECTIONS: { type: Exclude<ItemType, "character">; title: string }[] = [
  { type: "avatar", title: "👕 아바타 꾸미기" },
  { type: "furniture", title: "🪑 가구" },
  { type: "deco", title: "🌷 광장 장식" },
  { type: "background", title: "🖼 배경" },
  { type: "growth", title: "🌱 성장 아이템" },
];

export function sectionTitle(type: ItemType): string | null {
  return SHOP_SECTIONS.find((s) => s.type === type)?.title ?? null;
}

/** 상점 카드 한 장 */
export type ShopItem = {
  id: number;
  type: ItemType;
  name: string;
  description: string | null;
  price: number;
  requiredLevel: number;
  assetKey: string;
  /** 내가 가진 개수 (없으면 0). 꾸미기 아이템은 0 또는 1 */
  quantity: number;
  /** 가진 회원 수 (인기순) */
  ownerCount: number;
};

export type ButtonState = "owned" | "locked" | "short" | "buy";

/** [사기] 버튼 상태 (FR-006): 보유 중 → 레벨 잠금 → 코인 부족 → 사기. 성장 아이템은 여러 번 살 수 있어 보유 중이 없다 */
export function buttonState(item: Pick<ShopItem, "type" | "price" | "requiredLevel" | "quantity">, me: { level: number; coins: number }): ButtonState {
  if (item.type !== "growth" && item.quantity > 0) return "owned";
  if (me.level < item.requiredLevel) return "locked";
  if (me.coins < item.price) return "short";
  return "buy";
}

/** 모자란 코인 (FR-019) */
export function shortage(price: number, coins: number): number {
  return Math.max(0, price - coins);
}

/** 산 뒤 안내 (FR-008, FR-043) */
export function purchaseMessage(kind: "decor" | "growth", name: string): string {
  return kind === "growth" ? `🎉 ${withJosa(name, "을/를")} 샀어요! 동물 농장에서 써 보세요.` : `🎉 ${withJosa(name, "을/를")} 샀어요! 꾸미기에서 장착해 보세요.`;
}

export const SHOP_ERRORS = {
  notForSale: "살 수 없는 아이템이에요",
  owned: "이미 가지고 있는 아이템이에요",
  level: (n: number) => `레벨 ${n}부터 살 수 있어요`,
  coins: (n: number) => `코인이 ${n}개 부족해요`,
} as const;

export const CLOSET_ERRORS = {
  notOwned: "가지고 있지 않은 아이템이에요",
  cannotEquip: "아직 장착할 수 없는 종류예요",
  failed: "장착하지 못했어요. 잠시 뒤 다시 시도해 주세요",
} as const;

export const equipMessage = (name: string) => `${name} 장착을 저장했어요 ✓`;

// ===== 정렬 (FR-014~015) =====
export const SHOP_SORTS = [
  { key: "level", label: "레벨순" },
  { key: "popular", label: "인기순" },
  { key: "priceDesc", label: "비싼 순" },
  { key: "priceAsc", label: "싼 순" },
  { key: "newest", label: "최신순" },
  { key: "owned", label: "보유순" },
] as const;
export type ShopSort = (typeof SHOP_SORTS)[number]["key"];
export const DEFAULT_SORT: ShopSort = "level";

type Sortable = Pick<ShopItem, "id" | "price" | "requiredLevel" | "quantity" | "ownerCount">;

/** 새 배열로 정렬. 마지막 동률은 id 작은 순 (R13) */
export function sortShopItems<T extends Sortable>(items: readonly T[], sort: ShopSort): T[] {
  const cmp: Record<ShopSort, (a: T, b: T) => number> = {
    level: (a, b) => a.requiredLevel - b.requiredLevel || a.price - b.price,
    popular: (a, b) => b.ownerCount - a.ownerCount || a.price - b.price,
    priceDesc: (a, b) => b.price - a.price || a.requiredLevel - b.requiredLevel,
    priceAsc: (a, b) => a.price - b.price || a.requiredLevel - b.requiredLevel,
    newest: (a, b) => b.id - a.id,
    owned: (a, b) => Number(b.quantity > 0) - Number(a.quantity > 0) || a.price - b.price,
  };
  return [...items].sort((a, b) => cmp[sort](a, b) || a.id - b.id);
}
