// 게임 규칙 계산 테스트: 레벨(GAME-02), 출석 일차(GAME-04), 레벨업(GAME-06), 동물 농장(TOWN-09), 집 단계·지붕 색(TOWN-07·11), 광장 꾸미기 자리,
// 2.5D 마을 배치(겹침·절벽·걸어서 갈 수 있는지·이웃이 걷는 길), 이웃 집 자리(TOWN-18)
// 실행: npm run test:game
import { DECO_SLOTS, FARM_POS, HOUSE_SLOTS, houseSlot, inHome, LAMPS, LOT_AREAS, PATHS, POND_POS, smoothPath, START_POS, townSpots } from "../src/components/town/layout";
import { npcGraph, segmentClear, solidBox, townLayout, townProps } from "../src/components/town/structures";
import { boxWalkable, reachable, stairCrossings, terrain, TERRAIN_FEET, walkableAt } from "../src/components/town/terrain";
import type { TownData, TownNeighbor } from "../src/components/town/types";
import { assignLots, isNeighborLot, NEIGHBOR_LOTS } from "../src/lib/town-lots";
import { BOARD_SIZE, CLOTHES_SIZE, FARM_SIZE, FISHING_SIZE, FOUNTAIN_FRAMES, FOUNTAIN_SIZE, fountainSheetSvg, HOUSE_STAGES, houseStage, LAMP_SIZE, SALON_SIZE, SHOP_SIZE, TOWN_ROWS } from "../src/lib/art/town";
import { DECO_ASSETS, decoSize } from "../src/lib/art/deco";
import { CHARACTER_KEYS, characterRows } from "../src/lib/art/characters";
import { AVATAR_PARTS } from "../src/lib/art/avatar";
import { fitSvg, PIXEL } from "../src/lib/art/pixel";
import { FURNITURE_KEYS, furnitureRows } from "../src/lib/art/furniture";
import { artHit, ISO_FURNITURE_KEYS, roomFurnitureArt } from "../src/lib/art/room-furniture";
import { POSES, poseFrame } from "../src/lib/art/poses";
import { actionOf, blockedTiles, depthRanks, findPath, layoutDepth, planUse, seatTile } from "../src/lib/room-walk";
import { ANIMAL_SIZE, ANIMAL_SKINS, ANIMAL_VARIANT_ART, animalHalfWidth, animalHeight, animalRadius, animalSvg, displaySizeChoices, hasAnimalArt, PET_IDLE_FRAMES, PET_SHEET_FRAMES, PET_WALK_FRAMES, PET_WALK_LIFT, petSheetSvg, skinFits, variantFits } from "../src/lib/art/animals";
import { BOBBER, CATCH_CELLS, catchDataUri, catchRows, RIPPLE, SPLASH } from "../src/lib/art/catches";
import { CATCHES, pickCatch } from "../src/lib/fishing";
import { backgroundSvg, BG_ROWS } from "../src/lib/art/backgrounds";
import { ROOF_COLORS } from "../src/lib/blog";
import {
  ANIMAL_DISPLAY_SIZES,
  animalName,
  animalStage,
  HATCH_RARITY,
  HATCH_WEIGHT_TOTAL,
  hatchPercent,
  hatchWeightOf,
  isAnimalForm,
  isDisplaySize,
  isSex,
  levelEggLevels,
  pickSpecial,
  pickWeighted,
  RARITY_ODDS,
  SEX_LOOKS,
  SPECIAL_VARIANTS,
  specialPercent,
  subject,
  toward,
  variantsFor,
} from "../src/lib/farm";
import { formatCoinsShort } from "../src/lib/format";
import { boardSeenValue, shouldAutoOpenBoard } from "../src/lib/attendance-window";
import { expToMaxLevel, GRANT_COINS_MAX, GRANT_EXP_MAX, parseGrantInput, QUICK_COINS } from "../src/lib/admin-grant";
import { expForLevel, levelFromExp, levelProgress, levelsGained, MAX_LEVEL, nextCycleDay, todayKST } from "../src/lib/game";
import { checkLayout, findFreeSpot, fitsRoom, footprintOf, footprintTiles, FURNITURE_FOOTPRINT, repairLayout, WALKABLE_FURNITURE, currentRoof, decorationSlots, decoSlotLevel, DEFAULT_TILES, furnitureSlots, houseInfo, MAX_DECO_SLOTS, MAX_FURNITURE_SLOTS, MAX_ROOM_GRID, parseLayout, roofOrder, roomGrid, unlockedRoofs } from "../src/lib/house";
import { floorToScreen, isoRoom, isoRoomDataUri, roomCamera, screenToFloor } from "../src/lib/art/room";

let failed = 0;
function expect(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "✅" : "❌"} ${name}: ${JSON.stringify(got)}${ok ? "" : ` (기대: ${JSON.stringify(want)})`}`);
}

// GAME-02 레벨: 레벨 n까지 10 × n × (n − 1) (처음 곡선의 1/5, 2026-10-09)
expect("Lv.2·3·4·10 필요 경험치", [2, 3, 4, 10].map(expForLevel), [20, 60, 120, 900]);
expect("경험치 19 → Lv.1", levelFromExp(19), 1);
expect("경험치 20 → Lv.2", levelFromExp(20), 2);
expect("경험치 30 진행 막대", [levelProgress(30).current, levelProgress(30).needed], [10, 40]);
expect("경험치 97,019 → Lv.98", levelFromExp(97_019), 98);
expect("경험치 97,020 → Lv.99", levelFromExp(97_020), MAX_LEVEL);
expect("경험치 1,000만 → Lv.99에서 멈춤", levelFromExp(10_000_000), 99);
expect("최고 레벨 진행 막대 가득(MAX)", [levelProgress(600_000).isMax, levelProgress(600_000).ratio], [true, 1]);

// TOWN-11 집 단계: 10레벨마다 한 단계, 10단계까지 (2026-10-09)
expect("Lv.1·9·10·19·20·89·90·99 → 집 단계", [1, 9, 10, 19, 20, 89, 90, 99].map(houseStage), [1, 1, 2, 2, 3, 9, 10, 10]);
expect("가구 칸: 1단계 4, 2단계 6, 3단계부터 8", ([1, 2, 3, 10] as const).map(furnitureSlots), [4, 6, 8, 8]);
expect("Lv.15 집: 2단계, 다음은 Lv.20", [houseInfo(15).stage, houseInfo(15).nextLevel], [2, 20]);
expect("Lv.95 집: 10단계, 다음 없음", [houseInfo(95).stage, houseInfo(95).nextLevel], [10, null]);

// 우리 집 정육면체 방·가구 자유 배치 (2026-10-12): 방 크기, 기본 자리, 배치 검사(개수 → 같은 가구 → 방 밖 → 겹침)
expect("방 크기: 1단계 6×6, 2단계 7×7, 5단계부터 10×10", ([1, 2, 3, 4, 5, 10] as const).map(roomGrid), [6, 7, 8, 9, 10, 10]);
expect("방 크기는 DB 칸 범위(0~9) 안", roomGrid(10) <= MAX_ROOM_GRID && MAX_ROOM_GRID === 10, true);
expect(
  "옛 칸 자리(DEFAULT_TILES): 8개, 가장 작은 방 안, 서로 겹치지 않음",
  [DEFAULT_TILES.length === MAX_FURNITURE_SLOTS, DEFAULT_TILES.every(([x, y]) => x < roomGrid(1) && y < roomGrid(1)), new Set(DEFAULT_TILES.map((t) => t.join())).size],
  [true, true, 8],
);
{
  const spot = (itemId: number, x: number, y: number) => ({ itemId, x, y, flip: false });
  const rule = { grid: 6, limit: 4 };
  expect("배치: 빈 방·정상 배치 통과", [checkLayout([], rule), checkLayout([spot(1, 0, 0), spot(2, 5, 5)], rule)], [null, null]);
  expect("배치: 개수 넘침", checkLayout([1, 2, 3, 4, 5].map((i) => spot(i, i, 0)), rule), "지금 집에는 가구를 4개까지 놓을 수 있어요.");
  expect("배치: 같은 가구 두 번", checkLayout([spot(1, 0, 0), spot(1, 1, 0)], rule), "같은 가구는 한 번만 놓을 수 있어요.");
  expect("배치: 방 밖(6, -1, 0.5)", [spot(1, 6, 0), spot(1, 0, -1), spot(1, 0.5, 0)].map((s) => checkLayout([s], rule)), Array(3).fill("방 밖에는 놓을 수 없어요."));
  expect("배치: 한 칸에 둘", checkLayout([spot(1, 2, 2), spot(2, 2, 2)], rule), "가구끼리 겹쳐 놓을 수 없어요.");
  expect("배치 값 읽기: 모양이 틀리면 null", [parseLayout(null), parseLayout([{ itemId: "1", x: 0, y: 0 }]), parseLayout([{ itemId: 0, x: 0, y: 0 }]), parseLayout("x")], [null, null, null, null]);
  expect("배치 값 읽기: flip은 true만 true", parseLayout([{ itemId: 3, x: 1, y: 2, flip: "yes" }]), [{ itemId: 3, x: 1, y: 2, flip: false }]);
}
{
  // 아이소메트릭 좌표: 바닥 칸 64×32px, 화면 ↔ 바닥이 서로 되돌려진다, 방 그림은 크기마다 한 장
  const room = isoRoom(6);
  const back = floorToScreen(room, 0, 0);
  const p = floorToScreen(room, 3.25, 1.5);
  const q = screenToFloor(room, p.x, p.y);
  expect("방 6×6: 바닥 칸 64×32, 뒤 모서리 = origin", [room.tile, back.x === room.origin.x && back.y === room.origin.y], [{ w: 64, h: 32 }, true]);
  expect("화면 → 바닥 되돌리기", [q.x, q.y].map((v) => Math.round(v * 1000) / 1000), [3.25, 1.5]);
  expect("방 그림 크기 = 4배 도트 (가로 6칸 × 64 + 여백)", [room.width % 4, room.height % 4, room.width], [0, 0, 6 * 64 + 16]);
  expect("방 그림은 같은 크기면 한 번만 만든다", isoRoomDataUri(6) === isoRoomDataUri(6) && isoRoomDataUri(6) !== isoRoomDataUri(7), true);
  // 방 카메라 (2026-10-12): 넓은 방은 한 걸음 물러나고(도트 4 → 3px) 주인·동물도 같이, 휴대폰은 주인·동물이 한 단계 더 작다
  const cam = (grid: number, width: number, dpr = 1) => {
    const c = roomCamera({ grid, width, dpr });
    return [c.dot, +(24 * c.charCss).toFixed(2), +(32 * c.petCss).toFixed(2)];
  };
  expect("1280px: 6·7칸 방은 도트 4px, 캐릭터 96px, 동물 칸 96px", [cam(6, 1100), cam(7, 1100)], [[4, 96, 96], [4, 96, 96]]);
  expect("1280px: 8~10칸 방은 물러나 도트 3px, 캐릭터 72px, 동물 칸 64px", [8, 9, 10].map((g) => cam(g, 1100)), [[3, 72, 64], [3, 72, 64], [3, 72, 64]]);
  expect("넓은 방도 화면에 보이는 너비가 520px 이하", [6, 7, 8, 9, 10].every((g) => isoRoom(g).width * roomCamera({ grid: g, width: 1100 }).fit <= 520), true);
  expect("375px(2배 화면): 6칸 방 도트 3px·캐릭터 48px(예전 72), 10칸 방 도트 2px·캐릭터 36px(예전 48)", [cam(6, 343, 2), cam(10, 343, 2)], [[3, 48, 48], [2, 36, 32]]);
  expect("375px(3배 화면): 캐릭터 도트는 기기 픽셀 정수 (10칸 5점 = 40px)", cam(10, 343, 3), [2, 40, 42.67]);
  expect("캐릭터·동물 도트는 늘 기기 픽셀 정수", [1, 2, 3].every((dpr) => [6, 8, 10].every((g) => [343, 700, 1100].every((w) => {
    const c = roomCamera({ grid: g, width: w, dpr });
    return Number.isInteger(+(c.charCss * dpr).toFixed(6)) && Number.isInteger(+(c.petCss * dpr).toFixed(6));
  }))), true);
}

// 도트 그림 (2026-10-09 "도트로 바꾸기"): 글자 줄 길이가 고르고, 광장 크기는 PIXEL의 정수배
{
  const even = (rows: readonly string[]) => rows.every((r) => r.length === rows[0].length);
  expect("캐릭터는 모두 16×24", CHARACTER_KEYS().filter((k) => { const r = characterRows(k)!; return r.length !== 24 || r.some((x) => x.length !== 16); }), []);
  expect("아바타 부품은 16칸 폭, 24줄 이하", Object.entries(AVATAR_PARTS).filter(([, p]) => p.rows.length > 24 || p.rows.some((x) => x.length !== 16)).map(([k]) => k), []);
  const { houses, ...others } = TOWN_ROWS;
  const sprites: [string, readonly string[]][] = [...Object.entries(houses).map(([k, v]): [string, string[]] => [`house${k}`, v]), ...Object.entries(others)];
  expect("건물 그림 줄 길이가 고름", sprites.filter(([, rows]) => !even(rows)).map(([k]) => k), []);
  const sizes = [BOARD_SIZE, FARM_SIZE, FISHING_SIZE, FOUNTAIN_SIZE, LAMP_SIZE, SHOP_SIZE, SALON_SIZE, CLOTHES_SIZE, ...Object.values(HOUSE_STAGES), ...DECO_ASSETS.map(decoSize)];
  expect("광장 그림 크기는 PIXEL의 정수배", sizes.filter((z) => z.width % PIXEL || z.height % PIXEL).length, 0);
  const st = Object.values(HOUSE_STAGES);
  expect("집은 단계마다 같거나 커지고 10단계가 1단계의 2배 이상 넓다", st.every((z, i) => i === 0 || (z.width >= st[i - 1].width && z.height >= st[i - 1].height)) && st[9].width >= st[0].width * 2, true);
}

// 광장 분수 (2026-10-11 "분수대 이쁘게"): 3칸 그림판, 칸 하나 = FOUNTAIN_SIZE, 칸마다 물이 달라 흐르는 것처럼 보인다
{
  const sheet = fountainSheetSvg();
  const size = sheet.match(/width="(\d+)" height="(\d+)"/);
  expect("분수 그림판은 3칸 가로", [Number(size?.[1]), Number(size?.[2])], [FOUNTAIN_SIZE.width * FOUNTAIN_FRAMES, FOUNTAIN_SIZE.height]);
  expect("분수 칸 크기 60×52 도트 (광장 배치는 그대로, 너비도 예전과 같다)", FOUNTAIN_SIZE, { width: 180, height: 156 });
}

// TOWN-07 지붕 색: 블로그마다 정해진 순서(10색 모두 한 번씩), 단계 수만큼 열림, 안 골랐으면 첫 색
expect("지붕 색 순서는 10색을 한 번씩", [...roofOrder(7)].sort(), [...ROOF_COLORS].sort());
expect("같은 블로그는 늘 같은 순서", roofOrder(7), roofOrder(7));
expect("블로그마다 첫 색이 고루 나뉨 (1~200번에 8색 이상)", new Set(Array.from({ length: 200 }, (_, i) => roofOrder(i + 1)[0])).size >= 8, true);
expect("1단계 1색, 3단계 3색", [unlockedRoofs(7, 1).length, unlockedRoofs(7, 3).length], [1, 3]);
expect("안 골랐으면 첫 색", currentRoof(7, null), roofOrder(7)[0]);
expect("고른 색", currentRoof(7, "mint"), "mint");
expect("이상한 값은 첫 색", currentRoof(7, "gold"), roofOrder(7)[0]);

// 광장 꾸미기 (사용자 요청 2026-10-09, 2026-10-11부터 쉬는 중 TOWN-16): 자리 번호는 집 단계만큼 열린다
expect("꾸미기 자리 수: Lv.1·9 4, Lv.10 6, Lv.20·99 8", [1, 9, 10, 20, 99].map(decorationSlots), [4, 4, 6, 8, 8]);
expect("꾸미기 자리가 열리는 레벨", Array.from({ length: MAX_DECO_SLOTS }, (_, i) => decoSlotLevel(i)), [1, 1, 1, 1, 10, 10, 20, 20]);
expect("꾸미기 자리 8개", DECO_SLOTS.length, MAX_DECO_SLOTS);

// TOWN-18 이웃 집 자리 (2026-10-11): 고른 자리가 먼저, 안 고른 이웃은 남은 자리를 차례로
{
  const r = (id: string, townLot: number | null) => ({ id, townLot });
  const lots = (rows: { id: string; townLot: number | null }[]) => assignLots(rows).map((x) => `${x.id}${x.lot}`);
  expect("아무도 안 골랐으면 1번부터", lots([r("a", null), r("b", null), r("c", null)]), ["a1", "b2", "c3"]);
  expect("고른 자리는 그대로, 나머지는 빈 자리를 차례로", lots([r("a", null), r("b", 1), r("c", null), r("d", 7)]), ["b1", "a2", "c3", "d7"]);
  expect("같은 자리를 둘이 고르면 먼저 즐겨찾기한 이웃", lots([r("a", 4), r("b", 4)]), ["b1", "a4"]);
  expect("이상한 자리(0·11·1.5)는 안 고른 것처럼", lots([r("a", 0), r("b", 11), r("c", 1.5)]), ["a1", "b2", "c3"]);
  expect("자리 검사 1~10 정수", [0, 1, 10, 11, 2.5, "3", null].map(isNeighborLot), [false, true, true, false, false, false, false]);
  expect("11명이면 10명만 자리", assignLots(Array.from({ length: 11 }, (_, i) => r(`n${i}`, null))).length, NEIGHBOR_LOTS);
}

// 2.5D 마을 (2026-10-11): 건물이 겹치지 않고, 절벽·물에 걸치지 않고, 모든 입구·텔레포트 자리에 걸어서 갈 수 있다
{
  const house = (i: number, level: number): TownNeighbor => ({
    slug: `h${i}`, title: `집 ${i}`, nickname: `이웃${i}`, characterAsset: "char.boy", outfit: [], roof: "#d9574a", level, recentPosts: [], lot: i,
  });
  // 집이 가장 클 때(10단계)와 모두 빈 집터일 때
  const full: TownData = { player: { nickname: "나", characterAsset: "char.boy", outfit: [] }, myHouse: house(0, 99), neighbors: Array.from({ length: 10 }, (_, i) => house(i + 1, 99)), attendanceDay: 1, host: null, pet: null };
  const empty: TownData = { ...full, myHouse: null, neighbors: [] };
  const t = terrain();
  type B = { name: string; x1: number; y1: number; x2: number; y2: number };
  const boxOf = (name: string, s: { x: number; y: number; w: number; h: number }): B => ({ name, x1: s.x - s.w / 2, y1: s.y - s.h, x2: s.x + s.w / 2, y2: s.y });
  const overlap = (a: B, b: B) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
  const { structures, entrances } = townLayout(full);
  // 울타리·아치는 땅 가장자리에 서 있는 장식이라 (부딪히지 않음) 겹침에서 뺀다
  const big = structures.filter((s) => s.texture !== "lamp" && !s.texture.startsWith("mailbox") && !s.texture.startsWith("home:"));
  const boxes = big.map((s) => boxOf(s.label ?? s.texture, { ...s, h: s.solid?.h ?? s.h }));
  const pairs = boxes.flatMap((a, i) => boxes.slice(i + 1).filter((b) => overlap(a, b)).map((b) => `${a.name}-${b.name}`));
  expect("건물·집(10단계) 바닥이 서로 겹치지 않음", pairs, []);
  // 이름표 아래 설명 줄 없음 (사용자 요청 2026-10-11 "옷가게나 상점 아래 적혀있는 부가 설명들은 없애줘")
  expect("건물·집 이름표만 (설명 줄 없음)", [...townLayout(full).structures, ...townLayout(empty).structures].filter((s) => "sub" in s).map((s) => s.label), []);
  // 마을 게시판은 판 어디서 들어가도 마을 소식 + 출석 체크 창 하나
  const boardDoors = entrances.filter((e) => e.label.startsWith("마을 게시판"));
  expect("마을 게시판 입구 하나 → /feed?board=1", boardDoors.map((e) => (e.target.kind === "link" ? e.target.href : e.target.kind)), ["/feed?board=1"]);

  /** 상자 안 도트에 그 칸이 있는가 */
  const cells = (b: B, test: (i: number) => boolean) => {
    for (let y = Math.floor(b.y1 / PIXEL); y < Math.ceil(b.y2 / PIXEL); y++)
      for (let x = Math.floor(b.x1 / PIXEL); x < Math.ceil(b.x2 / PIXEL); x++) if (test(y * t.w + x)) return true;
    return false;
  };
  const solids = [...structures, ...townProps()].map(solidBox).filter((b) => b !== null);
  const footprints = [...structures].filter((s) => s.solid).map((s) => ({ name: s.label ?? s.texture, b: boxOf(s.label ?? s.texture, { x: s.x, y: s.y, w: s.solid!.w, h: s.solid!.h }) }));
  expect("건물 바닥이 절벽·물·길·계단에 걸치지 않음", footprints.filter(({ b }) => cells(b, (i) => t.face[i] > 0 || t.water[i] > 0 || t.edge[i] > 0 || t.path[i] > 0 || t.stairs[i] > 0)).map((f) => f.name), []);
  const levels = footprints.map(({ name, b }) => {
    const set = new Set<number>();
    cells(b, (i) => (set.add(t.level[i]), false));
    return set.size === 1 ? null : name;
  });
  expect("건물마다 한 높이의 땅 위", levels.filter(Boolean), []);
  expect("높이 4가지 (들판·가운데·언덕·전망대)", [...new Set(t.level)].sort(), [0, 1, 2, 3]);
  expect("절벽 앞면과 계단이 있다", [t.face.some((v) => v > 0), t.stairs.some((v) => v > 0)], [true, true]);
  expect("연못은 걸을 수 없다", walkableAt(POND_POS.x, POND_POS.y), false);
  expect("절벽 앞면은 걸을 수 없다", t.face.every((v, i) => v === 0 || t.blocked[i] === 1 || t.stairs[i] === 1), true);

  for (const [name, data] of [["집이 모두 클 때", full], ["모두 빈 집터일 때", empty]] as const) {
    const lay = townLayout(data);
    const blocks = [...lay.structures, ...townProps()].map(solidBox).filter((b) => b !== null);
    const can = reachable(START_POS, blocks);
    const spots = townSpots(data);
    const targets = [...spots.places, ...spots.houses, ...lay.entrances.map((e) => ({ key: e.label, x: e.x, y: e.y }))];
    expect(`${name}: 처음 자리에서 모든 텔레포트 자리·입구에 걸어서 간다`, targets.filter((p) => !can(p)).map((p) => p.key), []);
    expect(`${name}: 텔레포트 자리는 땅이 막히지 않음`, [...spots.places, ...spots.houses].filter((p) => !walkableAt(p.x, p.y)).map((p) => p.key), []);
  }
  expect("입구 앞에 나무·바위가 없음", entrances.filter((e) => townProps().some((p) => Math.abs(p.x - e.x) < 40 && Math.abs(p.y - e.y) < 30)).map((e) => e.label), []);
  expect("가로등이 길 위에 있지 않음", LAMPS.filter((l) => t.path[Math.floor(l.y / PIXEL) * t.w + Math.floor(l.x / PIXEL)] > 0).length, 0);
  expect("나무·바위 수 (가볍게, 500개 이하)", townProps().length <= 500, true);

  // 걸어 다니는 이웃 (NPC): 길 그래프가 이어지고, 내 집 앞 마디는 없다
  const home = houseSlot(0);
  const g = npcGraph([{ x: home.x, y: home.y + 46, r: 190 }]);
  const links = g.links.map((ls, i) => ls.filter((j) => segmentClear(g.nodes[i], g.nodes[j], solids)));
  const linked = links.map((ls, i) => (ls.length ? i : -1)).filter((i) => i >= 0);
  const seen = new Set([linked[0]]);
  for (const q = [linked[0]]; q.length; )
    for (const j of links[q.pop()!])
      if (!seen.has(j)) {
        seen.add(j);
        q.push(j);
      }
  expect("이웃이 걷는 길: 마디가 모두 한 덩어리로 이어짐", linked.filter((i) => !seen.has(i)).length, 0);
  expect("이웃이 걷는 길: 마디 100개 이상", linked.length >= 100, true);
  expect("이웃이 걷는 길: 내 집 앞(190px)에는 마디가 없음", linked.some((i) => Math.hypot(g.nodes[i].x - home.x, g.nodes[i].y - home.y - 46) < 190), false);
  expect("집 자리 11곳, 자리 설명 11개", [HOUSE_SLOTS, LOT_AREAS.length], [11, 11]);

  // 계단과 길 (사용자 요청 2026-10-11 "계단이 너무 좁아서 안 가지는 길이 많다"):
  // 그린 길 가운데선을 따라 6px마다 찍은 점이 모두 걸을 수 있고, 처음 자리에서 걸어서 닿는다
  const can = reachable(START_POS, solids);
  const stuck: string[] = [];
  const cut: string[] = [];
  PATHS.forEach((p, n) => {
    if (p.kind === "plaza") return;
    const pts = smoothPath(p.points);
    for (let s = 0; s < pts.length - 1; s++) {
      const [ax, ay] = pts[s];
      const [bx, by] = pts[s + 1];
      const k = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 6));
      for (let j = 0; j <= k; j++) {
        const x = ax + ((bx - ax) * j) / k;
        const y = ay + ((by - ay) * j) / k;
        const at = `길${n}(${Math.round(x)},${Math.round(y)})`;
        if (!boxWalkable(x, y, TERRAIN_FEET.w, TERRAIN_FEET.h)) stuck.push(at);
        // 건물·나무 상자 안의 점(길 끝이 문 앞에 닿는 곳)은 빼고 본다
        else if (!solids.some((o) => Math.abs(x - o.x) < o.w / 2 + 14 && Math.abs(y - o.y) < o.h / 2 + 8) && !can({ x, y })) cut.push(at);
      }
    }
  });
  expect("모든 길 가운데선이 땅에서 막히지 않음", stuck.slice(0, 8), []);
  expect("모든 길 가운데선에 처음 자리에서 걸어서 닿음", cut.slice(0, 8), []);
  const crossings = stairCrossings();
  expect("계단이 10곳 이상", crossings.length >= 10, true);
  // 계단 가운데에서 길에 수직으로 잰 걸을 수 있는 너비 ≥ 그 길 너비
  const narrow = crossings.flatMap((c, i) => {
    const mx = (c.a.x + c.b.x) / 2;
    const my = (c.a.y + c.b.y) / 2;
    const len = Math.hypot(c.b.x - c.a.x, c.b.y - c.a.y);
    const [nx, ny] = [-(c.b.y - c.a.y) / len, (c.b.x - c.a.x) / len];
    const run = (sign: number) => {
      let d = 0;
      while (d < 200 && walkableAt(mx + nx * sign * (d + 1), my + ny * sign * (d + 1))) d++;
      return d;
    };
    const width = run(1) + run(-1) + 1;
    return width >= c.width ? [] : [`계단${i}(${Math.round(mx)},${Math.round(my)}) ${width}px < 길 ${c.width}px`];
  });
  expect("계단은 이어지는 길보다 좁지 않음", narrow, []);
  expect("계단 양쪽 끝에 걸어서 닿음", crossings.flatMap((c, i) => (can(c.a) && can(c.b) ? [] : [`계단${i}`])), []);

  // 내 정원 (사용자 요청 2026-10-11 "내 집이 가장 특별한 곳에 따로"): 내 집과 농장만, 이웃 집은 멀리, 이웃(NPC)은 들어오지 않는다
  expect("내 집과 농장은 내 정원 안", [inHome(houseSlot(0).x, houseSlot(0).y), inHome(FARM_POS.x, FARM_POS.y)], [true, true]);
  expect("이웃 집 자리는 내 정원에서 200px 넘게 떨어짐", Array.from({ length: 10 }, (_, i) => i + 1).filter((i) => inHome(houseSlot(i).x, houseSlot(i).y, 200)), []);
  expect("내 정원 안의 건물은 내 집·농장·우체통·아치·울타리만", structures.filter((s) => inHome(s.x, s.y, 10) && !["내 집", "동물 농장"].includes(s.label ?? "") && !/^(mailbox:mine|home:)/.test(s.texture)).map((s) => s.label ?? s.texture), []);
  expect("이웃이 걷는 길: 내 정원과 그 둘레 60px에는 마디가 없음", linked.filter((i) => inHome(g.nodes[i].x, g.nodes[i].y, 60)).length, 0);
}

// 한국 날짜 0시 경계 (FR-008)
expect("UTC 14:59 → 그날", todayKST(new Date("2026-10-01T14:59:00Z")), "2026-10-01");
expect("UTC 15:01 → 다음 날", todayKST(new Date("2026-10-01T15:01:00Z")), "2026-10-02");

// GAME-04 출석 일차
expect("기록 없음 → 1일차", nextCycleDay(null, "2026-10-01"), 1);
expect("어제 3일차 → 4일차", nextCycleDay({ date: "2026-09-30", cycleDay: 3 }, "2026-10-01"), 4);
expect("어제 7일차 → 1일차", nextCycleDay({ date: "2026-09-30", cycleDay: 7 }, "2026-10-01"), 1);
expect("그저께가 마지막 → 1일차", nextCycleDay({ date: "2026-09-29", cycleDay: 5 }, "2026-10-01"), 1);
expect("해 바뀜 12/31 → 1/1 이어짐", nextCycleDay({ date: "2025-12-31", cycleDay: 2 }, "2026-01-01"), 3);
{
  // SC-005: 10/1~10/11, 10/10 빠짐 → 1~7, 1, 2, (없음), 1
  const got: (number | null)[] = [];
  let last: { date: string; cycleDay: number } | null = null;
  for (let d = 1; d <= 11; d++) {
    const date = `2026-10-${String(d).padStart(2, "0")}`;
    if (d === 10) { got.push(null); continue; }
    const cycleDay = nextCycleDay(last, date);
    got.push(cycleDay);
    last = { date, cycleDay };
  }
  expect("10/1~10/11 (10/10 빠짐)", got, [1, 2, 3, 4, 5, 6, 7, 1, 2, null, 1]);
}

// GAME-06 레벨업 목록
expect("19 → 20: [2]", levelsGained(19, 20), [2]);
expect("58 → 60: [3]", levelsGained(58, 60), [3]);
expect("18 → 70: [2, 3]", levelsGained(18, 70), [2, 3]);
expect("97,010 → 97,020: [99]", levelsGained(97_010, 97_020), [99]);
expect("600,000 → 600,010: []", levelsGained(600_000, 600_010), []);

// TOWN-09 동물 농장
expect("성장 0/90 → 아기", animalStage(0, 90), "baby");
expect("성장 29/90 → 아기", animalStage(29, 90), "baby");
expect("성장 30/90 → 청소년", animalStage(30, 90), "teen");
expect("성장 89/90 → 청소년", animalStage(89, 90), "teen");
expect("성장 90/90 → 어른", animalStage(90, 90), "adult");
expect("Lv.4 → 레벨 보상 알 없음", levelEggLevels(4), []);
expect("Lv.12 → 5, 10레벨 알", levelEggLevels(12), [5, 10]);
const sp = [{ code: "a", hatchWeight: 40 }, { code: "b", hatchWeight: 10 }];
expect("비중 고르기: 0 → 첫째", pickWeighted(sp, 0).code, "a");
expect("비중 고르기: 0.79 → 첫째 (40/50 경계 전)", pickWeighted(sp, 0.79).code, "a");
expect("비중 고르기: 0.8 → 둘째", pickWeighted(sp, 0.8).code, "b");
expect("비중 고르기: 0.999 → 둘째", pickWeighted(sp, 0.999).code, "b");
expect("조사: 토끼가", subject("토끼"), "토끼가");
expect("조사: 아기 돼지가", subject("아기 돼지"), "아기 돼지가");
expect("조사: 곰이", subject("곰"), "곰이");

// 남은 그림 도트 (2026-10-09 2차): 가구는 32×32, 미리보기는 정수 배율, 배경은 칸 × 배율 크기
expect("가구는 모두 32×32", FURNITURE_KEYS().filter((k) => { const r = furnitureRows(k)!; return r.length !== 32 || r.some((x) => x.length !== 32); }), []);
const view = (svg: string) => svg.match(/viewBox="([-\d. ]+)" width="(\d+)"/)!.slice(1);
expect("fitSvg 96px에 32칸 → 틀 32칸 (3배)", view(fitSvg(furnitureRows("furniture.bed")!, 96)), ["0 0 32 32", "96"]);
expect("fitSvg 72px에 32칸 → 틀 36칸 (2배)", view(fitSvg(furnitureRows("furniture.bed")!, 72)), ["-2 -4 36 36", "72"]);
expect("동물은 단계마다 다른 그림", new Set((["baby", "teen", "adult"] as const).map((st) => animalSvg("animal.chick", st))).size, 3);
// 동물 크기·스킨·움직임 (2026-10-11 "작은 동물은 작게 큰 동물은 크게", "펫 종류별로 스킨", "펫 따라다니는 모션")
expect("모든 동물이 그림·크기가 있고 단계마다 다른 그림", Object.keys(ANIMAL_SIZE).filter((k) => !hasAnimalArt(k) || new Set((["baby", "teen", "adult"] as const).map((st) => animalSvg(k, st))).size !== 3), []);
const tierOrder = { small: 0, medium: 1, large: 2 } as const;
expect(
  "크기 등급이 클수록 몸 반지름이 크다 (작은 < 중간 < 큰)",
  Object.values(ANIMAL_SIZE).every((sa) => Object.values(ANIMAL_SIZE).every((sb) => tierOrder[sa.tier] >= tierOrder[sb.tier] || sa.r < sb.r)),
  true,
);
expect("병아리 < 아기 돼지 < 송아지 (어른 반지름)", [animalRadius("animal.chick", "adult"), animalRadius("animal.piglet", "adult"), animalRadius("animal.calf", "adult")], [5, 8, 10]);
expect("스킨은 모두 있는 동물 종류에 붙고 기본 그림과 다르다", Object.entries(ANIMAL_SKINS).filter(([k, v]) => !hasAnimalArt(v.species) || animalSvg(v.species, "adult", 96, k) === animalSvg(v.species, "adult", 96)), []);
expect("다른 종류의 스킨은 입지 않는다 (기본 그림)", animalSvg("animal.chick", "adult", 96, "skin.pony.zebra") === animalSvg("animal.chick", "adult", 96) && !skinFits("skin.pony.zebra", "animal.chick"), true);
expect("따라다니는 그림판: 5칸 × 2줄(오른쪽·왼쪽), 32칸 × 3배", petSheetSvg("animal.bunny", null, 3).match(/viewBox="0 0 (\d+) (\d+)" width="(\d+)" height="(\d+)"/)!.slice(1).map(Number), [32 * PET_SHEET_FRAMES, 64, 96 * PET_SHEET_FRAMES, 192]);
// 다 키운 동물 크기 (2026-10-12 "햄스터는 완전 작게"): 반지름을 바꿔 다시 그린다 (정수 도트), 도화지 32칸 안에 다 들어간다
expect("햄스터 크기: 아주 작게 < 작게 < 보통 < 크게", (["tiny", "small", "normal", "large"] as const).map((z) => animalRadius("animal.hamster", "adult", z)), [3, 4, 5, 6]);
expect("작게 그리면 반폭·키도 작다 (따라오는 거리)", animalHalfWidth("animal.hamster", "tiny") < animalHalfWidth("animal.hamster") && animalHeight("animal.pony", "small") < animalHeight("animal.pony"), true);
expect("조랑말은 이미 가장 커서 크게가 없다", displaySizeChoices("animal.pony"), ["tiny", "small", "normal"]);
expect("크기 이름 검사", [isDisplaySize("tiny"), isDisplaySize("huge"), isDisplaySize(1), ANIMAL_DISPLAY_SIZES.length], [true, false, false, 4]);
{
  // 모든 동물·단계·크기가 32칸 안에 잘리지 않고(좌우 끝 칸·맨 위 줄이 비었다) 그려진다
  const clipped: string[] = [];
  for (const k of Object.keys(ANIMAL_SIZE))
    for (const z of ANIMAL_DISPLAY_SIZES)
      for (const st of ["baby", "teen", "adult"] as const) {
        const svg = animalSvg(k, st, 32, null, z);
        const cells = [...svg.matchAll(/fill="([^"]+)"(?: fill-opacity="[^"]+")? d="([^"]+)"/g)].filter(([, c]) => c !== "#3a2a1e");
        for (const [, , d] of cells)
          for (const m of d.matchAll(/M(\d+) (\d+)h(\d+)/g)) {
            const [x, y, w] = [+m[1], +m[2], +m[3]];
            if (x === 0 || x + w >= 32 || y === 0) clipped.push(`${k}:${st}:${z}`);
          }
      }
  expect("모든 동물·단계·크기가 도화지 안에 들어간다", [...new Set(clipped)], []);
}
// 자라는 비율 (2026-10-12 "대가리가 커지는 게 아니라 그 동물에 맞는 비율로"): 어른은 아기보다 길쭉하다 (키보다 몸길이가 더 자란다)
{
  const box = (k: string, st: "baby" | "adult") => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const m of animalSvg(k, st, 32).matchAll(/M(\d+) (\d+)h(\d+)/g)) if (+m[2] < 30) {
      xs.push(+m[1], +m[1] + +m[3]);
      ys.push(+m[2]);
    }
    return (Math.max(...xs) - Math.min(...xs)) / (30 - Math.min(...ys));
  };
  // (조랑말은 다리·목·몸이 함께 길어져 폭/키 비율은 비슷하다. 머리가 작아지는 것은 그림으로 확인)
  expect("네발 동물은 어른이 아기보다 길쭉하거나 다리가 길다 (폭/키 비율이 다르다)", ["animal.piglet", "animal.puppy", "animal.kitten", "animal.calf", "animal.lamb"].filter((k) => Math.abs(box(k, "adult") - box(k, "baby")) < 0.05), []);
}

// 알 확률·암수·특별 진화·아기 모습 (2026-10-12 "노말한 동물들이랑 희귀한 애들이랑 확률 다르게", "암/수 별로", "유니콘이나 페가수스", "아기 형태로 데리고 다닐 수도")
{
  const codes = Object.keys(HATCH_RARITY);
  const assetCodes = Object.keys(ANIMAL_SIZE).map((k) => k.replace("animal.", ""));
  expect("등급 확률 합 100%", Object.values(RARITY_ODDS).reduce((a, b) => a + b, 0), 100);
  expect("종류별 알 확률 합 100%", Math.round(codes.reduce((a, c) => a + hatchPercent(c), 0) * 1000) / 1000, 100);
  expect("시드 비중(만분율) 합 10,000이고 모두 정수", [codes.reduce((a, c) => a + hatchWeightOf(c), 0), codes.every((c) => Number.isInteger(hatchWeightOf(c)) && hatchWeightOf(c) > 0)], [HATCH_WEIGHT_TOTAL, true]);
  expect("그림이 있는 아홉 종류 모두 알 등급이 있다", [...assetCodes].sort(), [...codes].sort());
  expect("일반 > 희귀 > 아주 희귀 (종류 하나 확률)", hatchPercent("chick") > hatchPercent("piglet") && hatchPercent("piglet") > hatchPercent("pony"), true);
  expect("병아리 20%, 고양이 8%, 조랑말 4%", ["chick", "kitten", "pony"].map(hatchPercent), [20, 8, 4]);
  // 분포: 시드 비중으로 0~1을 고르게 나눠 뽑으면 확률대로 나온다
  const list = codes.map((code) => ({ code, hatchWeight: hatchWeightOf(code) }));
  const N = 100_000;
  const counts = new Map<string, number>();
  for (let i = 0; i < N; i++) {
    const c = pickWeighted(list, (i + 0.5) / N).code;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  expect("알 뽑기 분포가 표와 같다 (±0.1%p)", codes.filter((c) => Math.abs(((counts.get(c) ?? 0) / N) * 100 - hatchPercent(c)) > 0.1), []);
  // 무작위 뽑기도 대충 맞는다 (Math.random 20만 번, ±0.6%p)
  const rc = new Map<string, number>();
  for (let i = 0; i < 200_000; i++) {
    const c = pickWeighted(list, Math.random()).code;
    rc.set(c, (rc.get(c) ?? 0) + 1);
  }
  expect("무작위 알 뽑기 분포 (±0.6%p)", codes.filter((c) => Math.abs(((rc.get(c) ?? 0) / 200_000) * 100 - hatchPercent(c)) > 0.6), []);

  expect("특별 진화: 종류마다 하나 이상, 조랑말은 유니콘·페가수스", [codes.filter((c) => variantsFor(c).length === 0), variantsFor("pony").map((v) => v.key)], [[], ["unicorn", "pegasus"]]);
  expect("특별 진화 키는 겹치지 않고 그림이 그 종류에 맞다", [new Set(SPECIAL_VARIANTS.map((v) => v.key)).size === SPECIAL_VARIANTS.length, SPECIAL_VARIANTS.filter((v) => !variantFits(v.key, `animal.${v.species}`))], [true, []]);
  expect("그림만 있고 표에 없는 특별 진화 없음", Object.keys(ANIMAL_VARIANT_ART).filter((k) => !SPECIAL_VARIANTS.some((v) => v.key === k)), []);
  expect("특별 진화 확률은 낮다 (종류마다 합 10% 이하)", codes.filter((c) => specialPercent(c) <= 0 || specialPercent(c) > 10), []);
  expect("특별 진화 뽑기 경계: 조랑말 0 → 유니콘, 0.03 → 페가수스, 0.06 → 보통", [pickSpecial("pony", 0)?.key, pickSpecial("pony", 0.0299)?.key, pickSpecial("pony", 0.03)?.key, pickSpecial("pony", 0.06)], ["unicorn", "unicorn", "pegasus", null]);
  let specials = 0;
  for (let i = 0; i < N; i++) if (pickSpecial("calf", (i + 0.5) / N)) specials++;
  expect("송아지 특별 진화 분포 4%", Math.round((specials / N) * 1000) / 10, 4);
  expect("이름: 특별 진화면 그 이름", [animalName("조랑말", "unicorn"), animalName("조랑말", null), animalName("조랑말", "nope")], ["유니콘", "조랑말", "조랑말"]);
  expect("조사 (으)로", [toward("유니콘"), toward("페가수스"), toward("황금 닭"), toward("아기 모습"), toward("물")], ["유니콘으로", "페가수스로", "황금 닭으로", "아기 모습으로", "물로"]);
  expect("암수·모습 검사", [isSex("female"), isSex("male"), isSex("x"), isAnimalForm("baby"), isAnimalForm("adult"), isAnimalForm("teen")], [true, true, false, true, true, false]);
  expect("암수 모습 설명이 모든 종류에", [...codes].sort(), Object.keys(SEX_LOOKS).sort());

  // 그림: 암수 어른은 서로 다르고(아기는 같다), 특별 진화는 보통과 다르고 반짝이가 있다, 스킨은 특별 진화에 안 입는다
  expect("어른 암컷 ≠ 수컷 (모든 종류)", Object.keys(ANIMAL_SIZE).filter((k) => animalSvg(k, "adult", 96, null, "normal", { sex: "female" }) === animalSvg(k, "adult", 96, null, "normal", { sex: "male" })), []);
  expect("아기·청소년은 암수가 같은 모습", Object.keys(ANIMAL_SIZE).filter((k) => (["baby", "teen"] as const).some((st) => animalSvg(k, st, 96, null, "normal", { sex: "female" }) !== animalSvg(k, st, 96, null, "normal", { sex: "male" }))), []);
  expect("특별 진화는 보통 모습과 다르다 (어른·아기)", SPECIAL_VARIANTS.filter((v) => (["adult", "baby"] as const).some((st) => animalSvg(`animal.${v.species}`, st, 96, null, "normal", { variant: v.key }) === animalSvg(`animal.${v.species}`, st, 96))).map((v) => v.key), []);
  expect("다른 종류의 특별 진화 키는 보통 모습", animalSvg("animal.chick", "adult", 96, null, "normal", { variant: "unicorn" }) === animalSvg("animal.chick", "adult", 96), true);
  expect("특별 진화는 스킨을 입지 않는다", animalSvg("animal.calf", "adult", 96, "skin.calf.hanwoo", "normal", { variant: "strawberry_calf" }) === animalSvg("animal.calf", "adult", 96, null, "normal", { variant: "strawberry_calf" }), true);
  // 모든 종류 × 보통·특별 진화 × 암수 × 크기 × 단계가 32칸 안 (좌우 끝 칸·맨 위 줄이 비었다, 반짝이 포함)
  const clipped = new Set<string>();
  for (const k of Object.keys(ANIMAL_SIZE))
    for (const variant of [null, ...SPECIAL_VARIANTS.filter((v) => `animal.${v.species}` === k).map((v) => v.key)])
      for (const sex of [null, "female", "male"] as const)
        for (const z of ANIMAL_DISPLAY_SIZES)
          for (const st of ["baby", "teen", "adult"] as const) {
            const svg = animalSvg(k, st, 32, null, z, { sex, variant });
            for (const [, c, d] of svg.matchAll(/fill="([^"]+)"(?: fill-opacity="[^"]+")? d="([^"]+)"/g)) {
              if (c === "#3a2a1e") continue;
              for (const m of d.matchAll(/M(\d+) (\d+)h(\d+)/g)) if (+m[1] === 0 || +m[1] + +m[3] >= 32 || +m[2] === 0) clipped.add(`${k}:${variant}:${sex}:${z}:${st}`);
            }
          }
  expect("모든 암수·특별 진화·크기·단계가 도화지 안에 들어간다", [...clipped], []);
  // 아기 모습으로 데리고 다니기: 그림판은 아기 그림, 크기 고르기는 그 모습에서 달라 보이는 것만, 반폭은 어른보다 작다
  expect("아기 모습 그림판 ≠ 어른 그림판", petSheetSvg("animal.pony", null, 3, "normal", { form: "baby" }) !== petSheetSvg("animal.pony", null, 3), true);
  expect("아기 모습 반폭 < 어른 반폭 (따라오는 거리)", animalHalfWidth("animal.pony", "normal", { form: "baby" }) < animalHalfWidth("animal.pony"), true);
  expect("아기 모습 크기: 조랑말은 아주 작게~크게, 햄스터는 보통만", [displaySizeChoices("animal.pony", "baby"), displaySizeChoices("animal.hamster", "baby")], [["tiny", "small", "normal", "large"], ["normal"]]);
  expect("아기 모습 크기가 커질수록 크다 (조랑말)", (["tiny", "small", "normal", "large"] as const).map((z) => animalRadius("animal.pony", "baby", z)), [3, 5, 6, 8]);
}
// 낚시터 도트 그림 (2026-10-12 "낚을 수 있는 것들도 도트로"): 낚을 것마다 20×20칸 그림, 연출 그림은 줄 길이가 고르다
expect("낚을 것마다 20×20 도트 그림", CATCHES.filter((c) => { const r = catchRows(c.key); return !r || r.length !== CATCH_CELLS || r.some((x) => x.length !== CATCH_CELLS); }).map((c) => c.key), []);
expect("낚을 것 그림은 정수배 SVG", CATCHES.every((c) => catchDataUri(c.key, 2)!.includes("width='40' height='40'")), true);
expect("찌·물보라·물결 줄 길이가 고르다", [BOBBER, SPLASH, RIPPLE].map((r) => new Set(r.map((x) => x.length)).size), [1, 1, 1]);
expect("낚을 것 무게 합 100, 0~99가 모두 무언가를 낚는다", [CATCHES.reduce((a, c) => a + c.weight, 0), pickCatch(0).key, pickCatch(99).key], [100, "minnow", "boot"]);
expect("걷기 칸과 뛰는 높이 수가 같다", PET_WALK_FRAMES.length === PET_WALK_LIFT.length && PET_IDLE_FRAMES.length === 2, true);
expect("배경 1280px × 5배 → 256칸, 높이 60칸 × 5", backgroundSvg("bg.meadow", 1280, 5).match(/viewBox="0 0 (\d+) (\d+)" width="(\d+)" height="(\d+)"/)!.slice(1).map(Number), [256, BG_ROWS, 1280, BG_ROWS * 5]);

// AUTH-10 관리자 테스트 지급: 입력 검사와 빠른 버튼
const grantForm = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
expect("빈 아이디·숫자 → 그대로 (아이디는 소문자, @ 뺌)", parseGrantInput(grantForm({ username: " @Tester ", coins: "1,000", exp: "50" })), { username: "tester", coins: 1000, exp: 50, preset: null });
expect("코인 최대 넘음 → 문구", "error" in parseGrantInput(grantForm({ coins: String(GRANT_COINS_MAX + 1) })), true);
expect("음수·소수 경험치 → 문구", ["-1", "1.5", "abc"].map((exp) => "error" in parseGrantInput(grantForm({ exp }))), [true, true, true]);
expect("둘 다 0 → 문구", parseGrantInput(grantForm({ coins: "", exp: "0" })), { error: "코인이나 경험치를 1 이상 적어 주세요" });
expect("[+10,000 코인]은 칸 값을 무시", parseGrantInput(grantForm({ preset: "coins", coins: "9" })), { username: "", coins: QUICK_COINS, exp: 0, preset: "coins" });
expect("경험치 최대로 0에서 Lv.99에 닿음", levelFromExp(GRANT_EXP_MAX), MAX_LEVEL);
expect("Lv.99까지 모자란 경험치", [0, 1000, expForLevel(MAX_LEVEL) + 5].map(expToMaxLevel), [97020, 96020, 0]);
expect("휴대폰 헤더 짧은 코인", [9999, 10017, 12345, 1_000_000, 12_345_678, 350_000_000].map(formatCoinsShort), ["9,999", "1만", "1.2만", "100만", "1234만", "3.5억"]);

// 가구 크기·클릭해서 걷기·가구와 놀기 (사용자 요청 2026-10-12 "가구마다 크기 다르게", "클릭했을 때 이동", "가구들이랑 상호작용")
{
  expect("가구 크기: 침대 3×2, 탁자 2×1, 옷장·의자 1×1, 모르는 가구 1×1", ["furniture.bed", "furniture.table", "furniture.wardrobe", "furniture.chair", "furniture.nope"].map((k) => footprintOf(k)), [{ w: 3, d: 2 }, { w: 2, d: 1 }, { w: 1, d: 1 }, { w: 1, d: 1 }, { w: 1, d: 1 }]);
  expect("뒤집으면 가로·세로가 바뀐다 (침대 2×3)", footprintOf("furniture.bed", true), { w: 2, d: 3 });
  expect("모든 가구 크기 표가 가진 그림의 가구", Object.keys(FURNITURE_FOOTPRINT).every((k) => FURNITURE_KEYS().includes(k)), true);
  expect("가장 작은 방(6×6)에도 큰 가구가 들어간다", Object.keys(FURNITURE_FOOTPRINT).every((k) => fitsRoom(k, { x: 0, y: 0, flip: false }, roomGrid(1)) && fitsRoom(k, { x: 0, y: 0, flip: true }, roomGrid(1))), true);
  expect("침대가 차지하는 칸 (1,1에서 3×2)", footprintTiles("furniture.bed", { x: 1, y: 1, flip: false }), ["1,1", "2,1", "3,1", "1,2", "2,2", "3,2"]);
  const keys: Record<number, string> = { 1: "furniture.bed", 2: "furniture.chair", 3: "furniture.table" };
  const rule = { grid: 6, limit: 4, keyOf: (id: number) => keys[id] };
  const at = (itemId: number, x: number, y: number, flip = false) => ({ itemId, x, y, flip });
  expect("여러 칸 배치: 침대 옆 의자 통과", checkLayout([at(1, 0, 0), at(2, 3, 0)], rule), null);
  expect("여러 칸 배치: 침대가 차지한 칸에 의자 → 겹침", checkLayout([at(1, 0, 0), at(2, 2, 1)], rule), "가구끼리 겹쳐 놓을 수 없어요.");
  expect("여러 칸 배치: 침대 끝이 방 밖 (4,0 → 4~6칸)", checkLayout([at(1, 4, 0)], rule), "방 밖에는 놓을 수 없어요.");
  expect("여러 칸 배치: 뒤집으면 들어감 (4,0 뒤집기 → 4~5 × 0~2)", checkLayout([at(1, 4, 0, true)], rule), null);
  expect("여러 칸 배치: 뒤집은 침대 아래 칸과 탁자가 겹침", checkLayout([at(1, 4, 0, true), at(3, 3, 2)], rule), "가구끼리 겹쳐 놓을 수 없어요.");
  expect("러그는 밟을 수 있다", WALKABLE_FURNITURE.has("furniture.rug"), true);
  expect("빈 자리 찾기: 침대는 뒤 모서리, 꽉 차면 null", [findFreeSpot("furniture.bed", new Set(), 6), findFreeSpot("furniture.bed", new Set(Array.from({ length: 36 }, (_, i) => `${i % 6},${Math.floor(i / 6)}`)), 6)], [{ x: 0, y: 0, flip: false }, null]);
  // 예전 1칸 배치를 고쳐 읽기: 침대(2,2)가 차지하게 된 칸의 의자(3,3)는 빈 자리로, 방 밖으로 나가는 탁자(5,5)는 뒤집거나 옮긴다
  const old = [
    { ...at(1, 2, 2), assetKey: "furniture.bed" },
    { ...at(2, 3, 3), assetKey: "furniture.chair" },
    { ...at(3, 5, 5), assetKey: "furniture.table" },
  ];
  const fixed = repairLayout(old, 6);
  expect("고쳐 읽기: 겹치거나 나간 2개를 옮김, 결과는 checkLayout 통과", [fixed.moved, fixed.spots.length, checkLayout(fixed.spots, rule)], [2, 3, null]);
  expect("고쳐 읽기: 맞는 배치는 그대로", repairLayout([old[0]], 6), { spots: [old[0]], moved: 0 });
  expect("고쳐 읽기: 자리가 없으면 그 가구는 빠진다 (6×6 방에 3×2 침대 7개 → 6개)", repairLayout(Array.from({ length: 7 }, (_, i) => ({ ...at(i + 1, 0, 0), assetKey: "furniture.bed" })), 6).spots.length, 6);

  // 길 찾기: 가구 칸을 피하고, 대각선으로 모서리를 뚫지 않는다
  const bed = { itemId: 1, assetKey: "furniture.bed", x: 1, y: 1, flip: false };
  const blocked = blockedTiles([bed, { itemId: 9, assetKey: "furniture.rug", x: 4, y: 4, flip: false }]);
  expect("막힌 칸 = 침대 6칸 (러그는 안 막음)", [...blocked].sort(), ["1,1", "1,2", "2,1", "2,2", "3,1", "3,2"]);
  const path = findPath(6, blocked, { x: 0, y: 0 }, { x: 4, y: 3 });
  const steps = [{ x: 0, y: 0 }, ...path];
  const noCut = steps.every((p, i) => i === 0 || (Math.abs(p.x - steps[i - 1].x) <= 1 && Math.abs(p.y - steps[i - 1].y) <= 1 && !blocked.has(`${p.x},${steps[i - 1].y}`) && !blocked.has(`${steps[i - 1].x},${p.y}`)));
  expect("길: 도착 칸에서 끝나고, 막힌 칸을 안 밟고, 한 칸씩·모서리 안 뚫음", [path.at(-1), path.some((p) => blocked.has(`${p.x},${p.y}`)), noCut], [{ x: 4, y: 3 }, false, true]);
  expect("길: 그대로 그 칸이면 빈 길", findPath(6, blocked, { x: 0, y: 0 }, { x: 0, y: 0 }), []);
  expect("길: 막힌 칸을 누르면 가장 가까운 빈 칸으로", (() => { const p = findPath(6, blocked, { x: 0, y: 0 }, { x: 2, y: 1 }).at(-1)!; return !blocked.has(`${p.x},${p.y}`) && Math.hypot(p.x - 2, p.y - 1) <= 1; })(), true);
  expect("길: 갇힌 곳은 못 감 (가장 가까운 곳까지)", findPath(3, new Set(["1,0", "1,1", "1,2"]), { x: 0, y: 0 }, { x: 2, y: 2 }).at(-1), { x: 0, y: 2 });
  const plan = planUse(6, blocked, { x: 5, y: 5 }, bed);
  expect("가구 쓰러 가기: 침대에 맞닿은 빈 칸, 앞쪽(y = 3)을 고름", [plan?.stand.y, plan?.path.at(-1)], [3, plan?.stand]);
  expect("가구 행동: 침대 잠·의자 앉기·책장 읽기·화분 물·스탠드 불·TV 음악·옷장 한 바퀴·곰 인형 구경", ["bed", "chair", "shelf", "plant", "lamp", "tv", "wardrobe", "bear"].map((k) => actionOf(`furniture.${k}`)), ["sleep", "sit", "read", "water", "light", "music", "spin", "look"]);
  expect("앉을 칸: 소파(2×1)의 서 있는 쪽 칸", seatTile({ itemId: 2, assetKey: "furniture.sofa", x: 2, y: 0, flip: false }, { x: 3, y: 1 }), { x: 3, y: 0 });
  // 깊이: 긴 침대 오른쪽 뒤의 의자는 칸 합으로 줄 세우면 틀린다 → 상자 비교로 의자가 앞
  const ranks = depthRanks([{ x0: 0, y0: 0, x1: 1, y1: 4 }, { x0: 1, y0: 0, x1: 2, y1: 1 }]);
  expect("깊이: 길쭉한 가구 옆 가구 순서", ranks[0] < ranks[1], true);
  const { pieceZ, pointZ } = layoutDepth([bed]);
  expect("깊이: 침대 앞 캐릭터는 위, 뒤 캐릭터는 아래", [pointZ({ x: 2.5, y: 3.5 }) > pieceZ[0], pointZ({ x: 0.5, y: 0.5 }) < pieceZ[0]], [true, true]);
  // 그림: 아이소메트릭 가구는 차지하는 칸만큼 넓고, 침대·옷장은 캐릭터(24줄 × 4px = 96px)보다 크다
  const iso = ISO_FURNITURE_KEYS().map((k) => [k, roomFurnitureArt(k)] as const);
  expect("방 가구 그림 폭 = (w + d) × 8도트(칸 반폭) + 외곽선 2, 4배", iso.filter(([k, a]) => a.width !== ((footprintOf(k).w + footprintOf(k).d) * 8 + 2) * 4).map(([k]) => k), []);
  expect("침대는 사람보다 넓고, 옷장은 사람보다 크다", [roomFurnitureArt("furniture.bed").width > 96 * 1.5, roomFurnitureArt("furniture.wardrobe").height > 96 * 1.5], [true, true]);
  expect("작은 가구는 정수배(2·3배) 상점 그림", FURNITURE_KEYS().filter((k) => !ISO_FURNITURE_KEYS().includes(k)).every((k) => [2, 3].includes(roomFurnitureArt(k).dot) && roomFurnitureArt(k).height === 32 * roomFurnitureArt(k).dot), true);
  expect("큰 가구(2칸 넘게)는 모두 아이소메트릭 그림", Object.keys(FURNITURE_FOOTPRINT).every((k) => ISO_FURNITURE_KEYS().includes(k)), true);
  expect("그림 누르기: 침대 가운데는 칠한 칸, 왼쪽 위 구석은 투명", [artHit(roomFurnitureArt("furniture.bed"), roomFurnitureArt("furniture.bed").width / 2, roomFurnitureArt("furniture.bed").height * 0.6, false), artHit(roomFurnitureArt("furniture.bed"), 2, 2, false)], [true, false]);
  // 몸짓: 24×24 칸, 2칸씩, 어떤 캐릭터에도
  expect("몸짓 그림: 모든 캐릭터·몸짓·칸이 24×24", CHARACTER_KEYS().every((c) => POSES.every((p) => [0, 1].every((f) => { const g = poseFrame(c, [], p, f); return g.length === 24 && g.every((r) => r.length === 24); }))), true);
  expect("자는 몸짓은 머리만 (위 11줄은 비었다)", poseFrame("char.boy", [], "sleep", 0).slice(0, 11).every((r) => r.every((c) => c === null)), true);
  expect("앉은 몸짓은 서 있을 때보다 2줄 낮다 (맨 위 2줄 빔)", poseFrame("char.boy", [], "sit", 0).slice(0, 2).every((r) => r.every((c) => c === null)), true);
}
// 게시판 출석 창은 회원마다 하루 한 번만 저절로 (2026-10-12)
expect("출석 창: 처음 게시판 → 연다", shouldAutoOpenBoard(true, undefined, "u1", "2026-10-12"), true);
expect("출석 창: 오늘 이미 열림 → 안 연다", shouldAutoOpenBoard(true, boardSeenValue("u1", "2026-10-12"), "u1", "2026-10-12"), false);
expect("출석 창: 어제 열림 → 연다", shouldAutoOpenBoard(true, boardSeenValue("u1", "2026-10-11"), "u1", "2026-10-12"), true);
expect("출석 창: 다른 회원이 오늘 연 브라우저 → 연다", shouldAutoOpenBoard(true, boardSeenValue("u2", "2026-10-12"), "u1", "2026-10-12"), true);
expect("출석 창: 게시판 입구가 아니면 안 연다", shouldAutoOpenBoard(false, undefined, "u1", "2026-10-12"), false);

if (failed) process.exit(1);
