// 광장 건물·소품 그림 (도트, 사용자 결정 2026-10-09 "도트로 바꾸기"). Phaser가 이 SVG를 이미지로 바꿔 광장에 놓는다.
// 그림은 pixel.ts의 글자 줄(한 글자 = 한 픽셀)이고, 광장에는 모두 같은 배율 PIXEL(3배)로 그린다.
// *_SIZE는 광장에 놓일 화면 크기(px) = 도트 칸 수 × PIXEL. 그림 SVG도 그 크기 그대로라 Phaser가 키우거나 줄이지 않는다.
import { Pix, PIXEL, roof, spriteSize, spriteSvg, svgDataUri, type Colors, type Sprite } from "./pixel";
import { BOARD, BUSH, SHOP, TREEPINE, TREEROUND } from "./town-sprites";

/** 위아래의 빈 줄을 잘라 낸다 */
function trim(rows: Sprite): string[] {
  const empty = (r: string) => /^\.*$/.test(r);
  let a = 0;
  let b = rows.length;
  while (a < b && empty(rows[a])) a++;
  while (b > a && empty(rows[b - 1])) b--;
  return rows.slice(a, b);
}

/** 도트 그림의 광장 크기 (px) */
function sizeOf(rows: Sprite) {
  const { w, h } = spriteSize(rows);
  return { width: w * PIXEL, height: h * PIXEL };
}

const svg = (rows: Sprite, colors: Colors = {}) => spriteSvg(rows, { scale: PIXEL, colors });

// ===== 집 (단계별 성장, TOWN-11) =====
// 레벨 10마다 한 단계씩 커진다: Lv.1~9 → 1단계 … Lv.90 이상 → 10단계 (사용자 결정 2026-10-09).
// 단계마다 벽이 넓어지고 하나씩 더한다 (창문 → 다락 → 꽃밭 → 울타리 → 2층 → 발코니 → 탑 → 정원 → 금장식).
const HOUSE_STAGE_NAMES = [
  "작은 오두막",
  "창문 많은 집",
  "다락 있는 집",
  "꽃밭 있는 집",
  "울타리 있는 집",
  "2층 집",
  "발코니 있는 집",
  "탑 있는 집",
  "정원 있는 저택",
  "마을 최고 저택",
] as const;
export type HouseStage = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export const MAX_HOUSE_STAGE: HouseStage = 10;
/** 한 단계가 오르는 레벨 간격 */
export const HOUSE_STAGE_LEVELS = 10;

/** 집 주인의 레벨로 정하는 집 단계: 10레벨마다 1단계 (Lv.1~9 → 1, Lv.10~19 → 2, …, Lv.90 이상 → 10) */
export function houseStage(level: number): HouseStage {
  return Math.min(MAX_HOUSE_STAGE, Math.max(1, Math.floor(level / HOUSE_STAGE_LEVELS) + 1)) as HouseStage;
}

/** 지붕 색 코드값(blogs.roof_color, src/lib/blog.ts ROOF_COLORS) → 실제 색 (도트는 ramp()로 3단 명암) */
export const ROOF_HEX = {
  red: "#e0584f",
  orange: "#f08a3c",
  yellow: "#f2c14e",
  green: "#5fb36a",
  sky: "#6cc3e8",
  blue: "#4a7fd6",
  purple: "#9a76d6",
  brown: "#a0704e",
  pink: "#f08fb3",
  mint: "#4fc3a8",
} as const;

// 집 부품 (도장)
const WINDOW: Sprite = ["#######", "#IIwIi#", "#Iiwiv#", "#wwwww#", "#Iiwii#", "#ivwvv#", "#######"];
const FLOWER_BOX: Sprite = ["VzUlVzU", "nbbbbbn"];
const DOOR: Sprite = [
  ".####.",
  "#BbbB#",
  "#BIib#",
  "#Bivb#",
  "#Bbbb#",
  "#Bnnb#",
  "#Bbbz#",
  "#Bbbb#",
  "#Bnnb#",
  "#Bbbb#",
];
const LAMP_SMALL: Sprite = ["#Z#", "#z#", "#u#", "###"];
const FLOWER_BUSH: Sprite = [
  "..#####..",
  ".#LLVLl#.",
  "#LVwVllm#",
  "#LlVlmVm#",
  "#llmmVwV#",
  "#lmmMmVM#",
  ".#######.",
];
const TOPIARY: Sprite = [
  "..####..",
  ".#LLLl#.",
  "#LLllmm#",
  "#Llllmm#",
  "#llmmmM#",
  ".#lmmM#.",
  "..####..",
  "...#n#..",
  "..#bbn#.",
  "..####..",
];
const SPARKLE: Sprite = ["..Z..", ".ZzZ.", "ZzwzZ", ".ZzZ.", "..Z.."];

/** 집 한 채의 도트 그림 (지붕은 1·2·3 칸, 색은 houseSvg가 칠한다) */
function buildHouse(stage: HouseStage): string[] {
  const s = stage;
  const wallW = [34, 38, 40, 42, 44, 46, 48, 50, 52, 56][s - 1];
  const floors = s >= 6 ? 2 : 1;
  const FLOOR = 14;
  const roofH = 14 + (s >= 3 ? 2 : 0) + (s >= 9 ? 2 : 0);
  const side = s >= 5 ? 12 : s >= 4 ? 8 : 4;
  const tower = s >= 8 ? 10 : 0;
  const top = s >= 8 ? 16 : 7; // 굴뚝·깃발·탑 지붕 자리
  const W = wallW + side * 2 + tower;
  const wallsH = FLOOR * floors;
  const H = top + roofH + 1 + wallsH + 3 + 3;
  const p = new Pix(W, H);
  const x0 = side; // 벽 왼쪽
  const x1 = side + wallW - 1; // 벽 오른쪽
  const cx = side + wallW / 2; // 벽 가운데 (반 칸 단위)
  const roofBottom = top + roofH - 1; // 처마 바로 위 줄
  const wallTop = roofBottom + 2;
  const ground = wallTop + wallsH; // 기초 줄
  const gold = s >= 10;

  // 그림자
  p.shadow(W / 2, ground + 3, W / 2 - 1, 2);

  // 8단계: 오른쪽 둥근 탑 (집 뒤에 선다)
  if (tower) {
    const tx = x1 - 3;
    const tw = 14;
    const tTop = 7;
    p.box(tx, tTop + 8, tw, ground - tTop - 8, "c");
    p.rect(tx + 1, tTop + 9, 2, ground - tTop - 10, "w");
    p.rect(tx + tw - 4, tTop + 9, 3, ground - tTop - 10, "d");
    for (const wy of [tTop + 12, tTop + 26]) if (wy + 6 < ground) p.stamp(["#####", "#Iiw#", "#iwv#", "#Iiv#", "#####"], tx + 5, wy);
    if (gold) p.hline(tx, tx + tw - 1, tTop + 22, "z");
    // 뾰족 지붕
    for (let r = 0; r < 9; r++) {
      const half = Math.floor(r * 0.9) + 1;
      const y = tTop + r;
      const mid = tx + tw / 2;
      p.hline(Math.floor(mid - half), Math.ceil(mid + half) - 1, y, "#");
      if (half > 1) p.hline(Math.floor(mid - half) + 1, Math.ceil(mid + half) - 2, y, r % 3 === 0 ? "1" : r % 3 === 1 ? "2" : "3");
    }
    p.hline(tx - 1, tx + tw, tTop + 8, "#");
    // 깃발
    const fx = tx + tw / 2;
    p.vline(fx, tTop - 6, tTop, "#");
    p.stamp(gold ? ["#zz#", "#zZu#", "#zu#"] : ["#22#", "#123#", "#33#"], fx, tTop - 6);
  }

  // 굴뚝 (지붕보다 먼저: 지붕이 아랫부분을 덮는다)
  const chx = Math.round(cx + wallW / 4);
  p.box(chx - 1, top - 1, 6, 2, "x");
  p.box(chx, top, 4, roofH - 4, "y");
  p.vline(chx + 1, top + 1, top + roofH - 6, "Y");

  // 지붕: 아래로 갈수록 넓어지는 사다리꼴. 줄마다 기와(2와 3) → 그늘(3) → 밝은 면(1)
  for (let r = 0; r < roofH; r++) {
    const y = roofBottom - r;
    const half = wallW / 2 + 4 - Math.floor(r / 2);
    const a = Math.round(cx - half);
    const b = Math.round(cx + half) - 1;
    p.hline(a, b, y, "#");
    const k = roofH - 1 - r;
    for (let x = a + 1; x < b; x++) {
      if (r === roofH - 1) continue; // 맨 윗줄은 외곽선
      p.px(x, y, k % 3 === 1 ? ((x + k) % 5 === 0 ? "3" : "2") : k % 3 === 2 ? "3" : "1");
    }
  }
  p.hline(Math.round(cx - wallW / 2 - 4), Math.round(cx + wallW / 2 + 4) - 1, roofBottom + 1, "#");
  if (gold) {
    // 금색 용마루와 처마 띠
    const half = wallW / 2 + 4 - Math.floor((roofH - 1) / 2);
    p.hline(Math.round(cx - half) + 1, Math.round(cx + half) - 2, top + 1, "z");
    p.hline(Math.round(cx - wallW / 2 - 4), Math.round(cx + wallW / 2 + 4) - 1, roofBottom + 1, "u");
  }

  // 3단계: 지붕 위 다락 창
  if (s >= 3) {
    const dx = Math.round(cx) - 4;
    const dy = top + Math.round(roofH / 2) - 3;
    for (let k = 0; k < 5; k++) {
      p.hline(dx + 4 - k, dx + 3 + k, dy + k, "#");
      if (k > 0) p.hline(dx + 5 - k, dx + 2 + k, dy + k, k % 2 ? "2" : "1");
    }
    p.box(dx, dy + 5, 8, 6, "c");
    p.stamp(["####", "#Ii#", "#iv#", "####"], dx + 2, dy + 6);
    if (!tower) {
      // 지붕 꼭대기 깃발
      const fx = Math.round(cx) - 1;
      p.vline(fx, top - 6, top, "#");
      p.stamp(gold ? ["#zz#", "#zZu#", "#zu#"] : ["#zz#", "#zZu#", "#zu#"], fx, top - 6);
    }
  }

  // 벽 (층마다)
  for (let f = 0; f < floors; f++) {
    const y = wallTop + FLOOR * f;
    p.box(x0, y - (f === 0 ? 1 : 0), wallW, FLOOR + (f === 0 ? 1 : 0), "c");
    p.hline(x0 + 1, x1 - 1, y + (f === 0 ? 0 : 0), "d");
    p.vline(x0 + 1, y, y + FLOOR - 1, "B");
    p.vline(x0 + 2, y, y + FLOOR - 1, "b");
    p.vline(x1 - 2, y, y + FLOOR - 1, "b");
    p.vline(x1 - 1, y, y + FLOOR - 1, "n");
    if (f > 0) p.hline(x0, x1, y - 1, gold ? "z" : "#");
    if (f > 0 && gold) p.hline(x0, x1, y, "u");
  }
  const groundFloor = wallTop + FLOOR * (floors - 1);
  // 기초와 계단
  p.box(x0 - 1, ground, wallW + 2, 3, "y");
  p.hline(Math.round(cx) - 4, Math.round(cx) + 3, ground + 1, "Y");

  // 문 (가운데)
  const doorX = Math.round(cx) - 3;
  p.stamp(DOOR, doorX, ground - DOOR.length);
  if (gold) {
    p.hline(doorX - 1, doorX + 6, ground - DOOR.length - 1, "z");
    p.vline(doorX - 1, ground - DOOR.length, ground - 1, "z");
    p.vline(doorX + 6, ground - DOOR.length, ground - 1, "z");
  }

  // 1층 창문: 1단계는 하나 + 문 옆 등, 2단계부터 양쪽, 넓으면 둘씩
  const winY = groundFloor + 3;
  const left = [x0 + 4];
  const right = [x1 - 10];
  if (wallW >= 44) {
    left.push(x0 + 12);
    right.push(x1 - 18);
  }
  const windows = s === 1 ? [x0 + 5] : [...left, ...right];
  for (const wx of windows) {
    p.stamp(WINDOW, wx, winY);
    if (s >= 4) p.stamp(FLOWER_BOX, wx, winY + WINDOW.length);
  }
  if (s === 1) p.stamp(LAMP_SMALL, x1 - 8, winY + 2);
  else p.stamp(LAMP_SMALL, doorX + 7, winY + 3);

  // 2층 창문, 7단계는 가운데가 발코니
  if (floors === 2) {
    const y2 = wallTop + 3;
    for (const wx of [...left, ...right]) p.stamp(WINDOW, wx, y2);
    if (s >= 7) {
      const bx = Math.round(cx) - 6;
      p.stamp([".####.", "#BbbB#", "#BIib#", "#Bivb#", "#Bbbb#", "#Bbbb#", "#Bbbb#"], bx + 3, y2 + 2);
      // 난간
      p.hline(bx, bx + 11, y2 + 8, "#");
      p.hline(bx, bx + 11, y2 + 9, gold ? "z" : "Y");
      for (let x = bx; x <= bx + 11; x += 2) p.vline(x, y2 + 10, y2 + 11, "#");
      p.hline(bx, bx + 11, y2 + 12, "#");
    } else {
      p.stamp(WINDOW, Math.round(cx) - 3, y2);
    }
  }

  // 4단계: 양쪽 꽃덤불
  if (s >= 4) {
    p.stamp(FLOWER_BUSH, x0 - 6, ground - 4);
    p.stamp(FLOWER_BUSH, x1 - 2, ground - 4);
  }
  // 5단계: 흰 울타리 (양옆 앞마당)
  if (s >= 5) {
    const fence = (a: number, b: number) => {
      const y = ground - 1;
      for (let x = a; x <= b; x++) {
        const post = (x - a) % 3 === 0;
        p.px(x, y, post ? "#" : ".");
        p.px(x, y + 1, post ? "w" : "#");
        p.px(x, y + 2, post ? "w" : "Y");
        p.px(x, y + 3, post ? "w" : "#");
        p.px(x, y + 4, "#");
      }
    };
    fence(0, x0 - 3);
    fence(x1 + 3, W - 1 - (tower ? 0 : 0));
  }
  // 9단계: 산울타리 정원과 둥근 나무
  if (s >= 9) {
    p.stamp(TOPIARY, 1, ground - 9);
    p.stamp(TOPIARY, W - 9, ground - 9);
    p.rect(Math.round(cx) - 3, ground + 3, 6, 2, "Y");
    p.hline(Math.round(cx) - 4, Math.round(cx) + 3, ground + 4, "y");
  }
  // 10단계: 반짝이
  if (gold) {
    p.stamp(SPARKLE, 2, top - 4);
    p.stamp(SPARKLE, Math.round(cx) - 16, top + 2);
    p.stamp(SPARKLE, W - 8, top + roofH + 6);
  }
  return p.rows();
}

const HOUSES = Object.fromEntries(([1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as HouseStage[]).map((s) => [s, buildHouse(s)])) as Record<HouseStage, string[]>;

/** 단계별 이름과 광장에 놓을 크기 (px). 단계가 오를수록 눈에 띄게 커진다 */
export const HOUSE_STAGES = Object.fromEntries(
  HOUSE_STAGE_NAMES.map((name, i) => {
    const stage = (i + 1) as HouseStage;
    return [stage, { name, ...sizeOf(HOUSES[stage]) }];
  }),
) as Record<HouseStage, { name: string; width: number; height: number }>;

/** 집 그림. roof = 지붕 색 hex (ROOF_HEX 값) */
export function houseSvg(stage: HouseStage, roofHex: string): string {
  return svg(HOUSES[stage], roof(roofHex));
}

// ===== 빈 집터: 즐겨찾기한 이웃이 없는 자리 =====
const LOT = (() => {
  const p = new Pix(50, 36);
  p.shadow(25, 33, 23, 2);
  p.rect(5, 12, 40, 20, "a");
  for (const [x, y] of [[9, 15], [30, 18], [16, 25], [38, 27], [24, 14], [12, 29]]) p.rect(x, y, 2, 1, "A").px(x + 1, y - 1, "P");
  // 말뚝 울타리 (앞 가운데는 비운다)
  for (const x of [4, 12, 20, 29, 37, 45]) p.box(x, 27, 3, 6, "B");
  for (const y of [11, 19]) {
    p.box(4, y, 3, 6, "B");
    p.box(43, y, 3, 6, "B");
  }
  p.hline(7, 19, 29, "b");
  p.hline(31, 42, 29, "b");
  // 팻말 (집 그림)
  p.box(23, 8, 3, 14, "b");
  p.box(15, 1, 19, 10, "c");
  p.stamp(["...##...", "..#22#..", ".#2222#.", "#222222#", ".#wwww#.", ".#w#bw#.", ".######."], 21, 2);
  return p.rows();
})();
export const LOT_SIZE = sizeOf(LOT);
export function lotSvg(): string {
  return svg(LOT, roof("#c8ad7e"));
}

// ===== 우체통: 집 앞에서 소식 받기 =====
const MAILBOX: Sprite = [
  "........##..",
  "........#zz#",
  "........#zu#",
  ".######.#u#.",
  "#122222##...",
  "#1222222#...",
  "#1######3#..",
  "#1#wwww#3#..",
  "#12222223#..",
  "#12222223#..",
  "#33333333#..",
  ".########...",
  "....#Bn#....",
  "....#bn#....",
  "....#bn#....",
  "....#bn#....",
  "..########..",
  "..#yyyyyx#..",
  ".:::::::::..",
];
export const MAILBOX_SIZE = sizeOf(MAILBOX);
export function mailboxSvg(color = "#e05a4f"): string {
  return svg(MAILBOX, roof(color));
}

// ===== 표지판 =====
const SIGNPOST = (() => {
  const p = new Pix(30, 40);
  p.shadow(15, 38, 10, 1.5);
  p.box(13, 4, 4, 34, "B");
  p.vline(15, 5, 36, "b");
  p.stamp(["######################.", "#iiiiiiiiiiiiiiiiiiiii##", "#iIIiIiiIIiiIiIIiiIiiiv#", "#vvvvvvvvvvvvvvvvvvvvv##", "######################."], 3, 6);
  p.stamp([".######################", "##zzzzzzzzzzzzzzzzzzzzz#", "#ZzZZzzZZzZzzZZzzZzZzzu#", "##uuuuuuuuuuuuuuuuuuuuu#", ".######################"], 3, 15);
  p.box(10, 35, 10, 3, "y");
  return p.rows();
})();
export const SIGNPOST_SIZE = sizeOf(SIGNPOST);
export function signpostSvg(): string {
  return svg(SIGNPOST);
}

// ===== 마을 게시판 (왼쪽 마을 소식 + 오른쪽 출석 도장) =====
const BOARD_ROWS = trim(BOARD);
export const BOARD_SIZE = sizeOf(BOARD_ROWS);
export function boardSvg(): string {
  return svg(BOARD_ROWS);
}

// ===== 상점 (지붕 청록) =====
const SHOP_ROWS = trim(SHOP);
export const SHOP_SIZE = sizeOf(SHOP_ROWS);
export function shopSvg(): string {
  return svg(SHOP_ROWS, { 1: "#8fded2", 2: "#3fae9f", 3: "#2b7380" });
}

// ===== 분수 (광장 한가운데, 사용자 요청 2026-10-11 "분수대 이쁘게 하나") =====
// 3단 돌 분수: 큰 수반 + 가운데 받침 + 중간 접시 + 맨 위 작은 접시와 금빛 봉오리.
// 물(물줄기·흘러내리는 물·물결·반짝임)만 칸마다 조금씩 달라서 3칸을 돌리면 물이 흐른다 (FOUNTAIN_FRAMES).
export const FOUNTAIN_FRAMES = 3;
/** 1초에 바뀌는 칸 수 (Phaser 애니메이션) */
export const FOUNTAIN_FPS = 6;
const FW = 60;
const FH = 52;
/** 물이 지나가는 칸이면 칸 번호에 따라 밝은 물(I)과 보통 물(i)을 번갈아 칠한다 → 아래로 흐르는 것처럼 보인다 */
const flow = (y: number, f: number) => ((y - f + 30) % 3 === 0 ? "I" : "i");

function buildFountain(f: number): string[] {
  const p = new Pix(FW, FH);
  const cx = 30;
  p.shadow(cx, 49, 29, 3);

  // --- 큰 수반: 앞쪽 돌벽(블록 무늬) + 윗면 테두리 ---
  p.ellipse(cx, 42, 29, 7, "#");
  p.rect(1, 34, 58, 8, "#");
  p.ellipse(cx, 42, 28, 6, "y");
  p.rect(2, 34, 56, 8, "y");
  // 왼쪽은 밝게, 오른쪽은 어둡게 (빛이 왼쪽 위에서)
  p.map((c, x, y) => (y >= 34 && c === "y" ? (x < 14 ? "Y" : x > 46 ? "x" : c) : c));
  // 블록 줄눈: 가운데 가로줄 하나, 세로줄은 엇갈리게
  p.map((c, x, y) => (c !== "#" && c !== "." && y === 39 ? "x" : c));
  for (let x = 6; x < 56; x += 8) {
    for (let y = 35; y <= 47; y++) {
      const top = y < 39;
      const xx = top ? x : x + 4;
      if (xx > 1 && xx < 58 && p.get(xx, y) !== "#" && p.get(xx, y) !== ".") p.px(xx, y, top ? "x" : "X");
    }
  }
  // 테두리 윗면
  p.ellipse(cx, 34, 29, 10, "#");
  p.ellipse(cx, 34, 28, 9, "Y");
  p.ellipse(cx, 35, 28, 8, "y");
  p.ellipse(cx, 34, 28, 8, "Y");
  // 물
  p.ellipse(cx, 34, 25, 7, "#");
  p.ellipse(cx, 34.5, 24, 6, "t");
  p.ellipse(cx, 34, 24, 5, "v");
  p.ellipse(cx, 33.5, 21, 4, "i");
  // 물결: 받침에서 퍼지는 둥근 물결 (칸마다 한 걸음씩 커진다)
  for (const r of [9 + f * 5]) {
    for (let a = 0; a < 360; a += 10) {
      const x = Math.round(cx + Math.cos((a * Math.PI) / 180) * r);
      const y = Math.round(34.5 + Math.sin((a * Math.PI) / 180) * r * 0.28);
      const c = p.get(x, y);
      if (c === "i" || c === "v") p.px(x, y, c === "i" ? "I" : "i");
    }
  }
  // 연잎과 분홍 꽃
  p.stamp([".lLl.", "lmlLl", ".mml."], 7, 33);
  p.stamp([".V.", "VwV", ".R."], 8, 31);
  p.stamp([".lLl", "lmml"], 47, 36);
  // 바닥에 던진 동전 (반짝)
  p.px(41, 32, "z").px(17, 37, "z");

  // --- 가운데 받침 (기둥) ---
  p.ellipse(cx, 32, 5, 2, "#");
  p.ellipse(cx, 32, 4, 1, "y");
  p.box(26, 20, 8, 13, "Y");
  p.vline(27, 21, 31, "w");
  p.vline(32, 21, 31, "x");
  p.hline(27, 32, 25, "z");
  p.hline(27, 32, 26, "u");

  // --- 중간 접시 ---
  p.ellipse(cx, 21, 13, 4, "#");
  p.ellipse(cx, 21, 12, 3, "Y");
  p.ellipse(cx, 22.5, 11, 2, "y");
  p.hline(21, 39, 24, "x");
  p.ellipse(cx, 20, 10, 2, "#");
  p.ellipse(cx, 20, 9, 1.5, "v");
  p.hline(23, 37, 20, "i");
  p.hline(26, 29, 19, "I");
  // 접시에서 흘러내리는 물 (가장자리 양쪽 + 앞쪽 두 줄기)
  for (const x of [17, 18, 42, 43]) for (let y = 22; y <= 31; y++) p.px(x + (x < cx ? -Math.floor((y - 22) / 4) : Math.floor((y - 22) / 4)), y, flow(y, f));
  for (const x of [23, 37]) for (let y = 25; y <= 32; y++) p.px(x, y, flow(y + 1, f));
  // 떨어진 자리의 물보라
  for (const x of [14, 46]) p.stamp(f === 1 ? ["I.I", ".i."] : ["...", "IiI"], x - 1, 30);

  // --- 맨 위 작은 접시 ---
  p.box(28, 11, 4, 9, "Y");
  p.vline(31, 12, 18, "x");
  p.ellipse(cx, 11, 7, 2.5, "#");
  p.ellipse(cx, 11, 6, 1.5, "Y");
  p.hline(25, 35, 10, "v");
  p.hline(26, 34, 10, "i");
  for (const x of [23, 37]) for (let y = 13; y <= 18; y++) p.px(x, y, flow(y, f));

  // --- 금빛 봉오리와 솟는 물줄기 ---
  p.stamp([".#z#.", "#zZz#", "#uzu#", ".###."], 28, 6);
  const jetTop = [1, 0, 2][f];
  p.vline(30, jetTop + 1, 6, "i").vline(29, jetTop + 2, 6, "I");
  p.stamp([".I.", "IwI"], 28, jetTop);
  // 튀는 물방울 (칸마다 자리가 다르다)
  const drops: [number, number][][] = [
    [[25, 3], [35, 4], [22, 7]],
    [[26, 2], [34, 2], [38, 7]],
    [[24, 5], [36, 5], [21, 9]],
  ];
  for (const [x, y] of drops[f]) p.px(x, y, "I");
  // 물 위 반짝임
  const sparkle: [number, number][][] = [
    [[12, 30], [44, 33]],
    [[20, 37], [38, 31]],
    [[34, 38], [15, 34]],
  ];
  for (const [x, y] of sparkle[f]) p.px(x, y, "w");
  return p.rows();
}

const FOUNTAIN_ROWS = Array.from({ length: FOUNTAIN_FRAMES }, (_, f) => buildFountain(f));
/** 0번 칸 (그림 검사·크기 계산용) */
const FOUNTAIN = FOUNTAIN_ROWS[0];
export const FOUNTAIN_SIZE = sizeOf(FOUNTAIN);
/** 분수 그림판: 3칸을 가로로 이어 붙인다 (칸 하나 = FOUNTAIN_SIZE) */
export function fountainSheetSvg(): string {
  const rows = FOUNTAIN_ROWS[0].map((_, y) => FOUNTAIN_ROWS.map((frame) => frame[y]).join(""));
  return svg(rows);
}

// ===== 나무 =====
export type TreeKind = "round" | "pine" | "bush" | "blossom";
const TREES: Record<TreeKind, { rows: string[]; colors?: Colors }> = {
  round: { rows: trim(TREEROUND) },
  pine: { rows: trim(TREEPINE) },
  bush: { rows: trim(BUSH) },
  // 벚나무: 둥근 나무를 분홍으로
  blossom: { rows: trim(TREEROUND), colors: { L: "#ffe0ea", l: "#ffb7d0", m: "#f08fb3", M: "#c96a92" } },
};
/** 나무 종류별 광장 크기 (px) */
export function treeSize(kind: TreeKind) {
  return sizeOf(TREES[kind].rows);
}
/** 둥근 나무 크기 (옛 이름, 나무의 대표 크기) */
export const TREE_SIZE = treeSize("round");
export function treeSvg(kind: TreeKind): string {
  return svg(TREES[kind].rows, TREES[kind].colors);
}

// ===== 가로등 =====
const LAMP: Sprite = [
  "....####....",
  "...#XXXX#...",
  "..#XXXXXX#..",
  ".##########.",
  ".#ZZ#ZZ#Zz#.",
  ".#ZZ#Zz#zz#.",
  ".#Zz#zz#zu#.",
  ".##########.",
  "..#XXXXXX#..",
  "....#XX#....",
  "....#Xq#....",
  "....#Xq#....",
  "....#Xq#....",
  "....#Xq#....",
  "....#Xq#....",
  "....#Xq#....",
  "....#Xq#....",
  "....#Xq#....",
  "....#Xq#....",
  "....#Xq#....",
  "....#Xq#....",
  "....#Xq#....",
  "....#Xq#....",
  "....#Xq#....",
  "....#Xq#....",
  "....#Xq#....",
  "....#Xq#....",
  "....#Xq#....",
  "...#XXqq#...",
  "...#XXqq#...",
  "..#XXXqqq#..",
  "..#XXXqqq#..",
  ".##########.",
  ".#xxxxxxxX#.",
  ".##########.",
  "..::::::::..",
];
export const LAMP_SIZE = sizeOf(LAMP);
export function lampSvg(): string {
  return svg(LAMP, { X: "#6b7a8f", q: "#4a5568" });
}

// ===== 동물 농장: 빨간 헛간, 울타리, 건초, 병아리와 아기 돼지 =====
const FARM = (() => {
  const W = 86;
  const H = 56;
  const p = new Pix(W, H);
  p.shadow(W / 2, H - 3, W / 2 - 1, 2.5);
  // 울타리 안 풀밭과 흙길
  p.rect(3, 22, W - 6, 30, "G");
  for (let i = 0; i < 40; i++) p.px(5 + ((i * 37) % (W - 10)), 24 + ((i * 17) % 26), i % 3 ? "e" : "E");
  for (let y = 26; y < 52; y++) {
    const x = Math.round(40 + (52 - y) * 0.9);
    p.rect(x, y, 6, 1, "a").px(x, y, "A");
  }
  // 헛간 (왼쪽 뒤)
  p.box(5, 13, 26, 22, "N");
  for (let x = 8; x < 30; x += 4) p.vline(x, 14, 33, "Q");
  for (let r = 0; r < 12; r++) {
    p.hline(3 + r, 32 - r, 13 - r, "#");
    if (r > 0 && r < 11) p.hline(4 + r, 31 - r, 13 - r, r % 2 ? "Q" : "N");
  }
  p.box(14, 5, 8, 5, "w");
  p.box(11, 21, 14, 14, "w");
  for (let k = 0; k < 12; k++) {
    p.px(12 + k, 22 + k, "#").px(23 - k, 22 + k, "#");
  }
  // 건초 더미
  p.box(33, 27, 11, 7, "z");
  p.hline(34, 42, 29, "u").hline(34, 42, 31, "u");
  p.hline(35, 41, 28, "Z");
  // 여물통
  p.box(64, 36, 12, 5, "b");
  p.hline(65, 74, 37, "v");
  // 뒤 울타리
  const rail = (a: number, b: number, y: number) => {
    p.hline(a, b, y, "#").hline(a, b, y + 1, "B").hline(a, b, y + 2, "#");
    p.hline(a, b, y + 4, "#").hline(a, b, y + 5, "B").hline(a, b, y + 6, "#");
    for (let x = a; x <= b; x += 6) p.box(x, y - 2, 3, 10, "B");
  };
  rail(32, W - 3, 17);
  // 옆 울타리 기둥
  for (const y of [26, 34, 42]) {
    p.box(1, y, 3, 8, "B");
    p.box(W - 4, y, 3, 8, "B");
  }
  // 병아리와 아기 돼지
  p.stamp([".###..", "#zZz#.", "#z#zu#", "#zzz##", ".###.."], 20, 40);
  p.stamp([".######..", "#VVVVVV#.", "#VV#VVVV##", "#VVVVVVRR#", "#RVVVVVV#.", ".#R##R#..", ".##.##..."], 64, 42);
  // 앞 울타리 (가운데는 문 자리)
  rail(1, 36, 46);
  rail(50, W - 2, 46);
  // 간판
  p.box(66, 12, 3, 16, "b");
  p.box(56, 4, 24, 11, "c");
  p.stamp(["..##..##..", ".#VV##VV#.", "#VwVVVVVV#", "#VVVVVVVR#", ".#VVVVVR#.", "..#VVVR#..", "...#RR#...", "....##...."], 63, 5);
  return p.rows();
})();
export const FARM_SIZE = sizeOf(FARM);
export function farmSvg(): string {
  return svg(FARM);
}

/** SVG 문자열 → data URI */
export function toDataUri(svgText: string) {
  return svgDataUri(svgText);
}

// ===== 연못 낚시터 (사용자 요청 2026-10-08): 작은 연못 위 나무 잔교, 파란 오두막, 낚싯대 =====
const FISHING = (() => {
  const W = 82;
  const H = 56;
  const p = new Pix(W, H);
  p.shadow(W / 2, H - 3, W / 2 - 1, 2.5);
  // 연못 (풀 테두리 → 물)
  p.ellipse(50, 40, 31, 14, "l");
  p.ellipse(50, 40, 29, 12, "#");
  p.ellipse(50, 40, 28, 11, "v");
  p.ellipse(50, 39, 27, 10, "i");
  for (const [x, y] of [[32, 37], [58, 44], [48, 34], [66, 38]]) p.hline(x, x + 3, y, "I");
  // 연잎과 꽃
  p.stamp([".##.", "#lm#", "#lV#", ".##."], 70, 41);
  p.stamp([".##.", "#lm#", ".##."], 28, 43);
  // 잔교
  for (let x = 30; x < 70; x += 4) p.box(x, 31, 4, 8, "B").vline(x + 2, 32, 37, "b");
  for (const x of [32, 48, 64]) p.box(x, 38, 3, 6, "n");
  // 오두막 (왼쪽)
  p.box(4, 21, 24, 22, "i");
  p.rect(5, 22, 22, 20, "v");
  for (let x = 6; x < 27; x += 3) p.vline(x, 22, 41, "i");
  for (let r = 0; r < 11; r++) {
    p.hline(2 + r, 29 - r, 21 - r, "#");
    if (r > 0 && r < 10) p.hline(3 + r, 28 - r, 21 - r, r % 2 ? "t" : "T");
  }
  p.stamp(DOOR, 13, 33);
  p.stamp(["#####", "#Iiw#", "#iwv#", "#####"], 6, 26);
  // 물고기 바구니
  p.stamp([".#K#....", "##KN####", "#yyyyyy#", ".#xxxx#.", "..####.."], 56, 23);
  // 낚싯대와 찌
  for (let k = 0; k < 18; k++) p.px(66 + Math.round(k * 0.7), 30 - k, "n");
  for (let y = 13; y < 40; y++) p.px(79, y, "X");
  p.stamp(["#N#", "#w#"], 78, 40);
  // 간판 (물고기 그림)
  p.box(38, 14, 3, 17, "b");
  p.box(30, 6, 19, 10, "c");
  p.stamp(["..####...", ".#iiii#.#", "#iw#iii##", "#iiiiiv#.", ".#vvvv#.#", "..####..."], 35, 8);
  return p.rows();
})();
export const FISHING_SIZE = sizeOf(FISHING);
export function fishingSvg(): string {
  return svg(FISHING);
}

// ===== 미용실·옷가게 (SHOP-07·08, 사용자 요청 2026-10-11) =====
// 2.5D: 지붕 윗면과 앞 벽이 보이고, 돌 기초·계단이 땅에 붙어 있다. 지붕 1·2·3 칸은 가게 색(분홍·민트)으로 칠한다.
// 미용실: 줄무늬 차양, 거울과 의자가 보이는 창, 빙글빙글 이발소 기둥, 가위 간판
// 옷가게: 줄무늬 차양, 원피스 두 벌이 걸린 진열창, 문 옆 마네킹, 옷걸이 간판
function buildBoutique(kind: "salon" | "clothes"): string[] {
  const W = 52;
  const H = 60;
  const p = new Pix(W, H);
  const x0 = 5; // 벽 왼쪽
  const wallW = 42;
  const x1 = x0 + wallW - 1;
  const cx = x0 + wallW / 2;
  const wallTop = 27;
  const ground = 51; // 기초 줄
  p.shadow(W / 2, ground + 4, W / 2 - 1, 2.5);

  // 지붕: 처마가 벽보다 넓고 위로 갈수록 좁다. 맨 앞 두 줄은 처마 끝(그늘), 그 위는 기와 줄무늬 + 밝은 윗면
  const roofH = 17;
  for (let r = 0; r < roofH; r++) {
    const y = wallTop - 2 - r;
    const half = wallW / 2 + 4 - Math.floor(r * 0.55);
    const a = Math.round(cx - half);
    const b = Math.round(cx + half) - 1;
    p.hline(a, b, y, "#");
    if (r === roofH - 1) continue;
    for (let x = a + 1; x < b; x++) p.px(x, y, r < 2 ? "3" : r % 3 === 0 ? ((x + r) % 4 === 0 ? "3" : "2") : r > roofH - 5 ? "1" : (x + r) % 7 === 0 ? "1" : "2");
  }
  p.hline(Math.round(cx - wallW / 2 - 4), Math.round(cx + wallW / 2 + 4) - 1, wallTop - 1, "#");
  // 지붕 위 굴뚝 / 둥근 간판
  p.box(x1 - 9, wallTop - 20, 5, 6, "x");
  p.rect(x1 - 8, wallTop - 19, 1, 4, "Y");
  p.oval(cx, wallTop - 10, 8, 6, "c");
  p.ellipse(cx, wallTop - 10, 6, 4, "w");
  if (kind === "salon") {
    // 가위
    p.stamp(["#..#..", "##.##.", ".###..", "..#...", ".#V#..", "#V.V#.", ".#.#.."].map((r) => r.replace(/V/g, "R")), Math.round(cx) - 3, wallTop - 14);
  } else {
    // 옷걸이에 걸린 원피스
    p.stamp(["...##...", "..#..#..", ".######.", ".#5555#.", "..#55#..", ".#5445#.", "#555555#", "########"], Math.round(cx) - 4, wallTop - 15);
  }

  // 벽: 크림색 판자, 양쪽 나무 기둥, 오른쪽은 그늘
  p.box(x0, wallTop, wallW, ground - wallTop, "c");
  p.hline(x0 + 1, x1 - 1, wallTop + 1, "d");
  for (let y = wallTop + 4; y < ground; y += 4) p.hline(x0 + 3, x1 - 3, y, "d");
  p.rect(x0 + 1, wallTop + 1, 2, ground - wallTop - 1, "B");
  p.vline(x0 + 2, wallTop + 1, ground - 1, "b");
  p.rect(x1 - 2, wallTop + 1, 2, ground - wallTop - 1, "b");
  p.vline(x1 - 1, wallTop + 1, ground - 1, "n");

  // 진열창 (왼쪽 큰 창)
  const wx = x0 + 4;
  const wy = wallTop + 8;
  p.box(wx, wy, 20, 13, "i");
  p.rect(wx + 1, wy + 1, 18, 11, "I");
  for (let k = 0; k < 4; k++) p.px(wx + 3 + k, wy + 2 + k, "w");
  if (kind === "salon") {
    // 거울(타원)과 빨간 의자
    p.oval(wx + 6, wy + 5, 3, 4, "i");
    p.ellipse(wx + 6, wy + 5, 2, 3, "w");
    p.stamp([".####.", "#NNNN#", "#NQQN#", "######", ".#..#.", ".#..#."], wx + 11, wy + 5);
    p.stamp(["#z#", "#u#"], wx + 2, wy + 9);
  } else {
    // 마네킹 두 개에 원피스
    p.stamp(["..##..", ".#yy#.", "..##..", ".#VV#.", "#VVVR#", "#VRVR#", "######", "..#...", "..#..."], wx + 2, wy + 2);
    p.stamp(["..##..", ".#yy#.", "..##..", ".#zz#.", "#zZzu#", "#zzZu#", "######", "...#..", "...#.."], wx + 11, wy + 2);
  }
  p.hline(wx, wx + 19, wy + 13, "#").hline(wx, wx + 19, wy + 14, "B").hline(wx + 1, wx + 18, wy + 15, "b");
  // 꽃 상자
  p.stamp(["VzUlVzUlVzUlVzUlVzUl", "nbbbbbbbbbbbbbbbbbbn"], wx, wy + 16);
  // 줄무늬 차양 (창 위, 앞으로 튀어나온 면 + 늘어진 끝)
  for (let x = wx - 2; x <= wx + 21; x++) {
    const stripe = Math.floor((x - wx + 2) / 3) % 2 === 0;
    p.px(x, wy - 4, "#");
    p.px(x, wy - 3, stripe ? "2" : "w");
    p.px(x, wy - 2, stripe ? "2" : "w");
    p.px(x, wy - 1, stripe ? "3" : "Y");
    if ((x - wx + 2) % 3 === 1) p.px(x, wy, stripe ? "3" : "y");
  }
  p.vline(wx - 3, wy - 4, wy - 1, "#").vline(wx + 22, wy - 4, wy - 1, "#");

  // 문 (오른쪽): 유리창 달린 두 짝 문, 위에 작은 차양
  const dx = x1 - 17;
  const dTop = ground - 14;
  p.box(dx, dTop, 10, 14, "b");
  p.rect(dx + 1, dTop + 1, 8, 13, "B");
  p.vline(dx + 5, dTop + 1, ground - 1, "n");
  p.box(dx + 1, dTop + 2, 4, 5, "i").box(dx + 5, dTop + 2, 4, 5, "i");
  p.px(dx + 2, dTop + 3, "I").px(dx + 6, dTop + 3, "I");
  p.px(dx + 4, dTop + 9, "z").px(dx + 6, dTop + 9, "z");
  for (let x = dx - 1; x <= dx + 10; x++) {
    p.px(x, dTop - 2, "#");
    p.px(x, dTop - 1, (x - dx) % 2 ? "2" : "1");
  }
  if (kind === "salon") {
    // 이발소 기둥: 빨강·흰·파랑 줄이 비스듬히
    const px = x1 - 5;
    p.box(px, wallTop + 5, 4, ground - wallTop - 6, "w");
    for (let y = wallTop + 6; y < ground - 2; y++)
      for (let i = 1; i <= 2; i++) {
        const k = Math.floor((y + i) / 2) % 3;
        p.px(px + i, y, k === 0 ? "N" : k === 1 ? "w" : "v");
      }
    p.box(px - 1, wallTop + 3, 6, 3, "z");
    p.box(px - 1, ground - 2, 6, 3, "z");
  } else {
    // 문 옆 옷걸이 (셔츠 두 벌)
    const px = x1 - 5;
    p.vline(px + 2, wallTop + 5, ground - 1, "n");
    p.hline(px - 1, px + 5, wallTop + 5, "n");
    p.stamp(["#..#", "#55#", "#45#", "####"], px - 1, wallTop + 7);
    p.stamp(["#..#", "#NK#", "#NN#", "####"], px + 3, wallTop + 7);
  }

  // 돌 기초와 앞 계단 (땅에 붙는다)
  p.box(x0 - 1, ground, wallW + 2, 3, "y");
  p.hline(x0, x1, ground + 1, "Y");
  p.box(dx - 1, ground + 2, 12, 3, "x");
  p.hline(dx, dx + 9, ground + 3, "y");
  // 앞 화분 둘
  p.stamp([".#VV#.", "#VlVl#", ".####.", ".#bb#.", ".####."], x0 - 3, ground - 3);
  p.stamp([".#Ul#.", "#lUlV#", ".####.", ".#bb#.", ".####."], x1 - 1, ground - 3);
  return p.rows();
}
const SALON = buildBoutique("salon");
const CLOTHES = buildBoutique("clothes");
export const SALON_SIZE = sizeOf(SALON);
export const CLOTHES_SIZE = sizeOf(CLOTHES);
export function salonSvg(): string {
  return svg(SALON, roof("#f07fa8"));
}
export function clothesSvg(): string {
  return svg(CLOTHES, { ...roof("#45bf9c"), 4: "#ffd0e0", 5: "#ff9ec3" });
}

/** 미리보기·시험용: 그림 글자 줄 */
export const TOWN_ROWS = { houses: HOUSES, lot: LOT, mailbox: MAILBOX, signpost: SIGNPOST, board: BOARD_ROWS, shop: SHOP_ROWS, fountain: FOUNTAIN, lamp: LAMP, farm: FARM, fishing: FISHING, salon: SALON, clothes: CLOTHES };
