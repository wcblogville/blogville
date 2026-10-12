// "우리 집" 방 도트 그림 (2026-10-09 "남은 그림도 도트로", 2026-10-12 "평면 말고 정육면체 형태로").
// 방은 아이소메트릭 상자다: 마름모 바닥(N × N칸) + 뒤쪽 두 벽(왼쪽 벽에 창, 오른쪽 벽에 문). 하바·싸이월드 미니룸처럼.
// 바닥 한 칸 = 16 × 8 도트 마름모(2:1), 방 그림 전체를 ROOM_PIXEL(4)배로 그린다 → 한 칸이 화면에서 64 × 32px.
// 그림은 한 장의 도트 SVG: 도트 한 칸마다 "바닥·왼쪽 벽·오른쪽 벽·바닥 두께" 중 어디인지 계산해 칠한다 (외부 그림 파일 없음).
// 창 유리 자리는 비워 두고(투명) 화면에서 그 뒤에 주인이 고른 배경 장면을 깐다.
import { type Colors, Pix, spriteSvg, svgDataUri, type Sprite } from "./pixel";

/** 방 안 도트 한 칸 = 4px */
export const ROOM_PIXEL = 4;

/** 바닥 마름모 한 칸의 도트 크기 (가로 16, 세로 8) */
const HW = 8;
const HH = 4;
/** 벽 높이 (도트, 120px), 벽 위 띠, 바닥 두께, 둘레 여백 */
const WALL_H = 30;
const CAP = 3;
const SLAB = 4;
const MARGIN = 2;
/** 창 (왼쪽 벽): 가로 24도트(벽 3칸), 높이 14도트, 바닥에서 11도트 위 */
const WIN_W = 24;
const WIN_H = 14;
const WIN_B = 11;
/** 문 (오른쪽 벽): 가로 12도트(벽 1.5칸), 높이 23도트 */
const DOOR_W = 12;
const DOOR_H = 23;

const COLORS: Colors = {
  // 오른쪽 벽지: 크림색 줄무늬 두 가지 + 작은 꽃무늬
  7: "#fff4dc",
  8: "#fbe9c6",
  9: "#f3d9ad",
  // 왼쪽 벽지: 같은 무늬, 그늘진 쪽이라 조금 어둡게
  r: "#f2e0bd",
  s: "#ead5ab",
  o: "#dfc394",
  // 마루: 판자 두 가지, 밝은 결, 이음매
  D: "#d89a63",
  F: "#cf8f58",
  J: "#e4ab74",
  O: "#a8703f",
  // 바닥 두께 (왼쪽 면 어둡게, 오른쪽 면 조금 밝게)
  k: "#7a4a2e",
  K: "#94603a",
  // 굽도리·벽 위 띠·창틀·문 (나무)
  B: "#dba46a",
  b: "#ad7445",
  n: "#7a4a2e",
  "#": "#4a3426",
  z: "#ffd36e",
  Z: "#fff0a8",
};

// 벽지 무늬 (16 × 16). 벽 위에서는 세로줄이 곧게 서고 가로 줄은 벽을 따라 비스듬해진다
const WALL: Sprite = [
  "7777777788888888",
  "7777777788888888",
  "7779777788888888",
  "7797977788888888",
  "7779777788888888",
  "7777777788888888",
  "7777777788888888",
  "7777777788888888",
  "7777777788888888",
  "7777777788888888",
  "7777777788888888",
  "7777777788888888",
  "7777777788889888",
  "7777777788898988",
  "7777777788889888",
  "7777777788888888",
];
const SHADE: Record<string, string> = { 7: "r", 8: "s", 9: "o" };

/** 방 한 변 칸 수(grid)로 정해지는 크기·자리 (모두 화면 px = 도트 × ROOM_PIXEL) */
export type IsoRoom = {
  grid: number;
  /** 방 그림 전체 크기 */
  width: number;
  height: number;
  /** 바닥 뒤 모서리(0,0 칸의 위 꼭짓점) */
  origin: { x: number; y: number };
  /** 바닥 한 칸 마름모 (가로·세로 px) */
  tile: { w: number; h: number };
  /** 창 유리 자리를 덮는 네모 (그 뒤에 창밖 장면을 깐다). clip = 네모 안의 평행사변형(벽을 따라 기운 유리) CSS clip-path */
  glass: { x: number; y: number; width: number; height: number; clip: string };
  /** 문 자리를 덮는 네모 (누르는 링크) */
  door: { x: number; y: number; width: number; height: number };
};

function geometry(grid: number) {
  const ox = MARGIN + grid * HW;
  const oy = MARGIN + CAP + WALL_H;
  const width = MARGIN * 2 + grid * HW * 2;
  const height = oy + grid * HH * 2 + SLAB + MARGIN;
  const winT = Math.floor((grid - 3) / 2) + 0.5; // 창이 시작하는 벽 칸 (왼쪽 벽 가운데쯤)
  const doorT = grid - 2.25; // 문이 시작하는 벽 칸 (오른쪽 벽 앞쪽)
  return { ox, oy, width, height, winT, doorT };
}

/** 방 크기·자리 (화면 px) */
export function isoRoom(grid: number): IsoRoom {
  const { ox, oy, width, height, winT, doorT } = geometry(grid);
  const P = ROOM_PIXEL;
  // 창 유리: 왼쪽 벽에서 가로 [winT, winT + 3]칸, 높이 [WIN_B, WIN_B + WIN_H]
  const gx0 = ox - winT * HW - WIN_W;
  const gy0 = oy + winT * HH - (WIN_B + WIN_H);
  const gy1 = oy + (winT + WIN_W / HW) * HH - WIN_B;
  const dx0 = ox + doorT * HW;
  const dy0 = oy + doorT * HH - DOOR_H;
  const dy1 = oy + (doorT + DOOR_W / HW) * HH;
  return {
    grid,
    width: width * P,
    height: height * P,
    origin: { x: ox * P, y: oy * P },
    tile: { w: HW * 2 * P, h: HH * 2 * P },
    glass: {
      x: gx0 * P,
      y: gy0 * P,
      width: WIN_W * P,
      height: (gy1 - gy0) * P,
      // 왼쪽 끝은 오른쪽 끝보다 WIN_W / 2도트 낮다 (벽 기울기 1:2)
      clip: `polygon(0 ${(WIN_W / 2) * P}px, ${WIN_W * P}px 0, ${WIN_W * P}px ${WIN_H * P}px, 0 ${(WIN_W / 2 + WIN_H) * P}px)`,
    },
    door: { x: dx0 * P, y: dy0 * P, width: DOOR_W * P, height: (dy1 - dy0) * P },
  };
}

/** 바닥 위 점(칸 좌표, 0.5 = 칸 가운데) → 방 그림 안 화면 px */
export function floorToScreen(room: IsoRoom, x: number, y: number) {
  return { x: room.origin.x + ((x - y) * room.tile.w) / 2, y: room.origin.y + ((x + y) * room.tile.h) / 2 };
}

/** 방 그림 안 화면 px → 바닥 칸 좌표 (소수). 칸 번호는 Math.floor */
export function screenToFloor(room: IsoRoom, sx: number, sy: number) {
  const a = (sx - room.origin.x) / (room.tile.w / 2);
  const b = (sy - room.origin.y) / (room.tile.h / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** 방 도트 그림 (글자 줄). 칸 계산은 도트 한 칸의 가운데 점으로 한다 */
function roomRows(grid: number): string[] {
  const { ox, oy, width, height, winT, doorT } = geometry(grid);
  const rows: string[] = [];
  const floorAt = (cx: number, cy: number) => {
    const a = (cx - ox) / HW;
    const b = (cy - oy) / HH;
    const x = (a + b) / 2;
    const y = (b - a) / 2;
    return x >= 0 && y >= 0 && x < grid && y < grid ? { x, y } : null;
  };
  for (let py = 0; py < height; py++) {
    let line = "";
    for (let px = 0; px < width; px++) {
      const cx = px + 0.5;
      const cy = py + 0.5;
      const f = floorAt(cx, cy);
      if (f) {
        line += floorPixel(f.x, f.y, floorAt(cx + 1, cy), floorAt(cx, cy + 1));
        continue;
      }
      // 바닥 두께: 바로 위 몇 도트 안에 바닥이 있으면 앞면
      let slab = "";
      for (let d = 1; d <= SLAB; d++) {
        if (floorAt(cx, cy - d)) {
          slab = d === SLAB ? "#" : cx < ox ? "k" : "K";
          break;
        }
      }
      if (slab) {
        line += slab;
        continue;
      }
      line += wallPixel(px, cx, cy, ox, oy, grid, winT, doorT);
    }
    rows.push(line);
  }
  return rows;
}

// 마루: 오른쪽 벽과 나란한 판자(한 칸에 두 장, 두 칸 길이, 줄마다 엇갈림). 판자 사이에 어두운 이음매, 판자마다 색을 바꾼다
function floorPixel(x: number, y: number, right: { x: number; y: number } | null, below: { x: number; y: number } | null) {
  const row = (p: { x: number; y: number }) => Math.floor(p.y * 2);
  const plank = (p: { x: number; y: number }) => Math.floor((p.x + (row(p) % 2)) / 2);
  const me = { x, y };
  if (below && (row(below) !== row(me) || plank(below) !== plank(me))) return "O";
  if (right && plank(right) !== plank(me)) return "O";
  const tone = (row(me) * 3 + plank(me)) % 3;
  return tone === 0 ? "J" : tone === 1 ? "D" : "F";
}

function wallPixel(px: number, cx: number, cy: number, ox: number, oy: number, grid: number, winT: number, doorT: number) {
  const left = cx < ox;
  const t = left ? (ox - cx) / HW : (cx - ox) / HW;
  if (t > grid) return ".";
  const h = oy + t * HH - cy; // 바닥에서 위로 몇 도트
  if (h < 0 || h >= WALL_H + CAP) return ".";
  // 벽 끝 세로 테두리, 뒤 모서리 세로줄
  if (t > grid - 1 / HW) return "#";
  if (h >= WALL_H + CAP - 1) return "#";
  if (h >= WALL_H) return h >= WALL_H + 1 ? "B" : "n";
  if (Math.abs(cx - ox) < 1) return "o";
  // 창 (왼쪽 벽)
  if (left) {
    const u = (ox - cx) - winT * HW; // 창 왼쪽 끝에서 가로로 몇 도트 (벽을 따라)
    const w = WIN_W - 1 - u;
    const v = h - WIN_B;
    if (u >= -1 && u < WIN_W + 1 && v >= -2 && v < 0) return v < -1 ? "#" : "b"; // 창턱
    if (u >= 0 && u < WIN_W && v >= 0 && v < WIN_H) {
      if (w < 1 || u < 1 || v < 1 || v >= WIN_H - 1) return "#";
      if (w < 2 || u < 2 || v < 2 || v >= WIN_H - 2) return "B";
      if (Math.abs(u - WIN_W / 2) < 1 || Math.abs(v - WIN_H / 2) < 0.75) return "b"; // 창살
      return ".";
    }
  } else {
    // 문 (오른쪽 벽): 위가 둥근 판자 문, 손잡이
    const u = (cx - ox) - doorT * HW;
    if (u >= 0 && u < DOOR_W && h >= 0 && h < DOOR_H) {
      const r = DOOR_W / 2;
      const top = DOOR_H - r; // 둥근 부분이 시작하는 높이
      const dx = u - r;
      const dy = h - top;
      const inArch = h < top || dx * dx + dy * dy < r * r;
      const inInner = h < top ? u >= 1 && u < DOOR_W - 1 : dx * dx + dy * dy < (r - 1) * (r - 1);
      if (inArch) {
        if (!inInner) return "#";
        if (u >= DOOR_W - 3.5 && u < DOOR_W - 2 && h >= 9 && h < 11) return "z"; // 손잡이
        if (Math.abs(u - r) < 0.5) return "n";
        return h > 13 && h < 15 ? "B" : "b";
      }
    }
  }
  // 굽도리 (바닥 바로 위 나무 띠)
  if (h < 3) return h >= 2 ? "B" : "b";
  const ch = WALL[Math.floor(h) % 16][Math.floor(px) % 16];
  return left ? (SHADE[ch] ?? ch) : ch;
}

const cache = new Map<number, string>();

/** 방 그림 data URI (ROOM_PIXEL배). 방 크기마다 한 번만 만든다 */
export function isoRoomDataUri(grid: number): string {
  let uri = cache.get(grid);
  if (!uri) {
    uri = svgDataUri(spriteSvg(roomRows(grid), { scale: ROOM_PIXEL, colors: COLORS }));
    cache.set(grid, uri);
  }
  return uri;
}

// ===== 평면 타일 (장소 띠 그림 place-banner.tsx가 쓴다): 벽지·마루 16 × 16, 창문 =====
const FLOOR: Sprite = [
  "JJJJJJJJJJJOJJJJ",
  "DDDDDDDDDDDODDDD",
  "DDDDDDDDDDDODDDD",
  "OOOOOOOOOOOOOOOO",
  "JJJJOJJJJJJJJJJJ",
  "FFFFOFFFFFFFFFFF",
  "FFFFOFFFFFFFFFFF",
  "OOOOOOOOOOOOOOOO",
  "JJJJJJJJJJJJJOJJ",
  "DDDDDDDDDDDDDODD",
  "DDDDDDDDDDDDDODD",
  "OOOOOOOOOOOOOOOO",
  "JJJJJJJJOJJJJJJJ",
  "FFFFFFFFOFFFFFFF",
  "FFFFFFFFOFFFFFFF",
  "OOOOOOOOOOOOOOOO",
];

// 창문: 나무 틀, 하늘이 비치는 유리, 십자 창살, 창턱
const WINDOW: Sprite = (() => {
  const p = new Pix(20, 17);
  p.box(0, 0, 20, 15, "B");
  p.rect(2, 2, 16, 11, "i");
  p.rect(3, 3, 3, 1, "I").rect(3, 4, 1, 2, "I").rect(12, 8, 2, 1, "I");
  p.hline(4, 9, 6, "w").hline(5, 7, 5, "w");
  p.rect(9, 2, 2, 11, "B").rect(2, 7, 16, 1, "B");
  p.vline(1, 1, 13, "Z").hline(1, 18, 1, "Z").vline(18, 1, 13, "b").hline(1, 18, 13, "b");
  p.box(0, 14, 20, 3, "B");
  p.hline(1, 18, 15, "b");
  return p.rows();
})();

const flat = (rows: Sprite) => svgDataUri(spriteSvg(rows, { scale: ROOM_PIXEL, colors: COLORS }));

/** 평면 방 그림 data URI (ROOM_PIXEL배): 장소 띠 그림용 */
export const ROOM_ART = {
  wall: flat(WALL),
  floor: flat(FLOOR),
  window: flat(WINDOW),
};
