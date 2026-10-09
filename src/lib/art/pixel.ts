// 도트(픽셀 아트) 그림 도구 (사용자 결정 2026-10-09 "도트로 바꾸기").
// - 그림은 "팔레트 + 글자 줄" 데이터다. 한 글자 = 한 픽셀, "." = 투명. 외부 그림 파일은 쓰지 않는다.
// - spriteSvg()는 한 줄에서 같은 색이 이어진 칸을 <rect> 하나로 합쳐 SVG를 만든다 (shape-rendering="crispEdges").
// - 화면에는 정수 배(광장은 PIXEL = 3배)로만 키운다. 그래야 픽셀이 흐려지지 않는다.
// - 바꿔 칠하는 칸: 지붕 "1·2·3"(밝은 면·기본·그늘), 옷 "4·5·6". 다른 글자도 colors 옵션으로 바꿀 수 있다.
// - 크기: 캐릭터 16×24, 바닥 타일 16×16, 건물은 40~90칸. 광장에서는 모두 같은 배율(PIXEL)로 그린다.

/** 광장에서 도트 한 칸이 차지하는 화면 픽셀 (모든 광장 그림이 같은 배율) */
export const PIXEL = 3;

export type Sprite = readonly string[];
export type Colors = Readonly<Record<string, string>>;

// ===== 팔레트 (따뜻하고 부드러운 색, 외곽선은 사이트와 같은 짙은 갈색) =====
// 재질마다 밝은 면 · 기본 · 그늘 3단. 그늘은 살짝 푸른 쪽, 밝은 면은 노란 쪽으로 기울였다.
export const PALETTE: Colors = {
  "#": "#4a3426", // 외곽선·눈
  w: "#fffaf0", // 흰색 (따뜻한 흰색)
  ":": "#3a2a1e38", // 그림자 (반투명)
  // 피부
  f: "#ffdcbf",
  g: "#f2b896",
  p: "#ff9eaa", // 볼터치
  // 머리카락 (갈색)
  H: "#b57a4c",
  h: "#8a5434",
  j: "#5f3522",
  // 나무 판자·줄기
  B: "#dba46a",
  b: "#ad7445",
  n: "#7a4a2e",
  // 크림색 벽
  c: "#f6e0b8",
  d: "#dcbc8c",
  // 돌
  Y: "#f1ebe2",
  y: "#d9cdbf",
  x: "#b5a493",
  X: "#8f7d6e",
  // 나뭇잎
  L: "#a8d86c",
  l: "#64b85a",
  m: "#3e9152",
  M: "#2b6b4a",
  // 잔디 바닥
  G: "#b2e09c",
  e: "#9cdb94",
  E: "#80c77a",
  // 흙길
  P: "#f3e6c8",
  a: "#e2cc9c",
  A: "#c8ad7e",
  // 유리·물
  I: "#effbff",
  i: "#a9def5",
  v: "#6db2d6",
  // 금색
  Z: "#fff0a8",
  z: "#ffd36e",
  u: "#d99a36",
  // 빨강 (차양·사과·우체통)
  K: "#ff8b78",
  N: "#e05a4f",
  Q: "#a8403f",
  // 꽃
  V: "#ff9cc0",
  R: "#e0607f",
  U: "#b79cff",
  // 남색 (바지·신발)
  T: "#7f91c9",
  t: "#56649e",
  q: "#3b4473",
  // 바꿔 칠하는 칸 기본값: 지붕 = 빨강, 옷 = 하늘색
  1: "#f4896b",
  2: "#d9574a",
  3: "#9e3b45",
  4: "#a8d8f8",
  5: "#6cb4ee",
  6: "#4a86c8",
};

// ===== 색 계산 =====
function toHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1, 7), 16);
  const [r, g, b] = [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function toHex(h: number, s: number, l: number) {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return `#${[f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
/** 색상환에서 target 쪽으로 최대 step도 돌린다 */
function turn(h: number, target: number, step: number) {
  const d = ((target - h + 540) % 360) - 180;
  return (h + Math.sign(d) * Math.min(Math.abs(d), step) + 360) % 360;
}

/** 아무 색 하나로 3단 명암 [밝은 면, 기본, 그늘]을 만든다. 밝은 면은 노란 쪽, 그늘은 푸른 쪽으로 기울이고 채도를 조금 낮춘다 */
export function ramp(hex: string): [string, string, string] {
  const [h, s, l] = toHsl(hex);
  const soft = Math.min(s, 0.78);
  return [
    toHex(turn(h, 55, 10), soft * 0.85, Math.min(0.9, l + 0.14)),
    hex,
    toHex(turn(h, 250, 12), soft * (l > 0.7 ? 0.62 : 0.9), Math.max(0.13, l - (l > 0.7 ? 0.24 : 0.16))),
  ];
}

/** 지붕 색 바꾸기: roof("#4a7fd6") → { 1, 2, 3 } (ramp로 3단 명암) */
export function roof(hex: string): Colors {
  const [a, b, c] = ramp(hex);
  return { 1: a, 2: b, 3: c };
}
/** 옷 색 바꾸기: outfit("#ff8a65") → { 4, 5, 6 } */
export function outfit(hex: string): Colors {
  const [a, b, c] = ramp(hex);
  return { 4: a, 5: b, 6: c };
}

// ===== 그리기 =====
/** 그림 크기 (픽셀 칸 수) */
export function spriteSize(rows: Sprite) {
  return { w: rows[0]?.length ?? 0, h: rows.length };
}

// 반투명 색(#rrggbbaa)은 fill-opacity로 나눈다
function fillAttr(color: string) {
  if (color.length === 9) return `fill="${color.slice(0, 7)}" fill-opacity="${(parseInt(color.slice(7), 16) / 255).toFixed(2)}"`;
  return `fill="${color}"`;
}

/**
 * 그림 조각 SVG (1픽셀 = 1단위). 같은 색 칸을 <path> 하나로 모으고, 한 줄에서 이어진 칸은 사각형 하나(M x y h 길이 v1 h-길이 z)로 그린다.
 * <rect>를 칸마다 쓰는 것보다 훨씬 짧아 헤더·목록처럼 캐릭터가 많이 나오는 화면도 가볍다. 모르는 글자는 그리지 않는다
 */
export function spriteRects(rows: Sprite, colors: Colors = {}, dx = 0, dy = 0): string {
  const paths = new Map<string, string>();
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      const ch = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      const color = ch === "." ? undefined : (colors[ch] ?? PALETTE[ch]);
      if (color) paths.set(color, `${paths.get(color) ?? ""}M${x + dx} ${y + dy}h${end - x}v1h-${end - x}z`);
      x = end;
    }
  });
  let out = "";
  for (const [color, d] of paths) out += `<path ${fillAttr(color)} d="${d}"/>`;
  return out;
}

/**
 * 그림 하나를 SVG 문자열로. scale은 정수 배율, colors는 바꿔 칠할 색.
 * frame: 그림 둘레에 둘 빈칸 (정사각형 틀 등). 단위는 도트 칸
 */
export function spriteSvg(
  rows: Sprite,
  { scale = PIXEL, colors = {}, pad = { x: 0, y: 0 } }: { scale?: number; colors?: Colors; pad?: { x: number; y: number } } = {},
) {
  const { w, h } = spriteSize(rows);
  const W = w + pad.x * 2;
  const H = h + pad.y * 2;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad.x} ${-pad.y} ${W} ${H}" width="${W * scale}" height="${H * scale}" shape-rendering="crispEdges">` +
    `${spriteRects(rows, colors)}</svg>`
  );
}

/** SVG → data URI. 꼭 필요한 글자(%, #, <, > 등)만 바꿔 encodeURIComponent보다 짧게 만든다 (따옴표는 작은따옴표로) */
export function svgDataUri(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${svg.replace(/"/g, "'").replace(/[%#<>?&\n]/g, encodeURIComponent)}`;
}

/** 위 그림의 "."이 아닌 칸으로 아래 그림을 덮는다 (크기는 아래 그림). x, y = 위 그림을 놓을 칸 */
export function overlay(base: Sprite, top: Sprite, x = 0, y = 0): string[] {
  const out = base.map((r) => r.split(""));
  top.forEach((row, ty) => {
    const line = out[ty + y];
    if (!line) return;
    for (let tx = 0; tx < row.length; tx++) {
      if (row[tx] !== "." && tx + x >= 0 && tx + x < line.length) line[tx + x] = row[tx];
    }
  });
  return out.map((r) => r.join(""));
}

/** 좌우 뒤집기 */
export function flipX(rows: Sprite): string[] {
  return rows.map((r) => [...r].reverse().join(""));
}

/** 글자 바꾸기 (예: 눈을 지우거나 색 칸을 다른 칸으로) */
export function swap(rows: Sprite, map: Readonly<Record<string, string>>): string[] {
  return rows.map((r) => [...r].map((c) => map[c] ?? c).join(""));
}

/**
 * 도트 도화지: 사각형·타원·그림 도장으로 큰 그림(집·건물)을 짠다.
 * 모든 좌표는 정수 칸. 밖으로 나간 칸은 버린다
 */
export class Pix {
  readonly w: number;
  readonly h: number;
  private cells: string[][];

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.cells = Array.from({ length: h }, () => Array<string>(w).fill("."));
  }

  get(x: number, y: number) {
    return this.cells[y]?.[x] ?? ".";
  }

  px(x: number, y: number, c: string) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.cells[y][x] = c;
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: string) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, c);
    return this;
  }

  /** 외곽선(#) 두른 사각형 */
  box(x: number, y: number, w: number, h: number, fill: string, line = "#") {
    this.rect(x, y, w, h, line);
    if (w > 2 && h > 2) this.rect(x + 1, y + 1, w - 2, h - 2, fill);
    return this;
  }

  hline(x1: number, x2: number, y: number, c: string) {
    return this.rect(Math.min(x1, x2), y, Math.abs(x2 - x1) + 1, 1, c);
  }

  vline(x: number, y1: number, y2: number, c: string) {
    return this.rect(x, Math.min(y1, y2), 1, Math.abs(y2 - y1) + 1, c);
  }

  /** 채운 타원 (가운데 cx, cy는 .5 단위도 된다) */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: string) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.px(x, y, c);
      }
    return this;
  }

  /** 외곽선 두른 타원 */
  oval(cx: number, cy: number, rx: number, ry: number, fill: string, line = "#") {
    this.ellipse(cx, cy, rx, ry, line);
    return this.ellipse(cx, cy, rx - 1, ry - 1, fill);
  }

  /** 그림 도장 ("."은 건너뛴다) */
  stamp(rows: Sprite, x: number, y: number) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) if (row[i] !== ".") this.px(x + i, y + j, row[i]);
    });
    return this;
  }

  /** 조건에 맞는 칸만 바꾼다 (예: 벽에 판자 무늬) */
  map(fn: (c: string, x: number, y: number) => string) {
    this.cells = this.cells.map((row, y) => row.map((c, x) => fn(c, x, y)));
    return this;
  }

  /** 투명 칸 중 그림과 맞닿은 칸에 외곽선을 두른다 (그림자 ":"는 빼고) */
  outline(line = "#") {
    const solid = (x: number, y: number) => {
      const c = this.get(x, y);
      return c !== "." && c !== ":" && c !== line;
    };
    const add: [number, number][] = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const c = this.get(x, y);
        if (c !== "." && c !== ":") continue;
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) add.push([x, y]);
      }
    for (const [x, y] of add) this.px(x, y, line);
    return this;
  }

  /** 바닥 그림자: (cx, y)에 납작한 반투명 타원. 이미 칠한 칸은 덮지 않는다 */
  shadow(cx: number, y: number, rx: number, ry = 2) {
    for (let j = Math.floor(y - ry); j <= Math.ceil(y + ry); j++)
      for (let i = Math.floor(cx - rx); i <= Math.ceil(cx + rx); i++) {
        const dx = (i + 0.5 - cx) / rx;
        const dy = (j + 0.5 - y) / ry;
        if (dx * dx + dy * dy <= 1 && this.get(i, j) === ".") this.px(i, j, ":");
      }
    return this;
  }

  rows(): string[] {
    return this.cells.map((r) => r.join(""));
  }
}

// ===== 바닥 타일 16×16 (광장 바닥, scene.ts가 한 번 구워 쓴다) =====
export const TILE = 16;
export const TILES = {
  // 잔디
  grass: [
    "eeeeeeeeeeeeeeee",
    "eeeeeeeeeeeGeeee",
    "eeEeEeeeeeeeeeee",
    "eeeEeeeeeeeeeeee",
    "eeeeeeeeeeeeeeee",
    "eeeeeeeeeeEeEeee",
    "eeeeeGeeeeeEeeee",
    "eeeeeeeeeeeeeeee",
    "eeeeeeeeeeeeeeee",
    "eGeeeeeeeeeeeeee",
    "eeeeeeeEeEeeeeee",
    "eeeeeeeeEeeeeeGe",
    "eeeeeeeeeeeeeeee",
    "eeeEeEeeeeeeeeee",
    "eeeeEeeeeeeEeEee",
    "eeeeeeeeeeeeEeee",
  ],
  // 잔디 2 (풀 포기 위치만 다르다)
  grass2: [
    "eeeeeeeeeeeeeeee",
    "eeeeeEeEeeeeeeee",
    "eeeeeeEeeeeeeeee",
    "eeeeeeeeeeeeGeee",
    "eGeeeeeeeeeeeeee",
    "eeeeeeeeeEeEeeee",
    "eeeeeeeeeeEeeeee",
    "eeeeeeeeeeeeeeee",
    "eeeEeEeeeeeeeeee",
    "eeeeEeeeeeeeeeGe",
    "eeeeeeeeeeeeeeee",
    "eeeeeeeeeeeeeeee",
    "eeeeeeeGeeeeEeEe",
    "eeeeeeeeeeeeeEee",
    "eEeEeeeeeeeeeeee",
    "eeEeeeeeeeeeeeee",
  ],
  // 꽃 핀 잔디
  grassFlowers: [
    "eeeeeeeeeeeeeeee",
    "eeeeeeeeeeeGeeee",
    "eeEeEeeeeeeeeeee",
    "eeeEeeeeeeeweeee",
    "eeeeeeeeeewzweee",
    "eeeeeeeeeeeweeee",
    "eeeeeGeeeeeEeeee",
    "eeeeeeeeeeeeeeee",
    "eeeeeeeeeeeeeeee",
    "eGeeVeeeeeeeeeee",
    "eeeVzVeEeEeeeeee",
    "eeeeVeeeEeeeeeGe",
    "eeeeEeeeeeeeeeee",
    "eeeEeEeeeeeeeeee",
    "eeeeeeeeeeeEeEee",
    "eeeeeeeeeeeeEeee",
  ],
  // 흙길
  path: [
    "aaaaaaaaaaaaaaaa",
    "aaaaaaaaaaaaaaaa",
    "aaaPAaaaaaaaaaaa",
    "aaaAAaaaaaaPaaaa",
    "aaaaaaaaaaaAaaaa",
    "aaaaaaaaaaaaaaaa",
    "aaaaaaaPPaaaaaaa",
    "aaaaaaPAAAaaaaaa",
    "aaaaaaaAAaaaaaaa",
    "aaaaaaaaaaaaaaaa",
    "aPaaaaaaaaaaaPAa",
    "aAaaaaaaaaaaaAAa",
    "aaaaaaaaaaaaaaaa",
    "aaaaPAaaaaaaaaaa",
    "aaaaaAaaaaaPaaaa",
    "aaaaaaaaaaaaaaaa",
  ],
  // 돌바닥 (광장)
  stone: [
    "xYYYYYxxxYYYYYxx",
    "YyyyyyyxYyyyyyyx",
    "YyyyyyyxYyxyyyyx",
    "YyyyyyyxYyyyyyyx",
    "YyyxyyyxYyyyyyyx",
    "YyyyyyyxYyyyyyyx",
    "xyyyyyxxxyyyyyxx",
    "xxxxxxxxxxxxxxxx",
    "YYxxxYYYYYxxxYYY",
    "yyyxYyyyyyyxYyyy",
    "yyyxYyyyyyyxYyyy",
    "yyyxYyyyyyyxYyxy",
    "yyyxYyyxyyyxYyyy",
    "yxyxYyyyyyyxYyyy",
    "yyxxxyyyyyxxxyyy",
    "xxxxxxxxxxxxxxxx",
  ],
} as const satisfies Record<string, Sprite>;

/** 흙길·돌바닥이 잔디와 맞닿는 쪽에 덮는 풀 가장자리 (위쪽 모양. 돌려서 네 방향에 쓴다) */
export const EDGE: Sprite = [
  "eeeeeeeeeeeeeeee",
  "eeeAeeeeeAeeeeAe",
  "AeA.AAeAA.AeeA.A",
  ".A....A....AA...",
];

/** 팔레트 hex → [r, g, b] (바닥을 픽셀 단위로 구울 때) */
export function rgbOf(color: string): [number, number, number] {
  const n = parseInt(color.slice(1, 7), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
