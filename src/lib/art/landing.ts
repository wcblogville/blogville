// 첫 화면(로그인·회원가입) 도트 그림 (2026-10-11 사용자 요청 "첫 화면도 도트로").
// 광장과 같은 팔레트·글자 줄(pixel.ts)로 그린다. 화면에는 모두 PIXEL(3)배, 제목 글자만 크게 보이도록 다른 정수배로 키운다.
// - 제목 BLOGVILLE: 6×8 칸 굵은 도트 글자 + 외곽선 + 아래로 두께 (게임 로고 느낌)
// - 하늘의 구름, 멀리 보이는 언덕(가로로 이어 붙임), 잔디·흙길·울타리 타일
// 건물·나무·캐릭터·동물은 광장·상점 그림(town.ts, characters.ts, animals.ts)을 그대로 쓴다.
import { EDGE, Pix, PIXEL, spriteSize, spriteSvg, svgDataUri, TILES, type Colors, type Sprite } from "./pixel";

// 팔레트에 없는 색은 비어 있는 글자에 붙여 쓴다 (pixel.ts PALETTE에 없는 글자: 0 7 9 k o r 등)
const SKY_COLORS: Colors = {
  "0": "#d6ecfa", // 구름 아랫면
  "7": "#b7dcc0", // 먼 언덕
  "9": "#8fcf86", // 가까운 언덕
  k: "#74b86f", // 가까운 언덕 그늘
  o: "#5a9e62", // 언덕 위 나무
  r: "#3f7f50", // 언덕 위 나무 그늘
};

// ===== 제목 글자 (6칸 너비, I만 4칸, 8줄) =====
const GLYPHS: Record<string, Sprite> = {
  B: ["ooooo.", "oo..oo", "oo..oo", "ooooo.", "oo..oo", "oo..oo", "oo..oo", "ooooo."],
  L: ["oo....", "oo....", "oo....", "oo....", "oo....", "oo....", "oo....", "oooooo"],
  O: [".oooo.", "oo..oo", "oo..oo", "oo..oo", "oo..oo", "oo..oo", "oo..oo", ".oooo."],
  G: [".oooo.", "oo..oo", "oo....", "oo....", "oo.ooo", "oo..oo", "oo..oo", ".ooooo"],
  V: ["oo..oo", "oo..oo", "oo..oo", "oo..oo", "oo..oo", ".oooo.", ".oooo.", "..oo.."],
  I: ["oooo", ".oo.", ".oo.", ".oo.", ".oo.", ".oo.", ".oo.", "oooo"],
  E: ["oooooo", "oo....", "oo....", "ooooo.", "oo....", "oo....", "oo....", "oooooo"],
};

/** 글자 앞면 색: 위는 밝은 금색, 아래로 갈수록 짙은 금색 (줄마다) */
const FACE = ["Z", "Z", "z", "z", "z", "z", "u", "u"];
/** 두께(아래로 2칸): 나무색 */
const DEPTH = ["b", "n"];

function titleRows(text: string): string[] {
  const glyphs = [...text].map((c) => GLYPHS[c]);
  const gap = 1;
  const inner = glyphs.reduce((w, g) => w + spriteSize(g).w, 0) + gap * (glyphs.length - 1);
  const p = new Pix(inner + 2, 8 + DEPTH.length + 2);
  const each = (fn: (x: number, y: number) => void) => {
    let left = 1;
    for (const g of glyphs) {
      g.forEach((row, y) => [...row].forEach((c, x) => c === "o" && fn(left + x, 1 + y)));
      left += spriteSize(g).w + gap;
    }
  };
  // 아래 칸부터 두께를 쌓고 앞면을 덮는다
  for (let d = DEPTH.length; d >= 1; d--) each((x, y) => p.px(x, y + d, DEPTH[d - 1]));
  each((x, y) => p.px(x, y, FACE[y - 1]));
  // 글자 획 왼쪽 위 모서리에 반짝이는 칸
  each((x, y) => {
    if (p.get(x - 1, y) !== FACE[y - 1] && p.get(x, y - 1) !== FACE[y - 2] && y - 1 < 4) p.px(x, y, "w");
  });
  return p.outline().rows();
}

const TITLE = titleRows("BLOGVILLE");
/** 제목 크기 (칸). 화면에는 정수배로 키운다 */
export const TITLE_SIZE = spriteSize(TITLE);
/** 제목 그림 (scale = 정수 배율) */
export function titleDataUri(scale: number) {
  return svgDataUri(spriteSvg(TITLE, { scale }));
}

// ===== 구름 =====
function cloudRows(w: number, h: number, bumps: [number, number, number][]): string[] {
  const p = new Pix(w, h);
  for (const [cx, cy, r] of bumps) p.ellipse(cx, cy, r, r * 0.85, "I");
  // 아랫면은 연한 하늘색, 바닥은 평평하게
  p.map((c, _x, y) => (c === "I" && y >= h - 3 ? "0" : c));
  p.map((c, x, y) => (c === "I" && p.get(x, y - 1) === "." ? "w" : c));
  return p.rows();
}
const CLOUDS = {
  big: cloudRows(44, 16, [[10, 11, 6], [19, 8, 8], [29, 9, 7], [37, 12, 5]]),
  small: cloudRows(28, 11, [[7, 7, 4.5], [14, 5, 5.5], [21, 7, 4.5]]),
};
export type CloudKind = keyof typeof CLOUDS;
export function cloudSize(kind: CloudKind) {
  const { w, h } = spriteSize(CLOUDS[kind]);
  return { width: w * PIXEL, height: h * PIXEL };
}
export function cloudDataUri(kind: CloudKind) {
  return svgDataUri(spriteSvg(CLOUDS[kind], { colors: SKY_COLORS }));
}

// ===== 먼 언덕 (가로로 이어 붙인다: 오른쪽 끝과 왼쪽 끝이 맞물린다) =====
export const HILLS_SIZE = { w: 192, h: 44 };
const HILLS = (() => {
  const { w: W, h: H } = HILLS_SIZE;
  const p = new Pix(W, H);
  // 둘레를 넘어가는 그림은 반대편에도 그린다
  const wrap = (fn: (dx: number) => void) => [-W, 0, W].forEach(fn);
  for (const [cx, cy, rx, ry] of [[20, 26, 46, 20], [96, 22, 40, 22], [160, 28, 44, 18]])
    wrap((dx) => p.ellipse(cx + dx, cy, rx, ry, "7"));
  // 먼 언덕의 위쪽 테두리를 한 칸 밝게
  p.map((c, x, y) => (c === "7" && p.get(x, y - 1) === "." ? "I" : c));
  for (const [cx, cy, rx, ry] of [[58, 40, 52, 18], [140, 42, 56, 16], [0, 44, 30, 12]])
    wrap((dx) => p.ellipse(cx + dx, cy, rx, ry, "9"));
  // 가까운 언덕 위 동글동글한 나무들
  for (const [x, y] of [[30, 26], [37, 25], [44, 27], [112, 29], [118, 28], [176, 35], [183, 34]])
    wrap((dx) => {
      p.ellipse(x + dx, y, 3.5, 3.5, "o").ellipse(x + dx - 0.5, y + 1, 2.5, 2.5, "o");
      p.px(x + dx - 1, y - 2, "9").px(x + dx + 1, y + 2, "r").px(x + dx + 2, y + 1, "r");
    });
  // 풀 포기 (자리마다 고정된 흩어진 무늬. 줄무늬가 생기지 않게 곱한 값을 크게 섞는다)
  p.map((c, x, y) => (c === "9" && ((x * 73856093) ^ (y * 19349663)) % 23 === 0 && y < H - 2 ? "k" : c));
  p.rect(0, H - 1, W, 1, "9");
  return p.rows();
})();
export function hillsDataUri() {
  return svgDataUri(spriteSvg(HILLS, { colors: SKY_COLORS }));
}

// ===== 잔디 (16칸 타일 3종을 3×3으로 섞은 큰 타일) =====
const LAWN = (() => {
  const { grass, grass2, grassFlowers } = TILES;
  const order = [grass, grass2, grass, grassFlowers, grass, grass2, grass2, grass, grassFlowers];
  const p = new Pix(48, 48);
  order.forEach((t, i) => p.stamp(t, (i % 3) * 16, Math.floor(i / 3) * 16));
  return p.rows();
})();
export const LAWN_PX = 48 * PIXEL;
export function lawnDataUri() {
  return svgDataUri(spriteSvg(LAWN));
}

// ===== 흙길 (가로로 이어지는 길. 위아래 가장자리에 풀이 덮인다) =====
const ROAD = (() => {
  const p = new Pix(16, 24);
  p.stamp(TILES.path, 0, 0).stamp(TILES.path, 0, 16);
  p.stamp(EDGE, 0, 0);
  p.stamp([...EDGE].reverse(), 0, 20);
  return p.rows();
})();
export const ROAD_PX = { w: 16 * PIXEL, h: 24 * PIXEL };
export function roadDataUri() {
  return svgDataUri(spriteSvg(ROAD));
}

// ===== 나무 울타리 (가로로 이어 붙인다) =====
const FENCE = (() => {
  const p = new Pix(16, 16);
  p.shadow(8, 15, 8, 1);
  // 가로대 두 줄
  for (const y of [4, 9]) {
    p.rect(0, y, 16, 3, "#").rect(0, y + 1, 16, 1, "B");
  }
  // 말뚝 하나 (끝이 뾰족)
  p.rect(5, 1, 5, 14, "#").rect(6, 2, 3, 12, "B").rect(8, 2, 1, 12, "b");
  p.px(5, 1, ".").px(9, 1, ".").rect(6, 0, 3, 1, "#").px(7, 1, "B");
  return p.rows();
})();
export const FENCE_PX = { w: 16 * PIXEL, h: 16 * PIXEL };
export function fenceDataUri() {
  return svgDataUri(spriteSvg(FENCE));
}

// ===== 작은 아이콘 (2배): 집 =====
const HOUSE_ICON: Sprite = [
  "....##....",
  "...#22#...",
  "..#2222#..",
  ".#222222#.",
  "#22222222#",
  ".#cccccc#.",
  ".#c##ccc#.",
  ".#cbbcii#.",
  ".#cbbcii#.",
  ".########.",
];
export function houseIconDataUri() {
  return svgDataUri(spriteSvg(HOUSE_ICON, { scale: 2 }));
}
