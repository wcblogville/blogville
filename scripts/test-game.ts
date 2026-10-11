// 게임 규칙 계산 테스트: 레벨(GAME-02), 출석 일차(GAME-04), 레벨업(GAME-06), 동물 농장(TOWN-09), 집 단계·지붕 색(TOWN-07·11), 광장 꾸미기 자리
// 실행: npm run test:game
import { DECO_ASSETS, decoSize } from "../src/lib/art/deco";
import { BOARD_POS, CENTER, CLOTHES_POS, DECO_SLOTS, FARM_POS, FISHING_POS, HOUSE_SLOTS, houseSlot, PLAZA_RADIUS, POND_POS, RING_RADIUS, SALON_POS, SHOP_POS, TOWN_RADIUS, townSpots } from "../src/components/town/layout";
import { BOARD_SIZE, CLOTHES_SIZE, FARM_SIZE, FISHING_SIZE, FOUNTAIN_SIZE, HOUSE_STAGES, houseStage, LAMP_SIZE, SALON_SIZE, SHOP_SIZE, TOWN_ROWS } from "../src/lib/art/town";
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

// TOWN-07 지붕 색: 블로그마다 정해진 순서(10색 모두 한 번씩), 단계 수만큼 열림, 안 골랐으면 첫 색
expect("지붕 색 순서는 10색을 한 번씩", [...roofOrder(7)].sort(), [...ROOF_COLORS].sort());
expect("같은 블로그는 늘 같은 순서", roofOrder(7), roofOrder(7));
expect("블로그마다 첫 색이 고루 나뉨 (1~200번에 8색 이상)", new Set(Array.from({ length: 200 }, (_, i) => roofOrder(i + 1)[0])).size >= 8, true);
expect("1단계 1색, 3단계 3색", [unlockedRoofs(7, 1).length, unlockedRoofs(7, 3).length], [1, 3]);
expect("안 골랐으면 첫 색", currentRoof(7, null), roofOrder(7)[0]);
expect("고른 색", currentRoof(7, "mint"), "mint");
expect("이상한 값은 첫 색", currentRoof(7, "gold"), roofOrder(7)[0]);

// 광장 꾸미기 (사용자 요청 2026-10-09): 자리는 집 단계만큼 열리고, 장식이 건물·길·연못과 겹치지 않는 곳에 있다
expect("꾸미기 자리 수: Lv.1·9 4, Lv.10 6, Lv.20·99 8", [1, 9, 10, 20, 99].map(decorationSlots), [4, 4, 6, 8, 8]);
expect("꾸미기 자리가 열리는 레벨", Array.from({ length: MAX_DECO_SLOTS }, (_, i) => decoSlotLevel(i)), [1, 1, 1, 1, 10, 10, 20, 20]);
expect("꾸미기 자리 8개", DECO_SLOTS.length, MAX_DECO_SLOTS);
expect("꾸미기 자리는 타운 잔디 원 안", DECO_SLOTS.every((p) => Math.hypot(p.x - CENTER.x, p.y - CENTER.y) < TOWN_RADIUS - 60), true);
{
  // 가장 큰 장식이 차지하는 칸 (아랫변 가운데 기준)
  const big = { w: Math.max(...DECO_ASSETS.map((k) => decoSize(k).width)), h: Math.max(...DECO_ASSETS.map((k) => decoSize(k).height)) };
  type Box = { x1: number; y1: number; x2: number; y2: number };
  const box = (x: number, y: number, w: number, h: number): Box => ({ x1: x - w / 2, y1: y - h, x2: x + w / 2, y2: y });
  const overlap = (a: Box, b: Box) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
  const decoBoxes = DECO_SLOTS.map((p) => box(p.x, p.y, big.w, big.h));
  const buildings: [string, Box][] = [
    ["게시판", box(BOARD_POS.x, BOARD_POS.y, BOARD_SIZE.width, BOARD_SIZE.height)],
    ["상점", box(SHOP_POS.x, SHOP_POS.y, SHOP_SIZE.width, SHOP_SIZE.height)],
    ["낚시터", box(FISHING_POS.x, FISHING_POS.y, FISHING_SIZE.width, FISHING_SIZE.height)],
    ["농장", box(FARM_POS.x, FARM_POS.y, FARM_SIZE.width, FARM_SIZE.height)],
    ["미용실", box(SALON_POS.x, SALON_POS.y, SALON_SIZE.width, SALON_SIZE.height)],
    ["옷가게", box(CLOTHES_POS.x, CLOTHES_POS.y, CLOTHES_SIZE.width, CLOTHES_SIZE.height)],
    ["분수", box(CENTER.x, CENTER.y + FOUNTAIN_SIZE.height / 2, FOUNTAIN_SIZE.width, FOUNTAIN_SIZE.height)],
    ["연못", { x1: POND_POS.x - 125, y1: POND_POS.y - 75, x2: POND_POS.x + 125, y2: POND_POS.y + 75 }],
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dy]): [string, Box] => ["가로등", box(CENTER.x + dx * 185, CENTER.y + dy * 185 + 40, LAMP_SIZE.width, LAMP_SIZE.height)]),
  ];
  const hits = decoBoxes.flatMap((d, i) => buildings.filter(([, b]) => overlap(d, b)).map(([name]) => `${i + 1}번-${name}`));
  expect("꾸미기 자리가 건물·연못·가로등과 겹치지 않음", hits, []);
  const pairs = decoBoxes.flatMap((a, i) => decoBoxes.slice(i + 1).flatMap((b, j) => (overlap(a, b) ? [`${i + 1}-${i + j + 2}`] : [])));
  expect("꾸미기 자리끼리 겹치지 않음", pairs, []);
  // 광장에서 집으로 가는 길(폭 54)과 떨어져 있다 (광장 안 자리는 길이 없다)
  const toSegment = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
    const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
    return Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay)));
  };
  const onPath = DECO_SLOTS.flatMap((p, i) =>
    Array.from({ length: HOUSE_SLOTS }, (_, h) => houseSlot(h))
      .filter(() => Math.hypot(p.x - CENTER.x, p.y - CENTER.y) > PLAZA_RADIUS)
      .filter((h) => toSegment(p.x, p.y, CENTER.x + Math.cos(h.angle) * PLAZA_RADIUS, CENTER.y + Math.sin(h.angle) * PLAZA_RADIUS, h.x, h.y) < 27 + big.w / 2)
      .map(() => `${i + 1}번`),
  );
  expect("꾸미기 자리가 집으로 가는 길과 겹치지 않음", onPath, []);

  // 미용실·옷가게 (2026-10-11): 다른 건물·연못과 겹치지 않고, 그림 어느 곳도 집으로 가는 길·둘레 길·광장에 걸치지 않는다
  const shops: [string, Box][] = buildings.filter(([n]) => n === "미용실" || n === "옷가게");
  const others = buildings.filter(([n]) => n !== "미용실" && n !== "옷가게");
  expect("미용실·옷가게가 다른 건물·연못·가로등과 겹치지 않음", shops.flatMap(([a, b]) => others.filter(([, o]) => overlap(b, o)).map(([n]) => `${a}-${n}`)), []);
  expect("미용실과 옷가게가 서로 겹치지 않음", overlap(shops[0][1], shops[1][1]), false);
  const blocked = shops.flatMap(([name, b]) => {
    const hits = new Set<string>();
    for (let x = b.x1; x <= b.x2; x += 6)
      for (let y = b.y1; y <= b.y2 + 30; y += 6) {
        const d = Math.hypot(x - CENTER.x, y - CENTER.y);
        if (d < PLAZA_RADIUS + 42) hits.add("광장");
        if (Math.abs(d - RING_RADIUS) < 38) hits.add("둘레 길");
        for (let h = 0; h < HOUSE_SLOTS; h++) {
          const p = houseSlot(h);
          if (toSegment(x, y, CENTER.x + Math.cos(p.angle) * PLAZA_RADIUS, CENTER.y + Math.sin(p.angle) * PLAZA_RADIUS, p.x, p.y) < 27) hits.add(`${h}번 집 길`);
        }
      }
    return [...hits].map((h) => `${name}-${h}`);
  });
  expect("미용실·옷가게가 길·광장에 걸치지 않음", blocked, []);
  expect("미용실·옷가게는 타운 잔디 원 안", [SALON_POS, CLOTHES_POS].every((p) => Math.hypot(p.x - CENTER.x, p.y - CENTER.y) < TOWN_RADIUS), true);
  const spots = townSpots({ player: null, myHouse: null, neighbors: [], attendanceDay: null, host: null, decorations: [], decoSlots: 0 }).places;
  expect("텔레포트 목록에 미용실·옷가게", spots.filter((p) => p.key === "salon" || p.key === "clothes").map((p) => p.href), ["/salon", "/clothes"]);
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
