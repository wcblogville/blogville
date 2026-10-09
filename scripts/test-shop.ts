// 상점·꾸미기 규칙 테스트 (SHOP-01~06 / FR-003, FR-006, FR-014~015, FR-019)
// 실행: npm run test:shop
import { AVATAR_PARTS, orderOutfit, outfitLayers } from "../src/lib/art/avatar";
import { characterSvg, lookKey } from "../src/lib/art/characters";
import { growthSvg } from "../src/lib/art/growth";
import { CATCHES, pickCatch } from "../src/lib/fishing";
import { buttonState, purchaseMessage, SHOP_ERRORS, SHOP_SECTIONS, shortage, sortShopItems, type ShopItem } from "../src/lib/shop";

let failed = 0;
function expect(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "✅" : "❌"} ${name}: ${JSON.stringify(got)}${ok ? "" : ` (기대: ${JSON.stringify(want)})`}`);
}

// FR-003 구역 순서, 캐릭터 없음
expect("구역 5개 순서 (광장 장식은 가구 다음)", SHOP_SECTIONS.map((s) => s.type), ["avatar", "furniture", "deco", "background", "growth"]);

// FR-006 버튼 상태: 보유 → 잠금 → 코인 부족 → 사기
const item = (o: Partial<ShopItem>): ShopItem => ({
  id: 1, type: "avatar", name: "x", description: null, price: 100, requiredLevel: 1, assetKey: "hat.straw", quantity: 0, ownerCount: 0, ...o,
});
const me = { level: 3, coins: 150 };
expect("보유 중", buttonState(item({ quantity: 1, requiredLevel: 9 }), me), "owned");
expect("레벨 잠금이 코인 부족보다 먼저", buttonState(item({ requiredLevel: 4, price: 999 }), me), "locked");
expect("코인 부족", buttonState(item({ price: 151 }), me), "short");
expect("딱 맞는 코인은 사기", buttonState(item({ price: 150, requiredLevel: 3 }), me), "buy");
expect("성장 아이템은 가져도 또 살 수 있음", buttonState(item({ type: "growth", quantity: 4 }), me), "buy");

// FR-019 모자란 코인, 안내 문구
expect("모자란 코인", shortage(150, 40), 110);
expect("모자라지 않으면 0", shortage(10, 40), 0);
expect("코인 부족 오류", SHOP_ERRORS.coins(110), "코인이 110개 부족해요");
expect("레벨 오류", SHOP_ERRORS.level(3), "레벨 3부터 살 수 있어요");
expect("성장 아이템 산 안내", purchaseMessage("growth", "먹이").includes("동물 농장"), true);
expect("꾸미기 아이템 산 안내", purchaseMessage("decor", "모자").includes("꾸미기"), true);

// FR-014~015 정렬, 동률은 id 작은 순
const list = [
  item({ id: 1, price: 100, requiredLevel: 2, ownerCount: 1 }),
  item({ id: 2, price: 50, requiredLevel: 1, ownerCount: 5, quantity: 1 }),
  item({ id: 3, price: 100, requiredLevel: 1, ownerCount: 5 }),
  item({ id: 4, price: 100, requiredLevel: 1, ownerCount: 0 }),
];
const ids = (s: Parameters<typeof sortShopItems>[1]) => sortShopItems(list, s).map((i) => i.id);
expect("레벨순", ids("level"), [2, 3, 4, 1]);
expect("인기순 (동률은 싼 순)", ids("popular"), [2, 3, 1, 4]);
expect("비싼 순", ids("priceDesc"), [3, 4, 1, 2]);
expect("싼 순", ids("priceAsc"), [2, 3, 4, 1]);
expect("최신순", ids("newest"), [4, 3, 2, 1]);
expect("보유순", ids("owned"), [2, 1, 3, 4]);
expect("원래 배열은 그대로", list.map((i) => i.id), [1, 2, 3, 4]);

// SHOP-06 아바타 겹치기
expect("부위 순서: 옷 → 소품 → 모자", orderOutfit(["hat.straw", "acc.glasses", "outfit.hoodie"]), ["outfit.hoodie", "acc.glasses", "hat.straw"]);
expect("모르는 키는 빠짐", orderOutfit(["nope", "hat.straw"]), ["hat.straw"]);
expect("옷은 body 층", outfitLayers(["outfit.hoodie"]).body.length > 0 && outfitLayers(["outfit.hoodie"]).top === "", true);
expect("모자는 top 층", outfitLayers(["hat.straw"]).top === AVATAR_PARTS["hat.straw"].svg, true);
expect("lookKey는 순서와 상관없이 같음", lookKey("char.cat", ["hat.straw", "acc.glasses"]) === lookKey("char.cat", ["acc.glasses", "hat.straw"]), true);
expect("옷 없으면 lookKey = 캐릭터", lookKey("char.cat"), "char.cat");
expect("입히면 그림이 달라짐", characterSvg("char.cat", 64, ["hat.straw"]) !== characterSvg("char.cat", 64), true);
expect("아바타 그림 9개", Object.keys(AVATAR_PARTS).length, 9);
expect("성장 아이템 그림", ["growth.feed", "growth.premium", "growth.booster"].every((k) => growthSvg(k).startsWith("<svg")), true);

// 연못 낚시터: 무게 합 100, 경계값
expect("낚시 무게 합 100", CATCHES.reduce((n, c) => n + c.weight, 0), 100);
expect("0 → 송사리", pickCatch(0).key, "minnow");
expect("99 → 마지막(낡은 장화)", pickCatch(99).key, "boot");
expect("먹이 꾸러미는 growth_feed", CATCHES.find((c) => c.key === "feed")?.itemCode, "growth_feed");
expect("0~99 모두 무언가 낚임", Array.from({ length: 100 }, (_, i) => pickCatch(i)).every(Boolean), true);

if (failed) {
  console.log(`\n${failed}개 실패`);
  process.exit(1);
}
console.log("\n상점 규칙 테스트 모두 통과");
