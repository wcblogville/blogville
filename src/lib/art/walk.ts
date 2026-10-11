// 캐릭터 걷기 그림 (사용자 요청 2026-10-11 "캐릭터 움직일때 동작을 만들어줘").
// 캐릭터마다 따로 그리지 않고, 입은 모습 그대로의 색 칸 격자(characters.ts lookGrid)에서 칸을 옮겨 만든다.
// 그래서 모든 캐릭터·머리·옷·모자가 어느 칸에서나 같이 움직인다 (부품이 따로 놀지 않는다).
//
// 방향 4개(아래·왼쪽·오른쪽·위) × 그림 5칸(0 = 서 있기, 1~4 = 걷기). 걷기 4칸:
//   1 왼발 들고 몸이 1칸 뜬다, 오른팔 앞으로 · 2 제자리 · 3 오른발 들고 1칸 뜬다, 왼팔 앞으로 · 4 제자리
// 위로 걸으면 뒷모습(얼굴 대신 머리카락, 안경은 안 보인다), 옆으로 걸으면 얼굴(눈·입)이 그쪽으로 1칸 돈다.
// 오른쪽은 왼쪽 그림을 좌우로 뒤집는다. 그림자(":")는 움직이지 않고 바닥에 남는다.
import { FRAME, lookGrid } from "./characters";
import { gridRects, PALETTE, PIXEL, svgDataUri, type Grid } from "./pixel";

export const WALK_DIRS = ["down", "left", "right", "up"] as const;
export type WalkDir = (typeof WALK_DIRS)[number];
/** 방향마다 그림 칸 수: 0 = 서 있기, 1~4 = 걷기 */
export const WALK_FRAMES = 5;
/** 걷기 그림이 바뀌는 빠르기 (초당 칸) */
export const WALK_FPS = 8;

const SHADOW = PALETTE[":"];
const OUTLINE = PALETTE["#"];
/** 발 줄과 그 아래 외곽선 줄 (모든 캐릭터가 같다: 21줄 신발·발, 22줄 외곽선, 23줄 그림자) */
const FOOT_ROW = 21;
const SOLE_ROW = 22;
/** 왼발·오른발 칸 (꼬리가 있는 14·15칸은 건드리지 않는다) */
const LEGS = { left: [2, 7], right: [8, 13] } as const;
/** 팔(손) 칸과 줄: 소매 14줄, 손 15·16줄, 팔 끝 외곽선 17줄 */
const ARMS = { left: 2, right: 13, top: 14, bottom: 17 } as const;
/** 옆으로 볼 때 돌리는 얼굴 줄 */
const FACE_ROWS = [7, 11] as const;

const copy = (g: Grid): Grid => g.map((r) => [...r]);
const isShadow = (c: string | null) => c === SHADOW;

/** 그림자 층: 그림자 칸 + 발밑 외곽선 줄의 그림자 사이 (발을 들면 그 밑에 그림자가 보인다) */
function shadowLayer(g: Grid): Grid {
  const out: Grid = g.map((r) => r.map((c) => (isShadow(c) ? c : null)));
  const sole = g[SOLE_ROW];
  if (sole) {
    const first = sole.findIndex(isShadow);
    const last = sole.findLastIndex(isShadow);
    if (first >= 0) for (let x = first; x <= last; x++) out[SOLE_ROW][x] = SHADOW;
  }
  return out;
}

/** 몸 층: 그림자를 뺀 칸 */
const bodyLayer = (g: Grid): Grid => g.map((r) => r.map((c) => (isShadow(c) ? null : c)));

/** 몸 층을 그림자 층 위에 놓는다 */
function merge(shadow: Grid, body: Grid): Grid {
  return body.map((r, y) => r.map((c, x) => c ?? shadow[y][x]));
}

/** 몸 전체를 위로 n칸 */
function raise(body: Grid, n: number): Grid {
  return body.map((_, y) => [...(body[y + n] ?? body[0].map(() => null))]);
}

/**
 * 한 발 들기: 그 발 칸에서 신발 줄을 한 줄 위로, 발밑 외곽선을 신발 자리로 올리고 맨 아래는 비운다.
 * 위 줄이 외곽선(치마 끝 등)이면 덮지 않는다 → 긴 옷은 신발만 옷자락 밑으로 숨는다
 */
function liftFoot(body: Grid, side: keyof typeof LEGS): Grid {
  const out = copy(body);
  const [a, b] = LEGS[side];
  for (let x = a; x <= b; x++) {
    const above = body[FOOT_ROW - 1][x];
    if (above !== OUTLINE && body[FOOT_ROW][x]) out[FOOT_ROW - 1][x] = body[FOOT_ROW][x];
    out[FOOT_ROW][x] = body[SOLE_ROW][x];
    out[SOLE_ROW][x] = null;
  }
  return out;
}

/** 팔 흔들기: 그 팔(손) 한 줄의 칸을 dy(+1 아래 = 앞으로, −1 위 = 뒤로)만큼 옮긴다 */
function swingArm(body: Grid, side: "left" | "right", dy: 1 | -1): Grid {
  const out = copy(body);
  const x = ARMS[side];
  if (dy === 1) {
    for (let y = ARMS.bottom; y > ARMS.top; y--) out[y][x] = body[y - 1][x];
    // 팔 끝이 한 칸 내려온다: 그 자리가 비어 있을 때만 외곽선
    if (!body[ARMS.bottom + 1][x]) out[ARMS.bottom + 1][x] = body[ARMS.bottom][x];
  } else {
    for (let y = ARMS.top; y < ARMS.bottom; y++) out[y][x] = body[y + 1][x];
  }
  return out;
}

/** 얼굴을 왼쪽으로 1칸 돌린다: 얼굴 줄의 외곽선 안쪽을 왼쪽으로 밀고, 오른쪽 끝 칸은 그대로 늘인다 */
function turnLeft(body: Grid): Grid {
  const out = copy(body);
  for (let y = FACE_ROWS[0]; y <= FACE_ROWS[1]; y++) {
    const row = body[y];
    const first = row.indexOf(OUTLINE);
    const last = row.lastIndexOf(OUTLINE);
    if (first < 0 || last - first < 4) continue;
    for (let x = first + 1; x < last - 1; x++) out[y][x] = row[x + 1];
  }
  return out;
}

const flip = (g: Grid): Grid => g.map((r) => [...r].reverse());

/** 방향·칸 하나의 그림 격자 (16×24) */
export function walkFrame(assetKey: string, outfit: readonly string[], dir: WalkDir, frame: number): Grid {
  const full = lookGrid(assetKey, outfit, dir === "up" ? "back" : "front");
  const shadow = shadowLayer(full);
  let body = bodyLayer(full);
  if (dir === "left" || dir === "right") body = turnLeft(body);
  if (frame === 1 || frame === 3) {
    const foot = frame === 1 ? "left" : "right";
    body = liftFoot(body, foot);
    // 든 발 반대쪽 팔이 앞으로, 같은 쪽 팔이 뒤로
    body = swingArm(swingArm(body, foot === "left" ? "right" : "left", 1), foot, -1);
    body = raise(body, 1);
  }
  const g = merge(shadow, body);
  return dir === "right" ? flip(g) : g;
}

/**
 * 걷기 그림판 SVG: 가로 5칸(서 있기 + 걷기 4) × 세로 4줄(아래·왼쪽·오른쪽·위).
 * 한 칸은 캐릭터 그림과 같은 24×24 틀(가운데 16칸)을 scale배. Phaser가 칸마다 잘라 쓴다 (frameWidth = 24 × scale)
 */
export function walkSheetSvg(assetKey: string, outfit: readonly string[] = [], scale = PIXEL): string {
  const pad = (FRAME - 16) / 2;
  let body = "";
  WALK_DIRS.forEach((dir, row) => {
    for (let f = 0; f < WALK_FRAMES; f++) body += gridRects(walkFrame(assetKey, outfit, dir, f), f * FRAME + pad, row * FRAME);
  });
  const w = FRAME * WALK_FRAMES;
  const h = FRAME * WALK_DIRS.length;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}" shape-rendering="crispEdges">${body}</svg>`;
}

export function walkSheetDataUri(assetKey: string, outfit: readonly string[] = [], scale = PIXEL): string {
  return svgDataUri(walkSheetSvg(assetKey, outfit, scale));
}

/** 그림판에서 (방향, 칸)의 번호 (Phaser 프레임 번호) */
export function walkFrameIndex(dir: WalkDir, frame: number): number {
  return WALK_DIRS.indexOf(dir) * WALK_FRAMES + frame;
}

/** 움직이는 방향 (vx, vy) → 그림 방향. 가로·세로 중 큰 쪽을 따른다. 멈춰 있으면 null */
export function walkDirOf(vx: number, vy: number): WalkDir | null {
  if (Math.abs(vx) < 1 && Math.abs(vy) < 1) return null;
  if (Math.abs(vx) > Math.abs(vy)) return vx < 0 ? "left" : "right";
  return vy < 0 ? "up" : "down";
}
