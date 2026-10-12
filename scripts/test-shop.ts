// 상점·꾸미기 규칙 테스트 (SHOP-01~06 / FR-003, FR-006, FR-014~015, FR-019)
// 실행: npm run test:shop
import { AVATAR_PARTS, orderOutfit, outfitLayers } from "../src/lib/art/avatar";
import { characterSvg, lookKey } from "../src/lib/art/characters";
import { readFileSync } from "node:fs";
import { backgroundSvg } from "../src/lib/art/backgrounds";
import { CHARACTER_KEYS } from "../src/lib/art/characters";
import { hasDecoArt } from "../src/lib/art/deco";
import { FURNITURE_KEYS, furnitureRows, hasFurnitureArt } from "../src/lib/art/furniture";
import { growthSvg, hasGrowthArt } from "../src/lib/art/growth";
import { availabilityText, catchByKey, catchCoins, catchPool, CATCHES, expectedCoinsPerCast, formatSize, isAvailable, judgeTiming, pickCatch, poolTotal, rollSize } from "../src/lib/fishing";
import { FISHING_RULES, kstClock, weekStart } from "../src/lib/game";
import { buttonState, purchaseMessage, SHOP_ERRORS, SHOP_SECTIONS, shortage, sortShopItems, type ShopItem } from "../src/lib/shop";

let failed = 0;
function expect(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "✅" : "❌"} ${name}: ${JSON.stringify(got)}${ok ? "" : ` (기대: ${JSON.stringify(want)})`}`);
}

// FR-003 구역 순서, 캐릭터 없음
expect("구역 4개 순서 (광장 장식은 광장 꾸미기를 쉬면서 뺐다, TOWN-16)", SHOP_SECTIONS.map((s) => s.type), ["avatar", "furniture", "background", "growth"]);

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
expect("아바타 그림 77개 (모자·옷·소품 45 + 머리 모양 16 + 머리 색 16)", Object.keys(AVATAR_PARTS).length, 77);
expect("성장 아이템 그림", ["growth.feed", "growth.premium", "growth.booster", "growth.elixir"].every((k) => growthSvg(k).startsWith("<svg") && hasGrowthArt(k)), true);

// 아이템 카탈로그(scripts/seed.ts)의 모든 asset_key에 코드로 그린 그림이 있다 (그림이 없으면 회색 상자로 보인다)
{
  const seed = readFileSync(new URL("./seed.ts", import.meta.url), "utf8");
  const rows = [...seed.matchAll(/type: "(\w+)".*?price: (\d+).*?assetKey: "([\w.]+)"/g)].map(([, type, price, key]) => ({ type, price: Number(price), key }));
  const hasArt: Record<string, (k: string) => boolean> = {
    character: (k) => CHARACTER_KEYS().includes(k),
    // 모르는 배경은 초원으로 그린다
    background: (k) => k === "bg.meadow" || backgroundSvg(k) !== backgroundSvg("bg.meadow"),
    furniture: hasFurnitureArt,
    avatar: (k) => k in AVATAR_PARTS,
    growth: hasGrowthArt,
    deco: hasDecoArt,
  };
  expect("카탈로그 아이템을 읽음", rows.length > 100, true);
  expect("그림 없는 아이템 없음", rows.filter((r) => !hasArt[r.type]?.(r.key)).map((r) => r.key), []);
  expect("asset_key가 겹치지 않음", rows.length, new Set(rows.map((r) => r.key)).size);
  const count = (type: string) => rows.filter((r) => r.type === type).length;
  expect("가구 그림은 모두 32 × 32칸", FURNITURE_KEYS().filter((k) => { const r = furnitureRows(k)!; return r.length !== 32 || r.some((x) => x.length !== 32); }), []);
  expect("가구 38개 (기본 2 + 원래 6 + 2026-10-11 30)", count("furniture"), 38);
  const furniture = rows.filter((r) => r.type === "furniture" && r.price > 0).map((r) => r.price);
  expect("가구 값: 30부터 3,000까지 (싼 소품부터 오래 모으는 목표까지)", [Math.min(...furniture), Math.max(...furniture)], [30, 3000]);
}

// 연못 낚시터 (TOWN-14, 2026-10-12 "낚시 컨텐츠 더 풍성하게"): 등급·시간·계절, 타이밍, 길이, 평균 코인
{
  const day = { hour: 12, month: 10 };
  const night = { hour: 23, month: 10 };
  const keys = (at: { hour: number; month: number }) => catchPool(at, false).map((p) => p.c.key);
  expect("key가 겹치지 않음", new Set(CATCHES.map((c) => c.key)).size, CATCHES.length);
  expect("등급 4가지가 다 있다", [...new Set(CATCHES.map((c) => c.tier))].sort(), ["common", "junk", "legendary", "rare"]);
  expect("먹이 꾸러미는 growth_feed", catchByKey("feed")?.itemCode, "growth_feed");
  const pool = catchPool(day, false);
  expect("0 → 송사리, 합-1 → 마지막(낡은 장화)", [pickCatch(0, pool).key, pickCatch(poolTotal(pool) - 1, pool).key], ["minnow", "boot"]);
  expect("0~합-1 모두 무언가 낚임", Array.from({ length: poolTotal(pool) }, (_, i) => pickCatch(i, pool)).every(Boolean), true);
  expect("메기·달빛 잉어는 밤에만 (낮 12시 없음, 밤 11시 있음)", [keys(day).includes("catfish"), keys(day).includes("moon"), keys(night).includes("catfish"), keys(night).includes("moon")], [false, false, true, true]);
  expect("자정을 넘는 밤: 새벽 3시 메기 있음, 새벽 5시 없음", [isAvailable(catchByKey("catfish")!, { hour: 3, month: 1 }), isAvailable(catchByKey("catfish")!, { hour: 5, month: 1 })], [true, false]);
  expect("계절 물고기: 10월은 꺽지만", ["smelt", "cherry", "sweetfish", "perch"].filter((k) => keys(day).includes(k)), ["perch"]);
  expect("계절마다 계절 물고기 하나씩", [1, 4, 7, 10].map((month) => ["smelt", "cherry", "sweetfish", "perch"].filter((k) => keys({ hour: 12, month }).includes(k)).length), [1, 1, 1, 1]);
  expect("언제 나오는지 안내", [availabilityText(catchByKey("catfish")!), availabilityText(catchByKey("smelt")!), availabilityText(catchByKey("carp")!)], ["밤 19시~5시에만", "겨울(12·1·2월)에만", null]);
  // 타이밍을 맞추면 희귀·전설 몫이 늘고 잡동사니 몫이 준다
  const share = (good: boolean, tier: string) => {
    const p = catchPool(day, good);
    return p.filter((x) => x.c.tier === tier).reduce((n, x) => n + x.w, 0) / poolTotal(p);
  };
  expect("타이밍 성공: 희귀·전설↑ 잡동사니↓", [share(true, "rare") > share(false, "rare"), share(true, "legendary") > share(false, "legendary"), share(true, "junk") < share(false, "junk")], [true, true, true]);
  // 길이·코인
  const carp = catchByKey("carp")!;
  expect("길이: 범위 양 끝", [rollSize(carp, 0), rollSize(carp, 0.999999)], [300, 700]);
  expect("길이: 타이밍 성공이면 둘 중 큰 쪽", rollSize(carp, 0.1, 0.9), rollSize(carp, 0.9));
  expect("물고기가 아니면 길이 없음", [rollSize(catchByKey("boot")!, 0.5), rollSize(catchByKey("chest")!, 0.5)], [null, null]);
  expect("코인: 가장 작으면 기본, 가장 크면 × 1.5", [catchCoins(carp, 300), catchCoins(carp, 700), catchCoins(catchByKey("boot")!, null)], [20, 30, 1]);
  expect("길이 표시", [formatSize(45), formatSize(1000)], ["4.5cm", "100.0cm"]);
  expect("타이밍 판정", [judgeTiming(-1000), judgeTiming(-100), judgeTiming(800), judgeTiming(FISHING_RULES.hitWindowMs + 1)], ["early", "good", "good", "late"]);
  // 균형: 모든 시각·달에서 한 번 평균 8~20코인, 타이밍을 맞추면 더 받지만 1.6배를 넘지 않고, 하루(3번, 모두 성공) 66을 넘지 않는다 (글 보상 하루 최대 90보다 작게)
  const evs: [number, number][] = [];
  for (let month = 1; month <= 12; month++) for (let hour = 0; hour < 24; hour++) evs.push([expectedCoinsPerCast({ hour, month }, false), expectedCoinsPerCast({ hour, month }, true)]);
  const normal = evs.map((e) => e[0]);
  const good = evs.map((e) => e[1]);
  console.log(`  (낚시 한 번 평균 코인: 평소 ${Math.min(...normal).toFixed(1)}~${Math.max(...normal).toFixed(1)}, 타이밍 성공 ${Math.min(...good).toFixed(1)}~${Math.max(...good).toFixed(1)})`);
  expect("한 번 평균 코인 8~20", normal.every((v) => v >= 8 && v <= 20), true);
  expect("타이밍 성공이 더 많지만 1.6배 이하", evs.every(([n, g]) => g > n && g <= n * 1.6), true);
  expect("하루 최대 평균(3번 모두 성공) 66 이하", Math.max(...good) * FISHING_RULES.castsPerDay <= 66, true);
  expect("하루 횟수 3 (DB CHECK cast_no 1~3과 같다)", FISHING_RULES.castsPerDay, 3);
  // 실제 뽑기로도 확인 (무게대로 나오는지): 정해진 r을 고르게 돌리면 무게 비율과 같다
  const counts = new Map<string, number>();
  for (let r = 0; r < poolTotal(pool); r++) counts.set(pickCatch(r, pool).key, (counts.get(pickCatch(r, pool).key) ?? 0) + 1);
  expect("뽑기 결과 비율 = 무게", pool.every((p) => counts.get(p.c.key) === p.w), true);
  expect("이번 주 월요일", [weekStart("2026-10-12"), weekStart("2026-10-18"), weekStart("2026-10-11")], ["2026-10-12", "2026-10-12", "2026-10-05"]);
  expect("한국 시각: 2026-10-12T15:30Z → 13일 0시, 10월", kstClock(new Date("2026-10-12T15:30:00Z")), { hour: 0, month: 10 });
}

if (failed) {
  console.log(`\n${failed}개 실패`);
  process.exit(1);
}
console.log("\n상점 규칙 테스트 모두 통과");
