// 게임 규칙 계산 테스트: 레벨(GAME-02), 출석 일차(GAME-04), 레벨업(GAME-06), 동물 농장(TOWN-09), 집 단계·지붕 색(TOWN-07·11), 광장 꾸미기 자리,
// 2.5D 마을 배치(겹침·절벽·걸어서 갈 수 있는지·이웃이 걷는 길), 이웃 집 자리(TOWN-18)
// 실행: npm run test:game
import { DECO_SLOTS, HOUSE_SLOTS, houseSlot, LAMPS, LOT_AREAS, POND_POS, START_POS, townSpots } from "../src/components/town/layout";
import { npcGraph, segmentClear, solidBox, townLayout, townProps } from "../src/components/town/structures";
import { reachable, terrain, walkableAt } from "../src/components/town/terrain";
import type { TownData, TownNeighbor } from "../src/components/town/types";
import { assignLots, isNeighborLot, NEIGHBOR_LOTS } from "../src/lib/town-lots";
import { BOARD_SIZE, CLOTHES_SIZE, FARM_SIZE, FISHING_SIZE, FOUNTAIN_FRAMES, FOUNTAIN_SIZE, fountainSheetSvg, HOUSE_STAGES, houseStage, LAMP_SIZE, SALON_SIZE, SHOP_SIZE, TOWN_ROWS } from "../src/lib/art/town";
import { DECO_ASSETS, decoSize } from "../src/lib/art/deco";
import { CHARACTER_KEYS, characterRows } from "../src/lib/art/characters";
import { AVATAR_PARTS } from "../src/lib/art/avatar";
import { fitSvg, PIXEL } from "../src/lib/art/pixel";
import { FURNITURE_KEYS, furnitureRows } from "../src/lib/art/furniture";
import { animalSvg } from "../src/lib/art/animals";
import { backgroundSvg, BG_ROWS } from "../src/lib/art/backgrounds";
import { ROOF_COLORS } from "../src/lib/blog";
import { animalStage, levelEggLevels, pickWeighted, subject } from "../src/lib/farm";
import { expForLevel, levelFromExp, levelProgress, levelsGained, MAX_LEVEL, nextCycleDay, todayKST } from "../src/lib/game";
import { currentRoof, decorationSlots, decoSlotLevel, furnitureSlots, houseInfo, MAX_DECO_SLOTS, roofOrder, unlockedRoofs } from "../src/lib/house";

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
  const full: TownData = { player: { nickname: "나", characterAsset: "char.boy", outfit: [] }, myHouse: house(0, 99), neighbors: Array.from({ length: 10 }, (_, i) => house(i + 1, 99)), attendanceDay: 1, host: null };
  const empty: TownData = { ...full, myHouse: null, neighbors: [] };
  const t = terrain();
  type B = { name: string; x1: number; y1: number; x2: number; y2: number };
  const boxOf = (name: string, s: { x: number; y: number; w: number; h: number }): B => ({ name, x1: s.x - s.w / 2, y1: s.y - s.h, x2: s.x + s.w / 2, y2: s.y });
  const overlap = (a: B, b: B) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
  const { structures, entrances } = townLayout(full);
  const big = structures.filter((s) => s.texture !== "lamp" && !s.texture.startsWith("mailbox"));
  const boxes = big.map((s) => boxOf(s.label ?? s.texture, { ...s, h: s.solid?.h ?? s.h }));
  const pairs = boxes.flatMap((a, i) => boxes.slice(i + 1).filter((b) => overlap(a, b)).map((b) => `${a.name}-${b.name}`));
  expect("건물·집(10단계) 바닥이 서로 겹치지 않음", pairs, []);

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
expect("배경 1280px × 5배 → 256칸, 높이 60칸 × 5", backgroundSvg("bg.meadow", 1280, 5).match(/viewBox="0 0 (\d+) (\d+)" width="(\d+)" height="(\d+)"/)!.slice(1).map(Number), [256, BG_ROWS, 1280, BG_ROWS * 5]);

if (failed) process.exit(1);
