// 광장 바닥 (도트). 도트 한 칸 = 화면 PIXEL(3)px. 바닥 전체를 도트 해상도로 한 번만 구워(RGBA) 장면이 3배로 키워 쓴다.
// 2.5D (2026-10-11): 땅 높이·절벽 앞면·계단·연못 둑은 terrain.ts가 정한 격자를 그대로 칠한다.
// - 절벽 앞면: 위 단의 풀이 늘어진 가장자리 → 돌벽(줄마다 엇갈린 돌) → 아래 단에 드리운 그늘
// - 돌길은 들쭉날쭉한 자갈과 연석(남쪽 가장자리에 앞면이 보이는 턱), 흙길은 모래색에 풀이 삐죽
// - 풀은 넓은 얼룩(밝은·짙은 잔디)과 키 큰 풀 포기·꽃, 맨 위는 먼 하늘·산·숲, 북쪽(멀리)일수록 옅고 푸르게(대기 원근)
// Phaser 없이 쓰는 순수 계산이라 브라우저 밖에서도 돌릴 수 있다.
import { PALETTE, PIXEL, rgbOf, TILE, TILES } from "@/lib/art/pixel";
import { CENTER, HOME, HOME_BEDS, HORIZON, PLAZA_RADIUS, POND } from "./layout";
import { GROUND_SIZE, hash, PathCode, terrain } from "./terrain";

export { GROUND_SIZE };

const lattices = new Map<string, Float32Array>();
/** 부드러운 얼룩 (격자 s칸마다 값, 사이는 부드럽게 잇는다). 격자 값은 한 번만 계산해 둔다 */
function noise(x: number, y: number, s: number, seed = 0) {
  const key = `${s}:${seed}`;
  const size = 1024;
  let lat = lattices.get(key);
  if (!lat) {
    lat = new Float32Array(size * size / (s * s) + size * 4);
    const n = Math.ceil(size / s) + 2;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) lat[j * n + i] = hash(i + seed * 101, j - seed * 57);
    lattices.set(key, lat);
  }
  const n = Math.ceil(size / s) + 2;
  const gx = Math.floor(x / s);
  const gy = Math.floor(y / s);
  const fx = x / s - gx;
  const fy = y / s - gy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const o = gy * n + gx;
  const a = lat[o] + (lat[o + 1] - lat[o]) * sx;
  const b = lat[o + n] + (lat[o + n + 1] - lat[o + n]) * sx;
  return a + (b - a) * sy;
}

/** 잔디 색: 높이마다 조금 다르게 [밝은, 기본, 짙은, 아주 짙은] */
const GRASS: Record<number, [string, string, string, string]> = {
  0: ["#a6dc8c", "#86c874", "#6cb062", "#4f8f4f"], // 남쪽 들판 (가장 가깝고 짙다)
  1: [PALETTE.G, PALETTE.e, PALETTE.E, "#5e9f5c"],
  2: ["#bde5a0", "#a2d996", "#86c67e", "#66a565"],
  3: ["#c6e8a6", "#abdc9c", "#8fca84", "#6eaa6a"],
};
/** 절벽 돌벽 색 [윗돌 밝은 면, 돌, 돌 그늘, 줄눈, 맨 아래 그늘] (참고 그림처럼 따뜻한 베이지 돌) */
const WALL = ["#f1e3c2", "#dcc79c", "#c4ab7e", "#9a8160", "#6f5c45"];
/** 연못 둑 (흙) */
const BANK = ["#c99a68", "#a97a4c", "#8a5f3a", "#6b4a2e"];
/** 먼 풍경: 하늘(위→아래), 먼 산, 먼 숲 */
const SKY = ["#cfe9f7", "#d9eef8", "#e3f2f8", "#ecf5f2"];
const HILLS = ["#b7cfe0", "#a3c1d6"];
const FAR_FOREST = ["#7fae9c", "#6a9c8b", "#5a8c7c"];
/** 멀리(위쪽)를 옅게 만드는 공기 색 */
export const HAZE_COLOR = "#dcebf2";
const HAZE = rgbOf(HAZE_COLOR);

/** 대기 원근 세기 (0~0.24): 월드 y가 작을수록(북쪽, 멀리) 세다. 바닥과 그 위 그림(scene.ts)이 같이 쓴다 */
export function hazeAt(wy: number) {
  return Math.max(0, (950 - wy) / 950) ** 1.4 * 0.24;
}

let baked: Uint8ClampedArray | null = null;

/** 바닥을 RGBA로 굽는다 (GROUND_SIZE.w × GROUND_SIZE.h). 늘 같은 그림이라 한 번 구운 것을 다시 쓴다 */
export function bakeGround(): Uint8ClampedArray {
  baked ??= bake();
  return baked;
}

function bake(): Uint8ClampedArray {
  const T = terrain();
  const { w: W, h: H } = GROUND_SIZE;
  const PX = PIXEL;
  const PAL: Record<string, string> = { ...PALETTE };
  const [CX, CY, PLAZA] = [CENTER.x, CENTER.y, PLAZA_RADIUS];
  // 가져온 값은 지역 변수로 옮겨 둔다 (번들러가 import를 getter로 바꾸면 칸마다 부르는 비용이 크다)
  const { stone: STONE, path: SAND, grass: GRASS_TILE } = TILES;
  const TL = TILE;
  const [STONE_PATH, DIRT_PATH] = [PathCode.Stone, PathCode.Dirt];
  const { level, water, face, faceH, path, pathT, edge, stairs, stairIn, stairCode } = T;
  const HZ = HORIZON;
  const horizon = Math.round(HZ / PX);
  const out = new Uint8ClampedArray(W * H * 4);
  const rgb = new Map<string, [number, number, number]>();
  const color = (c: string) => {
    let v = rgb.get(c);
    if (!v) rgb.set(c, (v = rgbOf(c)));
    return v;
  };
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : y * W + x);
  const isGrass = (i: number) => i >= 0 && !path[i] && !water[i] && !face[i] && !stairs[i];
  const plazaD = (x: number, y: number) => {
    const dx = (x + 0.5) * PX - CX;
    const dy = (y + 0.5) * PX - CY;
    return Math.abs(dx) > PLAZA + 40 || Math.abs(dy) > PLAZA + 40 ? PLAZA + 40 : Math.sqrt(dx * dx + dy * dy);
  };
  // 내 정원 (도트 칸 단위): 반듯한 타원 안인가, 꽃밭 칸
  const [HX, HY, HRX, HRY] = [HOME.x / PX, HOME.y / PX, HOME.rx / PX, HOME.ry / PX];
  const inGarden = (x: number, y: number) => ((x + 0.5 - HX) / HRX) ** 2 + ((y + 0.5 - HY) / HRY) ** 2 < 1;
  const beds = HOME_BEDS.map((b) => ({ x0: Math.round((b.x - b.w / 2) / PX), y0: Math.round((b.y - b.h / 2) / PX), w: Math.round(b.w / PX), h: Math.round(b.h / PX) }));
  const BED_FLOWERS = [PAL.V, PAL.R, PAL.U, PAL.z, PAL.w];
  // 대기 원근 세기 (줄마다)
  const farOf = new Float32Array(H);
  for (let y = 0; y < H; y++) {
    const wy = (y + 0.5) * PX;
    farOf[y] = wy < HZ ? 0.3 + 0.25 * (1 - wy / HZ) : hazeAt(wy);
  }

  /** 그 칸 잔디 색 (얼룩·풀 포기) */
  const grass = (x: number, y: number, lv: number) => {
    const g = GRASS[lv] ?? GRASS[1];
    const big = noise(x, y, 46, lv);
    const v = big * 0.8 + hash(x >> 2, y >> 2) * 0.2;
    const tile = GRASS_TILE[(y + (big > 0.5 ? 5 : 0)) % TL][(x + (big > 0.6 ? 7 : 0)) % TL];
    if (v > 0.66) return tile === "E" ? g[1] : tile === "G" ? g[0] : hash(x, y) < 0.05 ? g[1] : g[0];
    if (v < 0.32) return tile === "E" ? g[3] : tile === "G" ? g[1] : g[2];
    return tile === "E" ? g[2] : tile === "G" ? g[0] : g[1];
  };

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const lv = level[i];
      let c: string;
      const lx = x % TL;
      const ly = y % TL;

      if (y < horizon) {
        // ===== 먼 풍경 =====
        const hill1 = 14 + 7 * Math.sin(x / 31) + 4 * Math.sin(x / 11 + 2);
        const hill2 = 22 + 5 * Math.sin(x / 23 + 1) + 3 * Math.sin(x / 7);
        // 먼 숲: 나무 머리가 둥글게 솟은 줄
        const crown = (x % 9) - 4;
        const forest = 30 + Math.round(3 * noise(x, 0, 6, 3)) + Math.round((crown * crown) / 6) - (hash(Math.floor(x / 9), 1) < 0.4 ? 3 : 0);
        if (y >= forest) {
          const depth = y - forest;
          c = depth < 2 ? FAR_FOREST[0] : depth < 9 ? (hash(x, y) < 0.15 ? FAR_FOREST[0] : FAR_FOREST[1]) : FAR_FOREST[2];
        } else if (y >= hill2) c = hash(x >> 1, y) < 0.06 ? HILLS[0] : HILLS[1];
        else if (y >= hill1) c = HILLS[0];
        else c = SKY[Math.min(3, Math.floor(y / 5) + (hash(x, y) < (y % 5) / 6 ? 1 : 0))];
      } else if (water[i]) {
        // ===== 연못: 둑(흙 앞면) → 짙은 물 → 물. 반짝임 =====
        if (face[i]) {
          const r = face[i] - 1;
          c = r === 0 ? (hash(x, y) < 0.5 ? GRASS[1][2] : BANK[0]) : r < faceH[i] - 1 ? BANK[r % 3 === 2 ? 2 : 1] : BANK[3];
          if (r > 0 && r < faceH[i] - 1 && hash(x >> 1, r) < 0.12) c = BANK[0];
        } else {
          const up = (k: number) => at(x, y - k);
          const deep = up(1) >= 0 && face[up(1)] ? 1 : up(2) >= 0 && face[up(2)] ? 2 : 0;
          c = deep ? PAL.v : hash(x >> 2, y) < 0.025 ? PAL.I : (x + y * 2) % 23 === 0 ? "#bfe8f8" : PAL.i;
          // 물가(옆·아래) 테두리
          if (!water[at(x + 1, y)] || !water[at(x - 1, y)] || !water[at(x, y + 1)]) c = PAL.v;
        }
      } else if (stairs[i] && face[i]) {
        // ===== 계단 (절벽 앞면을 지나는 길): 밝은 디딤판 2줄 + 챌판 그늘 2줄, 양옆은 돌 난간 =====
        const r = face[i] - 1;
        const inner = stairIn[i];
        if (inner <= 1) c = WALL[4];
        else if (inner <= 3) c = r % 5 === 0 ? WALL[1] : r % 5 === 4 ? WALL[4] : inner === 2 ? WALL[3] : WALL[2];
        else {
          const k = r % 4;
          c = k === 0 ? "#f7f1e6" : k === 1 ? PAL.Y : k === 2 ? PAL.y : PAL.X;
          if (k === 1 && hash(x, r) < 0.12) c = PAL.y;
        }
      } else if (face[i]) {
        // ===== 절벽 앞면: 늘어진 풀 → 밝은 갓돌 → 돌 쌓기(돌마다 왼쪽 위 밝게, 오른쪽 아래 그늘) → 아래 그늘 =====
        const r = face[i] - 1;
        const fh = faceH[i];
        const upper = level[at(x, y - r - 1)] ?? lv;
        const gU = GRASS[upper] ?? GRASS[1];
        // 위가 돌광장이면 늘어진 풀 대신 돌 테두리
        const stoneTop = plazaD(x, y - r - 1) < PLAZA || inGarden(x, y - r - 1);
        const droop = stoneTop ? 2 : 1 + (hash(x >> 1, 9) < 0.45 ? 1 : 0) + (hash(x >> 2, 4) < 0.18 ? 2 : 0);
        if (r < droop) c = stoneTop ? (r === 0 ? PAL.Y : PAL.X) : r === droop - 1 ? gU[3] : gU[2];
        else if (r === droop) c = WALL[0];
        else if (r >= fh - 1) c = WALL[4];
        else {
          const body = r - droop - 1;
          const CH = 5;
          const course = Math.floor(body / CH);
          const cr = body % CH;
          const BL = 11;
          const offset = (course % 2) * 5 + Math.floor(hash(course, 3) * 4);
          const bx = (x + offset) % BL;
          const stone = Math.floor((x + offset) / BL);
          if (cr === CH - 1 || bx === 0) c = WALL[3];
          else if (cr === 0 || bx === 1) c = WALL[0];
          else if (cr === CH - 2 || bx === BL - 1) c = WALL[2];
          else c = hash(stone, course) < 0.25 ? WALL[2] : hash(x, r) < 0.06 ? WALL[2] : WALL[1];
          // 아래쪽 1/3은 그늘 (흙이 묻고 빛이 덜 든다)
          if (r > fh * 0.7 && c === WALL[1]) c = WALL[2];
          else if (r > fh * 0.7 && c === WALL[0]) c = WALL[1];
        }
      } else if (path[i] || stairs[i]) {
        // ===== 길 (계단 너비만큼 길 밖으로 나온 계단 칸도 그 길처럼) =====
        const kind = path[i] || stairCode[i];
        const t = path[i] ? pathT[i] : 60;
        if (kind === STONE_PATH) {
          // 자갈: 5×4 돌, 줄마다 엇갈림. 가장자리는 연석
          const row = Math.floor(y / 4);
          const sx = (x + (row % 2) * 3) % 5;
          const sy = y % 4;
          const k = hash(Math.floor((x + (row % 2) * 3) / 5), row);
          if (t > 82) c = t > 92 ? PAL.X : PAL.Y;
          else if (sx === 0 || sy === 3) c = PAL.x;
          else c = sy === 0 && sx < 3 ? PAL.Y : k < 0.25 ? PAL.x : k < 0.7 ? PAL.y : "#e6ddd0";
        } else {
          c = PAL[SAND[ly][lx]];
          if (t > 80) c = hash(x, y) < 0.5 ? PAL.A : c;
        }
        if (stairs[i] && edge[i]) {
          // 뒤·옆 낭떠러지를 지나는 계단: 단 줄
          if (stairIn[i] <= 1) c = WALL[3];
          else if (y % 4 === 0) c = WALL[2];
        }
      } else {
        // ===== 풀 =====
        c = grass(x, y, lv);
        const d = plazaD(x, y) - PLAZA;
        const bed = lv === HOME.level && inGarden(x, y) ? beds.find((b) => x >= b.x0 && x < b.x0 + b.w && y >= b.y0 && y < b.y0 + b.h) : undefined;
        if (bed) {
          // 내 정원 꽃밭: 나무 테두리 → 흙 → 꽃 (잎 위에 꽃송이)
          const bx = x - bed.x0;
          const by = y - bed.y0;
          if (bx === 0 || by === 0 || bx === bed.w - 1 || by === bed.h - 1) c = by === bed.h - 1 ? PAL.n : PAL.b;
          else {
            const k = hash(x >> 1, y >> 1);
            c = (x + y) % 3 === 0 ? PAL.n : PAL.b;
            if (k < 0.55) c = (x + y) % 2 ? PAL.l : PAL.m;
            if ((x % 3 === 1 && y % 3 === 1) || k < 0.12) c = BED_FLOWERS[Math.floor(hash(x >> 1, (y >> 1) + 7) * BED_FLOWERS.length)];
          }
        } else if (lv === HOME.level && inGarden(x, y)) {
          // 내 정원 잔디: 깎은 줄무늬 (넓은 띠가 엇갈린다)
          const g = GRASS[1];
          c = Math.floor((x + Math.floor(y / 2)) / 7) % 2 ? g[0] : g[1];
          if (hash(x, y) < 0.04) c = g[2];
        }
        if (edge[i] && lv === HOME.level && inGarden(x, y)) {
          // 내 정원 뒤·옆 가장자리: 낮은 돌 테 (광장처럼)
          c = (x + y) % 5 === 0 ? PAL.x : hash(x, y) < 0.5 ? PAL.Y : PAL.y;
          if (!edge[at(x, y - 1)] || !inGarden(x, y - 1)) c = PAL.X;
        } else if (bed || (lv === HOME.level && inGarden(x, y))) {
          // 꽃밭·잔디는 그대로 (아래 가장자리 그늘·연석은 칠한다)
          const n = at(x, y - 1);
          if (n >= 0 && path[n] === STONE_PATH && !stairs[n]) c = PAL.X;
        } else if (d < 0) c = PAL[STONE[ly][lx]];
        else if (d < 12) c = d < 2.5 || d > 9.5 ? PAL.X : (x + y) % 6 === 0 ? PAL.x : PAL.y;
        // 돌광장 남쪽 턱의 앞면
        else if (d < 16 && (y + 0.5) * PX > CY + 40) c = d < 14 ? "#9e8c7c" : "#7c6b5e";
        else {
          // 높은 단의 뒤·옆 가장자리: 위 단 쪽은 밝은 테두리, 아래 단 쪽은 그늘
          if (edge[i]) {
            let higher = false;
            let lower = false;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
              const j = at(x + dx, y + dy);
              if (j < 0 || face[j] || water[j]) continue;
              if (level[j] > lv) higher = true;
              if (level[j] < lv) lower = true;
            }
            if (lower) c = GRASS[lv]?.[3] ?? c;
            else if (higher) c = GRASS[lv]?.[2] ?? c;
          }
          // 절벽 아래 그늘: 바로 위가 앞면이면 몇 줄 어둡게
          for (let k = 1; k <= 4; k++) {
            const j = at(x, y - k);
            if (j >= 0 && face[j] && !water[j]) {
              c = k <= 2 ? GRASS[lv]?.[3] ?? c : GRASS[lv]?.[2] ?? c;
              break;
            }
          }
          // 길 남쪽 연석 앞면 (돌길만): 바로 위가 돌길 가장자리
          const n = at(x, y - 1);
          if (n >= 0 && path[n] === STONE_PATH && !stairs[n]) c = PAL.X;
          else if (n >= 0 && path[n] === DIRT_PATH && !stairs[n] && hash(x, y) < 0.5) c = GRASS[lv]?.[2] ?? c;
        }
      }

      let [R, G, B] = color(c);
      // 대기 원근: 북쪽(멀리)일수록 공기 색을 섞는다 (먼 풍경은 더)
      const far = farOf[y];
      if (far > 0) {
        R += (HAZE[0] - R) * far;
        G += (HAZE[1] - G) * far;
        B += (HAZE[2] - B) * far;
      }
      const o = i * 4;
      out[o] = R;
      out[o + 1] = G;
      out[o + 2] = B;
      out[o + 3] = 255;
    }

  // ===== 풀 포기·꽃 도장 (풀 위에만) =====
  const put = (x: number, y: number, c: string) => {
    const i = at(x, y);
    if (i < 0 || !isGrass(i) || y < horizon + 2 || plazaD(x, y) < PLAZA + 18) return;
    const [R, G, B] = color(c);
    const far = farOf[y];
    out[i * 4] = R + (HAZE[0] - R) * far;
    out[i * 4 + 1] = G + (HAZE[1] - G) * far;
    out[i * 4 + 2] = B + (HAZE[2] - B) * far;
  };
  const stamp = (rows: string[], sx: number, sy: number, colors: Record<string, string>) =>
    rows.forEach((row, j) => [...row].forEach((ch, k) => ch !== "." && put(sx + k, sy + j, colors[ch] ?? PAL[ch])));
  // 키 큰 풀 (참고 그림의 풀 무더기): 잎 끝은 밝고 아래는 짙다
  const TUFTS = [
    ["L.L..L.", ".lL.Ll.", "ll.lll.", "lmlmllm", "mmMmmMm"],
    [".L..L.", "Ll.lL.", "lllll.", "mlmmlm", "MmMmMm"],
    ["..L...", ".lL.L.", "lmllL.", "mmlml.", "MmmMm."],
  ];
  const FLOWERS = [PAL.w, PAL.V, PAL.z, PAL.U, "#ffb08a"];
  for (let k = 0; k < 2600; k++) {
    const x = Math.floor(hash(k, 11) * W);
    const y = Math.floor(hash(k, 23) * H);
    const i = at(x, y);
    if (!isGrass(i) || !isGrass(at(x + 6, y + 4)) || edge[i]) continue;
    const lv = level[i];
    const g = GRASS[lv] ?? GRASS[1];
    // 풀 포기는 무리 지어 (얼룩 값이 높은 곳)
    if (noise(x, y, 30, 5) > 0.55) stamp(TUFTS[k % 3], x, y, { L: g[0], l: g[1], m: g[2], M: g[3] });
    else if (k % 3 === 0) {
      const f = FLOWERS[k % FLOWERS.length];
      stamp([".f.", "fYf", ".s."], x, y, { f, Y: PAL.z, s: g[3] });
    } else put(x, y, g[3]);
  }
  // 연잎과 연꽃
  for (const [dx, dy, flower] of [[-60, 20, true], [40, -5, false], [70, 30, true], [-20, -20, false], [10, 40, false]] as const) {
    const px = Math.round((POND.x + dx) / PX);
    const py = Math.round((POND.y + dy) / PX);
    [".####.", "#lLll#", "#llmm#", "#lmm.#", ".####."].forEach((row, j) =>
      [...row].forEach((ch, k) => {
        if (ch === ".") return;
        const o = ((py - 2 + j) * W + px - 3 + k) * 4;
        const [R, G, B] = color(PAL[ch]);
        out[o] = R;
        out[o + 1] = G;
        out[o + 2] = B;
      }),
    );
    if (flower) {
      const o = ((py - 2) * W + px) * 4;
      const [R, G, B] = color(PAL.V);
      out[o] = R;
      out[o + 1] = G;
      out[o + 2] = B;
    }
  }
  return out;
}

