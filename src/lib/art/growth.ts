// 성장 아이템 그림 (SHOP-01 2026-10-07, 도트 2026-10-09): 동물 농장에서 쓰는 먹이·촉진제.
// 32 × 32 칸 도화지 바닥에 붙여 그리고, 화면에서는 32의 정수배로 보인다 (fitSvg). 글자 뜻은 pixel.ts PALETTE
import { type Colors, fitSvg, Pix, ramp, type Sprite, svgDataUri } from "./pixel";

type Art = { rows: Sprite; colors?: Colors };

const tint = (hex: string): Colors => {
  const [a, b, c] = ramp(hex);
  return { 4: a, 5: b, 6: c };
};

const GROWTH: Record<string, Art> = {
  // 동물 먹이: 곡식 자루 (삼베는 4·5·6)
  "growth.feed": {
    colors: tint("#e8c98a"),
    rows: (() => {
      const p = new Pix(32, 32);
      // 자루 몸통 (아래가 불룩)
      for (let y = 10; y < 30; y++) {
        const half = y < 13 ? 6 + (y - 10) : y < 26 ? 9 : 9 - (y - 25);
        p.hline(16 - half, 15 + half, y, "5");
        p.px(16 - half, y, "4").px(15 + half, y, "6").px(14 + half, y, "6");
      }
      // 묶은 목과 위로 나온 곡식
      p.rect(12, 8, 8, 2, "6").hline(12, 19, 8, "5");
      p.ellipse(16, 6, 5, 2.5, "4").hline(13, 18, 5, "z").px(14, 4, "z").px(17, 4, "z").px(16, 5, "u");
      // 새싹
      p.outline();
      p.vline(16, 1, 3, "l").px(15, 1, "L").px(14, 0, "L").px(17, 1, "m").px(18, 0, "m");
      // 이름표: 동그란 라벨에 십자
      p.oval(16, 20.5, 5, 4, "w");
      p.hline(14, 17, 20, "N").vline(15, 19, 21, "N").vline(16, 19, 21, "N");
      return p.shadow(16, 30.5, 10, 1.5).rows();
    })(),
  },
  // 고급 먹이: 당근과 사과가 담긴 그릇 (그릇은 4·5·6)
  "growth.premium": {
    colors: tint("#8ec5ff"),
    rows: (() => {
      const p = new Pix(32, 32);
      // 당근 (비스듬히)
      for (let k = 0; k < 11; k++) {
        const x = 19 + Math.round(k * 0.5);
        const y = 18 - k;
        const w = k < 3 ? 3 : k < 8 ? 2 : 1;
        p.hline(x - w + 1, x + 1, y, k % 3 === 1 ? "u" : "K");
      }
      p.hline(18, 21, 17, "K");
      p.px(25, 6, "l").px(24, 5, "l").px(26, 5, "L").px(25, 4, "m").px(27, 4, "l");
      // 사과
      p.ellipse(12, 14, 5, 4.5, "N");
      p.ellipse(10.5, 12.5, 2, 1.5, "K").px(10, 12, "w");
      p.px(12, 9, "n").px(13, 8, "n").px(14, 9, "l").px(15, 8, "L");
      // 그릇
      p.rect(3, 17, 26, 3, "4").hline(3, 28, 17, "w");
      for (let y = 20; y < 29; y++) {
        const inset = Math.floor((y - 20) * 0.9);
        p.hline(3 + inset, 28 - inset, y, "5");
        p.px(28 - inset, y, "6").px(27 - inset, y, "6");
      }
      p.hline(6, 25, 22, "4");
      return p.outline().shadow(16, 30.5, 11, 1.5).rows();
    })(),
  },
  // 성장 촉진제: 반짝이는 물약 (물약은 4·5·6)
  "growth.booster": {
    colors: tint("#9b7cf2"),
    rows: (() => {
      const p = new Pix(32, 32);
      // 코르크 마개와 병목
      p.rect(13, 2, 6, 4, "B").hline(13, 18, 2, "Z").vline(18, 2, 5, "b");
      p.rect(13, 6, 6, 5, "I").vline(13, 6, 10, "w");
      // 둥근 병
      p.ellipse(16, 20, 10, 9.5, "I");
      p.ellipse(16, 21.5, 9, 7.5, "5");
      p.hline(8, 23, 15, "4").hline(7, 24, 16, "4");
      p.ellipse(19, 24, 5, 3.5, "6");
      p.ellipse(11, 19, 1.5, 2.5, "w").px(14, 25, "w").px(20, 18, "4");
      p.outline();
      // 반짝이 (외곽선 없이)
      const spark = (x: number, y: number) => p.px(x, y, "Z").px(x - 1, y, "z").px(x + 1, y, "z").px(x, y - 1, "z").px(x, y + 1, "z");
      spark(26, 5);
      spark(5, 9);
      p.px(27, 13, "z");
      return p.shadow(16, 30.5, 9, 1.5).rows();
    })(),
  },
};

const FALLBACK: Sprite = (() => {
  const p = new Pix(32, 32);
  p.ellipse(16, 20, 9, 9, "c").ellipse(14, 17, 3, 3, "w");
  return p.outline().shadow(16, 30.5, 9, 1.5).rows();
})();

/** 성장 아이템 SVG. size = 화면에 보일 한 변 px (32의 배수면 도트가 고르다) */
export function growthSvg(assetKey: string, size = 96): string {
  const art = GROWTH[assetKey] ?? { rows: FALLBACK };
  return fitSvg(art.rows, size, { colors: art.colors });
}

export function growthDataUri(assetKey: string, size = 96): string {
  return svgDataUri(growthSvg(assetKey, size));
}
