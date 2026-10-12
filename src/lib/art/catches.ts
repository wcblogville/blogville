// 낚시터에서 낚는 것들 도트 그림 (사용자 요청 2026-10-12 "낚시터 낚을 수 있는 것들도 도트로").
// 그림 글자(🐟 👢 …) 대신 광장과 같은 팔레트(pixel.ts)로 20×20칸에 그린다. 화면에는 정수배(목록 2배 = 40px, 결과 5배)로만 키운다.
// 물고기는 오른쪽을 본다. 낚시 결과 연출용 찌·물보라·연못 그림도 여기 둔다. 무엇을 낚을지는 src/lib/fishing.ts CATCHES
import { Pix, type Colors, type Sprite, spriteSvg, svgDataUri } from "./pixel";

/** 낚을 것 그림 한 변 (칸) */
export const CATCH_CELLS = 20;

type Art = { rows: Sprite; colors?: Colors };

/** 오른쪽을 보는 물고기: 몸(타원) · 꼬리 · 등지느러미 · 아가미 · 눈. 몸 색은 4(배)·5(몸)·6(등·지느러미) */
function fish({ len, h, cy = 10, stripe, spots, whisker }: { len: number; h: number; cy?: number; stripe?: string; spots?: [number, number, number][]; whisker?: boolean }): string[] {
  const p = new Pix(CATCH_CELLS, CATCH_CELLS);
  const tail = Math.max(3, Math.round(len * 0.28));
  const cx = (CATCH_CELLS + tail) / 2 - 0.5;
  const x0 = Math.round(cx - len / 2);
  // 꼬리 (뒤로 갈수록 벌어지는 부채꼴, 가운데가 조금 파였다)
  for (let i = 0; i < tail; i++) {
    const spread = Math.round(1 + i * (h / 2 / tail) * 1.2);
    p.vline(x0 - i, Math.round(cy - spread), Math.round(cy + spread) - 1, "6");
  }
  p.px(x0 - tail + 1, Math.round(cy) - 1, ".").px(x0 - tail + 1, Math.round(cy), ".");
  // 등지느러미·배지느러미
  p.rect(Math.round(cx - len * 0.15), Math.round(cy - h / 2) - 1, Math.max(2, Math.round(len * 0.3)), 1, "6");
  p.px(Math.round(cx - len * 0.1), Math.round(cy - h / 2) - 2, "6");
  p.rect(Math.round(cx), Math.round(cy + h / 2) - 1, 2, 1, "6");
  // 몸: 위는 짙게, 배는 밝게
  p.ellipse(cx, cy, len / 2, h / 2, "5");
  p.map((c, _x, y) => (c === "5" && y >= cy + h * 0.2 ? "4" : c === "5" && y < cy - h * 0.25 ? "6" : c));
  if (stripe) p.map((c, x, y) => (c !== "." && y === Math.round(cy) && x > x0 && x < cx + len * 0.25 ? stripe : c));
  for (const [sx, sy, r] of spots ?? []) {
    const mark = new Pix(CATCH_CELLS, CATCH_CELLS).ellipse(sx, sy, r, r * 0.8, "K");
    p.map((c, x, y) => (["4", "5", "6"].includes(c) && mark.get(x, y) === "K" ? (y < cy ? "N" : "K") : c));
  }
  // 아가미 줄, 눈(반짝이), 입
  const gx = Math.round(cx + len * 0.18);
  p.vline(gx, Math.round(cy - h * 0.25), Math.round(cy + h * 0.2), "6");
  const ex = Math.round(cx + len * 0.32);
  const ey = Math.round(cy - h * 0.15);
  p.px(ex, ey, "#").px(ex, ey - 1, "w");
  if (h >= 8) p.px(ex + 1, ey, "#");
  p.px(Math.round(cx + len / 2) - 1, Math.round(cy + h * 0.15), "#");
  p.outline();
  if (whisker) p.px(Math.round(cx + len / 2), Math.round(cy + h * 0.3) + 1, "#").px(Math.round(cx + len / 2) + 1, Math.round(cy + h * 0.3) + 2, "#");
  return p.rows();
}

/** 동물 먹이 꾸러미: 끈으로 묶은 자루, 위에 새싹, 앞에 씨앗 그림 */
function feedSack(): string[] {
  const p = new Pix(CATCH_CELLS, CATCH_CELLS);
  p.ellipse(10, 13, 6.5, 5.5, "B");
  p.rect(7, 5, 6, 4, "B");
  p.ellipse(10, 4.5, 4, 1.5, "B");
  p.map((c, x, y) => (c === "B" && (x >= 14 || y >= 17) ? "b" : c === "B" && x <= 5 && y < 12 ? "Z" : c));
  // 묶은 끈
  p.hline(7, 12, 8, "N").px(13, 9, "N").px(14, 10, "N");
  // 씨앗 그림 표
  p.rect(8, 12, 5, 4, "c").px(9, 13, "u").px(11, 13, "u").px(10, 14, "u").px(12, 14, "u");
  // 새싹
  p.vline(10, 1, 3, "m").rect(8, 0, 2, 2, "l").rect(11, 0, 2, 1, "L").px(12, 1, "l");
  p.outline();
  return p.rows();
}

/** 낡은 장화: 고무 장화, 기운 자국, 떨어지는 물방울 */
function oldBoot(): string[] {
  const p = new Pix(CATCH_CELLS, CATCH_CELLS);
  p.rect(5, 3, 7, 12, "5");
  p.ellipse(11, 15.5, 6, 2.5, "5");
  p.rect(5, 13, 6, 4, "5");
  p.map((c, x, y) => (c === "5" && x >= 10 && y < 13 ? "6" : c === "5" && y >= 17 ? "6" : c));
  // 장화 입구 테두리·밑창
  p.hline(5, 11, 3, "4").hline(4, 17, 18, "X");
  // 기운 천 조각
  p.rect(6, 8, 3, 3, "d").px(6, 8, "b").px(8, 10, "b");
  p.outline();
  // 물방울
  p.px(2, 9, "i").px(2, 10, "v").px(18, 6, "i").px(17, 4, "I");
  return p.rows();
}

/** 작은 보물 상자: 나무 상자에 금테, 열린 틈으로 코인이 반짝, 물풀 한 가닥 */
function treasureChest(): string[] {
  const p = new Pix(CATCH_CELLS, CATCH_CELLS);
  // 뚜껑(둥근 윗면)과 몸통
  p.ellipse(10, 8, 7.5, 3.5, "B");
  p.rect(3, 8, 15, 2, "B");
  p.rect(3, 10, 15, 7, "b");
  p.map((c, _x, y) => (c === "B" && y <= 5 ? "Z" : c));
  // 금테: 뚜껑 아래 띠, 세로 띠 둘, 자물쇠
  p.hline(3, 17, 10, "z").vline(6, 6, 16, "z").vline(14, 6, 16, "z");
  p.rect(9, 10, 3, 3, "u").px(10, 11, "#");
  // 뚜껑 틈 사이 코인
  p.px(8, 9, "Z").px(11, 9, "Z").px(12, 9, "z");
  p.outline();
  // 반짝이·물풀
  p.px(2, 3, "w").px(18, 2, "Z").px(17, 1, "w").px(1, 14, "m").px(1, 15, "l").px(2, 16, "m");
  return p.rows();
}

const cache = new Map<string, string>();

const SILVER = { 4: "#eef6fb", 5: "#b4cadb", 6: "#7895ae" };

const ART: Record<string, Art> = {
  // 송사리: 작고 날씬한 은빛, 옆줄
  minnow: { rows: fish({ len: 11, h: 5, stripe: "v" }), colors: SILVER },
  // 붕어: 통통한 황동빛
  crucian: { rows: fish({ len: 13, h: 9 }), colors: { 4: "#f1e7b8", 5: "#c4ab5e", 6: "#8b7438" } },
  // 잉어: 크고 흰 바탕에 주황 무늬 (비단잉어), 수염
  carp: {
    rows: fish({ len: 15, h: 9, whisker: true, spots: [[9, 8, 2.6], [13, 11, 2]] }),
    colors: { 4: "#fffaf0", 5: "#f6ebe0", 6: "#d9c6b4", K: "#ff8b5a", N: "#e05a3f" },
  },
  // 황금 잉어: 금빛 몸에 반짝이
  golden: {
    rows: (() => {
      const p = new Pix(CATCH_CELLS, CATCH_CELLS).stamp(fish({ len: 15, h: 9, whisker: true }), 0, 0);
      for (const [x, y] of [[2, 2], [17, 3], [16, 16]] as const) p.px(x, y, "w").px(x - 1, y, "Z").px(x + 1, y, "Z").px(x, y - 1, "Z").px(x, y + 1, "Z");
      return p.rows();
    })(),
    colors: { 4: "#fff3b0", 5: "#ffd36e", 6: "#d99a36" },
  },
  // ── 2026-10-12 "낚시 컨텐츠 더 풍성하게": 새 물고기 ──
  // 피라미: 날씬한 은빛, 보랏빛 옆줄
  chub: { rows: fish({ len: 12, h: 5, stripe: "U" }), colors: { 4: "#f3f6fb", 5: "#b9c4dc", 6: "#7c88b0" } },
  // 빙어: 작고 투명한 몸, 물빛 옆줄
  smelt: { rows: fish({ len: 10, h: 4, stripe: "i" }), colors: { 4: "#f7fdff", 5: "#d4eef7", 6: "#96c4d8" } },
  // 메기: 길고 납작한 흙빛 몸, 긴 수염
  catfish: {
    rows: (() => {
      const p = new Pix(CATCH_CELLS, CATCH_CELLS).stamp(fish({ len: 16, h: 7, whisker: true }), 0, 0);
      p.px(18, 8, "#").px(19, 7, "#").px(18, 13, "#").px(19, 14, "#");
      return p.rows();
    })(),
    colors: { 4: "#d8c8ab", 5: "#806c58", 6: "#55473a" },
  },
  // 쏘가리: 노란 몸에 짙은 얼룩
  mandarin: {
    rows: fish({ len: 14, h: 8, spots: [[7, 9, 1.4], [10, 11, 1.3], [12, 8, 1.2], [8, 12, 1]] }),
    colors: { 4: "#f8eab8", 5: "#d9b85e", 6: "#9a7a36", K: "#7a5a2a", N: "#4f3a1e" },
  },
  // 산천어: 은록빛 몸, 분홍 옆줄, 파란 무늬
  cherry: {
    rows: fish({ len: 13, h: 7, stripe: "V", spots: [[8, 8, 1.2], [11, 8, 1.2]] }),
    colors: { 4: "#eef4ea", 5: "#a9bfa0", 6: "#6f8a68", K: "#9db0d8", N: "#6f7fb0" },
  },
  // 은어: 올리브빛 날씬한 몸, 아가미 뒤 노란 점
  sweetfish: { rows: fish({ len: 13, h: 5, stripe: "z" }), colors: { 4: "#f6f3dc", 5: "#c3c493", 6: "#86915f" } },
  // 꺽지: 갈색 몸, 아가미에 파란 점
  perch: {
    rows: fish({ len: 12, h: 8, spots: [[13, 9, 1]] }),
    colors: { 4: "#ecdcb4", 5: "#a88c5a", 6: "#6e5a38", K: "#7fd0f0", N: "#3f9ad0" },
  },
  // 달빛 잉어: 은청빛 몸, 별 반짝이
  moon: {
    rows: (() => {
      const p = new Pix(CATCH_CELLS, CATCH_CELLS).stamp(fish({ len: 15, h: 9, whisker: true }), 0, 0);
      for (const [x, y] of [[2, 3], [17, 2], [17, 16]] as const) p.px(x, y, "w").px(x - 1, y, "U").px(x + 1, y, "U").px(x, y - 1, "U").px(x, y + 1, "U");
      return p.rows();
    })(),
    colors: { 4: "#f4f8ff", 5: "#c6d4f5", 6: "#8a9ad6" },
  },
  chest: { rows: treasureChest() },
  feed: { rows: feedSack() },
  boot: { rows: oldBoot(), colors: { 4: "#a7c48a", 5: "#6f8f5a", 6: "#4f6b40" } },
};

/** 그림이 있는 낚을 것 키 (시험용) */
export const CATCH_ART_KEYS = Object.keys(ART);

/** 아직 못 낚은 것의 그림자 그림 (도감): 모든 칸을 한 색으로 */
export function catchSilhouetteDataUri(key: string, scale = 2): string | null {
  const art = ART[key];
  if (!art) return null;
  const id = `${key}@${scale}:shadow`;
  let uri = cache.get(id);
  if (!uri) {
    const rows = art.rows.map((r) => r.replace(/[^.]/g, "X"));
    uri = svgDataUri(spriteSvg(rows, { scale, colors: { X: "#9fb7c4" } }));
    cache.set(id, uri);
  }
  return uri;
}

/** 낚을 것 그림 줄 (없으면 null) */
export function catchRows(key: string): Sprite | null {
  return ART[key]?.rows ?? null;
}

/** 낚을 것 data URI (scale = 정수 배율). 그림이 없으면 null */
export function catchDataUri(key: string, scale = 2): string | null {
  const art = ART[key];
  if (!art) return null;
  const id = `${key}@${scale}`;
  let uri = cache.get(id);
  if (!uri) {
    uri = svgDataUri(spriteSvg(art.rows, { scale, colors: art.colors }));
    cache.set(id, uri);
  }
  return uri;
}

// ===== 낚시 연출 그림 =====

/** 찌 (빨강·흰색, 위에 낚싯줄) 7×12 */
export const BOBBER: Sprite = [
  "...w...",
  "...w...",
  "...w...",
  "..###..",
  ".#KNN#.",
  "#KNNNQ#",
  "#wwwwx#",
  "#wwwwx#",
  ".#wwx#.",
  "..###..",
  "...#...",
  ".......",
];

/** 물보라 (낚아 올릴 때 튀는 물방울) 28×12 */
export const SPLASH: Sprite = [
  "..........I.................",
  "....I....IiI.......I........",
  "...IiI....i.......IiI...I...",
  "....i...........I..i...IiI..",
  "..............IIiI......i...",
  "..I.....I....IivviI.........",
  ".IiI...IiI..IivvvviI....I...",
  "..i....IiiIIivvvvvviI..IiI..",
  "......IivvvvvvvvvvvviI..i...",
  ".IIIIIivvvvvvvvvvvvvviIIIII.",
  "IiiiiivvvvvvvvvvvvvvvviiiiiI",
  ".IIIIIIIIIIIIIIIIIIIIIIIIII.",
];

/** 연못 물결 한 줄 (가로로 이어 붙인다) 16×6 */
export const RIPPLE: Sprite = [
  "iiiiiiiiiiiiiiii",
  "iiiIIiiiiiiiiiii",
  "iiiiiIIiiiiiiIIi",
  "vviiiiiiiiiiiiii",
  "vvvvviiivvvviiiv",
  "vvvvvvvvvvvvvvvv",
];

export function bobberDataUri(scale = 4) {
  return svgDataUri(spriteSvg(BOBBER, { scale }));
}
export function splashDataUri(scale = 4) {
  return svgDataUri(spriteSvg(SPLASH, { scale }));
}
export function rippleDataUri(scale = 4) {
  return svgDataUri(spriteSvg(RIPPLE, { scale }));
}
