// 마을 땅 높이와 걸을 수 있는 곳 (Phaser 없이 쓰는 순수 계산, 도트 한 칸 = PIXEL px 격자).
// 좌표·모양은 layout.ts가 정하고, 여기서는 그것을 도트 격자로 바꾼다. 바닥 그림(ground.ts)·충돌(scene.ts)·시험(test-game.ts)이 같이 쓴다.
//
// 3/4 탑다운 규칙 (Stardew·RPG 맵처럼): 화면 좌표 = 윗면 좌표. 높은 단의 남쪽 가장자리 아래로 "앞면"(절벽 돌벽)이
// 단 높이(LEVEL_HEIGHT × 높이 차)만큼 내려와 낮은 땅을 덮는다. 앞면·단의 옆/뒤 가장자리·물은 걸을 수 없고,
// 길이 지나가는 곳만 계단이라 지나갈 수 있다.
import { PIXEL } from "@/lib/art/pixel";
import { BANK_HEIGHT, CENTER, CLIFF_LINES, FOREST_EDGE, HORIZON, LEVEL_HEIGHT, MESAS, PATHS, PLAZA_RADIUS, POND, smoothPath, WORLD } from "./layout";

/** 바닥 도트 크기 (칸) */
export const GROUND_SIZE = { w: Math.ceil(WORLD.width / PIXEL), h: Math.ceil(WORLD.height / PIXEL) };

/** 길 종류 번호 (도트 격자에 적는 값) */
export const PathCode = { None: 0, Stone: 1, Dirt: 2 } as const;

export type Terrain = {
  w: number;
  h: number;
  /** 윗면 높이 (0 들판 · 1 가운데 · 2 언덕 · 3 전망대) */
  level: Uint8Array;
  /** 물 (연못) */
  water: Uint8Array;
  /** 절벽 앞면이면 위에서부터 몇째 줄인지 + 1 (0 = 앞면 아님) */
  face: Uint8Array;
  /** 그 앞면의 전체 줄 수 */
  faceH: Uint8Array;
  /** 길 (PathCode) */
  path: Uint8Array;
  /** 길 가운데선까지 거리 ÷ 길 반폭 × 100 (0 = 가운데, 100 = 가장자리). 길이 아니면 255 */
  pathT: Uint8Array;
  /** 높이가 다른 땅과 맞닿은 가장자리 (앞면 아님) */
  edge: Uint8Array;
  /** 계단 (길이 앞면·가장자리를 지나는 곳) */
  stairs: Uint8Array;
  /** 계단 너비 안에서 가장자리까지 남은 도트 칸 + 1 (길 가운데선에서 반폭 + STAIR_PAD까지. 0 = 계단 너비 밖) */
  stairIn: Uint8Array;
  /** 그 계단이 이어 주는 길 종류 (PathCode) */
  stairCode: Uint8Array;
  /** 걸을 수 없는 칸 */
  blocked: Uint8Array;
};

/**
 * 계단은 길보다 양옆으로 이만큼(px) 넓다 (사용자 요청 2026-10-11 "계단이 너무 좁아서 안 가지는 길이 많다").
 * 길 가장자리의 들쭉날쭉과 상관없이 길 가운데선에서 잰다. 맨 바깥 1칸은 돌 난간(못 지나감)
 */
export const STAIR_PAD = 15;
/** 땅(절벽·물)에 부딪히는지 볼 때 쓰는 발 상자. 건물·나무와 부딪히는 발 상자(28×16)보다 작아 계단 입구 모서리에 덜 걸린다 */
export const TERRAIN_FEET = { w: 18, h: 10 } as const;

/** 같은 입력에 늘 같은 0~1 값 */
export function hash(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 1차원 부드러운 얼룩 (-1~1) */
function wave(x: number, seed: number) {
  const i = Math.floor(x);
  const f = x - i;
  const s = f * f * (3 - 2 * f);
  const a = hash(i, seed * 977);
  const b = hash(i + 1, seed * 977);
  return (a + (b - a) * s) * 2 - 1;
}

/** 절벽 줄의 y (점 사이를 부드럽게 잇고, 큰 굽이와 작은 들쭉날쭉을 더한다) */
function lineY(points: readonly (readonly [number, number])[], x: number, seed: number) {
  let i = 0;
  while (i < points.length - 2 && x > points[i + 1][0]) i++;
  const [ax, ay] = points[i];
  const [bx, by] = points[i + 1];
  const t = Math.max(0, Math.min(1, (x - ax) / (bx - ax)));
  // 부드럽게 (smoothstep): 꺾이는 점이 뾰족하지 않게
  const s = t * t * (3 - 2 * t);
  return ay + (by - ay) * s + 18 * wave(x / 80, seed) + 5 * wave(x / 23, seed + 1);
}

/** 둥근 단 안인가 (가장자리를 각도에 따라 흔든다) */
function inMesa(m: (typeof MESAS)[number], x: number, y: number, seed: number) {
  const dx = (x - m.x) / m.rx;
  const dy = (y - m.y) / m.ry;
  if (m.round) return dx * dx + dy * dy < 1;
  const a = Math.atan2(dy, dx);
  const r = 1 + 0.06 * wave(((a + Math.PI) / (2 * Math.PI)) * 9, seed) + 0.025 * wave(((a + Math.PI) / (2 * Math.PI)) * 31, seed + 5);
  return dx * dx + dy * dy < r * r;
}

/** 연못 안인가 (조금 일그러진 타원) */
export function inPond(x: number, y: number) {
  const dx = (x - POND.x) / POND.rx;
  const dy = (y - POND.y) / POND.ry;
  const a = Math.atan2(dy, dx);
  const r = 1 + 0.06 * Math.sin(3 * a + 1) + 0.03 * Math.sin(7 * a);
  return dx * dx + dy * dy < r * r;
}

/** 그 자리(px)의 윗면 높이 */
export function levelAt(x: number, y: number) {
  let lv = y < lineY(CLIFF_LINES.north, x, 1.3) ? 2 : y > lineY(CLIFF_LINES.south, x, 4.1) ? 0 : 1;
  if (lv === 1 && (x - CENTER.x) ** 2 + (y - CENTER.y) ** 2 < PLAZA_RADIUS ** 2) lv = 2;
  MESAS.forEach((m, i) => {
    if (m.level > lv && inMesa(m, x, y, i * 2.7)) lv = m.level;
  });
  return lv;
}

let cached: Terrain | null = null;

/** 땅을 도트 격자로 한 번 계산해 둔다 */
export function terrain(): Terrain {
  cached ??= build();
  return cached;
}

function build(): Terrain {
  const { w: W, h: H } = GROUND_SIZE;
  const PX = PIXEL;
  const N = W * H;
  const level = new Uint8Array(N);
  const water = new Uint8Array(N);
  const face = new Uint8Array(N);
  const faceH = new Uint8Array(N);
  const path = new Uint8Array(N);
  const pathT = new Uint8Array(N).fill(255);
  const edge = new Uint8Array(N);
  const stairs = new Uint8Array(N);
  const stairIn = new Uint8Array(N);
  const stairCode = new Uint8Array(N);
  const blocked = new Uint8Array(N);

  // 1) 윗면 높이와 물. 절벽 줄은 세로줄마다 한 번, 둥근 단·연못은 그 둘레 상자 안만 본다
  const north = new Float32Array(W);
  const south = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    north[x] = lineY(CLIFF_LINES.north, (x + 0.5) * PX, 1.3);
    south[x] = lineY(CLIFF_LINES.south, (x + 0.5) * PX, 4.1);
  }
  for (let y = 0; y < H; y++) {
    const wy = (y + 0.5) * PX;
    for (let x = 0; x < W; x++) level[y * W + x] = wy < north[x] ? 2 : wy > south[x] ? 0 : 1;
  }
  // 돌광장은 한 단 높은 돌 단 (길이 닿는 곳마다 계단)
  for (let y = Math.floor((CENTER.y - PLAZA_RADIUS) / PX); y <= Math.ceil((CENTER.y + PLAZA_RADIUS) / PX); y++)
    for (let x = Math.floor((CENTER.x - PLAZA_RADIUS) / PX); x <= Math.ceil((CENTER.x + PLAZA_RADIUS) / PX); x++) {
      const dx = (x + 0.5) * PX - CENTER.x;
      const dy = (y + 0.5) * PX - CENTER.y;
      if (dx * dx + dy * dy < PLAZA_RADIUS * PLAZA_RADIUS && level[y * W + x] === 1) level[y * W + x] = 2;
    }
  MESAS.forEach((m, k) => {
    const x0 = Math.max(0, Math.floor((m.x - m.rx * 1.1) / PX));
    const x1 = Math.min(W - 1, Math.ceil((m.x + m.rx * 1.1) / PX));
    const y0 = Math.max(0, Math.floor((m.y - m.ry * 1.1) / PX));
    const y1 = Math.min(H - 1, Math.ceil((m.y + m.ry * 1.1) / PX));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = y * W + x;
        if (m.level > level[i] && inMesa(m, (x + 0.5) * PX, (y + 0.5) * PX, k * 2.7)) level[i] = m.level;
      }
  });
  for (let y = Math.floor((POND.y - POND.ry * 1.2) / PX); y <= Math.ceil((POND.y + POND.ry * 1.2) / PX); y++)
    for (let x = Math.floor((POND.x - POND.rx * 1.2) / PX); x <= Math.ceil((POND.x + POND.rx * 1.2) / PX); x++)
      if (inPond((x + 0.5) * PX, (y + 0.5) * PX)) water[y * W + x] = 1;

  // 2) 앞면: 칸마다 위로 올라가며 높은 단이 있으면 그 단의 앞면 (단 높이 차 × LEVEL_HEIGHT). 물은 둑 높이만큼
  const LH = Math.round(LEVEL_HEIGHT / PX);
  const BH = Math.round(BANK_HEIGHT / PX);
  for (let x = 0; x < W; x++) {
    let start = -1;
    let height = 0;
    for (let y = 1; y < H; y++) {
      const i = y * W + x;
      const up = i - W;
      if (level[i] < level[up]) {
        start = y;
        height = (level[up] - level[i]) * LH;
      } else if (water[i] && !water[up]) {
        start = y;
        height = BH;
      } else if (level[i] > level[up]) start = -1;
      if (start >= 0 && y - start < height) {
        face[i] = y - start + 1;
        faceH[i] = height;
      } else if (start >= 0) start = -1;
    }
  }

  // 3) 길: 선분마다 둘레 칸만 본다. 가장자리는 조금씩 들쭉날쭉. 돌길이 흙길보다 위
  for (const p of PATHS) {
    if (p.kind === "plaza") continue;
    const code = p.kind === "stone" ? PathCode.Stone : PathCode.Dirt;
    const half = p.width / 2;
    const reach = half + STAIR_PAD;
    const pts = smoothPath(p.points);
    for (let s = 0; s < pts.length - 1; s++) {
      const [ax, ay] = pts[s];
      const [bx, by] = pts[s + 1];
      const x0 = Math.max(0, Math.floor((Math.min(ax, bx) - reach) / PX));
      const x1 = Math.min(W - 1, Math.ceil((Math.max(ax, bx) + reach) / PX));
      const y0 = Math.max(0, Math.floor((Math.min(ay, by) - reach) / PX));
      const y1 = Math.min(H - 1, Math.ceil((Math.max(ay, by) + reach) / PX));
      const L2 = (bx - ax) ** 2 + (by - ay) ** 2;
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const wx = (x + 0.5) * PX;
          const wy = (y + 0.5) * PX;
          const t = Math.max(0, Math.min(1, ((wx - ax) * (bx - ax) + (wy - ay) * (by - ay)) / L2));
          const ex = wx - (ax + t * (bx - ax));
          const ey = wy - (ay + t * (by - ay));
          const d = Math.sqrt(ex * ex + ey * ey);
          if (d > reach) continue;
          const i = y * W + x;
          // 계단 너비 (길 가장자리 흔들기와 상관없이 가운데선에서)
          const inner = Math.floor((reach - d) / PX) + 1;
          if (inner > stairIn[i]) {
            stairIn[i] = inner;
            stairCode[i] = code;
          }
          // 가장자리 흔들기: 3칸 덩어리마다 0~1칸
          const wobble = hash(x >> 1, y >> 1) < 0.35 ? PX : 0;
          if (d > half - wobble) continue;
          const tt = Math.min(100, Math.round((d / half) * 100));
          if (path[i] === PathCode.Stone && code === PathCode.Dirt) continue;
          if (path[i] !== code || tt < pathT[i]) pathT[i] = tt;
          path[i] = code;
        }
    }
  }

  // 4) 가장자리: 앞면·물이 아닌 칸끼리 높이가 다른 곳(경계)에서 양쪽 3칸씩 (뒤·옆 낭떠러지). 경계 표시 → 가로·세로로 넓힌다
  const EDGE = 3;
  const solidGround = (i: number) => !face[i] && !water[i];
  const seam = new Uint8Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!solidGround(i)) continue;
      if ((x + 1 < W && solidGround(i + 1) && level[i + 1] !== level[i]) || (y + 1 < H && solidGround(i + W) && level[i + W] !== level[i])) {
        seam[i] = 1;
        if (x + 1 < W && level[i + 1] !== level[i]) seam[i + 1] = 1;
        if (y + 1 < H && level[i + W] !== level[i]) seam[i + W] = 1;
      }
    }
  const wide = new Uint8Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!seam[y * W + x]) continue;
      for (let k = -EDGE + 1; k < EDGE; k++) {
        if (x + k >= 0 && x + k < W) wide[y * W + x + k] = 1;
      }
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!wide[y * W + x]) continue;
      for (let k = -EDGE + 1; k < EDGE; k++) {
        const j = (y + k) * W + x;
        if (y + k >= 0 && y + k < H && solidGround(j)) edge[j] = 1;
      }
    }

  // 5) 계단과 걸을 수 없는 칸. 계단은 길이 앞면·가장자리를 지나는 곳에서 길보다 STAIR_PAD씩 넓다. 계단 양옆 1칸은 돌 난간이라 막는다
  const horizon = Math.ceil((HORIZON + 30) / PX);
  const border = Math.ceil(FOREST_EDGE / PX);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const cliff = face[i] > 0 || edge[i] > 0;
      if (cliff && stairIn[i] && !water[i]) {
        stairs[i] = 1;
        if (stairIn[i] <= 1) blocked[i] = 1;
        continue;
      }
      if (water[i] || cliff) blocked[i] = 1;
      else if (y < horizon || x < border || x >= W - border || y >= H - border) blocked[i] = 1;
    }

  return { w: W, h: H, level, water, face, faceH, path, pathT, edge, stairs, stairIn, stairCode, blocked };
}

/** 그 자리(px)를 걸을 수 있는가 (땅만 본다. 건물·나무는 장면의 충돌 상자가 막는다) */
export function walkableAt(x: number, y: number) {
  const t = terrain();
  const gx = Math.floor(x / PIXEL);
  const gy = Math.floor(y / PIXEL);
  if (gx < 0 || gy < 0 || gx >= t.w || gy >= t.h) return false;
  return t.blocked[gy * t.w + gx] === 0;
}

/** 발 상자 (가운데 x, y, 너비, 높이)가 땅에서 막히지 않는가. 테두리를 3px 간격으로 본다 */
export function boxWalkable(x: number, y: number, w: number, h: number) {
  for (let dx = -w / 2; dx <= w / 2; dx += Math.min(PIXEL, w / 2))
    for (let dy = -h / 2; dy <= h / 2; dy += Math.min(PIXEL, h / 2)) if (!walkableAt(x + dx, y + dy)) return false;
  return true;
}

export type Box = { x: number; y: number; w: number; h: number };

/**
 * start에서 걸어서 갈 수 있는 칸 (cell px 격자). 막는 상자(solids)는 발 상자 feet로, 땅은 장면처럼 작은 발 상자 ground로 본다.
 * 시험(test-game.ts)이 모든 입구·텔레포트 자리에 갈 수 있는지 확인한다
 */
export function reachable(start: { x: number; y: number }, solids: Box[], feet = { w: 28, h: 16 }, cell = 12, ground: { w: number; h: number } = TERRAIN_FEET) {
  const cols = Math.ceil(WORLD.width / cell);
  const rows = Math.ceil(WORLD.height / cell);
  const free = new Uint8Array(cols * rows);
  const hitsSolid = (x: number, y: number) =>
    solids.some((s) => Math.abs(x - s.x) < (s.w + feet.w) / 2 && Math.abs(y - s.y) < (s.h + feet.h) / 2);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = c * cell + cell / 2;
      const y = r * cell + cell / 2;
      if (boxWalkable(x, y, ground.w, ground.h) && !hitsSolid(x, y)) free[r * cols + c] = 1;
    }
  const seen = new Uint8Array(cols * rows);
  const cellOf = (p: { x: number; y: number }) => Math.floor(p.y / cell) * cols + Math.floor(p.x / cell);
  const queue = [cellOf(start)];
  if (!free[queue[0]]) return () => false;
  seen[queue[0]] = 1;
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    const c = i % cols;
    for (const j of [i - 1, i + 1, i - cols, i + cols]) {
      if (j < 0 || j >= free.length || seen[j] || !free[j]) continue;
      if ((j === i - 1 && c === 0) || (j === i + 1 && c === cols - 1)) continue;
      seen[j] = 1;
      queue.push(j);
    }
  }
  return (p: { x: number; y: number }) => seen[cellOf(p)] === 1;
}

export type StairCrossing = { a: { x: number; y: number }; b: { x: number; y: number }; width: number };

let crossings: StairCrossing[] | null = null;

/**
 * 계단마다 양쪽 끝 바로 바깥 점 (길 가운데선 위, 계단에서 24px). 길을 따라가며 계단 칸을 지나는 구간을 찾는다.
 * 시험(test-game.ts, e2e town)이 모든 계단을 오르내려 본다
 */
export function stairCrossings(): StairCrossing[] {
  if (crossings) return crossings;
  const t = terrain();
  const out: StairCrossing[] = [];
  const onStairs = (x: number, y: number) => {
    const gx = Math.floor(x / PIXEL);
    const gy = Math.floor(y / PIXEL);
    return gx >= 0 && gy >= 0 && gx < t.w && gy < t.h && t.stairs[gy * t.w + gx] === 1;
  };
  for (const p of PATHS) {
    if (p.kind === "plaza") continue;
    // 길을 3px마다 따라간 점들
    const pts = smoothPath(p.points);
    const line: { x: number; y: number }[] = [];
    for (let s = 0; s < pts.length - 1; s++) {
      const [ax, ay] = pts[s];
      const [bx, by] = pts[s + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 3));
      for (let k = 0; k < n; k++) line.push({ x: ax + ((bx - ax) * k) / n, y: ay + ((by - ay) * k) / n });
    }
    const last = pts[pts.length - 1];
    line.push({ x: last[0], y: last[1] });
    const OUT = 8; // 계단 끝에서 24px (3px × 8) 바깥
    let k = 0;
    while (k < line.length) {
      if (!onStairs(line[k].x, line[k].y)) {
        k++;
        continue;
      }
      let end = k;
      // 4칸(12px) 안에서 다시 계단이면 같은 계단 (가장자리 띠가 앞면과 떨어져 있는 곳)
      for (let j = k; j < line.length && j <= end + 4; j++) if (onStairs(line[j].x, line[j].y)) end = j;
      const a = line[Math.max(0, k - OUT)];
      const b = line[Math.min(line.length - 1, end + OUT)];
      out.push({ a: { x: Math.round(a.x), y: Math.round(a.y) }, b: { x: Math.round(b.x), y: Math.round(b.y) }, width: p.width });
      k = end + 1;
    }
  }
  crossings = out;
  return out;
}
