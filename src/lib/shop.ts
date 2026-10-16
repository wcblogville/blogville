// 상점·꾸미기 규칙 (SHOP). DB를 쓰지 않는 순수 함수만 둔다 (화면과 서버 어디서나 import 가능)
import { withJosa } from "@/lib/josa";

export type ItemType = "character" | "background" | "furniture" | "avatar" | "growth" | "deco";

/** 상점 구역 순서와 제목 (FR-003). 캐릭터는 상점에 없다 */
// name·icon: 상점 화면의 구역 제목 (그림 글자 대신 도트 아이콘, src/lib/art/icons.ts)
export const SHOP_SECTIONS: { type: Exclude<ItemType, "character">; title: string; name: string; icon: "shirt" | "chair" | "frame" | "sprout" }[] = [
  { type: "avatar", title: "아바타 꾸미기", name: "아바타 꾸미기", icon: "shirt" },
  { type: "furniture", title: "가구", name: "가구", icon: "chair" },
  { type: "background", title: "배경", name: "배경", icon: "frame" },
  { type: "growth", title: "성장 아이템", name: "성장 아이템", icon: "sprout" },
];

/**
 * 상점 탭 (사용자 요청 2026-10-16 "상점이 잡화점마냥 다 몰아져있는 느낌 → 종류별로 나누자"): 종류마다 한 탭. 주소 #key로 바로 연다 (예: /shop#growth).
 * 옷·모자·소품은 옷가게(/clothes)에서만 판다 (사용자 요청 2026-10-16 "옷가게가 있는데 왜 상점에 옷칸이 있는지"). 미용실 부위처럼 상점에는 없다
 */
export const SHOP_TABS = [
  { key: "furniture", type: "furniture", name: "가구", icon: "chair", group: "우리 집" },
  { key: "background", type: "background", name: "배경", icon: "frame", group: "우리 집" },
  { key: "growth", type: "growth", name: "성장 아이템", icon: "sprout", group: "동물 농장" },
] as const satisfies readonly { key: string; type: Exclude<ItemType, "character" | "deco" | "avatar">; name: string; icon: string; group: string }[];

export type ShopTab = (typeof SHOP_TABS)[number]["key"];
export const DEFAULT_TAB: ShopTab = "furniture";

/** 아이템이 놓이는 탭 (아바타 아이템은 옷가게에서 팔아 상점 탭이 없다) */
export function shopTabOf(item: Pick<ShopItem, "type">): ShopTab | null {
  return SHOP_TABS.find((t) => t.type === item.type)?.key ?? null;
}

/** 예전 상점 주소 #avatar·#outfit·#hat·#accessory (옷·모자·소품 탭). 이제는 옷가게로 보낸다 */
const CLOTHES_HASHES = ["avatar", "outfit", "hat", "accessory"];
export const isClothesHash = (hash: string) => CLOTHES_HASHES.includes(decodeURIComponent(hash.replace(/^#/, "")));

/** 주소의 #으로 탭 고르기 */
export function tabFromHash(hash: string): ShopTab | null {
  const key = decodeURIComponent(hash.replace(/^#/, ""));
  return SHOP_TABS.find((t) => t.key === key)?.key ?? null;
}

/** 성장 아이템 한 번에 사는 개수 상한 (사용자 요청 2026-10-16 "성장 아이템 한번에 여러개 사는 기능") */
export const MAX_BULK = 99;

/** 지금 코인으로 한 번에 살 수 있는 개수 (0 ~ MAX_BULK) */
export function maxBuyable(price: number, coins: number): number {
  if (price <= 0) return MAX_BULK;
  return Math.max(0, Math.min(MAX_BULK, Math.floor(coins / price)));
}

/** 서버로 온 개수: 1 ~ MAX_BULK 정수만 (아니면 null) */
export function parseCount(raw: unknown): number | null {
  if (raw === undefined) return 1;
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 1 && raw <= MAX_BULK ? raw : null;
}

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
  /** 아바타 아이템의 부위 (outfit·hat·accessory), 다른 종류는 null */
  avatarSlot?: string | null;
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
export function purchaseMessage(kind: "decor" | "growth", name: string, count = 1): string {
  if (kind === "growth") return `${count > 1 ? `${name} ${count}개를` : withJosa(name, "을/를")} 샀어요! 동물 농장에서 써 보세요.`;
  return `${withJosa(name, "을/를")} 샀어요! 꾸미기에서 장착해 보세요.`;
}

export const SHOP_ERRORS = {
  notForSale: "살 수 없는 아이템이에요",
  owned: "이미 가지고 있는 아이템이에요",
  level: (n: number) => `레벨 ${n}부터 살 수 있어요`,
  coins: (n: number) => `코인이 ${n}개 부족해요`,
  count: `한 번에 1~${MAX_BULK}개까지 살 수 있어요`,
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
