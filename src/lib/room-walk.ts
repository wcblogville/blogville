// 우리 집 방에서 캐릭터가 움직이는 규칙 (순수 계산, 화면·시험 공용).
// 사용자 요청 2026-10-12 "방에서 혼자 막 돌아다니는 것 보다 사용자가 클릭했을 때 이동하게 해주고 가구들이랑 상호작용하는거 넣어줘":
// - 바닥 칸을 누르면 그 칸까지 길을 찾아 걷는다 (8방향, 가구 칸은 피하고 가구 모서리를 대각선으로 스쳐 지나가지 않는다)
// - 가구를 누르면 그 가구 옆 빈 칸(앞쪽이면 더 좋다)까지 걸어가 가구마다 정한 행동을 한다 (FURNITURE_ACTION)
// - 화면에서 앞뒤로 겹치는 순서(깊이)는 가구가 차지하는 칸 상자로 정한다 (depthRanks, depthOfPoint)
import { footprintOf, WALKABLE_FURNITURE } from "./house";

export type Tile = { x: number; y: number };
/** 방에 놓인 가구 (길 찾기·깊이에 필요한 것만) */
export type RoomPiece = { itemId: number; assetKey: string; x: number; y: number; flip: boolean };

/** 가구와 하는 행동 */
export type RoomAction = "sleep" | "sit" | "write" | "read" | "water" | "light" | "music" | "spin" | "look";

/** 가구마다 하는 행동. 없으면 "look"(바라보며 하트) */
export const FURNITURE_ACTION: Readonly<Record<string, RoomAction>> = {
  "furniture.bed": "sleep",
  "furniture.canopy": "sleep",
  "furniture.chair": "sit",
  "furniture.stool": "sit",
  "furniture.sofa": "sit",
  "furniture.armchair": "sit",
  "furniture.beanbag": "sit",
  "furniture.throne": "sit",
  "furniture.table": "write",
  "furniture.desk": "write",
  "furniture.computer": "write",
  "furniture.shelf": "read",
  "furniture.plant": "water",
  "furniture.cactus": "water",
  "furniture.tulip": "water",
  "furniture.monstera": "water",
  "furniture.bonsai": "water",
  "furniture.lamp": "light",
  "furniture.mushroom": "light",
  "furniture.tv": "music",
  "furniture.radio": "music",
  "furniture.gramophone": "music",
  "furniture.piano": "music",
  "furniture.wardrobe": "spin",
  "furniture.dresser": "spin",
};

/** 화면 읽기 프로그램·말풍선에 쓰는 행동 이름 */
export const ACTION_LABEL: Readonly<Record<RoomAction, string>> = {
  sleep: "누워서 자기",
  sit: "앉기",
  write: "글 쓰기",
  read: "책 읽기",
  water: "물 주기",
  light: "불 켜고 끄기",
  music: "음악 듣기",
  spin: "옷 갈아입고 한 바퀴",
  look: "구경하기",
};

export function actionOf(assetKey: string): RoomAction {
  return FURNITURE_ACTION[assetKey] ?? "look";
}

/** 가구 위에 올라가서 하는 행동 (옆 칸까지 걸어간 다음 가구 위로 옮겨 앉거나 눕는다) */
export const ON_FURNITURE: ReadonlySet<RoomAction> = new Set(["sleep", "sit"]);

const key = (x: number, y: number) => `${x},${y}`;

/** 캐릭터가 못 지나가는 칸 ("x,y"): 러그처럼 밟는 가구는 빼고 가구가 차지하는 모든 칸 */
export function blockedTiles(pieces: readonly RoomPiece[]): Set<string> {
  const out = new Set<string>();
  for (const p of pieces) {
    if (WALKABLE_FURNITURE.has(p.assetKey)) continue;
    const { w, d } = footprintOf(p.assetKey, p.flip);
    for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) out.add(key(p.x + i, p.y + j));
  }
  return out;
}

const STEPS: readonly [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/**
 * from에서 갈 수 있는 모든 칸까지의 거리와 바로 앞 칸 (다익스트라, 8방향).
 * 대각선은 양옆 두 칸이 모두 비어 있을 때만 (가구 모서리를 뚫고 지나가지 않게)
 */
export function walkMap(grid: number, blocked: ReadonlySet<string>, from: Tile) {
  const dist = new Map<string, number>([[key(from.x, from.y), 0]]);
  const prev = new Map<string, string | null>([[key(from.x, from.y), null]]);
  const done = new Set<string>();
  const free = (x: number, y: number) => x >= 0 && y >= 0 && x < grid && y < grid && !blocked.has(key(x, y));
  for (;;) {
    let best: string | null = null;
    let bestD = Infinity;
    for (const [k, d] of dist) if (!done.has(k) && d < bestD) [best, bestD] = [k, d];
    if (best === null) break;
    done.add(best);
    const [cx, cy] = best.split(",").map(Number);
    for (const [dx, dy, cost] of STEPS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!free(nx, ny)) continue;
      if (dx && dy && (!free(cx + dx, cy) || !free(cx, cy + dy))) continue;
      const k = key(nx, ny);
      const nd = bestD + cost;
      if (nd < (dist.get(k) ?? Infinity) - 1e-9) {
        dist.set(k, nd);
        prev.set(k, best);
      }
    }
  }
  return { dist, prev };
}

/** prev 지도에서 to까지의 칸들 (from은 빼고 to는 넣는다) */
function trace(prev: ReadonlyMap<string, string | null>, to: string): Tile[] {
  const out: Tile[] = [];
  for (let k: string | null | undefined = to; k; k = prev.get(k)) {
    const [x, y] = k.split(",").map(Number);
    out.unshift({ x, y });
  }
  return out.slice(1);
}

/**
 * 누른 칸까지 가는 길 (지나갈 칸들, 마지막이 도착 칸). 그 칸에 못 가면(막혔거나 갇힌 칸) 갈 수 있는 칸 중 가장 가까운 칸으로.
 * 이미 그 칸이면 빈 배열
 */
export function findPath(grid: number, blocked: ReadonlySet<string>, from: Tile, to: Tile): Tile[] {
  const { dist, prev } = walkMap(grid, blocked, from);
  let goal = key(to.x, to.y);
  if (!dist.has(goal)) {
    let best = Infinity;
    for (const k of dist.keys()) {
      const [x, y] = k.split(",").map(Number);
      const d = Math.hypot(x - to.x, y - to.y) * 100 + (dist.get(k) ?? 0);
      if (d < best) [best, goal] = [d, k];
    }
  }
  return trace(prev, goal);
}

/** 가구 앞쪽: 뒤집지 않은 가구는 +y쪽(왼쪽 아래), 뒤집은 가구는 +x쪽(오른쪽 아래)을 본다 */
function isFront(piece: RoomPiece, t: Tile) {
  const { w, d } = footprintOf(piece.assetKey, piece.flip);
  return piece.flip ? t.x === piece.x + w : t.y === piece.y + d;
}

/**
 * 가구를 쓰러 가는 길: 가구에 맞닿은 빈 칸(위아래·양옆) 중 걸어서 가장 가까운 칸. 앞쪽 칸은 1.5칸만큼 덜 먼 것으로 친다.
 * 갈 수 있는 칸이 없으면 null
 */
export function planUse(grid: number, blocked: ReadonlySet<string>, from: Tile, piece: RoomPiece): { path: Tile[]; stand: Tile } | null {
  const { w, d } = footprintOf(piece.assetKey, piece.flip);
  const around: Tile[] = [];
  for (let i = 0; i < w; i++) around.push({ x: piece.x + i, y: piece.y - 1 }, { x: piece.x + i, y: piece.y + d });
  for (let j = 0; j < d; j++) around.push({ x: piece.x - 1, y: piece.y + j }, { x: piece.x + w, y: piece.y + j });
  const { dist, prev } = walkMap(grid, blocked, from);
  let best: Tile | null = null;
  let bestScore = Infinity;
  for (const t of around) {
    const dd = dist.get(key(t.x, t.y));
    if (dd === undefined) continue;
    const score = dd - (isFront(piece, t) ? 1.5 : 0);
    if (score < bestScore - 1e-9) [best, bestScore] = [t, score];
  }
  if (!best) return null;
  return { path: trace(prev, key(best.x, best.y)), stand: best };
}

/** 가구 위에서 앉거나 누울 칸: 가구가 차지하는 칸 중 서 있는 칸에서 가장 가까운 칸 */
export function seatTile(piece: RoomPiece, stand: Tile): Tile {
  const { w, d } = footprintOf(piece.assetKey, piece.flip);
  return {
    x: Math.min(piece.x + w - 1, Math.max(piece.x, stand.x)),
    y: Math.min(piece.y + d - 1, Math.max(piece.y, stand.y)),
  };
}

// ===== 깊이 (화면에서 앞뒤로 겹치는 순서) =====
/** 바닥 위 상자 [x0, x1) × [y0, y1) */
export type FloorBox = { x0: number; y0: number; x1: number; y1: number };

export function boxOf(piece: RoomPiece): FloorBox {
  const { w, d } = footprintOf(piece.assetKey, piece.flip);
  return { x0: piece.x, y0: piece.y, x1: piece.x + w, y1: piece.y + d };
}

/** a가 b보다 뒤인지 (b의 앞쪽 벽 너머에 있는지) */
const behind = (a: FloorBox, b: FloorBox) => a.x1 <= b.x0 || a.y1 <= b.y0;

/**
 * 가구들의 앞뒤 순서 (0 = 가장 뒤). 큰 가구는 칸 합 하나로 줄 세우면 틀리므로(긴 침대 옆 의자 등) 상자끼리 비교해 위상 정렬한다.
 * 서로 뒤라고 할 수 있는 두 상자(옆으로 나란한 상자)는 화면에서 거의 안 겹쳐 칸 합으로 정한다
 */
export function depthRanks(boxes: readonly FloorBox[]): number[] {
  const n = boxes.length;
  const sum = (b: FloorBox) => b.x0 + b.x1 + b.y0 + b.y1;
  const edges: number[][] = boxes.map(() => []);
  const indeg = boxes.map(() => 0);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const ij = behind(boxes[i], boxes[j]);
      const ji = behind(boxes[j], boxes[i]);
      if ((ij && !ji) || (ij && ji && (sum(boxes[i]) < sum(boxes[j]) || (sum(boxes[i]) === sum(boxes[j]) && i < j)))) {
        edges[i].push(j);
        indeg[j]++;
      }
    }
  const ranks = boxes.map(() => -1);
  const left = new Set(boxes.map((_, i) => i));
  let r = 0;
  while (left.size) {
    let pick = -1;
    for (const i of left) if (indeg[i] === 0 && (pick < 0 || sum(boxes[i]) < sum(boxes[pick]))) pick = i;
    // 고리(드문 바람개비 모양)면 칸 합이 가장 작은 것부터
    if (pick < 0) for (const i of left) if (pick < 0 || sum(boxes[i]) < sum(boxes[pick])) pick = i;
    left.delete(pick);
    ranks[pick] = r++;
    for (const j of edges[pick]) indeg[j]--;
  }
  return ranks;
}

/** 가구의 z-index (순서 rank). 캐릭터·동물은 그 사이(+5)에 끼운다 */
export const pieceZ = (rank: number) => 110 + rank * 10;

/**
 * 바닥 위 한 점(캐릭터·동물 발밑)의 z-index: 그 점이 앞에 있는 가구 중 가장 앞 가구 바로 위.
 * 반지름 r = 발 크기 (가구 칸에 살짝 걸쳐도 앞뒤가 뒤집히지 않게)
 */
export function depthOfPoint(p: { x: number; y: number }, boxes: readonly FloorBox[], ranks: readonly number[], r = 0.2): number {
  let z = 105;
  const me = { x0: p.x - r, y0: p.y - r, x1: p.x + r, y1: p.y + r };
  boxes.forEach((b, i) => {
    if (behind(b, me)) z = Math.max(z, pieceZ(ranks[i]) + 5);
  });
  return z;
}

/**
 * 방 한 판의 깊이: 가구마다 z-index와, 바닥 위 한 점(캐릭터·동물)의 z-index를 구하는 함수.
 * 밟는 가구(러그)는 늘 맨 아래(101)라 캐릭터가 그 위를 걷는다
 */
export function layoutDepth(pieces: readonly RoomPiece[]) {
  const solid = pieces.map((p, i) => ({ p, i })).filter(({ p }) => !WALKABLE_FURNITURE.has(p.assetKey));
  const boxes = solid.map(({ p }) => boxOf(p));
  const ranks = depthRanks(boxes);
  const z = pieces.map(() => 101);
  solid.forEach(({ i }, k) => (z[i] = pieceZ(ranks[k])));
  return { pieceZ: z, pointZ: (p: { x: number; y: number }) => depthOfPoint(p, boxes, ranks) };
}
