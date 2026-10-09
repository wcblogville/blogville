// 집 안 가구 그림 (도트, 2026-10-09 "남은 그림도 도트로"). 블로그의 "우리 집" 구역과 상점·꾸미기 미리보기가 같이 쓴다.
// 모든 가구는 32 × 32 칸 도화지 바닥(아래쪽)에 붙여 그린다. 글자 뜻은 pixel.ts PALETTE, 가구마다 다른 색은 colors로 바꿔 칠한다.
// 화면에서는 32의 정수배(64·96px)로 보여야 도트가 고르다 (fitSvg).
import { type Colors, fitSvg, Pix, ramp, type Sprite, svgDataUri } from "./pixel";

type Art = { rows: Sprite; colors?: Colors };

/** 4·5·6 칸(밝은 면·기본·그늘)을 한 색으로 칠한다 */
const tint = (hex: string): Colors => {
  const [a, b, c] = ramp(hex);
  return { 4: a, 5: b, 6: c };
};

/** 그림 다 그린 뒤: 외곽선 두르고 바닥 그림자 */
const finish = (p: Pix, rx = 12) => p.outline().shadow(16, 30.5, rx, 1.5).rows();

const FURNITURE: Record<string, Art> = {
  // 화분: 잎이 무성한 초록 화분 (토분은 4·5·6)
  "furniture.plant": {
    colors: tint("#d9825b"),
    rows: (() => {
      const p = new Pix(32, 32);
      // 잎: 큰 덩어리 몇 개를 겹치고 밝은 면·그늘
      p.ellipse(16, 11, 7, 7, "l").ellipse(10, 14, 5, 4, "l").ellipse(22, 13, 5, 4.5, "l").ellipse(16, 5, 4, 4, "l");
      p.ellipse(9, 7, 3, 3.5, "l").ellipse(24, 6, 3, 3.5, "l");
      p.ellipse(13, 9, 3, 2.5, "L").ellipse(18, 4, 2, 1.5, "L").ellipse(8.5, 6, 1.5, 1.5, "L").ellipse(23, 5, 1.5, 1.5, "L");
      p.ellipse(19, 15, 4, 2.5, "m").ellipse(11, 16, 3, 1.5, "m").ellipse(23.5, 15, 2, 1.5, "m");
      p.vline(16, 15, 18, "M").px(14, 17, "M").px(18, 17, "M");
      // 토분
      p.box(8, 18, 16, 4, "4");
      p.hline(9, 22, 20, "5");
      for (let y = 22; y < 30; y++) {
        const inset = Math.floor((y - 22) / 3);
        p.hline(9 + inset, 22 - inset, y, "5");
        p.px(22 - inset, y, "6").px(21 - inset, y, "6").px(9 + inset, y, "4");
      }
      p.hline(12, 19, 25, "6");
      return finish(p, 9);
    })(),
  },
  // 나무 의자
  "furniture.chair": {
    rows: (() => {
      const p = new Pix(32, 32);
      // 등받이: 위 가로대와 기둥 두 개, 사이 살
      p.rect(8, 2, 16, 4, "B").hline(8, 23, 2, "Z").hline(8, 23, 5, "b");
      p.rect(8, 6, 3, 12, "B").rect(21, 6, 3, 12, "b").vline(8, 6, 17, "Z");
      for (const x of [13, 16, 19]) p.vline(x, 6, 17, "b").vline(x - 1, 6, 17, "B");
      // 앉는 판
      p.rect(5, 17, 22, 3, "B").hline(5, 26, 17, "Z").hline(5, 26, 20, "b").hline(5, 26, 21, "n");
      // 다리 (앞 두 개 굵게, 뒤 두 개 얇게)
      p.rect(11, 22, 2, 6, "n").rect(19, 22, 2, 6, "n");
      p.rect(6, 22, 3, 8, "b").rect(23, 22, 3, 8, "b").vline(6, 22, 29, "B").vline(23, 22, 29, "B");
      p.hline(9, 22, 26, "n");
      return finish(p, 12);
    })(),
  },
  // 둥근 탁자 + 찻잔
  "furniture.table": {
    rows: (() => {
      const p = new Pix(32, 32);
      // 받침과 다리
      p.ellipse(16, 29, 7, 1.5, "b").hline(11, 20, 28, "B");
      p.rect(14, 16, 4, 12, "b").vline(14, 16, 27, "B").vline(17, 16, 27, "n");
      // 상판 (위에서 본 타원 + 두께)
      p.ellipse(16, 15, 15, 3.5, "b");
      p.ellipse(16, 13.5, 15, 3.5, "B");
      p.ellipse(13, 12.5, 7, 1.5, "Z");
      // 찻잔과 김
      p.rect(12, 7, 6, 4, "w").hline(13, 16, 10, "Y").rect(13, 7, 4, 1, "u");
      p.px(18, 8, "#").px(19, 8, "#").px(19, 9, "#").px(18, 10, "#");
      p.outline();
      // 김은 외곽선 없이 (outline 다음에 그린다)
      for (const [x, y] of [[13, 5], [14, 4], [14, 3], [15, 2], [16, 5], [17, 4], [17, 3], [18, 2]]) p.px(x, y, "y");
      return p.shadow(16, 30.5, 13, 1.5).rows();
    })(),
  },
  // 포근한 침대 (이불은 4·5·6)
  "furniture.bed": {
    colors: tint("#8ec5ff"),
    rows: (() => {
      const p = new Pix(32, 32);
      // 머리판 (왼쪽, 둥근 위)
      p.rect(1, 9, 5, 21, "B").rect(2, 8, 3, 1, "B").vline(1, 9, 29, "Z").vline(5, 9, 29, "b");
      p.px(3, 12, "n").px(3, 13, "n");
      // 발판 (오른쪽, 낮게)
      p.rect(27, 16, 4, 14, "B").vline(30, 16, 29, "b").vline(27, 16, 29, "Z");
      // 틀
      p.rect(6, 23, 21, 3, "b").hline(6, 26, 23, "B");
      // 매트리스
      p.rect(6, 18, 21, 5, "w").hline(6, 26, 22, "Y");
      // 베개
      p.rect(6, 14, 7, 4, "w").hline(7, 11, 14, "I").hline(6, 12, 17, "Y");
      // 이불
      p.rect(12, 15, 15, 8, "5").hline(12, 26, 15, "4").hline(12, 26, 22, "6");
      for (const x of [16, 21]) p.vline(x, 16, 21, "6");
      p.rect(12, 15, 2, 7, "4");
      // 다리
      p.rect(2, 30, 3, 1, "n").rect(28, 30, 2, 1, "n");
      return finish(p, 15);
    })(),
  },
  // 책장
  "furniture.shelf": {
    rows: (() => {
      const p = new Pix(32, 32);
      p.rect(5, 1, 22, 29, "b");
      p.hline(5, 26, 1, "B").vline(5, 1, 29, "B").vline(26, 1, 29, "n");
      // 칸 안쪽 (짙은 뒤판)
      p.rect(7, 3, 18, 8, "n").rect(7, 13, 18, 7, "n");
      p.hline(6, 25, 11, "B").hline(6, 25, 12, "b").hline(6, 25, 20, "B").hline(6, 25, 21, "b");
      // 위 칸: 책 세 권과 화분
      const book = (x: number, y: number, w: number, h: number, c: string, light: string) => {
        p.rect(x, y, w, h, c).vline(x, y, y + h - 1, light).hline(x, x + w - 1, y + 1, "Z");
      };
      book(8, 4, 2, 7, "N", "K");
      book(10, 5, 2, 6, "z", "Z");
      book(12, 3, 2, 8, "v", "i");
      p.rect(19, 8, 4, 3, "K").hline(19, 22, 8, "Z");
      p.ellipse(21, 6.5, 2.5, 2, "l").px(20, 5, "L");
      // 아래 칸: 책과 기운 책
      book(8, 15, 2, 5, "U", "w");
      book(10, 14, 2, 6, "l", "L");
      p.px(14, 19, "V").px(15, 18, "V").px(15, 19, "R").px(16, 17, "V").px(16, 18, "R").px(17, 16, "V").px(17, 17, "R").px(18, 15, "V").px(18, 16, "R").px(19, 15, "R");
      p.rect(21, 17, 3, 3, "w").hline(21, 23, 17, "z");
      // 서랍
      p.rect(7, 23, 18, 6, "B").hline(7, 24, 23, "Z").hline(7, 24, 28, "b");
      p.rect(15, 25, 2, 2, "#");
      return finish(p, 13);
    })(),
  },
  // 스탠드 조명
  "furniture.lamp": {
    rows: (() => {
      const p = new Pix(32, 32);
      // 갓 (위가 좁은 사다리꼴)
      for (let y = 2; y < 12; y++) {
        const half = 5 + Math.floor((y - 2) / 2);
        p.hline(16 - half, 15 + half, y, "z");
        p.px(16 - half, y, "Z").px(15 + half, y, "u");
      }
      p.hline(12, 19, 2, "Z").hline(7, 24, 11, "u");
      p.rect(13, 4, 2, 5, "Z");
      // 기둥과 받침
      p.rect(15, 12, 2, 16, "n").vline(15, 12, 27, "b");
      p.ellipse(16, 28.5, 6, 1.5, "n").hline(12, 19, 28, "b");
      p.outline();
      // 불빛: 갓 아래 은은한 빛
      for (const [y, half] of [[12, 6], [13, 5]] as const) for (let x = 16 - half; x < 16 + half; x++) if (p.get(x, y) === ".") p.px(x, y, "Z");
      return p.shadow(16, 30.5, 8, 1.5).rows();
    })(),
  },
  // 동그란 러그 (분홍 · 노랑 · 하늘 고리)
  "furniture.rug": {
    rows: (() => {
      const p = new Pix(32, 32);
      p.ellipse(16, 25.5, 15, 5, "V");
      p.ellipse(16, 25.5, 11, 3.5, "z");
      p.ellipse(16, 25.5, 6, 2, "i");
      p.ellipse(16, 25.5, 2.5, 0.8, "w");
      // 술 장식 (왼쪽·오른쪽 끝)
      p.px(0, 25, "R").px(0, 26, "R").px(31, 25, "R").px(31, 26, "R");
      p.outline();
      p.map((c, x, y) => (c === "V" && y > 26 && (x + y) % 2 === 0 ? "R" : c));
      return p.rows();
    })(),
  },
  // 푹신한 소파 (천은 4·5·6)
  "furniture.sofa": {
    colors: tint("#7fb8a4"),
    rows: (() => {
      const p = new Pix(32, 32);
      // 등받이
      p.rect(5, 9, 22, 10, "5").hline(5, 26, 9, "4").hline(6, 25, 10, "4");
      p.vline(16, 11, 18, "6");
      // 방석
      p.rect(5, 18, 22, 6, "4").hline(5, 26, 22, "5").hline(5, 26, 23, "6");
      p.vline(16, 18, 23, "6");
      // 팔걸이 (양옆, 앞으로 둥글게)
      for (const x of [1, 26]) {
        p.rect(x, 13, 5, 13, "5").hline(x, x + 4, 13, "4").hline(x + 1, x + 3, 12, "4");
        p.vline(x + 4, 14, 25, "6");
      }
      p.rect(1, 25, 30, 2, "6");
      // 다리
      p.rect(3, 27, 2, 2, "n").rect(27, 27, 2, 2, "n");
      return finish(p, 15);
    })(),
  },
};

const FALLBACK: Art = {
  rows: (() => {
    const p = new Pix(32, 32);
    p.rect(8, 12, 16, 17, "c").hline(8, 23, 12, "w").hline(8, 23, 28, "d");
    return finish(p, 10);
  })(),
};

export function hasFurnitureArt(assetKey: string) {
  return assetKey in FURNITURE;
}

/** 가구 SVG. size = 화면에 보일 한 변 px (32의 배수면 도트가 고르다) */
export function furnitureSvg(assetKey: string, size = 96): string {
  const art = FURNITURE[assetKey] ?? FALLBACK;
  return fitSvg(art.rows, size, { colors: art.colors });
}

export function furnitureDataUri(assetKey: string, size = 96): string {
  return svgDataUri(furnitureSvg(assetKey, size));
}

/** 시험·미리보기용: 가구 글자 줄 */
export function furnitureRows(assetKey: string): Sprite | null {
  return FURNITURE[assetKey]?.rows ?? null;
}
export const FURNITURE_KEYS = () => Object.keys(FURNITURE);
