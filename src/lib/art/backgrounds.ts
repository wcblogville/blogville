// 미니룸 배경 (도트, 2026-10-09 "남은 그림도 도트로"). 높이 ROWS(60)칸, 땅은 GROUND(44)칸부터. 캐릭터는 그 위에 선다.
// 너비 width(px)와 배율 scale을 받아 width ÷ scale 칸으로 그린다: 상점 카드는 2배(320px), 블로그 위쪽은 5배(1280px, 캐릭터와 같은 도트 크기).
// 넓게 그릴 때도 확대하지 않고 구름·나무·꽃을 더 많이 놓는다. 화면에서는 SVG 크기 그대로(background-size: auto) 아래 가운데에 붙인다.
// DB의 asset_key("bg.meadow" 등)로 고른다. accent는 광장 집 지붕 색으로도 쓴다.
import { type Colors, Pix, type Sprite, spriteRects, svgDataUri } from "./pixel";

/** 배경 높이 (칸) */
export const BG_ROWS = 60;
/** 땅이 시작하는 줄 */
const GROUND = 44;

type Scene = { accent: string; colors: Colors; draw: (p: Pix) => void };

// 같은 장면이 매번 똑같이 그려지도록 고정 시드 난수
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** 하늘: 위에서 아래로 띠 몇 개. 띠 경계 한 줄은 드문드문 섞어 부드럽게 */
function sky(p: Pix, bands: string[], until = GROUND) {
  const h = until / bands.length;
  for (let y = 0; y < until; y++) {
    const i = Math.min(bands.length - 1, Math.floor(y / h));
    p.hline(0, p.w - 1, y, bands[i]);
    const next = bands[i + 1];
    if (next && Math.floor((y + 1) / h) > i) for (let x = y % 2; x < p.w; x += 3) p.px(x, y, next);
  }
}

/** 구름 (밝은 몸 + 아래 그늘) */
function cloud(p: Pix, x: number, y: number, w: number, body = "w", shade = "C") {
  p.ellipse(x, y, w * 0.5, 2.5, body).ellipse(x - w * 0.15, y - 2, w * 0.25, 2.5, body).ellipse(x + w * 0.15, y - 1.5, w * 0.3, 2.5, body);
  p.hline(Math.round(x - w * 0.45), Math.round(x + w * 0.45) - 1, Math.round(y + 2), shade);
}

/** 완만한 언덕: 줄마다 높이를 사인 두 개로. 맨 위 칸은 밝은 테두리 */
function hills(p: Pix, base: number, amp: number, seed: number, fill: string, rim: string, to = GROUND) {
  const a = seed * 1.7;
  for (let x = 0; x < p.w; x++) {
    const t = Math.round(base - amp * (0.55 * Math.sin(x / 13 + a) + 0.45 * Math.sin(x / 5.3 + a * 2.1) * 0.5 + 0.5));
    p.vline(x, t, to - 1, fill).px(x, t, rim);
  }
}

/** 일정 간격으로 놓는다 (가운데 캐릭터 자리는 비운다) */
function spread(p: Pix, gap: number, seed: number, fn: (x: number, r: () => number) => void) {
  const rand = rng(seed);
  for (let x = gap * 0.4; x < p.w; x += gap * (0.75 + rand() * 0.5)) {
    if (Math.abs(x - p.w / 2) < 14) continue;
    fn(Math.round(x), rand);
  }
}

/** 점 뿌리기: 너비 64칸마다 n개 */
function dots(p: Pix, seed: number, n: number, y: [number, number], chars: string[], plus = false) {
  const rand = rng(seed);
  const count = Math.round((n * p.w) / 64);
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rand() * p.w);
    const yy = Math.floor(y[0] + rand() * (y[1] - y[0]));
    const c = chars[Math.floor(rand() * chars.length)];
    if (plus) p.px(x - 1, yy, c).px(x + 1, yy, c).px(x, yy - 1, c).px(x, yy + 1, c).px(x, yy, "z");
    else p.px(x, yy, c);
  }
}

/** 땅: 기본 색 + 풀 포기 무늬 */
function ground(p: Pix, fill: string, tuft: string, seed: number) {
  p.rect(0, GROUND, p.w, BG_ROWS - GROUND, fill);
  const rand = rng(seed);
  for (let i = 0; i < p.w / 3; i++) {
    const x = Math.floor(rand() * p.w);
    const y = GROUND + 2 + Math.floor(rand() * (BG_ROWS - GROUND - 2));
    p.px(x, y, tuft).px(x + 1, y - 1, tuft).px(x + 2, y, tuft);
  }
}

// ===== 작은 그림 도장 (외곽선 포함) =====
const TREE: Sprite = [
  "..#####..",
  ".#LLlll#.",
  "#LLlllll#",
  "#Lllllmm#",
  "#llllllm#",
  "#lllllmm#",
  ".#lmmmm#.",
  "..##n##..",
  "...#n#...",
  "...#b#...",
  "..##b##..",
];
const PINE: Sprite = [
  "....#....",
  "...#w#...",
  "..#wmm#..",
  "..#mmM#..",
  ".#wwmmM#.",
  ".#mmmMM#.",
  "#wwwmmMM#",
  "#mmmmMMM#",
  ".###n###.",
  "...#n#...",
];
const SAKURA: Sprite = [
  "...######...",
  "..#VVVwVV#..",
  ".#VwVVVVVR#.",
  "#VVVVVVRVRR#",
  "#VVVRVVVVRR#",
  "#RVVVVVRRRR#",
  ".#RRVnRRRR#.",
  "..###n#nR#..",
  ".....nn##...",
  ".....#n#....",
  ".....#n#....",
  "....##n##...",
];
const CABIN: Sprite = [
  "......##......",
  "....##ww##....",
  "..##wwwwww##..",
  ".#wwwwwwwwww#.",
  "##############",
  ".#BBBBBBBBBB#.",
  ".#bb###bb##b#.",
  ".#BB#n#BB#z#B#",
  ".#bb#n#bb##b#.",
  ".#BB#n#BBBBB#.",
  ".############.",
];

const SCENES: Record<string, Scene> = {
  // 초원: 해, 구름, 언덕, 들꽃, 나무
  "bg.meadow": {
    accent: "#2f855a",
    colors: { 0: "#8fd3ff", 7: "#a6dcff", 8: "#bfe6ff", 9: "#daf2ff", C: "#d6ecf8", D: "#bfe6a8", F: "#a3d98f", J: "#7cc66d", O: "#6ab85d" },
    draw: (p) => {
      sky(p, ["0", "7", "8", "9"]);
      const sx = Math.round(p.w / 2) + 24;
      p.ellipse(sx, 22, 5, 5, "Z").ellipse(sx, 22, 4, 4, "z").ellipse(sx - 1, 21, 1.5, 1.5, "Z");
      spread(p, 34, 3, (x, r) => cloud(p, x, 16 + Math.floor(r() * 12), 10 + Math.floor(r() * 6)));
      hills(p, 39, 5, 5, "D", "D");
      hills(p, 43, 3, 9, "F", "D");
      spread(p, 26, 13, (x) => p.stamp(TREE, x - 4, 35));
      ground(p, "J", "O", 7);
      dots(p, 17, 10, [GROUND + 2, BG_ROWS - 1], ["w", "V", "U", "Z"], true);
    },
  },
  // 바닷가: 해, 파도, 모래, 야자수, 조개
  "bg.beach": {
    accent: "#0369a1",
    colors: { 0: "#7fd0ff", 7: "#9fdcff", 8: "#bde8ff", C: "#d6ecf8", S: "#3fb3e8", W: "#6fcbef", D: "#f5deb3", F: "#ead0a0", O: "#fff6e3" },
    draw: (p) => {
      sky(p, ["0", "7", "8"], 34);
      const sx = Math.round(p.w / 2) - 26;
      p.ellipse(sx, 20, 4.5, 4.5, "Z").ellipse(sx, 20, 3.5, 3.5, "z");
      spread(p, 40, 17, (x, r) => Math.abs(x - sx) > 10 && cloud(p, x, 15 + Math.floor(r() * 8), 12));
      // 바다: 짙은 띠 → 밝은 띠, 반짝이는 물결
      p.rect(0, 34, p.w, 5, "S").rect(0, 39, p.w, 5, "W");
      const rand = rng(19);
      for (let i = 0; i < p.w / 6; i++) {
        const x = Math.floor(rand() * p.w);
        const y = 35 + Math.floor(rand() * 8);
        p.hline(x, x + 2 + Math.floor(rand() * 3), y, y < 39 ? "W" : "I");
      }
      ground(p, "D", "F", 21);
      // 파도 거품
      for (let x = 0; x < p.w; x++) p.px(x, GROUND + (Math.floor(x / 5) % 3 === 0 ? 1 : 0), "O");
      // 야자수
      spread(p, 60, 23, (x) => {
        for (let k = 0; k < 18; k++) {
          const tx = x + Math.round(Math.pow(k / 18, 2) * 4);
          p.rect(tx, GROUND + 2 - k, 2, 1, k % 3 ? "b" : "n");
        }
        const top = GROUND - 16;
        const cx = x + 4;
        for (const [dx, dy] of [[-1, 0], [1, 0], [-1, -1], [1, -1]] as const)
          for (let k = 0; k < 7; k++) p.rect(cx + dx * k, top + dy * Math.round(k * 0.6) + (k > 3 ? k - 3 : 0), 2, 1, k % 2 ? "l" : "m");
        p.rect(cx - 1, top - 1, 3, 2, "n");
      });
      // 조개
      spread(p, 28, 25, (x, r) => {
        const y = GROUND + 6 + Math.floor(r() * 8);
        p.hline(x, x + 2, y, "V").px(x + 1, y - 1, "V").hline(x, x + 2, y + 1, "R");
      });
    },
  },
  // 눈 마을: 흐린 하늘, 눈송이, 눈 덮인 전나무, 오두막
  "bg.snow": {
    accent: "#475569",
    colors: { 0: "#b9c8dc", 7: "#c9d5e5", 8: "#dbe4ef", 9: "#eaf0f7", D: "#e5ecf5", F: "#d2dcea", O: "#f9fbff" },
    draw: (p) => {
      sky(p, ["0", "7", "8", "9"]);
      hills(p, 38, 4, 27, "D", "w");
      spread(p, 18, 29, (x) => p.stamp(PINE, x - 4, 32));
      p.stamp(CABIN, Math.round(p.w / 2) + 20, 33);
      ground(p, "O", "F", 31);
      for (let x = 0; x < p.w; x++) if ((x * 7) % 11 < 4) p.px(x, GROUND, "F");
      dots(p, 23, 14, [0, BG_ROWS], ["w"]);
    },
  },
  // 벚꽃길: 분홍 하늘, 벚나무, 흩날리는 꽃잎, 길
  "bg.sakura": {
    accent: "#be185d",
    colors: { 0: "#ffd6e7", 7: "#ffe2ee", 8: "#fff0f6", D: "#c9e7b8", F: "#b3db9f", P: "#f3e2c7", A: "#e6cfa9" },
    draw: (p) => {
      sky(p, ["0", "7", "8"]);
      hills(p, 41, 3, 33, "D", "F");
      spread(p, 30, 35, (x) => p.stamp(SAKURA, x - 6, 33));
      ground(p, "D", "F", 37);
      // 가운데로 뻗은 흙길 (아래로 갈수록 넓다)
      const c = Math.floor(p.w / 2);
      for (let y = GROUND; y < BG_ROWS; y++) {
        const half = 3 + Math.round((y - GROUND) * 0.9);
        p.hline(c - half, c + half - 1, y, "P").px(c - half, y, "A").px(c + half - 1, y, "A");
      }
      dots(p, 31, 12, [0, BG_ROWS], ["V", "R", "w"]);
    },
  },
  // 밤의 도시: 달, 별, 불 켜진 건물들
  "bg.night": {
    accent: "#a5b4fc",
    colors: { 0: "#0f172a", 7: "#1b1f45", 8: "#2a2563", 9: "#3b2f7a", S: "#1e2a4a", W: "#26355c", D: "#141c33", O: "#ffe08a", C: "#c7d2fe" },
    draw: (p) => {
      sky(p, ["0", "7", "8", "9"]);
      dots(p, 41, 10, [0, 28], ["w", "C"]);
      // 달 (초승달)
      const mx = Math.round(p.w / 2) + 24;
      p.ellipse(mx, 17, 4.5, 4.5, "Z").ellipse(mx + 2, 16, 4, 4, "7");
      // 건물
      const rand = rng(43);
      for (let x = 0; x < p.w; ) {
        const w = 6 + Math.floor(rand() * 7);
        const h = 10 + Math.floor(rand() * 16);
        const c = rand() > 0.5 ? "S" : "W";
        p.rect(x, GROUND - h, w, h, c);
        for (let wy = GROUND - h + 2; wy < GROUND - 2; wy += 3)
          for (let wx = x + 1; wx < x + w - 1; wx += 2) if (rand() > 0.45) p.px(wx, wy, "O");
        x += w + 1;
      }
      ground(p, "D", "D", 1);
      for (let x = 0; x < p.w; x += 6) p.hline(x, x + 2, GROUND + 5, "O");
    },
  },
  // 우주: 별, 고리 행성, 작은 달, 혜성
  "bg.space": {
    accent: "#f0abfc",
    colors: { 0: "#0b0a24", 7: "#1e1b4b", 8: "#2e1a6b", 9: "#4c1d95", P: "#f0abfc", Q: "#c084fc", D: "#6b5b95", F: "#5b4b84", O: "#7d6daa", C: "#cbd5e1", S: "#94a3b8" },
    draw: (p) => {
      sky(p, ["0", "7", "8", "9"]);
      dots(p, 53, 14, [0, GROUND], ["w", "U", "Z"]);
      dots(p, 54, 1, [4, 36], ["w"], true);
      // 고리 행성
      const px = Math.round(p.w / 2) + 22;
      // 기운 고리: 뒤쪽 반은 행성 뒤, 앞쪽 반은 행성 앞
      const ring = (front: boolean) => {
        for (let t = 0; t < Math.PI * 2; t += 0.02) {
          if (Math.sin(t) >= 0 !== front) continue;
          const x = Math.round(px + 12 * Math.cos(t));
          const y = Math.round(21 + 3 * Math.sin(t) - 3 * Math.cos(t));
          p.px(x, y, "z").px(x, y + 1, "u");
        }
      };
      ring(false);
      p.ellipse(px, 21, 7, 7, "P").ellipse(px + 2, 23, 5, 4, "Q").ellipse(px - 2, 18, 2.5, 2, "w");
      ring(true);
      // 작은 달
      const lx = Math.round(p.w / 2) - 26;
      p.ellipse(lx, 17, 3, 3, "C").px(lx - 1, 16, "S").px(lx + 1, 18, "S");
      // 혜성
      const cx = Math.round(p.w / 2) - 14;
      for (let k = 0; k < 8; k++) p.px(cx + k, 12 + Math.floor(k / 2), k < 4 ? "S" : "C");
      p.rect(cx + 8, 16, 2, 2, "w");
      hills(p, GROUND, 1, 55, "D", "O", BG_ROWS);
      spread(p, 26, 57, (x, r) => {
        const y = GROUND + 5 + Math.floor(r() * 9);
        p.ellipse(x, y, 3 + Math.floor(r() * 2), 1, "F").hline(x - 2, x + 1, y - 1, "O");
      });
    },
  },
};

/**
 * 배경 장면 SVG. width = 화면에 보일 너비(px), scale = 도트 한 칸의 px (정수).
 * 높이는 BG_ROWS × scale. 쓰는 쪽은 크기를 늘이지 말고 아래 가운데에 붙인다
 */
export function backgroundSvg(assetKey: string, width = 320, scale = 2): string {
  const scene = SCENES[assetKey] ?? SCENES["bg.meadow"];
  const w = Math.ceil(width / scale);
  const p = new Pix(w, BG_ROWS);
  scene.draw(p);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${BG_ROWS}" width="${w * scale}" height="${BG_ROWS * scale}" preserveAspectRatio="xMidYMax slice" shape-rendering="crispEdges">` +
    `${spriteRects(p.rows(), scene.colors)}</svg>`
  );
}

export function backgroundDataUri(assetKey: string, width = 320, scale = 2): string {
  return svgDataUri(backgroundSvg(assetKey, width, scale));
}

/** 하늘 맨 위 색 (배경 그림보다 칸이 높을 때 위를 채운다) */
export function backgroundSky(assetKey: string): string {
  return (SCENES[assetKey] ?? SCENES["bg.meadow"]).colors[0];
}

export function backgroundAccent(assetKey: string): string {
  return (SCENES[assetKey] ?? { accent: "#2f855a" }).accent;
}
