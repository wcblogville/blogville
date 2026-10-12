// 우리 집 방에 놓이는 가구 그림 (사용자 요청 2026-10-12 "가구마다 크기 다르게 해줘 침대같은 경우는 사람보다 컸으면 좋겠어").
// 가구가 차지하는 칸 수는 src/lib/house.ts FURNITURE_FOOTPRINT 한 곳이고, 여기서는 그 칸 수에 맞는 그림을 만든다.
// - 큰 가구(2칸 넘게 차지하는 가구)와 상자 모양 가구(옷장·책장·냉장고 등)는 방과 같은 아이소메트릭 도트로 새로 그린다.
//   방과 같은 도트(바닥 한 칸 = 16 × 8 도트, ROOM_PIXEL = 4배)라 침대는 3 × 2칸 · 40도트 너비로 사람(16 × 24)보다 크고,
//   옷장은 1칸이지만 키가 36도트로 사람보다 크다.
//   그림은 "상자" 몇 개(위·왼쪽 앞·오른쪽 앞 세 면, 빛은 왼쪽 위)를 뒤 → 앞 순서로 쌓고 면 위에 무늬를 칠한 뒤 외곽선을 두른다.
//   좌우 뒤집기(-scale-x)는 x축과 y축을 맞바꾼 모습과 같아서 뒤집으면 차지하는 칸도 w ↔ d가 된다 (footprintOf).
// - 작은 1칸 가구는 상점 그림(32 × 32 도트, furniture.ts)을 정수배(2배, 키 큰 것은 3배)로 칸 가운데에 세운다.
// 모두 외부 그림 파일 없이 글자 줄(Pix)로 그린다. 화면에서는 방 카메라(--fit)로 방과 함께 줄어든다.
import { footprintOf } from "../house";
import { furnitureArtOf } from "./furniture";
import { type Colors, Pix, ramp, type Sprite, spriteSvg, svgDataUri } from "./pixel";
import { ROOM_PIXEL } from "./room";

/** 바닥 한 칸의 도트 크기 (room.ts와 같다): 가로 반 HW, 세로 반 HH */
const HW = 8;
const HH = 4;
/** 외곽선이 들어갈 둘레 여백 (도트) */
const M = 1;

type Face = readonly [top: string, left: string, right: string];
const WOOD: Face = ["B", "b", "n"];
const DARK_WOOD: Face = ["b", "n", "#"];
const WHITE: Face = ["w", "Y", "y"];
const TINT: Face = ["4", "5", "6"];
const GOLD: Face = ["Z", "z", "u"];
const GLASS: Face = ["I", "i", "v"];
const tint = (hex: string): Colors => {
  const [a, b, c] = ramp(hex);
  return { 4: a, 5: b, 6: c };
};

/**
 * 아이소메트릭 도화지: 가구가 차지하는 w × d칸 + 높이 H도트.
 * 바닥 좌표 (fx, fy, z): fx = 0..w (x축, 오른쪽 아래), fy = 0..d (y축, 왼쪽 아래), z = 바닥에서 위로 도트.
 * 그리는 함수는 도화지의 모든 점(가운데)에서 거꾸로 바닥 좌표를 구해 그 점이 면 안인지 본다 (그래서 2:1 계단 선이 고르다)
 */
class Iso {
  readonly p: Pix;
  constructor(
    readonly w: number,
    readonly d: number,
    readonly H: number,
  ) {
    this.p = new Pix((w + d) * HW + M * 2, H + (w + d) * HH + M * 2);
  }
  /** 바닥 좌표 → 도화지 칸 */
  at(fx: number, fy: number, z: number) {
    return { x: M + this.d * HW + (fx - fy) * HW, y: M + this.H + (fx + fy) * HH - z };
  }
  private each(fn: (cx: number, cy: number) => string | null | undefined) {
    for (let y = 0; y < this.p.h; y++)
      for (let x = 0; x < this.p.w; x++) {
        const c = fn(x + 0.5, y + 0.5);
        if (c) this.p.px(x, y, c);
      }
    return this;
  }
  /** 높이 z의 수평면 위에 칠한다: fn(fx, fy) */
  top(z: number, fn: (fx: number, fy: number) => string | null | undefined) {
    return this.each((cx, cy) => {
      const a = (cx - M - this.d * HW) / HW;
      const b = (cy - M - this.H + z) / HH;
      return fn((a + b) / 2, (b - a) / 2);
    });
  }
  /** y = 일정한 세로 면(왼쪽 아래를 보는 면)에 칠한다: fn(fx, z) */
  faceY(y: number, fn: (fx: number, z: number) => string | null | undefined) {
    return this.each((cx, cy) => {
      const fx = (cx - M - this.d * HW) / HW + y;
      return fn(fx, M + this.H + (fx + y) * HH - cy);
    });
  }
  /** x = 일정한 세로 면(오른쪽 아래를 보는 면)에 칠한다: fn(fy, z) */
  faceX(x: number, fn: (fy: number, z: number) => string | null | undefined) {
    return this.each((cx, cy) => {
      const fy = x - (cx - M - this.d * HW) / HW;
      return fn(fy, M + this.H + (x + fy) * HH - cy);
    });
  }
  /** 상자 하나: 보이는 세 면 (왼쪽 앞 y = y1, 오른쪽 앞 x = x1, 위 z = z1) */
  box(x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, [t, l, r]: Face) {
    this.faceY(y1, (fx, z) => (fx >= x0 && fx < x1 && z >= z0 && z < z1 ? l : null));
    this.faceX(x1, (fy, z) => (fy >= y0 && fy < y1 && z >= z0 && z < z1 ? r : null));
    return this.top(z1, (fx, fy) => (fx >= x0 && fx < x1 && fy >= y0 && fy < y1 ? t : null));
  }
  /** 바닥 그림자 (차지하는 칸보다 조금 넓게, 반투명) */
  shadow(pad = 0.08) {
    return this.top(0, (fx, fy) => (fx >= -pad && fx < this.w + pad && fy >= -pad && fy < this.d + pad ? ":" : null));
  }
  finish() {
    return this.p.outline().rows();
  }
}

/** 면 위의 네모 안인지 (가로 a..b, 세로 c..d) */
const inside = (u: number, v: number, a: number, b: number, c: number, d: number) => u >= a && u < b && v >= c && v < d;

type IsoArt = { w: number; d: number; H: number; rows: Sprite; colors?: Colors };

function iso(assetKey: string, H: number, draw: (g: Iso) => void, colors?: Colors): IsoArt {
  const { w, d } = footprintOf(assetKey);
  const g = new Iso(w, d, H);
  draw(g);
  return { w, d, H, rows: g.finish(), colors };
}

/** 침대 몸통 (머리판은 x = 0쪽, 발판은 x = w쪽). 이불은 4·5·6 */
function bedBody(g: Iso, x0 = 0, x1 = g.w) {
  const d = g.d;
  g.box(x0, 0, x0 + 0.3, d, 0, 18, WOOD); // 머리판
  g.faceX(x0 + 0.3, (fy, z) => (inside(fy, z, 0.35, d - 0.35, 11, 15) ? "b" : null)); // 머리판 판자 무늬
  g.box(x0 + 0.3, 0, x1, d, 0, 4, WOOD); // 틀
  g.box(x0 + 0.3, 0.12, x1 - 0.2, d - 0.12, 4, 7, WHITE); // 매트리스
  g.box(x0 + 0.4, 0.35, x0 + 1.1, d - 0.35, 7, 9, WHITE); // 베개
  g.top(9, (fx, fy) => (inside(fx, fy, x0 + 0.5, x0 + 1.0, 0.45, d - 0.45) && Math.abs(fy - d / 2) < 0.08 ? "y" : null));
  g.box(x0 + 1.15, 0.06, x1 - 0.2, d - 0.06, 4, 8, TINT); // 이불
  g.top(8, (fx, fy) => (inside(fx, fy, x0 + 1.15, x0 + 1.45, 0.06, d - 0.06) ? "w" : null)); // 접힌 이불 끝
  g.top(8, (fx, fy) => (inside(fx, fy, x0 + 1.6, x1 - 0.2, 0.06, d - 0.06) && Math.abs(fy - d / 2) < 0.06 ? "6" : null)); // 이불 솔기
  g.box(x1 - 0.2, 0, x1, d, 0, 10, WOOD); // 발판
}

const ISO: Record<string, () => IsoArt> = {
  // 포근한 침대 (3 × 2칸): 나무 머리판·발판, 흰 매트리스와 베개, 하늘색 이불
  "furniture.bed": () =>
    iso(
      "furniture.bed",
      20,
      (g) => {
        g.shadow();
        bedBody(g);
        g.box(0, 0.6, 0.3, g.d - 0.6, 18, 20, WOOD); // 머리판 둥근 위
      },
      tint("#8ec5ff"),
    ),
  // 캐노피 침대 (3 × 2칸): 기둥 넷, 연보라 지붕 천과 휘장
  "furniture.canopy": () =>
    iso(
      "furniture.canopy",
      38,
      (g) => {
        const { w, d } = g;
        g.shadow();
        g.faceX(0.12, (fy, z) => (inside(fy, z, 0.15, d - 0.15, 8, 35) ? (Math.floor(fy * 8) % 3 === 0 ? "5" : "4") : null)); // 뒤 휘장
        g.box(0, 0, 0.2, 0.2, 0, 36, GOLD);
        g.box(0, d - 0.2, 0.2, d, 0, 36, GOLD);
        g.box(w - 0.2, 0, w, 0.2, 0, 36, GOLD);
        bedBody(g, 0.05, w - 0.05);
        g.box(w - 0.2, d - 0.2, w, d, 0, 36, GOLD);
        // 앞 기둥에 묶은 휘장
        g.faceY(d, (fx, z) => (inside(fx, z, w - 0.45, w - 0.2, 14, 33) && (z > 18 || fx > w - 0.35) ? "5" : null));
        g.faceX(w, (fy, z) => (inside(fy, z, d - 0.45, d - 0.2, 14, 33) && (z > 18 || fy > d - 0.35) ? "6" : null));
        // 지붕 천과 물결 끝단
        g.box(0, 0, w, d, 35, 38, TINT);
        g.faceY(d, (fx, z) => (fx >= 0 && fx < w && z >= 32 && z < 35 && (z >= 33.5 || Math.floor(fx * 4) % 2 === 0) ? "5" : null));
        g.faceX(w, (fy, z) => (fy >= 0 && fy < d && z >= 32 && z < 35 && (z >= 33.5 || Math.floor(fy * 4) % 2 === 0) ? "6" : null));
        g.top(38, (fx, fy) => (Math.abs(fx - w / 2) < 0.12 && Math.abs(fy - d / 2) < 0.12 ? "z" : null));
      },
      tint("#b49cf0"),
    ),
  // 알록달록 러그 (2 × 2칸): 바닥에 납작하게. 분홍·노랑·하늘 고리
  "furniture.rug": () =>
    iso("furniture.rug", 1, (g) => {
      g.top(1, (fx, fy) => {
        const r = Math.hypot(fx - 1, fy - 1);
        if (r >= 0.98) return null;
        if (r > 0.8) return (Math.floor((Math.atan2(fy - 1, fx - 1) + Math.PI) * 6) % 2 ? "V" : "R");
        if (r > 0.55) return "z";
        if (r > 0.3) return "i";
        return r > 0.14 ? "w" : "V";
      });
    }),
  // 둥근 탁자 → 긴 나무 탁자 (2 × 1칸): 다리 넷, 찻주전자와 찻잔
  "furniture.table": () =>
    iso("furniture.table", 16, (g) => {
      g.shadow();
      for (const [x, y] of [[0.12, 0.12], [0.12, 0.72], [1.72, 0.12], [1.72, 0.72]]) g.box(x, y, x + 0.16, y + 0.16, 0, 9, WOOD);
      g.box(0, 0, 2, 1, 9, 11, WOOD);
      g.top(11, (fx, fy) => (inside(fx, fy, 0.15, 1.85, 0.12, 0.88) && (Math.abs(fy - 0.5) < 0.04 || fx < 0.2 || fx > 1.8) ? "Z" : null));
      g.box(0.5, 0.35, 0.68, 0.53, 11, 13, WHITE); // 찻잔
      g.box(1.15, 0.3, 1.5, 0.65, 11, 15, ["V", "R", "R"]); // 찻주전자
      g.box(1.28, 0.42, 1.38, 0.52, 15, 16, ["w", "w", "y"]);
    }),
  // 나무 책상 (2 × 1칸): 오른쪽 서랍, 공책·머그잔
  "furniture.desk": () =>
    iso("furniture.desk", 15, (g) => {
      g.shadow();
      g.box(0.08, 0.1, 0.24, 0.26, 0, 10, WOOD);
      g.box(0.08, 0.74, 0.24, 0.9, 0, 10, WOOD);
      g.box(1.25, 0.05, 1.95, 0.95, 0, 10, WOOD); // 서랍장
      g.faceY(0.95, (fx, z) => (!inside(fx, z, 1.3, 1.9, 0, 10) ? null : Math.abs(z - 5) < 0.5 ? "n" : inside(fx, z, 1.53, 1.67, 7, 8) || inside(fx, z, 1.53, 1.67, 2, 3) ? "z" : null));
      g.box(0, 0, 2, 1, 10, 12, WOOD);
      g.top(12, (fx, fy) => (inside(fx, fy, 0.3, 0.85, 0.35, 0.8) ? (Math.abs(fx - 0.57) < 0.04 ? "i" : "w") : null)); // 공책
      g.box(1.5, 0.3, 1.66, 0.46, 12, 14, ["K", "N", "Q"]); // 머그잔
    }),
  // 컴퓨터 책상 (2 × 1칸): 블로그 글이 뜬 모니터, 키보드
  "furniture.computer": () =>
    iso("furniture.computer", 24, (g) => {
      g.shadow();
      for (const [x, y] of [[0.08, 0.1], [0.08, 0.74], [1.76, 0.1], [1.76, 0.74]]) g.box(x, y, x + 0.16, y + 0.16, 0, 10, WOOD);
      g.box(0, 0, 2, 1, 10, 12, WOOD);
      g.box(0.92, 0.18, 1.08, 0.3, 12, 14, ["x", "X", "X"]); // 받침
      g.box(0.5, 0.12, 1.5, 0.3, 14, 23, ["Y", "y", "x"]); // 모니터
      g.faceY(0.3, (fx, z) => {
        if (!inside(fx, z, 0.58, 1.42, 15, 22)) return null;
        if (z >= 20.5) return "v"; // 제목 막대
        return Math.floor(z) % 2 === 0 && fx < 1.32 - (Math.floor(z) % 4) * 0.05 ? "w" : "i";
      });
      g.top(12, (fx, fy) => (inside(fx, fy, 0.6, 1.4, 0.48, 0.74) ? ((Math.floor(fx * 16) + Math.floor(fy * 16)) % 2 ? "Y" : "y") : null)); // 키보드
      g.box(1.6, 0.4, 1.76, 0.56, 12, 14, ["i", "v", "v"]); // 머그잔
    }),
  // 푹신한 소파 (2 × 1칸): 등받이는 뒤(y = 0), 방석 둘, 팔걸이 (천은 4·5·6)
  "furniture.sofa": () =>
    iso(
      "furniture.sofa",
      16,
      (g) => {
        g.shadow();
        g.box(0, 0, 2, 1, 0, 3, ["5", "6", "6"]);
        g.box(0, 0, 2, 0.35, 3, 15, TINT); // 등받이
        g.faceY(0.35, (fx, z) => (Math.abs(fx - 1) < 0.06 && z > 7 && z < 14 ? "6" : null));
        g.box(0, 0.05, 0.3, 1, 3, 10, TINT); // 왼쪽 팔걸이
        g.box(0.3, 0.35, 1, 0.97, 3, 7, TINT); // 방석
        g.box(1, 0.35, 1.7, 0.97, 3, 7, TINT);
        g.faceY(0.97, (fx, z) => (Math.abs(fx - 1) < 0.07 && z >= 3 && z < 7 ? "6" : null));
        g.box(1.7, 0.05, 2, 1, 3, 10, TINT); // 오른쪽 팔걸이
      },
      tint("#7fb8a4"),
    ),
  // 피아노 (2 × 1칸): 까만 업라이트, 흰 건반, 악보, 촛대
  "furniture.piano": () =>
    iso(
      "furniture.piano",
      26,
      (g) => {
        g.shadow();
        g.box(0, 0, 2, 0.45, 0, 22, ["7", "8", "9"]);
        g.faceY(0.45, (fx, z) => (inside(fx, z, 0.7, 1.3, 13, 19) ? (Math.floor(z) % 2 === 0 && fx > 0.75 && fx < 1.25 ? "x" : "w") : null)); // 악보
        g.box(0.1, 0.6, 0.22, 0.75, 0, 9, ["8", "9", "9"]);
        g.box(1.78, 0.6, 1.9, 0.75, 0, 9, ["8", "9", "9"]);
        g.box(0.05, 0.45, 1.95, 0.8, 9, 11, ["8", "9", "9"]);
        g.top(11, (fx, fy) => {
          if (!inside(fx, fy, 0.1, 1.9, 0.47, 0.76)) return null;
          const k = Math.floor((fx - 0.1) * 8);
          return fy < 0.62 && [1, 2, 4, 5, 6].includes(k % 7) ? "#" : "w";
        });
        g.box(1.65, 0.12, 1.8, 0.27, 22, 24, GOLD); // 촛대
        g.top(24, (fx, fy) => (inside(fx, fy, 1.69, 1.76, 0.16, 0.23) ? "w" : null));
        g.box(1.7, 0.16, 1.75, 0.21, 24, 26, ["z", "z", "u"]);
      },
      { 7: "#5a4a5e", 8: "#3a2f40", 9: "#241c29" },
    ),
  // 벽난로 (2 × 1칸): 붉은 벽돌, 활활 타는 불, 나무 선반
  "furniture.fireplace": () =>
    iso(
      "furniture.fireplace",
      25,
      (g) => {
        g.shadow();
        g.box(0, 0, 2, 0.55, 0, 20, ["7", "8", "9"]);
        // 벽돌 줄눈
        g.faceY(0.55, (fx, z) => (fx >= 0 && fx < 2 && z >= 0 && z < 20 && (Math.floor(z) % 4 === 0 || Math.floor(fx * 8 + (Math.floor(z / 4) % 2) * 2) % 4 === 0) ? "9" : null));
        g.faceX(2, (fy, z) => (fy >= 0 && fy < 0.55 && z >= 0 && z < 20 && Math.floor(z) % 4 === 0 ? "#" : null));
        // 불 구멍 (위가 둥근 아치)
        g.faceY(0.55, (fx, z) => {
          const u = (fx - 1) * 8;
          if (!(Math.abs(u) < 5 && z >= 1 && (z < 9 || u * u + (z - 9) * (z - 9) < 25))) return null;
          if (z < 2.5 && Math.abs(u) < 3.5) return "n"; // 장작
          if (u * u + (z - 2) * (z - 2) * 0.6 < 4) return "Z";
          if (u * u * 0.8 + (z - 3) * (z - 3) * 0.35 < 7) return "z";
          if (u * u * 0.6 + (z - 3) * (z - 3) * 0.2 < 9) return "K";
          return "q";
        });
        g.box(-0, 0, 2, 0.7, 20, 22, WOOD); // 선반
        g.box(0.3, 0.25, 0.42, 0.37, 22, 25, ["w", "Y", "y"]); // 촛불
        g.box(1.6, 0.25, 1.72, 0.37, 22, 24, ["w", "Y", "y"]);
        g.top(25, (fx, fy) => (inside(fx, fy, 0.33, 0.39, 0.28, 0.34) ? "z" : null));
      },
      { 7: "#d97b5c", 8: "#b85c45", 9: "#8a3f35" },
    ),
  // 어항 (2 × 1칸): 나무 받침 위 유리 어항, 물고기·수초·물방울
  "furniture.aquarium": () =>
    iso("furniture.aquarium", 20, (g) => {
      g.shadow();
      g.box(0, 0.05, 2, 0.95, 0, 7, WOOD);
      g.box(0.05, 0.1, 1.95, 0.9, 7, 19, GLASS);
      g.faceY(0.9, (fx, z) => {
        if (!inside(fx, z, 0.1, 1.9, 7, 18)) return null;
        const fish = (cx: number, cz: number) => Math.abs((fx - cx) * 8) + Math.abs(z - cz) * 1.6 < 2.6;
        if (fish(0.6, 12)) return "z";
        if (Math.abs((fx - 0.82) * 8) < 1 && Math.abs(z - 12) < 1.2) return "u"; // 꼬리
        if (fish(1.35, 15)) return "K";
        if (Math.abs((fx - 1.13) * 8) < 1 && Math.abs(z - 15) < 1.2) return "N";
        if (z < 9 + Math.abs(Math.sin(fx * 9)) * 4 && (Math.floor(fx * 8) % 3 === 0)) return "l"; // 수초
        if (z < 8) return "a"; // 모래
        if ((Math.floor(fx * 16) === 26 && Math.floor(z) % 3 === 0)) return "I"; // 물방울
        return null;
      });
      g.top(19, (fx, fy) => (inside(fx, fy, 0.05, 1.95, 0.1, 0.9) && (fx < 0.12 || fx > 1.88 || fy < 0.16 || fy > 0.84) ? "y" : null)); // 테두리
    }),
  // 그릇 찬장 (2 × 1칸): 위 칸 유리 너머 접시, 아래 문 두 짝
  "furniture.cupboard": () =>
    iso("furniture.cupboard", 28, (g) => {
      g.shadow();
      g.box(0, 0, 2, 0.6, 0, 26, WOOD);
      g.faceY(0.6, (fx, z) => {
        if (inside(fx, z, 0.15, 1.85, 13.5, 24)) {
          for (const [cx, c] of [[0.5, "i"], [1, "V"], [1.5, "z"]] as const) {
            const r = Math.hypot((fx - cx) * 8, z - 19);
            if (r < 1.2) return c;
            if (r < 3.2) return "w";
          }
          return z < 15 ? "B" : "c";
        }
        if (inside(fx, z, 0.15, 1.85, 1, 12)) return Math.abs(fx - 1) < 0.07 ? "n" : inside(fx, z, 0.85, 0.92, 6, 8) || inside(fx, z, 1.08, 1.15, 6, 8) ? "z" : null;
        return null;
      });
      g.box(0, 0, 2, 0.7, 26, 28, WOOD);
    }),
  // 옷장 (1칸, 사람보다 크다): 두 짝 문, 둥근 장식 머리
  "furniture.wardrobe": () =>
    iso("furniture.wardrobe", 38, (g) => {
      g.shadow();
      g.box(0.08, 0.02, 0.92, 0.72, 0, 34, WOOD);
      g.faceY(0.72, (fx, z) => {
        if (!inside(fx, z, 0.12, 0.88, 2, 32)) return null;
        if (Math.abs(fx - 0.5) < 0.06) return "n";
        const u = fx < 0.5 ? fx - 0.12 : fx - 0.5;
        if (inside(u, z, 0.06, 0.32, 4, 14) || inside(u, z, 0.06, 0.32, 17, 30)) return inside(u, z, 0.1, 0.28, 5, 13) || inside(u, z, 0.1, 0.28, 18, 29) ? "b" : "n";
        if (Math.abs(fx - 0.5) < 0.13 && z > 15 && z < 17) return "z";
        return null;
      });
      g.box(0.04, 0, 0.96, 0.76, 34, 36, WOOD);
      g.box(0.4, 0.3, 0.6, 0.5, 36, 38, GOLD);
    }),
  // 책장 (1칸): 세 칸에 알록달록 책
  "furniture.shelf": () =>
    iso("furniture.shelf", 31, (g) => {
      g.shadow();
      g.box(0.06, 0, 0.94, 0.55, 0, 30, WOOD);
      const books = ["N", "z", "v", "U", "l", "K", "i", "V"];
      g.faceY(0.55, (fx, z) => {
        if (!inside(fx, z, 0.12, 0.88, 2, 28)) return null;
        const shelf = [[2, 9], [11, 18], [20, 28]].findIndex(([a, b]) => z >= a && z < b);
        if (shelf < 0) return "B";
        const col = Math.floor(fx * 8);
        const h = 4 + ((col * 7 + shelf * 3) % 4);
        const base = [2, 11, 20][shelf];
        if (shelf === 1 && col >= 5) return z < base + 3 && col === 5 ? "w" : "n"; // 빈 자리와 작은 상자
        return z < base + h ? books[(col + shelf * 3) % books.length] : "n";
      });
    }),
  // 냉장고 (1칸): 민트색 옛날 냉장고, 위 냉동칸
  "furniture.fridge": () =>
    iso(
      "furniture.fridge",
      28,
      (g) => {
        g.shadow();
        g.box(0.1, 0.05, 0.9, 0.75, 0, 27, ["7", "8", "9"]);
        g.faceY(0.75, (fx, z) => {
          if (!inside(fx, z, 0.1, 0.9, 0, 27)) return null;
          if (Math.abs(z - 18) < 0.5) return "9";
          if (inside(fx, z, 0.72, 0.8, 9, 16) || inside(fx, z, 0.72, 0.8, 20, 25)) return "y";
          if (inside(fx, z, 0.2, 0.3, 22, 25)) return "w";
          return null;
        });
      },
      { 7: "#d7f3e8", 8: "#a9dcc9", 9: "#78b7a2" },
    ),
  // 거울 서랍장 (1칸): 서랍 셋 위에 동그란 거울
  "furniture.dresser": () =>
    iso("furniture.dresser", 27, (g) => {
      g.shadow();
      g.box(0.48, 0.12, 0.56, 0.2, 12, 15, WOOD);
      g.faceY(0.2, (fx, z) => {
        const r = Math.hypot((fx - 0.52) * 8, (z - 20) * 0.95);
        if (r >= 5.5) return null;
        if (r >= 4.4) return "b";
        return r < 2 && fx < 0.47 && z > 20 ? "I" : "i";
      });
      g.box(0.06, 0, 0.94, 0.6, 0, 12, WOOD);
      g.faceY(0.6, (fx, z) => (inside(fx, z, 0.1, 0.9, 1, 12) ? (Math.abs(z - 4.5) < 0.5 || Math.abs(z - 8.5) < 0.5 ? "n" : inside(fx, z, 0.45, 0.55, 2, 3) || inside(fx, z, 0.45, 0.55, 6, 7) || inside(fx, z, 0.45, 0.55, 10, 11) ? "z" : null) : null));
      g.box(0.15, 0.35, 0.27, 0.47, 12, 15, ["V", "R", "R"]); // 향수
      g.box(0.75, 0.3, 0.87, 0.42, 12, 16, ["U", "U", "U"]); // 꽃병
      g.top(16, (fx, fy) => (inside(fx, fy, 0.72, 0.9, 0.27, 0.45) ? "V" : null));
    }),
  // 괘종시계 (1칸, 키가 크다): 흰 시계판, 금빛 추
  "furniture.clock": () =>
    iso("furniture.clock", 32, (g) => {
      g.shadow(-0.15);
      g.box(0.22, 0.2, 0.78, 0.65, 0, 2, DARK_WOOD);
      g.box(0.27, 0.25, 0.73, 0.6, 2, 24, WOOD);
      g.faceY(0.6, (fx, z) => {
        if (!inside(fx, z, 0.36, 0.64, 6, 21)) return null;
        const r = Math.hypot((fx - 0.5) * 8, z - 10);
        if (r < 1.6) return "z";
        return Math.abs(fx - 0.5) < 0.05 && z > 10 ? "u" : "n";
      });
      g.box(0.2, 0.18, 0.8, 0.67, 24, 31, WOOD);
      g.faceY(0.67, (fx, z) => {
        const r = Math.hypot((fx - 0.5) * 8, z - 27.5);
        if (r >= 2.9) return null;
        if (inside(fx, z, 0.47, 0.53, 27, 30) || inside(fx, z, 0.5, 0.65, 27, 28)) return "#";
        return "w";
      });
      g.box(0.42, 0.36, 0.58, 0.5, 31, 32, GOLD);
    }),
  // 브라운관 TV (1칸): 나무 다리, 무지개 화면, 안테나
  "furniture.tv": () =>
    iso("furniture.tv", 26, (g) => {
      g.shadow();
      for (const [x, y] of [[0.2, 0.2], [0.2, 0.62], [0.68, 0.2], [0.68, 0.62]]) g.box(x, y, x + 0.12, y + 0.12, 0, 5, DARK_WOOD);
      g.box(0.06, 0.12, 0.94, 0.8, 5, 18, WOOD);
      const rainbow = ["N", "K", "z", "l", "v", "U"];
      g.faceY(0.8, (fx, z) => {
        if (inside(fx, z, 0.12, 0.74, 6.5, 17)) return inside(fx, z, 0.18, 0.68, 7.5, 16) ? rainbow[Math.min(5, Math.floor((16 - z) / 1.42))] : "#";
        if (inside(fx, z, 0.8, 0.88, 13, 15) || inside(fx, z, 0.8, 0.88, 9, 11)) return "z";
        return null;
      });
      // 안테나 두 가닥
      const base = g.at(0.5, 0.45, 18);
      for (let i = 1; i <= 7; i++) {
        g.p.px(Math.round(base.x - i * 0.6), Math.round(base.y - i), "X");
        g.p.px(Math.round(base.x + i * 0.6), Math.round(base.y - i), "X");
      }
    }),
};

// ===== 작은 1칸 가구: 상점 그림을 정수배로 칸 가운데에 세운다 =====
/** 키 큰 1칸 가구는 3배 (나머지는 2배 = 32도트가 64px로 바닥 한 칸 너비) */
const FRONT_SCALE: Readonly<Record<string, number>> = {
  "furniture.throne": 3,
  "furniture.xmastree": 3,
  "furniture.monstera": 3,
  "furniture.armchair": 3,
  "furniture.easel": 3,
};

/** 방 그림 하나 (방 그림 좌표 px) */
export type RoomFurnitureArt = {
  uri: string;
  rows: Sprite;
  /** 도트 한 칸 = 몇 px (아이소메트릭 그림은 방과 같은 4, 작은 가구는 2·3) */
  dot: number;
  width: number;
  height: number;
  /** 그림 안에서 차지하는 칸들의 뒤 꼭짓점(바닥 위 x, y 칸 모서리)이 오는 자리. 뒤집으면 x가 바뀐다 */
  anchor: (flip: boolean) => { x: number; y: number };
  /** 방과 같은 아이소메트릭 그림인지 */
  iso: boolean;
};

const cache = new Map<string, RoomFurnitureArt>();

/** 방에 놓을 가구 그림 (가구마다 한 번만 만든다) */
export function roomFurnitureArt(assetKey: string): RoomFurnitureArt {
  const hit = cache.get(assetKey);
  if (hit) return hit;
  let art: RoomFurnitureArt;
  const make = ISO[assetKey];
  if (make) {
    const a = make();
    const P = ROOM_PIXEL;
    art = {
      uri: svgDataUri(spriteSvg(a.rows, { scale: P, colors: a.colors })),
      rows: a.rows,
      dot: P,
      width: a.rows[0].length * P,
      height: a.rows.length * P,
      anchor: (flip) => ({ x: (M + (flip ? a.w : a.d) * HW) * P, y: (M + a.H) * P }),
      iso: true,
    };
  } else {
    const { rows, colors } = furnitureArtOf(assetKey);
    const s = FRONT_SCALE[assetKey] ?? 2;
    const size = rows.length * s;
    // 그림 아래가 칸 가운데보다 8px(칸 높이의 1/4) 아래: 칸 가운데 = 뒤 꼭짓점 + 16px
    art = { uri: svgDataUri(spriteSvg(rows, { scale: s, colors })), rows, dot: s, width: rows[0].length * s, height: size, anchor: () => ({ x: (rows[0].length * s) / 2, y: size - 24 }), iso: false };
  }
  cache.set(assetKey, art);
  return art;
}

/** 아이소메트릭으로 새로 그린 가구 목록 (시험용) */
export const ISO_FURNITURE_KEYS = () => Object.keys(ISO);

/** 그림 안의 한 점(px, 뒤집기 반영 전 화면 기준)이 칠한 도트 위인지 (투명·그림자면 아니다). 누른 가구 찾기에 쓴다 */
export function artHit(art: RoomFurnitureArt, lx: number, ly: number, flip: boolean): boolean {
  if (lx < 0 || ly < 0 || lx >= art.width || ly >= art.height) return false;
  let col = Math.floor(lx / art.dot);
  if (flip) col = art.rows[0].length - 1 - col;
  const c = art.rows[Math.floor(ly / art.dot)]?.[col];
  return c !== undefined && c !== "." && c !== ":";
}

/**
 * 가구 위에서 앉거나 누운 자리: 칸 좌표 안의 점(바닥)과 그 위 높이(방 그림 px).
 * 소파는 고른 칸의 방석 위, 침대는 머리판 쪽 베개 위, 작은 의자는 칸 가운데 자리판 위
 */
export function restSpot(assetKey: string, piece: { x: number; y: number; flip: boolean }, seat: { x: number; y: number }): { x: number; y: number; lift: number } {
  const { w, d } = footprintOf(assetKey, piece.flip);
  if (assetKey === "furniture.bed" || assetKey === "furniture.canopy") {
    // 베개 위 (머리판 = 길이 방향의 처음 끝)
    return piece.flip ? { x: piece.x + w / 2, y: piece.y + 0.95, lift: 6 * ROOM_PIXEL } : { x: piece.x + 0.95, y: piece.y + d / 2, lift: 6 * ROOM_PIXEL };
  }
  if (assetKey === "furniture.sofa") {
    return piece.flip ? { x: piece.x + 0.62, y: seat.y + 0.5, lift: 4 * ROOM_PIXEL } : { x: seat.x + 0.5, y: piece.y + 0.62, lift: 4 * ROOM_PIXEL };
  }
  const lift = SEAT_LIFT[assetKey] ?? 14;
  return { x: seat.x + 0.5, y: seat.y + 0.5, lift };
}

/** 작은 의자에 앉은 캐릭터를 칸 가운데에서 위로 올리는 높이 (px, 자리판 줄에서 발이 조금 내려오게 잰 값) */
const SEAT_LIFT: Readonly<Record<string, number>> = {
  "furniture.chair": 14,
  "furniture.stool": 16,
  "furniture.beanbag": 10,
  "furniture.armchair": 22,
  "furniture.throne": 24,
};
