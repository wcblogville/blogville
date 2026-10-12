// 가만히 서 있을 때 하는 재미있는 동작 (사용자 요청 2026-10-12 "가만히 있으면 캐릭터가 재밌는 모션 랜덤으로 하나씩 하게 해줘").
// 걷기 그림(walk.ts)처럼 캐릭터마다 따로 그리지 않고, 입은 모습 그대로의 색 칸 격자(lookGrid)에서 칸을 옮기고 덧그려 만든다.
// 그래서 모든 캐릭터·머리·옷·모자가 어느 동작에서나 같이 움직인다.
//
// 칸 틀: 가로 24 × 세로 32 (걷기 그림판의 24×24 틀 위에 8줄을 더 둔다). 캐릭터 16×24는 아래 가운데(4, 8)에 서고,
// 위쪽 8줄과 양옆 4칸은 점프·들어 올린 팔·말풍선(하트·음표·?·z)이 쓴다. 그림자는 늘 바닥(맨 아래 두 줄)에 남는다.
// 그림판: 동작마다 한 줄(IDLE_MOTIONS 순서), 칸 0 = 앞을 보고 서 있기, 1~ = 그 동작의 그림 (IDLE_COLS칸).
// 재생 순서(어느 칸을 몇 ms)는 동작마다 sequence. 광장(scene.ts)과 우리 집(room-resident.tsx)이 같이 쓴다.
import { FRAME, lookGrid } from "./characters";
import { gridRects, PALETTE, PIXEL, svgDataUri, type Grid } from "./pixel";
import { ARMS, bodyLayer, flip, shadowLayer, swingArm, turnLeft, walkFrame } from "./walk";

/** 한 칸의 크기 (도트): 가로는 걷기 틀과 같고, 세로는 8줄 더 높다 */
export const IDLE_FRAME = { w: FRAME, h: FRAME + 8 } as const;
/** 캐릭터(16×24)가 칸 안에 서는 자리 */
const OX = (FRAME - 16) / 2;
const OY = IDLE_FRAME.h - 24;
/** 동작마다 그림 칸 수 (0 = 서 있기 포함) */
export const IDLE_COLS = 5;
/** 이만큼 가만히 서 있으면 동작을 하나 한다 (ms). 동작 사이에는 IDLE_GAP_MS 범위에서 무작위로 쉰다 */
export const IDLE_AFTER_MS = 3500;
export const IDLE_GAP_MS: readonly [number, number] = [4000, 8000];

export type IdleStep = { frame: number; ms: number };
export type IdleMotion = { key: string; name: string; frames: number; sequence: readonly IdleStep[] };

/** 동작 목록 (그림판의 줄 순서). frames = 칸 0을 뺀 그림 수 */
export const IDLE_MOTIONS: readonly IdleMotion[] = [
  { key: "wave", name: "손 흔들기", frames: 2, sequence: steps([1, 220], [2, 200], [1, 200], [2, 200], [1, 200], [2, 200], [1, 220]) },
  { key: "jump", name: "점프", frames: 3, sequence: steps([1, 140], [2, 90], [3, 220], [2, 90], [1, 140], [0, 160], [1, 140], [2, 90], [3, 220], [2, 90], [1, 160]) },
  { key: "stretch", name: "하품·기지개", frames: 3, sequence: steps([1, 220], [2, 420], [3, 700], [2, 500], [1, 220]) },
  { key: "look", name: "두리번", frames: 3, sequence: steps([1, 520], [0, 200], [2, 520], [0, 200], [1, 360], [0, 160], [3, 700]) },
  { key: "sit", name: "앉아서 졸기", frames: 4, sequence: steps([1, 500], [2, 450], [3, 450], [4, 500], [3, 450], [4, 500], [2, 300], [1, 300]) },
  { key: "heart", name: "하트", frames: 3, sequence: steps([1, 160], [2, 320], [3, 320], [2, 320], [3, 320], [2, 260], [1, 160]) },
  { key: "music", name: "흥얼흥얼", frames: 2, sequence: steps([1, 380], [2, 380], [1, 380], [2, 380], [1, 380], [2, 380]) },
  { key: "spin", name: "빙글 돌기", frames: 3, sequence: steps([1, 110], [2, 110], [3, 110], [0, 110], [1, 110], [2, 110], [3, 110], [0, 200]) },
];

function steps(...list: [number, number][]): IdleStep[] {
  return list.map(([frame, ms]) => ({ frame, ms }));
}

/** 동작 하나의 길이 (ms) */
export const idleDuration = (m: IdleMotion) => m.sequence.reduce((s, x) => s + x.ms, 0);

/** 동작 시작 뒤 t ms일 때 그릴 칸 (끝났으면 null) */
export function idleFrameAt(m: IdleMotion, t: number): number | null {
  let left = t;
  for (const s of m.sequence) {
    if (left < s.ms) return s.frame;
    left -= s.ms;
  }
  return null;
}

/** 다음 동작을 무작위로 (바로 앞 동작은 되도록 피한다). rand는 0~1 */
export function pickIdleMotion(rand: number, previous: string | null = null): IdleMotion {
  const pool = IDLE_MOTIONS.filter((m) => m.key !== previous);
  return pool[Math.min(pool.length - 1, Math.floor(rand * pool.length))];
}

/** 그림판에서 (동작, 칸)의 번호 (Phaser 프레임 번호) */
export function idleFrameIndex(motion: string, frame: number): number {
  const row = Math.max(0, IDLE_MOTIONS.findIndex((m) => m.key === motion));
  return row * IDLE_COLS + frame;
}

// ===== 그리기 =====
const OUTLINE = PALETTE["#"];
const MOUTH = "#8a3a3a";
const HEART = { o: "#a8324a", R: "#ff5d7a", r: "#ffb3c4" };
const NOTE = "#5b4bb0";
const INK = "#3a2f4a";
const HALO = "#fffaf0";

const blank = (): Grid => Array.from({ length: IDLE_FRAME.h }, () => Array<string | null>(IDLE_FRAME.w).fill(null));

/** 16×24 격자를 큰 칸(24×32)의 캐릭터 자리 + (dx, dy)에 놓는다 */
function place(g: Grid, dx = 0, dy = 0): Grid {
  const out = blank();
  g.forEach((row, y) =>
    row.forEach((c, x) => {
      const by = OY + dy + y;
      const bx = OX + dx + x;
      if (c && by >= 0 && by < IDLE_FRAME.h && bx >= 0 && bx < IDLE_FRAME.w) out[by][bx] = c;
    }),
  );
  return out;
}

/** 큰 칸 위 (캐릭터 좌표 cx, cy + 몸이 옮겨진 dx, dy) 한 칸 */
type Pen = { get: (cx: number, cy: number) => string | null; set: (cx: number, cy: number, c: string | null) => void };
function pen(big: Grid, dx = 0, dy = 0): Pen {
  const inside = (x: number, y: number) => y >= 0 && y < IDLE_FRAME.h && x >= 0 && x < IDLE_FRAME.w;
  return {
    get: (cx, cy) => {
      const [x, y] = [OX + dx + cx, OY + dy + cy];
      return inside(x, y) ? big[y][x] : null;
    },
    set: (cx, cy, c) => {
      const [x, y] = [OX + dx + cx, OY + dy + cy];
      if (inside(x, y)) big[y][x] = c;
    },
  };
}

/**
 * 들어 올린 팔 (화면 왼쪽 팔 기준, 캐릭터 좌표 col -3부터 · 4줄부터). h = 손, s = 소매, # = 외곽선, . = 그대로.
 * 위로 곧게 / 손을 바깥으로 흔든 모양. 오른쪽 팔은 좌우를 뒤집어 쓴다
 */
const ARM_UP = ["..#...", ".#h#..", ".#h#..", ".#s#..", ".#s#..", ".#s#..", ".#s#..", ".#ss#.", "..#ss#", "...#s#"];
const ARM_WAVE = [".#....", "#h#...", "#h#...", ".#s#..", ".#s#..", ".#s#..", ".#s#..", ".#ss#.", "..#ss#", "...#s#"];
const ARM_TOP = 4;

/** 팔을 들어 올린다: 원래 팔(14~16줄)을 지우고 머리 옆으로 올린 팔을 그린다 */
function raiseArm(big: Grid, side: "left" | "right", shape: readonly string[], dx = 0, dy = 0) {
  const p = pen(big, dx, dy);
  const col = side === "left" ? ARMS.left : ARMS.right;
  const out = side === "left" ? col - 1 : col + 1; // 팔 바깥 외곽선
  const beyond = side === "left" ? col - 2 : col + 2; // 그 바깥 (꼬리가 붙어 있으면 외곽선을 남긴다)
  const sleeve = p.get(col, ARMS.top) ?? OUTLINE;
  const hand = p.get(col, ARMS.top + 1) ?? sleeve;
  for (let y = ARMS.top; y < ARMS.bottom; y++) {
    p.set(col, y, null);
    if (!p.get(beyond, y)) p.set(out, y, null);
  }
  // 팔 끝 외곽선: 안쪽이 몸 외곽선이면 지운다 (긴 옷자락이면 남긴다)
  const inner = side === "left" ? col + 1 : col - 1;
  if (p.get(inner, ARMS.bottom) === OUTLINE && !p.get(beyond, ARMS.bottom)) p.set(col, ARMS.bottom, null);
  shape.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      if (ch === ".") return;
      const cx = side === "left" ? i - 3 : 15 - (i - 3);
      p.set(cx, ARM_TOP + j, ch === "#" ? OUTLINE : ch === "h" ? hand : sleeve);
    }),
  );
}

/** 눈 감기: 눈 칸(7~9줄 · 4·5, 10·11칸)의 흰자·눈동자를 얼굴색으로 덮고 아래 줄만 감은 눈 선으로 */
function closeEyes(big: Grid, dx = 0, dy = 0) {
  const p = pen(big, dx, dy);
  const face = p.get(7, 9) ?? p.get(7, 8);
  if (!face || face === OUTLINE) return;
  for (const x of [4, 5, 10, 11])
    for (const y of [7, 8]) {
      const c = p.get(x, y);
      if (c === OUTLINE || c === PALETTE.w) p.set(x, y, face);
    }
  for (const x of [4, 5, 10, 11]) if (p.get(x, 9) !== null) p.set(x, 9, OUTLINE);
}

/** 하품하는 입 (2×2) */
function yawnMouth(big: Grid, dx = 0, dy = 0) {
  const p = pen(big, dx, dy);
  for (const [x, y] of [[7, 10], [8, 10], [7, 11], [8, 11]] as const) if (p.get(x, y) && p.get(x, y) !== OUTLINE) p.set(x, y, MOUTH);
}

/** 말풍선 글자 도장 (밝은 테두리를 둘러 어느 바닥에서도 보이게). x, y = 큰 칸 좌표 */
function glyph(big: Grid, rows: readonly string[], x: number, y: number, colors: Record<string, string>) {
  const cells: [number, number, string][] = [];
  rows.forEach((row, j) => [...row].forEach((ch, i) => ch !== "." && cells.push([x + i, y + j, colors[ch] ?? ch])));
  const inside = (cx: number, cy: number) => cy >= 0 && cy < IDLE_FRAME.h && cx >= 0 && cx < IDLE_FRAME.w;
  for (const [cx, cy] of cells)
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
      if (inside(cx + ox, cy + oy) && !big[cy + oy][cx + ox]) big[cy + oy][cx + ox] = HALO;
  for (const [cx, cy, c] of cells) if (inside(cx, cy)) big[cy][cx] = c;
}

const HEART_SMALL = [".o.o.", "oRoRo", ".oRo.", "..o.."];
const HEART_BIG = [".oo.oo.", "orroRRo", "oRRRRRo", ".oRRRo.", "..oRo..", "...o..."];
const NOTE_A = ["..NN", "..NN", "..N.", "..N.", "NNN.", "NN.."];
const NOTE_B = [".NNNN", ".NNNN", ".N..N", ".N..N", "NN.NN", "NN.NN"];
const QUESTION = [".KK.", "K..K", "...K", "..K.", "....", "..K."];
const Z_SMALL = ["KKK", "..K", ".K.", "KKK"];
const Z_BIG = ["KKKK", "...K", "..K.", ".K..", "KKKK"];

/** 그 동작의 칸 하나 (24×32 격자). frame 0 = 앞을 보고 서 있기 */
export function idleFrame(assetKey: string, outfit: readonly string[], motion: string, frame: number): Grid {
  const full = lookGrid(assetKey, outfit, "front");
  const shadow = place(shadowLayer(full));
  const body = bodyLayer(full);
  const over = (top: Grid) => top.map((r, y) => r.map((c, x) => c ?? shadow[y][x]));
  const stand = () => over(place(body));
  if (frame === 0) return stand();

  switch (motion) {
    case "wave": {
      const big = place(body);
      raiseArm(big, "left", frame === 1 ? ARM_UP : ARM_WAVE);
      return over(big);
    }
    case "jump": {
      // 1 웅크리기(몸이 한 줄 내려앉는다) · 2 떠오르기(3줄, 팔 뒤로) · 3 꼭대기(6줄, 두 팔 번쩍)
      if (frame === 1) return over(place(squash(body, 1)));
      if (frame === 2) return over(place(swingArm(swingArm(body, "left", -1), "right", -1), 0, -3));
      const big = place(body, 0, -6);
      raiseArm(big, "left", ARM_UP, 0, -6);
      raiseArm(big, "right", ARM_UP, 0, -6);
      return over(big);
    }
    case "stretch": {
      // 1 팔을 반쯤 · 2 두 팔 번쩍 + 하품 · 3 발끝으로 서서 쭉 (한 줄 위)
      if (frame === 1) return over(place(swingArm(swingArm(body, "left", -1), "right", -1)));
      const dy = frame === 3 ? -1 : 0;
      const big = place(body, 0, dy);
      raiseArm(big, "left", ARM_UP, 0, dy);
      raiseArm(big, "right", ARM_UP, 0, dy);
      closeEyes(big, 0, dy);
      yawnMouth(big, 0, dy);
      return over(big);
    }
    case "look": {
      // 1 왼쪽 보기 · 2 오른쪽 보기 · 3 갸웃 + ? 말풍선
      if (frame === 1) return over(place(turnLeft(body)));
      if (frame === 2) return over(place(flip(turnLeft(flip(body)))));
      const g = stand();
      glyph(g, QUESTION, OX + 13, 1, { K: INK });
      return g;
    }
    case "sit": {
      // 1 앉기(다리를 접어 3줄 내려앉음) · 2 꾸벅(눈 감기) · 3 z · 4 zZ
      const big = place(squash(body, 3));
      if (frame >= 2) closeEyes(big, 0, 3);
      const g = over(big);
      if (frame >= 3) glyph(g, Z_SMALL, OX + 13, 5, { K: INK });
      if (frame >= 4) glyph(g, Z_BIG, OX + 16, 0, { K: INK });
      return g;
    }
    case "heart": {
      // 1 작은 하트 · 2 큰 하트 · 3 큰 하트가 한 줄 떠오름
      const g = stand();
      if (frame === 1) glyph(g, HEART_SMALL, OX + 12, 3, HEART);
      else glyph(g, HEART_BIG, OX + 11, frame === 2 ? 1 : 0, HEART);
      return g;
    }
    case "music": {
      // 몸을 좌우로 한 칸씩 흔들며 음표 (1 왼쪽 · 2 오른쪽)
      const dx = frame === 1 ? -1 : 1;
      const g = over(place(body, dx, 0));
      if (frame === 1) glyph(g, NOTE_A, OX + 12, 1, { N: NOTE });
      else glyph(g, NOTE_B, 1, 0, { N: NOTE });
      return g;
    }
    case "spin": {
      // 왼쪽 → 뒤 → 오른쪽 (서 있는 모습)
      const dir = frame === 1 ? "left" : frame === 2 ? "up" : "right";
      return place(walkFrame(assetKey, outfit, dir, 0));
    }
  }
  return stand();
}

/**
 * 몸을 n줄 내려앉힌다: 발(21~22줄)은 그대로 두고 그 위를 n줄 아래로 민다 (다리 n줄이 접힌다).
 * 맨 위 n줄은 비운다
 */
function squash(body: Grid, n: number): Grid {
  const out = body.map((r) => [...r]);
  const feet = 21;
  for (let y = feet - 1; y >= 0; y--) out[y] = y - n >= 0 ? [...body[y - n]] : body[0].map(() => null);
  return out;
}

/**
 * 가만히 동작 그림판 SVG: 가로 IDLE_COLS칸 × 세로 동작 수. 한 칸 = 24×32 도트 × scale.
 * Phaser는 칸마다 잘라 쓴다 (frameWidth = 24 × scale, frameHeight = 32 × scale)
 */
export function idleSheetSvg(assetKey: string, outfit: readonly string[] = [], scale = PIXEL): string {
  let body = "";
  IDLE_MOTIONS.forEach((m, row) => {
    for (let f = 0; f <= m.frames; f++) body += gridRects(idleFrame(assetKey, outfit, m.key, f), f * IDLE_FRAME.w, row * IDLE_FRAME.h);
  });
  const w = IDLE_FRAME.w * IDLE_COLS;
  const h = IDLE_FRAME.h * IDLE_MOTIONS.length;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}" shape-rendering="crispEdges">${body}</svg>`;
}

export function idleSheetDataUri(assetKey: string, outfit: readonly string[] = [], scale = PIXEL): string {
  return svgDataUri(idleSheetSvg(assetKey, outfit, scale));
}

// 걷기 그림판과 같은 발 위치에 서도록: 걷기 칸(24줄)의 원점 y 비율 → 가만히 칸(32줄)의 비율
export const idleOriginY = (walkOriginY: number) => 1 - ((1 - walkOriginY) * FRAME) / IDLE_FRAME.h;

