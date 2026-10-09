// 광장 바닥 (도트). 도트 한 칸 = 화면 PIXEL(3)px. 바닥 전체를 도트 해상도로 한 번만 구워(RGBA) 장면이 3배로 키워 쓴다.
// 잔디·꽃 잔디·흙길·돌바닥은 pixel.ts의 16×16 타일 무늬를 그대로 쓰고, 둥근 광장·둘레 길·연못은 칸마다 계산한다.
// Phaser 없이 쓰는 순수 계산이라 브라우저 밖에서도 돌릴 수 있다.
import { PALETTE, PIXEL, rgbOf, TILE, TILES } from "@/lib/art/pixel";
import { CENTER, HOUSE_SLOTS, houseSlot, PLAZA_RADIUS, POND_POS, RING_RADIUS, TOWN_RADIUS, WORLD } from "./layout";

/** 바닥 종류 */
const Kind = {
  Grass: 0,
  Wild: 1, // 타운 밖 짙은 잔디
  Yard: 2, // 집 마당 밝은 잔디
  Path: 3,
  Stone: 4,
  StoneRim: 5,
  Hedge: 6, // 광장 둘레 꽃 울타리
  Water: 7,
  Shore: 8, // 연못 가장자리 (짙은 물)
  Bank: 9, // 연못 테두리 외곽선
} as const;
type Kind = (typeof Kind)[keyof typeof Kind];

// 잔디 3종: 같은 무늬(e·E·G)를 다른 색으로 칠한다
const GRASS: Record<string, Record<string, string>> = {
  town: { e: PALETTE.e, E: PALETTE.E, G: PALETTE.G },
  wild: { e: "#88cc81", E: "#6fb868", G: "#a3d898" },
  yard: { e: "#ace39f", E: "#8fd18a", G: "#c8ecb6" },
};

/** 같은 입력에 늘 같은 0~1 값 (자리마다 고정된 무늬) */
function hash(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 거리 (Math.hypot은 느려서 바닥을 구울 때는 쓰지 않는다) */
const len = (dx: number, dy: number) => Math.sqrt(dx * dx + dy * dy);

/** 점에서 선분까지 거리 */
function toSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
  return len(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay)));
}

/** 바닥 도트 크기 (칸) */
export const GROUND_SIZE = { w: Math.ceil(WORLD.width / PIXEL), h: Math.ceil(WORLD.height / PIXEL) };

/** 바닥을 RGBA로 굽는다 (GROUND_SIZE.w × GROUND_SIZE.h) */
export function bakeGround(): Uint8ClampedArray {
  // 가져온 값은 지역 변수로 옮겨 둔다 (번들러가 import를 getter로 바꾸면 칸마다 부르는 비용이 크다)
  const [CX, CY, PLAZA, RING, TOWN, PONDX, PONDY, PX] = [CENTER.x, CENTER.y, PLAZA_RADIUS, RING_RADIUS, TOWN_RADIUS, POND_POS.x, POND_POS.y, PIXEL];
  const [SLOTS, T] = [HOUSE_SLOTS, TILE];
  const PAL: Record<string, string> = { ...PALETTE };
  const { stone: STONE, path: PATH, grassFlowers: FLOWERS, grass2: GRASS2, grass: GRASS1 } = TILES;
  const { w: W, h: H } = GROUND_SIZE;
  const FLOWER_COLORS = [PAL.V, PAL.z, PAL.w, PAL.U];
  const kind = new Uint8Array(W * H);
  const paths = Array.from({ length: SLOTS }, (_, i) => {
    const p = houseSlot(i);
    return { ax: CX + Math.cos(p.angle) * PLAZA, ay: CY + Math.sin(p.angle) * PLAZA, bx: p.x, by: p.y + 30, yx: p.x, yy: p.y - 40 };
  });

  const STEP = (2 * Math.PI) / SLOTS;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const wx = (x + 0.5) * PX;
      const wy = (y + 0.5) * PX;
      const d = len(wx - CX, wy - CY);
      let k: Kind;
      // 가장 가까운 집 쪽 길·마당만 본다 (집은 원 둘레에 같은 간격으로 있다)
      const slot = (Math.round((Math.atan2(wy - CY, wx - CX) - Math.PI / 2) / STEP) + SLOTS * 2) % SLOTS;
      const s = paths[slot];
      // 집으로 가는 길은 꽃 울타리를 지나 광장 돌바닥까지 이어진다
      const onPath = d >= PLAZA + 15 && d < RING + 220 && toSegment(wx, wy, s.ax, s.ay, s.bx, s.by) < 27;
      if (d < PLAZA) k = Kind.Stone;
      else if (d < PLAZA + 15) k = Kind.StoneRim;
      else if (d < PLAZA + 42) k = onPath ? Kind.Path : Kind.Hedge;
      else {
        const pdx = (wx - PONDX) / 125;
        const pdy = (wy - PONDY) / 75;
        const pond = pdx * pdx + pdy * pdy;
        if (pond < 0.78) k = Kind.Water;
        else if (pond < 0.9) k = Kind.Shore;
        else if (pond < 0.96) k = Kind.Bank;
        else if (Math.abs(d - RING) < 38 || onPath) k = Kind.Path;
        else if (d > RING && ((wx - s.yx) / 130) ** 2 + ((wy - s.yy) / 85) ** 2 < 1) k = Kind.Yard;
        else k = d < RING + 120 ? Kind.Grass : Kind.Wild;
      }
      kind[y * W + x] = k;
    }

  const out = new Uint8ClampedArray(W * H * 4);
  const rgb = new Map<string, [number, number, number]>();
  const color = (c: string) => {
    let v = rgb.get(c);
    if (!v) rgb.set(c, (v = rgbOf(c)));
    return v;
  };
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= W || y >= H ? Kind.Grass : kind[y * W + x]);
  const soft = (k: number) => k === Kind.Grass || k === Kind.Wild || k === Kind.Yard;

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = kind[y * W + x];
      const tx = Math.floor(x / T);
      const ty = Math.floor(y / T);
      const lx = x % T;
      const ly = y % T;
      const r = hash(tx, ty);
      let c: string;
      switch (k) {
        case Kind.Stone:
          c = PAL[STONE[ly][lx]];
          break;
        case Kind.StoneRim: {
          const d = len((x + 0.5) * PX - CX, (y + 0.5) * PX - CY) - PLAZA;
          c = d < 3 || d > 12 ? PAL.X : (x + y) % 6 === 0 ? PAL.x : PAL.y;
          break;
        }
        case Kind.Hedge: {
          // 꽃 울타리: 잎 덩어리(2×2칸)마다 명암, 드문드문 꽃
          const h = hash(x >> 1, y >> 1);
          const edge = !(at(x - 1, y) === Kind.Hedge && at(x + 1, y) === Kind.Hedge && at(x, y - 1) === Kind.Hedge && at(x, y + 1) === Kind.Hedge);
          const flower = FLOWER_COLORS[Math.floor(hash(y >> 1, x >> 1) * 4)];
          c = edge ? PAL.M : h < 0.07 ? flower : h < 0.35 ? PAL.m : h < 0.8 ? PAL.l : PAL.L;
          break;
        }
        case Kind.Water:
          c = hash(x >> 2, y) < 0.03 ? PAL.I : PAL.i;
          break;
        case Kind.Shore:
          c = PAL.v;
          break;
        case Kind.Bank:
          c = PAL["#"];
          break;
        case Kind.Path: {
          c = PAL[PATH[ly][lx]];
          // 잔디와 맞닿은 가장자리: 짙은 흙 테두리와 삐죽한 풀
          const n1 = soft(at(x - 1, y)) || soft(at(x + 1, y)) || soft(at(x, y - 1)) || soft(at(x, y + 1));
          if (n1) c = hash(x, y) < 0.45 ? GRASS.town.e : PAL.A;
          else if (soft(at(x - 2, y)) || soft(at(x + 2, y)) || soft(at(x, y - 2)) || soft(at(x, y + 2))) c = hash(x, y) < 0.3 ? PAL.A : c;
          break;
        }
        default: {
          const set = k === Kind.Wild ? GRASS.wild : k === Kind.Yard ? GRASS.yard : GRASS.town;
          const tile = r < 0.06 && k !== Kind.Yard ? FLOWERS : r < 0.55 ? GRASS1 : GRASS2;
          const ch = tile[(ly + (r < 0.3 ? 5 : 0)) % T][(lx + Math.floor(r * 7)) % T];
          c = set[ch] ?? PAL[ch];
          // 타운 잔디 원 경계: 짙은 풀 줄
          const d = Math.abs(len((x + 0.5) * PX - CX, (y + 0.5) * PX - CY) - TOWN);
          if (d < 4 && k === Kind.Grass) c = (x + y) % 3 ? GRASS.wild.E : GRASS.town.E;
        }
      }
      const [R, G, B] = color(c);
      const i = (y * W + x) * 4;
      out[i] = R;
      out[i + 1] = G;
      out[i + 2] = B;
      out[i + 3] = 255;
    }

  // 연잎과 연꽃
  const stamp = (rows: string[], sx: number, sy: number) =>
    rows.forEach((row, j) =>
      [...row].forEach((ch, i) => {
        if (ch === ".") return;
        const [R, G, B] = color(PAL[ch]);
        const o = ((sy + j) * W + sx + i) * 4;
        out[o] = R;
        out[o + 1] = G;
        out[o + 2] = B;
      }),
    );
  for (const [dx, dy, flower] of [[-60, 20, true], [40, -10, false], [70, 30, true], [-20, -30, false]] as const) {
    const px = Math.round((PONDX + dx) / PX);
    const py = Math.round((PONDY + dy) / PX);
    stamp([".####.", "#lLll#", "#llmm#", "#lmm.#", ".####."], px - 3, py - 2);
    if (flower) stamp([".V.", "VzV", ".V."], px - 1, py - 2);
  }
  return out;
}
