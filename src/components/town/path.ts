// 광장 길 찾기 (사용자 요청 2026-10-16 "길 막혀있을 때 클릭한 곳까지 알아서 가는 기능"):
// 누른 곳까지 건물·나무·절벽·물을 돌아가는 길을 칸(CELL px) 격자에서 A*로 찾고, 곧게 갈 수 있는 점은 건너뛰어 꺾는 점만 남긴다.
// 땅은 장면과 같은 작은 발 상자(TERRAIN_FEET), 건물·나무는 장면의 발 상자 크기만큼 넓혀 본다 (reachable과 같은 기준)
import { WORLD } from "./layout";
import { boxWalkable, TERRAIN_FEET, type Box } from "./terrain";

export const PATH_CELL = 12;
/** 누른 곳이 막혀 있으면 이 거리(px) 안의 가장 가까운 걸을 수 있는 칸으로 간다 */
const SNAP_PX = 120;

export type WalkGrid = { cols: number; rows: number; free: Uint8Array };

/** 걸을 수 있는 칸 표. 광장을 만들 때 한 번 만든다 */
export function walkGrid(solids: Box[], feet = { w: 28, h: 16 }, cell = PATH_CELL): WalkGrid {
  const cols = Math.ceil(WORLD.width / cell);
  const rows = Math.ceil(WORLD.height / cell);
  const free = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) if (boxWalkable(c * cell + cell / 2, r * cell + cell / 2, TERRAIN_FEET.w, TERRAIN_FEET.h)) free[r * cols + c] = 1;
  // 막는 상자는 칸마다 모든 상자를 보지 않고, 상자가 덮는 칸만 지운다 (가운데가 상자 + 발 반폭 안이면 막힘)
  for (const s of solids) {
    const hw = (s.w + feet.w) / 2;
    const hh = (s.h + feet.h) / 2;
    const c1 = Math.max(0, Math.floor((s.x - hw) / cell));
    const c2 = Math.min(cols - 1, Math.floor((s.x + hw) / cell));
    const r1 = Math.max(0, Math.floor((s.y - hh) / cell));
    const r2 = Math.min(rows - 1, Math.floor((s.y + hh) / cell));
    for (let r = r1; r <= r2; r++)
      for (let c = c1; c <= c2; c++) {
        const x = c * cell + cell / 2;
        const y = r * cell + cell / 2;
        if (Math.abs(x - s.x) < hw && Math.abs(y - s.y) < hh) free[r * cols + c] = 0;
      }
  }
  return { cols, rows, free };
}

const cellAt = (g: WalkGrid, p: { x: number; y: number }, cell: number) => {
  const c = Math.min(g.cols - 1, Math.max(0, Math.floor(p.x / cell)));
  const r = Math.min(g.rows - 1, Math.max(0, Math.floor(p.y / cell)));
  return r * g.cols + c;
};

/** 막힌 칸이면 가까운 걸을 수 있는 칸 (없으면 -1) */
function nearestFree(g: WalkGrid, i: number, cell: number) {
  if (g.free[i]) return i;
  const c0 = i % g.cols;
  const r0 = Math.floor(i / g.cols);
  const max = Math.ceil(SNAP_PX / cell);
  for (let d = 1; d <= max; d++) {
    let best = -1;
    let bestD = Infinity;
    for (let r = r0 - d; r <= r0 + d; r++)
      for (let c = c0 - d; c <= c0 + d; c++) {
        if (Math.max(Math.abs(r - r0), Math.abs(c - c0)) !== d || r < 0 || c < 0 || r >= g.rows || c >= g.cols) continue;
        const j = r * g.cols + c;
        const dd = (r - r0) ** 2 + (c - c0) ** 2;
        if (g.free[j] && dd < bestD) {
          best = j;
          bestD = dd;
        }
      }
    if (best >= 0) return best;
  }
  return -1;
}

/** 두 칸 사이를 곧게 갈 때 지나는 칸이 모두 걸을 수 있는가 (반 칸 간격으로 본다) */
function lineFree(g: WalkGrid, a: number, b: number) {
  const ax = a % g.cols;
  const ay = Math.floor(a / g.cols);
  const bx = b % g.cols;
  const by = Math.floor(b / g.cols);
  const n = Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 2);
  for (let k = 1; k < n; k++) {
    const x = ax + ((bx - ax) * k) / n;
    const y = ay + ((by - ay) * k) / n;
    // 두 칸 경계를 비스듬히 지날 때 옆 칸 모서리도 막히지 않아야 한다
    for (const [cx, cy] of [[Math.floor(x + 0.5), Math.floor(y + 0.5)], [Math.floor(x + 0.25), Math.floor(y + 0.25)], [Math.floor(x + 0.75), Math.floor(y + 0.75)]])
      if (!g.free[cy * g.cols + cx]) return false;
  }
  return true;
}

/**
 * from에서 to까지 걸어갈 점들 (첫 점은 빼고, 마지막은 to 또는 가장 가까운 걸을 수 있는 곳). 길이 없으면 null.
 * 8방향, 막힌 칸의 모서리를 비스듬히 뚫지 않는다
 */
export function findTownPath(g: WalkGrid, from: { x: number; y: number }, to: { x: number; y: number }, cell = PATH_CELL): { x: number; y: number }[] | null {
  const start = nearestFree(g, cellAt(g, from, cell), cell);
  const goal = nearestFree(g, cellAt(g, to, cell), cell);
  if (start < 0 || goal < 0) return null;
  const center = (i: number) => ({ x: (i % g.cols) * cell + cell / 2, y: Math.floor(i / g.cols) * cell + cell / 2 });
  const end = goal === cellAt(g, to, cell) ? { x: to.x, y: to.y } : center(goal);
  if (start === goal) return [end];

  const n = g.cols * g.rows;
  const cost = new Float32Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const gx = goal % g.cols;
  const gy = Math.floor(goal / g.cols);
  const h = (i: number) => {
    const dx = Math.abs((i % g.cols) - gx);
    const dy = Math.abs(Math.floor(i / g.cols) - gy);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  // 작은 이진 힙 (f 값, 칸)
  const heap: [number, number][] = [];
  const push = (f: number, i: number) => {
    heap.push([f, i]);
    for (let k = heap.length - 1; k > 0; ) {
      const p = (k - 1) >> 1;
      if (heap[p][0] <= heap[k][0]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let k = 0; ; ) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top[1];
  };
  cost[start] = 0;
  push(h(start), start);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;
  let found = false;
  while (heap.length) {
    const i = pop();
    if (closed[i]) continue;
    if (i === goal) {
      found = true;
      break;
    }
    closed[i] = 1;
    const c = i % g.cols;
    const r = Math.floor(i / g.cols);
    for (const [dx, dy] of dirs) {
      const nc = c + dx;
      const nr = r + dy;
      if (nc < 0 || nr < 0 || nc >= g.cols || nr >= g.rows) continue;
      const j = nr * g.cols + nc;
      if (!g.free[j] || closed[j]) continue;
      if (dx && dy && (!g.free[r * g.cols + nc] || !g.free[nr * g.cols + c])) continue;
      const nextCost = cost[i] + (dx && dy ? Math.SQRT2 : 1);
      if (nextCost < cost[j]) {
        cost[j] = nextCost;
        prev[j] = i;
        push(nextCost + h(j), j);
      }
    }
  }
  if (!found) return null;

  const cells: number[] = [];
  for (let i = goal; i !== -1; i = prev[i]) cells.push(i);
  cells.reverse();
  // 곧게 갈 수 있는 칸은 건너뛰고 꺾는 칸만 남긴다
  const keep: number[] = [];
  let a = 0;
  while (a < cells.length - 1) {
    let b = cells.length - 1;
    while (b > a + 1 && !lineFree(g, cells[a], cells[b])) b--;
    keep.push(cells[b]);
    a = b;
  }
  const points = keep.map(center);
  points[points.length - 1] = end;
  return points;
}
