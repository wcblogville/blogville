// 동물 농장 동물 그림 (도트, 2026-10-09 "남은 그림도 도트로"). 캐릭터처럼 코드로 그린다.
// 32 × 32 칸 도화지, 발바닥이 y=29. 단계(아기·청소년·어른)마다 몸 크기 r을 달리해 새로 그린다 (줄여서 흐려지지 않게).
// 어른은 머리에 리본을 단다. 화면에서는 32의 정수배(64·96px)로 보여야 도트가 고르다 (fitSvg).
import type { AnimalStage } from "@/lib/farm";
import { type Colors, fitSvg, Pix, type Sprite, svgDataUri } from "./pixel";

/** 단계별 몸 반지름 (칸) */
const STAGE_R: Record<AnimalStage, number> = { baby: 5, teen: 7, adult: 9 };
const FEET = 29;

type Draw = (p: Pix, r: number, cy: number) => void;

/** 눈 두 개와 볼터치 (몸이 크면 눈이 2칸 높이, 반짝이 한 칸) */
function face(p: Pix, r: number, cy: number) {
  const ey = Math.round(cy - r * 0.15);
  const dx = Math.max(2, Math.round(r * 0.4));
  const [lx, rx] = [15 - dx, 16 + dx];
  if (r >= 9) {
    // 큰 눈: 2×2칸, 왼쪽 위에 반짝이
    p.rect(lx - 1, ey - 1, 2, 2, "#").rect(rx, ey - 1, 2, 2, "#").px(lx - 1, ey - 1, "w").px(rx, ey - 1, "w");
  } else {
    p.px(lx, ey, "#").px(rx, ey, "#");
    if (r >= 7) p.px(lx, ey - 1, "#").px(rx, ey - 1, "#");
  }
  if (r >= 7) p.px(lx - 2, ey + 2, "p").px(rx + 2, ey + 2, "p");
}

const ANIMALS: Record<string, { colors: Colors; draw: Draw }> = {
  // 병아리: 노란 동그라미, 주황 부리·발
  "animal.chick": {
    colors: { 4: "#fff1a0", 5: "#ffd84d", 6: "#e9ac2c", o: "#f08a24" },
    draw: (p, r, cy) => {
      // 날개
      p.ellipse(16 - r - 0.5, cy + 1, 2, 2.5, "6").ellipse(16 + r + 0.5, cy + 1, 2, 2.5, "6");
      p.ellipse(16, cy, r + 0.5, r, "5");
      p.ellipse(14.5, cy - r * 0.45, r * 0.45, r * 0.3, "4");
      // 머리 깃털
      p.px(16, Math.round(cy - r) - 1, "5").px(17, Math.round(cy - r) - 2, "5");
      // 부리
      const by = Math.round(cy + r * 0.15);
      p.rect(15, by, 2, 1, "o");
      if (r >= 7) p.rect(14, by, 4, 1, "o").rect(15, by + 1, 2, 1, "u");
      // 발
      p.px(14, FEET, "o").px(13, FEET, "o").px(18, FEET, "o").px(19, FEET, "o");
    },
  },
  // 토끼: 흰 몸, 긴 귀, 분홍 귀 안쪽
  "animal.bunny": {
    colors: { 4: "#ffffff", 5: "#f6f1ea", 6: "#ddd2c6", o: "#ffb3c7" },
    draw: (p, r, cy) => {
      const top = Math.round(cy - r);
      const ear = Math.round(r * 1.1);
      for (const x of [16 - Math.round(r * 0.45) - 1, 16 + Math.round(r * 0.45)]) {
        p.rect(x - 1, top - ear, 3, ear + 2, "4").vline(x, top - ear + 1, top, "o");
        p.vline(x + 1, top - ear, top + 1, "6");
      }
      p.ellipse(16, cy, r + 0.5, r, "5");
      p.ellipse(14.5, cy - r * 0.45, r * 0.5, r * 0.35, "4");
      // 발
      p.rect(12, FEET - 1, 3, 2, "4").rect(17, FEET - 1, 3, 2, "4");
      // 코
      p.px(16, Math.round(cy + r * 0.2), "o");
    },
  },
  // 아기 돼지: 분홍, 납작 코, 세모 귀
  "animal.piglet": {
    colors: { 4: "#ffe0e8", 5: "#ffc2d2", 6: "#f09ab3", o: "#ff9fb8" },
    draw: (p, r, cy) => {
      const top = Math.round(cy - r);
      const dx = Math.round(r * 0.55);
      p.stamp(["5.", "55", "565"], 16 - dx - 2, top - 2).stamp([".5", "55", "655"], 16 + dx, top - 2);
      p.ellipse(16, cy, r + 1, r, "5");
      p.ellipse(14, cy - r * 0.5, r * 0.5, r * 0.3, "4");
      p.rect(12, FEET - 1, 3, 2, "6").rect(18, FEET - 1, 3, 2, "6");
      // 코: 가운데 납작한 타원과 콧구멍
      const ny = Math.round(cy + r * 0.25);
      if (r >= 7) {
        p.rect(14, ny, 5, 3, "o").hline(15, 17, ny - 1, "o").hline(15, 17, ny + 3, "o");
        p.px(15, ny + 1, "#").px(17, ny + 1, "#");
      } else p.rect(15, ny, 3, 2, "o").px(15, ny, "#").px(17, ny, "#");
    },
  },
  // 송아지: 흰 바탕 검은 무늬, 작은 뿔, 코
  "animal.calf": {
    colors: { 4: "#ffffff", 5: "#f7f2ea", 6: "#ddd2c6", D: "#4a3a33", o: "#ffc7a8", O: "#f4a882" },
    draw: (p, r, cy) => {
      const top = Math.round(cy - r);
      const dx = Math.round(r * 0.5);
      // 뿔과 옆으로 난 귀
      p.rect(16 - dx - 1, top - 2, 2, 3, "c").rect(16 + dx, top - 2, 2, 3, "c");
      p.ellipse(16 - r - 1, cy - r * 0.35, 2.5, 1.5, "5").ellipse(17 + r, cy - r * 0.35, 2.5, 1.5, "5");
      p.ellipse(16, cy, r + 0.5, r, "5");
      p.ellipse(14.5, cy - r * 0.5, r * 0.4, r * 0.3, "4");
      // 무늬
      p.ellipse(16 - r * 0.6, cy - r * 0.6, r * 0.35, r * 0.3, "D");
      p.ellipse(16 + r * 0.7, cy + r * 0.4, r * 0.3, r * 0.3, "D");
      p.rect(12, FEET - 1, 3, 2, "D").rect(18, FEET - 1, 3, 2, "D");
      // 주둥이
      const ny = Math.round(cy + r * 0.25);
      const w = Math.max(2, Math.round(r * 0.55));
      p.rect(16 - w, ny, w * 2, r >= 7 ? 4 : 2, "o").hline(16 - w, 15 + w, ny + (r >= 7 ? 3 : 1), "O");
      p.px(16 - Math.ceil(w / 2), ny + 1, "#").px(15 + Math.ceil(w / 2), ny + 1, "#");
    },
  },
};

// 어른이 되면 다는 리본 (외곽선 포함 도장)
const RIBBON: Sprite = [".#...#.", "#V#.#V#", "#VV#VV#", "#VVRVV#", "#VV#VV#", "#V#.#V#", ".#...#."];

function animalRows(assetKey: string, stage: AnimalStage): { rows: Sprite; colors: Colors } {
  const art = ANIMALS[assetKey] ?? ANIMALS["animal.chick"];
  const r = STAGE_R[stage];
  const cy = FEET - r + 0.5;
  const p = new Pix(32, 32);
  art.draw(p, r, cy);
  // 몸 오른쪽 아래 가장자리에 그늘 (밖과 맞닿은 칸)
  p.map((c, x, y) => (c === "5" && (p.get(x + 1, y + 1) === "." || p.get(x, y + 1) === ".") ? "6" : c));
  face(p, r, cy);
  p.outline();
  if (stage === "adult") p.stamp(RIBBON, Math.round(16 + r * 0.25), Math.round(cy - r) - 4);
  p.shadow(16, FEET + 1.5, r + 2, 1.5);
  return { rows: p.rows(), colors: art.colors };
}

/** 그림 키에 맞는 동물 그림이 있는지 (블로그 전시 동물은 없으면 그리지 않는다, BLOG-04 / research R-20) */
export function hasAnimalArt(assetKey: string): boolean {
  return Object.hasOwn(ANIMALS, assetKey);
}

/** 동물 SVG. 단계가 낮을수록 작다 (발바닥 기준). size = 화면에 보일 한 변 px (32의 배수면 도트가 고르다) */
export function animalSvg(assetKey: string, stage: AnimalStage, size = 64): string {
  const { rows, colors } = animalRows(assetKey, stage);
  return fitSvg(rows, size, { colors });
}

const EGG: Sprite = (() => {
  const p = new Pix(32, 32);
  for (let y = 9; y < 30; y++) {
    // 위가 좁은 알 모양
    const t = (y - 19.5) / 10.5;
    const half = Math.round(8 * Math.sqrt(Math.max(0, 1 - t * t)) * (y < 19 ? 0.82 + 0.18 * (1 + t) : 1));
    if (half > 0) p.hline(16 - half, 15 + half, y, "w");
    if (half > 1) p.px(15 + half, y, "c").px(14 + half, y, y > 20 ? "c" : "w");
  }
  p.hline(10, 21, 28, "c").hline(9, 22, 27, "c").map((c, x, y) => (c === "w" && y > 25 && x > 17 ? "c" : c));
  p.rect(11, 18, 2, 2, "z").rect(18, 13, 2, 2, "i").rect(17, 22, 3, 2, "V").rect(12, 24, 2, 1, "l").px(15, 16, "U");
  p.px(12, 13, "I").px(13, 12, "I");
  return p.outline().shadow(16, 30.5, 9, 1.5).rows();
})();

/** 아직 부화하지 않은 알 */
export function eggSvg(size = 64): string {
  return fitSvg(EGG, size);
}

export function toAnimalDataUri(svg: string) {
  return svgDataUri(svg);
}
