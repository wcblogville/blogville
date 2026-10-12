// 걷기 그림·미용실·옷가게 규칙 테스트 (사용자 요청 2026-10-11, TOWN-17·SHOP-07·SHOP-08)
// 실행: npm run test:style
import { AVATAR_PARTS, AVATAR_SLOTS, orderOutfit, previewLook } from "../src/lib/art/avatar";
import { CHARACTER_KEYS, characterRows, characterSvg, hasHair, lookGrid } from "../src/lib/art/characters";
import { FACE_SHAPES, nativeHair } from "../src/lib/art/faces";
import { BALD_HEAD, HAIR_COLORS, HAIR_STYLES } from "../src/lib/art/hair";
import { IDLE_FRAME, IDLE_MOTIONS, idleFrameIndex, idleSheetSvg } from "../src/lib/art/idle";
import { PALETTE, PIXEL } from "../src/lib/art/pixel";
import { POSES, poseFrame, poseSheetSvg } from "../src/lib/art/poses";
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
  expect("머리 모양 23개, 머리 색 16개 (2026-10-11 9·8개, 2026-10-12 머리 7개 더함)", [Object.keys(HAIR_STYLES).length, Object.keys(HAIR_COLORS).length], [23, 16]);
  expect(
    "머리 모양은 눈(7~9줄의 4·5·10·11칸)을 가리지 않는다 (포니테일은 앞머리가 왼눈 위를 살짝 덮는 그림)",
    Object.entries(HAIR_STYLES).filter(([k]) => k !== "hair.pony").filter(([, r]) => [7, 8, 9].some((y) => [4, 5, 10, 11].some((x) => (r[y]?.[x] ?? ".") !== "."))).map(([k]) => k),
    [],
  );
  expect("머리 모양은 16칸 폭, 18줄 이하", Object.entries(HAIR_STYLES).filter(([, r]) => r.length > 18 || r.some((x) => x.length !== 16)).map(([k]) => k), []);
  expect("부위 6개 (얼굴형 더함)", [...AVATAR_SLOTS].sort(), ["accessory", "face_shape", "hair", "hair_color", "hat", "outfit"]);
  expect(
    "겹치는 순서: 얼굴형 → 머리 색 → 머리 → 옷 → 소품 → 모자",
    orderOutfit(["hat.straw", "acc.glasses", "outfit.suit", "hair.bob", "haircolor.mint", "face.round"]),
    ["face.round", "haircolor.mint", "hair.bob", "outfit.suit", "acc.glasses", "hat.straw"],
  );
  expect("사람 주민만 머리가 바뀐다", ["char.boy", "char.girl", "char.human", "char.cat", "char.robot"].map(hasHair), [true, true, true, false, false]);
  expect("머리 모양을 입으면 그림이 달라짐", characterSvg("char.boy", 72, ["hair.curly"]) !== characterSvg("char.boy", 72), true);
  expect("머리 색만 바꿔도 그림이 달라짐 (원래 머리)", characterSvg("char.girl", 72, ["haircolor.mint"]) !== characterSvg("char.girl", 72), true);
  expect("동물은 머리를 입어도 그대로", characterSvg("char.cat", 72, ["hair.curly", "haircolor.pink"]) === characterSvg("char.cat", 72), true);
  // 머리를 바꿔도 몸(13줄 아래)은 그대로 (긴 머리는 어깨까지 덮으니 짧은 머리로)
  expect("짧은 머리로 바꿔도 몸 줄은 그대로", same(lookGrid("char.girl", ["hair.short"]).slice(18), lookGrid("char.girl").slice(18)), true);
  expect(
    "머리·얼굴형 카드 미리보기는 사람 주민",
    [previewLook("hair.bob").asset, previewLook("haircolor.red").asset, previewLook("face.round").asset, previewLook("hat.crown").asset],
    ["char.boy", "char.girl", "char.boy", "char.mannequin"],
  );
  expect("모자·옷·소품 55개 (원래 18 + 2026-10-11 27 + 2026-10-12 옷 10) + 머리 39개 + 얼굴형 5개", Object.keys(AVATAR_PARTS).length, 99);
  expect(
    "모자·옷·소품은 16칸 폭, 24줄 이하",
    Object.entries(AVATAR_PARTS).filter(([, p]) => p.rows.length > 24 || p.rows.some((x) => x.length !== 16)).map(([k]) => k),
    [],
  );
  expect(
    "얼굴 위 소품(face)이 아닌 모자·옷은 눈을 가리지 않는다",
    Object.entries(AVATAR_PARTS)
      .filter(([, p]) => !p.face && p.slot !== "hair" && p.slot !== "hair_color" && p.slot !== "face_shape")
      .filter(([, p]) => [7, 8, 9].some((y) => [4, 5, 10, 11].some((x) => (p.rows[y]?.[x] ?? ".") !== ".")))
      .map(([k]) => k),
    [],
  );
}

// ===== 얼굴형 (사용자 요청 2026-10-12 "얼굴형도 추가 해줘 동그란 얼굴 그런거") =====
{
  const shapes = Object.keys(FACE_SHAPES);
  expect("얼굴형 5가지", shapes, ["face.round", "face.slim", "face.square", "face.heart", "face.chubby"]);
  expect("얼굴형은 머리 틀과 같은 16칸 × 13줄", shapes.filter((k) => FACE_SHAPES[k].length !== 13 || FACE_SHAPES[k].some((r) => r.length !== 16)), []);
  // 모자·머리 모양·안경이 그대로 맞도록: 0~6줄과 눈 칸(7~9줄의 4·5·10·11칸)은 기본 머리와 같다
  expect("이마 위(0~6줄)는 기본 머리와 같다", shapes.filter((k) => !same(FACE_SHAPES[k].slice(0, 7), BALD_HEAD.slice(0, 7))), []);
  expect(
    "눈 자리는 그대로",
    shapes.filter((k) => [7, 8, 9].some((y) => [4, 5, 10, 11].some((x) => FACE_SHAPES[k][y][x] !== BALD_HEAD[y][x]))),
    [],
  );
  expect("얼굴형마다 모양이 다르다", new Set([...shapes.map((k) => FACE_SHAPES[k].join()), BALD_HEAD.join()]).size, shapes.length + 1);
  expect("얼굴형은 미용실 부위, 그림 조각(SVG) 없이 캐릭터 그림을 바꾼다", shapes.map((k) => [AVATAR_PARTS[k].slot, AVATAR_PARTS[k].svg]), shapes.map(() => ["face_shape", ""]));

  // 사람 주민 셋 × 얼굴형 다섯: 그림이 달라지고, 몸(13줄 아래)은 그대로
  const humans = ["char.boy", "char.girl", "char.human"];
  expect(
    "사람 주민은 얼굴형마다 앞모습이 달라진다",
    humans.flatMap((h) => shapes.filter((k) => same(lookGrid(h, [k]), lookGrid(h))).map((k) => `${h}:${k}`)),
    [],
  );
  expect("얼굴형을 바꿔도 몸 줄(13줄~)은 그대로", humans.flatMap((h) => shapes.filter((k) => !same(lookGrid(h, [k]).slice(13), lookGrid(h).slice(13))).map((k) => `${h}:${k}`)), []);
  expect("동물·로봇은 얼굴형을 입어도 그대로", ["char.cat", "char.robot", "char.dragon"].filter((c) => shapes.some((k) => characterSvg(c, 72, [k]) !== characterSvg(c, 72))), []);
  // 원래 머리는 남는다: 여자 주민의 분홍 머리띠, 모험가의 빨간 두건
  const hasColor = (g: (string | null)[][], hex: string) => g.slice(0, 7).flat().includes(hex);
  expect("얼굴형만 바꿔도 원래 머리(머리띠·두건)가 남는다", [hasColor(lookGrid("char.girl", ["face.round"]), PALETTE.V), hasColor(lookGrid("char.human", ["face.round"]), PALETTE.K)], [true, true]);
  expect("원래 머리 층: 머리띠 줄은 남고 얼굴 칸(7줄 가운데)은 비운다", [nativeHair(characterRows("char.girl")!)[3].includes("V"), nativeHair(characterRows("char.girl")!)[8].slice(2, 14)], [true, "............"]);
  // 머리 모양과 같이 입으면 머리 모양이 위, 얼굴형은 아래
  expect("머리 모양 + 얼굴형 = 머리 모양 + 다른 턱", same(lookGrid("char.boy", ["hair.slick", "face.slim"]).slice(0, 7), lookGrid("char.boy", ["hair.slick"]).slice(0, 7)), true);

  // 모든 방향·걷기 칸·가만히 동작 칸에서 틀 크기 그대로 (그림은 lookGrid 하나에서 나온다)
  const looks = humans.flatMap((h) => shapes.map((k): [string, string[]] => [h, [k, "hair.wolf", "outfit.dino", "hat.cap", "acc.glasses"]]));
  const badWalk = looks.flatMap(([h, o]) => WALK_DIRS.flatMap((d) => Array.from({ length: WALK_FRAMES }, (_, f) => (same(size(walkFrame(h, o, d, f)), [16, 24]) ? [] : [`${h}:${o[0]}:${d}:${f}`])).flat()));
  expect("얼굴형: 모든 방향·걷기 칸이 16×24", badWalk, []);
  expect("얼굴형: 뒷모습에는 눈이 없다", shapes.filter((k) => walkFrame("char.boy", [k], "up", 0)[7].slice(3, 13).includes(PALETTE.w)), []);
  expect("얼굴형: 옆모습도 앞모습과 다르다", shapes.filter((k) => same(walkFrame("char.boy", [k], "left", 0), walkFrame("char.boy", [k], "down", 0))), []);
  const idle = idleSheetSvg("char.girl", ["face.round"], 1);
  expect(
    "얼굴형: 가만히 동작 그림판 크기 그대로",
    /width="(\d+)" height="(\d+)"/.exec(idle)?.slice(1).map(Number),
    /width="(\d+)" height="(\d+)"/.exec(idleSheetSvg("char.girl", [], 1))?.slice(1).map(Number),
  );
  expect("얼굴형: 가만히 동작 그림판도 얼굴형마다 다르다", idleSheetSvg("char.boy", ["face.round"], 1) !== idleSheetSvg("char.boy", [], 1), true);
  // 우리 집 가구와 놀기 몸짓(poses.ts)도 같은 lookGrid라 얼굴형이 보인다 (room-interact와 합칠 때 확인, 2026-10-12)
  expect("얼굴형: 가구 몸짓 그림판도 얼굴형마다 다르다", shapes.filter((k) => poseSheetSvg("char.boy", [k], 1) === poseSheetSvg("char.boy", [], 1)), []);
  expect(
    "얼굴형: 가구 몸짓 칸이 24×24, 피부색·눈 감기 그대로",
    looks.flatMap(([h, o]) => POSES.flatMap((p) => [0, 1].flatMap((f) => {
      const g = poseFrame(h, o, p, f);
      return same(size(g), [24, 24]) ? [] : [`${h}:${o[0]}:${p}:${f}`];
    }))),
    [],
  );
  expect("얼굴형: 자는 몸짓은 눈을 감는다 (흰 눈 칸 없음)", shapes.filter((k) => poseFrame("char.boy", [k], "sleep", 0).some((r) => r.includes(PALETTE.w))), []);
  expect("가만히 동작 칸 틀", [IDLE_FRAME.w, IDLE_FRAME.h, IDLE_MOTIONS.length > 0, idleFrameIndex("wave", 1)], [24, 32, true, 1]);
}

// ===== 옷·머리 더하기 (사용자 요청 2026-10-12 "옷이랑 머리 더 만들어줘") =====
{
  const NEW_OUTFITS = ["cardigan", "denim", "school", "hawaiian", "apron", "dopo", "bee", "dino", "firefighter", "vampire"].map((k) => `outfit.${k}`);
  const NEW_HAIR = ["pixie", "undercut", "slick", "middle", "sidepony", "wolf", "buzz"].map((k) => `hair.${k}`);
  expect("새 옷 10벌·머리 7가지가 그림 목록에 있다", [...NEW_OUTFITS, ...NEW_HAIR].filter((k) => !AVATAR_PARTS[k]), []);
  expect("새 옷은 몸 자리(13줄~21줄)에만 그린다", NEW_OUTFITS.filter((k) => AVATAR_PARTS[k].rows.slice(0, 13).some((r) => r !== "................") || AVATAR_PARTS[k].rows.length > 22), []);
  const chars = ["char.boy", "char.girl", "char.cat", "char.mannequin"];
  expect(
    "새 옷·머리: 모든 캐릭터·4방향·5칸이 16×24",
    [...NEW_OUTFITS, ...NEW_HAIR].flatMap((k) => chars.flatMap((c) => WALK_DIRS.flatMap((d) => Array.from({ length: WALK_FRAMES }, (_, f) => (same(size(walkFrame(c, [k], d, f)), [16, 24]) ? [] : [`${c}:${k}:${d}:${f}`])).flat()))),
    [],
  );
  expect("새 옷은 뒷모습이 앞모습과 다르다 (단추·넥타이·날개·가시)", NEW_OUTFITS.filter((k) => same(walkFrame("char.boy", [k], "up", 0).slice(13, 22), walkFrame("char.boy", [k], "down", 0).slice(13, 22))), []);
  const wing = PALETTE.I;
  expect("꿀벌 옷: 날개는 등(뒷모습)에만", [walkFrame("char.boy", ["outfit.bee"], "down", 0).flat().includes(wing), walkFrame("char.boy", ["outfit.bee"], "up", 0).flat().includes(wing)], [false, true]);
  const spike = PALETTE.z;
  expect("공룡 옷: 노란 가시는 등에만", [walkFrame("char.boy", ["outfit.dino"], "down", 0).slice(13).flat().includes(spike), walkFrame("char.boy", ["outfit.dino"], "up", 0).slice(13).flat().includes(spike)], [false, true]);
  expect("새 머리 모양은 서로 다르고, 사람 주민 그림을 바꾼다", NEW_HAIR.filter((k) => characterSvg("char.boy", 72, [k]) === characterSvg("char.boy", 72)), []);
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

  expect("미용실 부위 (얼굴형 더함)", STYLE_PLACES.salon.slots, ["hair", "hair_color", "face_shape"]);
  expect("옷가게 부위", STYLE_PLACES.clothes.slots, ["outfit", "hat", "accessory"]);
  expect("고른 값 검사: 맞는 부위", parseSelection("salon", { hair: 3, hair_color: null }), { hair: 3, hair_color: null });
  expect("고른 값 검사: 다른 가게 부위는 거절", parseSelection("salon", { outfit: 3 }), null);
  expect("고른 값 검사: 미용실 얼굴형", parseSelection("salon", { face_shape: 7 }), { face_shape: 7 });
  expect("고른 값 검사: 옷가게에서 얼굴형은 거절", parseSelection("clothes", { face_shape: 7 }), null);
  expect("고른 값 검사: 이상한 id는 거절", [parseSelection("clothes", { hat: -1 }), parseSelection("clothes", { hat: 1.5 }), parseSelection("clothes", { hat: "x" }), parseSelection("clothes", [])], [null, null, null, null]);
  expect("고른 값 검사: 빈 값은 거절", parseSelection("clothes", {}), null);
  expect("산 뒤 안내", styleMessage("salon", ["포니테일"], 60), "🎉 포니테일을 🪙 60에 샀어요. 새 머리가 잘 어울려요!");
  expect("가진 것만 입은 안내", styleMessage("clothes", [], 0), "✨ 새 옷이 잘 어울려요!");
  expect("얼굴형을 산 뒤 안내", styleMessage("salon", ["동그란 얼굴"], 60, ["face_shape"]), "🎉 동그란 얼굴을 🪙 60에 샀어요. 새 얼굴형이 잘 어울려요!");
  expect("가진 얼굴형으로 바꾼 안내", styleMessage("salon", [], 0, ["face_shape"]), "✨ 새 얼굴형이 잘 어울려요!");
  expect("얼굴형과 머리를 같이 바꾸면 머리 안내", styleMessage("salon", [], 0, ["hair", "face_shape"]), "✨ 새 머리가 잘 어울려요!");
}

if (failed) {
  console.log(`\n${failed}개 실패`);
  process.exit(1);
}
console.log("\n걷기 그림·미용실·옷가게 테스트 모두 통과");
