// 우리 집 방에서 가구와 놀 때의 캐릭터 몸짓 (사용자 요청 2026-10-12 "가구들이랑 상호작용하는거 넣어줘").
// 걷기 그림(walk.ts)처럼 캐릭터마다 따로 그리지 않고, 입은 모습 그대로의 색 칸 격자(lookGrid, 16×24)를 옮기고 덧그려 만든다.
// 그래서 어떤 캐릭터·머리·옷·모자에도 맞는다. 칸 하나는 24×24 틀(가운데 16칸 = 캐릭터), 몸짓마다 2칸:
//   sit   앉기: 허벅지 두 줄을 접어 몸이 2칸 내려앉는다 · 2칸째는 눈 깜빡
//   read  책 읽기: 두 손에 펼친 책 · 2칸째는 책장 넘기기
//   write 글 쓰기: 수첩과 연필 · 2칸째는 연필이 움직인다
//   water 물 주기: 오른손에 물뿌리개 · 2칸째는 기울여 물이 떨어진다
//   sleep 자기: 눈 감은 머리만 (몸은 이불 속), 틀 아래쪽에 붙인다 · 2칸째는 숨쉬며 1칸 내려간다
// 그림판: 가로 2칸 × 세로 몸짓 수. 효과(쿨쿨 Z·음표·반짝이·물방울·하트)는 작은 도트 조각(particleDataUri)
import { FRAME, lookGrid } from "./characters";
import { type Grid, gridRects, PALETTE, Pix, spriteSvg, svgDataUri } from "./pixel";

export const POSES = ["sit", "read", "write", "water", "sleep"] as const;
export type Pose = (typeof POSES)[number];
export const POSE_FRAMES = 2;
/**
 * 몸짓 그림에서 바닥(또는 앉는 자리·베개) 점이 오는 줄 (도트, 틀 위에서부터).
 * 서 있는 몸짓은 걷기 그림과 같은 발밑 21.5줄, 앉기도 신발 밑(21.5줄, 자리판 높이만큼 올려 그린다), 자기는 턱 끝(틀 맨 아래)
 */
export const POSE_ANCHOR: Readonly<Record<Pose, number>> = { sit: 21.5, read: 21.5, write: 21.5, water: 21.5, sleep: 23 };

const SHADOW = PALETTE[":"];
const OUTLINE = PALETTE["#"];
/** 캐릭터 16칸이 24칸 틀 가운데에 오는 자리 */
const PAD = (FRAME - 16) / 2;

const blank = (): Grid => Array.from({ length: FRAME }, () => Array<string | null>(FRAME).fill(null));
/** src를 dst의 (dx, dy)에 덮는다 (빈 칸은 건너뛴다). rows = 옮길 src 줄 범위 */
function put(dst: Grid, src: Grid, dx: number, dy: number, from = 0, to = src.length - 1) {
  for (let y = from; y <= to; y++)
    src[y]?.forEach((c, x) => {
      const ty = y + dy;
      const tx = x + dx;
      if (c && ty >= 0 && ty < FRAME && tx >= 0 && tx < FRAME) dst[ty][tx] = c;
    });
  return dst;
}
/** 글자 줄을 팔레트 색으로 덮는다 ("."은 건너뛴다). extra = 이 그림에서만 쓰는 글자 색 */
function paint(dst: Grid, rows: readonly string[], x: number, y: number, extra: Record<string, string> = {}) {
  rows.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      const color = ch === "." ? null : (extra[ch] ?? PALETTE[ch]);
      if (color && y + j >= 0 && y + j < FRAME && x + i >= 0 && x + i < FRAME) dst[y + j][x + i] = color;
    }),
  );
  return dst;
}
const noShadow = (g: Grid): Grid => g.map((r) => r.map((c) => (c === SHADOW ? null : c)));

/** 눈 감기: 눈 칸(7~9줄의 4·5칸과 10·11칸, characters.ts 머리말)의 외곽선·흰 칸을 피부색으로 덮고 맨 아래 줄만 감은 눈 선으로 */
function closeEyes(g: Grid): Grid {
  const out = g.map((r) => [...r]);
  const skin = g[11]?.[7] ?? PALETTE.f;
  for (const y of [7, 8, 9])
    for (const x of [4, 5, 10, 11]) {
      const c = out[y]?.[x];
      if (c === OUTLINE || c === PALETTE.w) out[y][x] = y === 9 ? OUTLINE : skin;
    }
  return out;
}

/** 몸짓 한 칸 (24×24 색 칸 격자) */
export function poseFrame(assetKey: string, outfit: readonly string[], pose: Pose, frame: number): Grid {
  const look = lookGrid(assetKey, outfit, "front");
  const skin = look[11]?.[7] ?? PALETTE.f;
  const out = blank();
  switch (pose) {
    case "sit": {
      const body = noShadow(frame === 1 ? closeEyes(look) : look);
      // 허벅지(18·19줄)를 접는다: 위 몸은 2칸 아래로, 무릎·신발(20~22줄)은 그대로
      put(out, body, PAD, 2, 0, 17);
      put(out, body, PAD, 0, 20, 22);
      return out;
    }
    case "read": {
      put(out, look, PAD, 0);
      paint(out, ["##########", "#wwwwywww#", frame ? "#wxxwywwx#" : "#wxxwyxxw#", "#wwwwywww#", "#NNNNNNNN#", "##########"], PAD + 3, 14);
      if (frame) paint(out, [".....##..", ".....#w#."], PAD + 3, 12);
      paint(out, ["f", "f"], PAD + 2, 16, { f: skin });
      paint(out, ["f", "f"], PAD + 13, 16, { f: skin });
      return out;
    }
    case "write": {
      put(out, look, PAD, 0);
      paint(out, ["#######", "#wwwww#", frame ? "#wxxww#" : "#wxwww#", "#wwwww#", "#######"], PAD + 2, 15);
      paint(out, ["f"], PAD + 2, 17, { f: skin });
      // 연필 (오른손): 노란 몸통, 짙은 끝
      const dx = frame ? -1 : 0;
      paint(out, ["...K", "..z.", ".z..", "#..."], PAD + 9 + dx, 13);
      paint(out, ["f"], PAD + 12 + dx, 14, { f: skin });
      return out;
    }
    case "water": {
      put(out, look, PAD, 0);
      // 오른손에 든 물뿌리개 (틀 오른쪽 여백까지)
      if (frame === 0) paint(out, ["..###..", ".#..#.#", "#ivvv##", "#vvvv#.", "#vvvv#.", ".####.."], PAD + 13, 14);
      else paint(out, ["..###..", ".#..#..", "#ivvv#.", "#vvvv##", "#vvvv#.#", ".####..", "......i", ".....i.", "......i"], PAD + 13, 14);
      return out;
    }
    case "sleep": {
      // 머리(0~12줄)만, 틀 아래에 붙인다. 2칸째는 숨쉬며 1칸 내려간다(턱 끝은 이불에 가린다)
      const head = closeEyes(noShadow(look));
      put(out, head, PAD, FRAME - 13 + frame, 0, 12 - frame);
      return out;
    }
  }
}

/** 몸짓 그림판 SVG: 가로 2칸 × 세로 몸짓 수 (POSES 순서), 한 칸 = 24 × 24도트를 scale배 */
export function poseSheetSvg(assetKey: string, outfit: readonly string[] = [], scale = 4): string {
  let body = "";
  POSES.forEach((pose, row) => {
    for (let f = 0; f < POSE_FRAMES; f++) body += gridRects(poseFrame(assetKey, outfit, pose, f), f * FRAME, row * FRAME);
  });
  const w = FRAME * POSE_FRAMES;
  const h = FRAME * POSES.length;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${+(w * scale).toFixed(3)}" height="${+(h * scale).toFixed(3)}" shape-rendering="crispEdges">${body}</svg>`;
}

export function poseSheetDataUri(assetKey: string, outfit: readonly string[] = [], scale = 4): string {
  return svgDataUri(poseSheetSvg(assetKey, outfit, scale));
}

// ===== 효과 조각 (외곽선 두른 작은 도트) =====
const PARTICLE_ROWS = {
  // 쿨쿨 Z
  z: ["wwwww", "...w.", "..w..", ".w...", "wwwww"],
  // 음표 ♪
  note: ["..UUU", "..U.U", "..U..", "..U..", "UUU..", "UUU.."],
  // 반짝이
  sparkle: ["..Z..", ".ZzZ.", "ZzwzZ", ".ZzZ.", "..Z.."],
  // 하트
  heart: [".N.N.", "NKNKN", "NKKKN", ".NKN.", "..N.."],
  // 물방울
  drop: [".i.", "iIi", "iii", ".i."],
} as const;
export type Particle = keyof typeof PARTICLE_ROWS;
export const PARTICLE_SIZE = 9;

const particleRows = (name: Particle) => {
  const rows = PARTICLE_ROWS[name];
  const p = new Pix(PARTICLE_SIZE, PARTICLE_SIZE);
  p.stamp(rows, Math.floor((PARTICLE_SIZE - rows[0].length) / 2), Math.floor((PARTICLE_SIZE - rows.length) / 2));
  return p.outline().rows();
};

const particleCache = new Map<string, string>();
/** 효과 조각 그림 (PARTICLE_SIZE × PARTICLE_SIZE 도트를 scale배) */
export function particleDataUri(name: Particle, scale: number): string {
  const k = `${name}@${scale}`;
  let uri = particleCache.get(k);
  if (!uri) {
    const svg = spriteSvg(particleRows(name), { scale: 1 }).replace(/width="(\d+)" height="(\d+)"/, (_, w, h) => `width="${+(w * scale).toFixed(3)}" height="${+(h * scale).toFixed(3)}"`);
    uri = svgDataUri(svg);
    particleCache.set(k, uri);
  }
  return uri;
}
