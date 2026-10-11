// 걷기 그림·미용실·옷가게 규칙 테스트 (사용자 요청 2026-10-11, TOWN-17·SHOP-07·SHOP-08)
// 실행: npm run test:style
import { AVATAR_PARTS, AVATAR_SLOTS, orderOutfit, previewLook } from "../src/lib/art/avatar";
import { CHARACTER_KEYS, characterSvg, hasHair, lookGrid } from "../src/lib/art/characters";
import { HAIR_COLORS, HAIR_STYLES } from "../src/lib/art/hair";
import { PALETTE, PIXEL } from "../src/lib/art/pixel";
import { WALK_DIRS, WALK_FRAMES, walkDirOf, walkFrame, walkFrameIndex, walkSheetSvg } from "../src/lib/art/walk";
import { checkout, checkoutState, parseSelection, STYLE_PLACES, styleMessage, type StyleItem } from "../src/lib/style";

let failed = 0;
function expect(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "✅" : "❌"} ${name}: ${JSON.stringify(got)}${ok ? "" : ` (기대: ${JSON.stringify(want)})`}`);
}

const size = (g: (string | null)[][]) => [g[0].length, g.length];
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const SHADOW = PALETTE[":"];

// ===== 걷기 그림 (TOWN-17) =====
{
  const keys = CHARACTER_KEYS();
  const looks: [string, string[]][] = [
    ...keys.map((k): [string, string[]] => [k, []]),
    ["char.girl", ["hair.long", "haircolor.pink", "outfit.hanbok", "hat.crown", "acc.glasses"]],
    ["char.cat", ["outfit.wizard", "hat.wizard", "acc.scarf"]],
  ];
  const bad = looks.flatMap(([k, o]) =>
    WALK_DIRS.flatMap((d) => Array.from({ length: WALK_FRAMES }, (_, f) => (same(size(walkFrame(k, o, d, f)), [16, 24]) ? [] : [`${k}:${d}:${f}`])).flat()),
  );
  expect("모든 캐릭터·모든 방향·모든 칸이 16×24", bad, []);
  expect("방향 4개 × 칸 5개", [WALK_DIRS.length, WALK_FRAMES], [4, 5]);

  const sheet = walkSheetSvg("char.boy", [], PIXEL);
  expect("그림판 크기 = 24칸 틀 × (5 × 4) × PIXEL", /width="(\d+)" height="(\d+)"/.exec(sheet)?.slice(1).map(Number), [24 * 5 * PIXEL, 24 * 4 * PIXEL]);
  expect("프레임 번호: 아래 0~4, 왼쪽 5~9, 오른쪽 10~14, 위 15~19", [walkFrameIndex("down", 0), walkFrameIndex("left", 1), walkFrameIndex("right", 4), walkFrameIndex("up", 2)], [0, 6, 14, 17]);

  // 서 있기(0칸, 앞)는 꾸미기·상점 그림과 같다
  const outfit = ["hair.pony", "outfit.suit", "hat.straw"];
  expect("아래 0칸 = 평소 그림", same(walkFrame("char.boy", outfit, "down", 0), lookGrid("char.boy", outfit)), true);
  // 걷는 칸은 서 있는 칸과 다르고, 2·4칸(제자리)은 서 있기와 같다
  expect("1·3칸은 움직인 그림", [1, 3].map((f) => same(walkFrame("char.boy", [], "down", f), walkFrame("char.boy", [], "down", 0))), [false, false]);
  expect("2·4칸은 제자리", [2, 4].map((f) => same(walkFrame("char.boy", [], "down", f), walkFrame("char.boy", [], "down", 0))), [true, true]);
  expect("1칸과 3칸은 서로 다른 발", same(walkFrame("char.boy", [], "down", 1), walkFrame("char.boy", [], "down", 3)), false);
  // 그림자는 움직이지 않는다 (맨 아래 줄)
  const shadowRow = (f: number) => walkFrame("char.boy", [], "down", f)[23];
  expect("맨 아래 그림자 줄은 걸어도 그대로", same(shadowRow(1), shadowRow(0)) && shadowRow(0).some((c) => c === SHADOW), true);
  // 몸이 1칸 뜬다: 1칸의 머리 맨 윗줄 = 0칸의 1줄
  expect("걷는 칸은 몸이 1칸 뜬다", same(walkFrame("char.boy", [], "down", 1)[0], walkFrame("char.boy", [], "down", 0)[1]), true);
  // 오른쪽은 왼쪽을 뒤집은 그림
  const flipped = walkFrame("char.cat", [], "left", 1).map((r) => [...r].reverse());
  expect("오른쪽 = 왼쪽 좌우 뒤집기", same(walkFrame("char.cat", [], "right", 1), flipped), true);
  // 뒷모습: 눈(흰자)이 없고, 안경은 안 보인다
  const white = PALETTE.w;
  const eyeRow = (g: (string | null)[][]) => g[7].slice(3, 13);
  expect("앞모습에는 눈 흰자", eyeRow(walkFrame("char.boy", [], "down", 0)).includes(white), true);
  expect("뒷모습에는 눈이 없다", eyeRow(walkFrame("char.boy", [], "up", 0)).includes(white), false);
  expect("뒷모습에는 안경이 없다", same(walkFrame("char.boy", ["acc.glasses"], "up", 0), walkFrame("char.boy", [], "up", 0)), true);
  // 부품이 따로 놀지 않는다: 모자를 쓴 걷는 칸 = 모자 안 쓴 걷는 칸 + 모자를 1칸 위에
  const hatPixels = (f: number) => {
    const a = walkFrame("char.boy", ["hat.beanie"], "down", f);
    const b = walkFrame("char.boy", [], "down", f);
    return a.flatMap((r, y) => r.flatMap((c, x) => (c !== b[y][x] ? [`${x},${y}`] : [])));
  };
  const lifted = hatPixels(0).map((p) => p.split(",").map(Number)).map(([x, y]) => `${x},${y - 1}`);
  expect("걷는 칸에서도 모자가 머리와 함께 1칸 뜬다", same(hatPixels(1).filter((p) => !p.endsWith(",-1")), lifted.filter((p) => !p.endsWith(",-1"))), true);

  expect("움직임 → 방향", [walkDirOf(0, 0), walkDirOf(-200, 30), walkDirOf(200, -30), walkDirOf(20, -200), walkDirOf(-10, 230)], [null, "left", "right", "up", "down"]);
}

// ===== 미용실 머리 (SHOP-07) =====
{
  expect("머리 모양 7개, 머리 색 8개", [Object.keys(HAIR_STYLES).length, Object.keys(HAIR_COLORS).length], [7, 8]);
  expect("머리 모양은 16칸 폭, 18줄 이하", Object.entries(HAIR_STYLES).filter(([, r]) => r.length > 18 || r.some((x) => x.length !== 16)).map(([k]) => k), []);
  expect("부위 5개", [...AVATAR_SLOTS].sort(), ["accessory", "hair", "hair_color", "hat", "outfit"]);
  expect("겹치는 순서: 머리 색 → 머리 → 옷 → 소품 → 모자", orderOutfit(["hat.straw", "acc.glasses", "outfit.suit", "hair.bob", "haircolor.mint"]), ["haircolor.mint", "hair.bob", "outfit.suit", "acc.glasses", "hat.straw"]);
  expect("사람 주민만 머리가 바뀐다", ["char.boy", "char.girl", "char.human", "char.cat", "char.robot"].map(hasHair), [true, true, true, false, false]);
  expect("머리 모양을 입으면 그림이 달라짐", characterSvg("char.boy", 72, ["hair.curly"]) !== characterSvg("char.boy", 72), true);
  expect("머리 색만 바꿔도 그림이 달라짐 (원래 머리)", characterSvg("char.girl", 72, ["haircolor.mint"]) !== characterSvg("char.girl", 72), true);
  expect("동물은 머리를 입어도 그대로", characterSvg("char.cat", 72, ["hair.curly", "haircolor.pink"]) === characterSvg("char.cat", 72), true);
  // 머리를 바꿔도 몸(13줄 아래)은 그대로 (긴 머리는 어깨까지 덮으니 짧은 머리로)
  expect("짧은 머리로 바꿔도 몸 줄은 그대로", same(lookGrid("char.girl", ["hair.short"]).slice(18), lookGrid("char.girl").slice(18)), true);
  expect("머리 카드 미리보기는 사람 주민", [previewLook("hair.bob").asset, previewLook("haircolor.red").asset, previewLook("hat.crown").asset], ["char.boy", "char.girl", "char.mannequin"]);
  expect("새 옷·모자 9개 + 원래 9개 + 머리 15개", Object.keys(AVATAR_PARTS).length, 33);
}

// ===== 가게 계산 (SHOP-07·08) =====
{
  const item = (o: Partial<StyleItem>): StyleItem => ({ id: 1, slot: "hair", name: "x", description: null, price: 0, requiredLevel: 1, assetKey: "hair.bob", owned: false, ...o });
  const items = [
    item({ id: 1, name: "단발", price: 0 }),
    item({ id: 2, name: "포니테일", price: 60 }),
    item({ id: 3, name: "뽀글 파마", price: 120, requiredLevel: 3 }),
    item({ id: 4, slot: "hair_color", name: "분홍 머리", price: 60, assetKey: "haircolor.pink" }),
    item({ id: 5, slot: "hair_color", name: "흑발", price: 0, owned: true, assetKey: "haircolor.black" }),
  ];
  const me = { level: 2, coins: 100 };
  const c1 = checkout(items, { hair: 2, hair_color: 4 }, {}, me);
  expect("안 가진 두 개 = 60 + 60", [c1.cost, c1.toBuy.map((i) => i.id), c1.short], [120, [2, 4], 20]);
  expect("코인 부족", checkoutState(c1), "short");
  const c2 = checkout(items, { hair: 2, hair_color: 5 }, {}, me);
  expect("가진 색은 공짜, 포니테일만 60", [c2.cost, checkoutState(c2)], [60, "buy"]);
  const c3 = checkout(items, { hair: 1, hair_color: 5 }, {}, me);
  expect("0코인 머리는 받기만 (그냥 적용)", [c3.cost, c3.toBuy.length, checkoutState(c3)], [0, 1, "apply"]);
  expect("레벨이 모자라면 잠금이 먼저", checkoutState(checkout(items, { hair: 3, hair_color: 4 }, {}, { level: 2, coins: 0 })), "locked");
  expect("지금 모습 그대로면 같음", checkoutState(checkout(items, { hair: null, hair_color: 5 }, { hair_color: 5 }, me)), "same");
  expect("벗기(원래 머리)도 바뀐 것", checkout(items, { hair: null }, { hair: 1 }, me).changes, 1);
  expect("딱 맞는 코인은 살 수 있음", checkoutState(checkout(items, { hair: 2 }, {}, { level: 1, coins: 60 })), "buy");

  expect("미용실 부위", STYLE_PLACES.salon.slots, ["hair", "hair_color"]);
  expect("옷가게 부위", STYLE_PLACES.clothes.slots, ["outfit", "hat", "accessory"]);
  expect("고른 값 검사: 맞는 부위", parseSelection("salon", { hair: 3, hair_color: null }), { hair: 3, hair_color: null });
  expect("고른 값 검사: 다른 가게 부위는 거절", parseSelection("salon", { outfit: 3 }), null);
  expect("고른 값 검사: 이상한 id는 거절", [parseSelection("clothes", { hat: -1 }), parseSelection("clothes", { hat: 1.5 }), parseSelection("clothes", { hat: "x" }), parseSelection("clothes", [])], [null, null, null, null]);
  expect("고른 값 검사: 빈 값은 거절", parseSelection("clothes", {}), null);
  expect("산 뒤 안내", styleMessage("salon", ["포니테일"], 60), "🎉 포니테일을 🪙 60에 샀어요. 새 머리가 잘 어울려요!");
  expect("가진 것만 입은 안내", styleMessage("clothes", [], 0), "✨ 새 옷이 잘 어울려요!");
}

if (failed) {
  console.log(`\n${failed}개 실패`);
  process.exit(1);
}
console.log("\n걷기 그림·미용실·옷가게 테스트 모두 통과");
