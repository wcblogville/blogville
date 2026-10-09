// 광장 장식 그림 (도트, 사용자 결정 2026-10-09 "도트로 바꾸기"). 광장 꾸미기와 상점·꾸미기 미리보기가 같이 쓴다.
// 장식마다 크기가 다르고, 바닥(아랫변 가운데)이 광장의 꾸미기 자리에 닿게 그린다. 광장에서는 PIXEL(3)배.
import { Pix, PIXEL, spriteSize, spriteSvg, svgDataUri, type Sprite } from "./pixel";

const DECO: Record<string, Sprite> = {
  // 나무 벤치
  "deco.bench": (() => {
    const p = new Pix(32, 20);
    p.shadow(16, 18, 15, 1.5);
    for (const y of [1, 5]) {
      p.box(2, y, 28, 4, "B");
      p.hline(3, 28, y + 2, "b");
    }
    p.box(6, 8, 3, 3, "n").box(23, 8, 3, 3, "n");
    p.box(1, 10, 30, 4, "B");
    p.hline(2, 29, 12, "b");
    p.box(3, 13, 3, 6, "n").box(26, 13, 3, 6, "n");
    return p.rows();
  })(),
  // 꽃밭: 나무 화단에 핀 꽃
  "deco.flowerbed": (() => {
    const p = new Pix(36, 20);
    p.shadow(18, 18, 17, 1.5);
    for (let x = 4; x < 32; x += 6) p.oval(x + 2, 9, 4, 3, x % 12 ? "l" : "m");
    const flower = (x: number, y: number, c: string) => p.px(x, y - 1, c).px(x - 1, y, c).px(x + 1, y, c).px(x, y + 1, c).px(x, y, "z");
    [[5, 5, "V"], [10, 3, "z"], [15, 6, "w"], [20, 3, "U"], [25, 5, "V"], [30, 3, "z"], [8, 8, "U"], [27, 8, "w"], [18, 8, "R"]].forEach(([x, y, c]) =>
      flower(x as number, y as number, c as string),
    );
    p.box(2, 10, 32, 8, "B");
    p.hline(3, 32, 13, "b").hline(3, 32, 16, "n");
    for (let x = 9; x < 32; x += 8) p.vline(x, 11, 16, "b");
    return p.rows();
  })(),
  // 이정표
  "deco.signpost": (() => {
    const p = new Pix(22, 32);
    p.shadow(11, 30, 7, 1.5);
    p.box(9, 3, 4, 27, "B");
    p.vline(11, 4, 28, "b");
    p.stamp(["################.", "#BBBBBBBBBBBBBBB##", "#BbBBbbBBbBBBbBBB#", "#bbbbbbbbbbbbbbb##", "################."], 1, 4);
    p.stamp([".################", "##BBBBBBBBBBBBBBB#", "#BBbBBBbbBBbBBBbB#", "##bbbbbbbbbbbbbbb#", ".################"], 3, 12);
    p.stamp(["l.l.", "lml.", "mmll"], 6, 27).stamp([".l.l", ".lml", "llmm"], 12, 27);
    return p.rows();
  })(),
  // 눈사람
  "deco.snowman": (() => {
    const p = new Pix(24, 32);
    p.shadow(12, 30, 9, 1.5);
    for (let k = 0; k < 5; k++) p.px(4 - k, 19 - k, "n").px(19 + k, 19 - k, "n");
    p.oval(12, 22.5, 8, 7.5, "w");
    p.ellipse(10, 21, 4, 3, "I");
    p.ellipse(15, 26, 4, 2, "y");
    p.oval(12, 12, 6, 5.5, "w");
    p.ellipse(11, 11, 3, 2, "I");
    p.px(10, 11, "#").px(14, 11, "#");
    p.rect(12, 13, 3, 1, "K").px(15, 13, "N");
    p.px(12, 20, "#").px(12, 23, "#").px(12, 26, "#");
    // 목도리
    p.rect(6, 16, 12, 2, "N").hline(7, 16, 16, "K");
    p.box(14, 17, 3, 5, "N");
    // 모자
    p.box(8, 2, 8, 6, "X").box(6, 7, 12, 2, "X");
    p.hline(9, 14, 6, "N");
    return p.rows();
  })(),
  // 캠핑 텐트
  "deco.tent": (() => {
    const p = new Pix(40, 28);
    p.shadow(20, 26, 19, 1.5);
    for (let y = 4; y < 25; y++) {
      const half = Math.round((y - 4) * 0.85) + 1;
      p.hline(20 - half, 19 + half, y, "#");
      if (y > 4) {
        p.hline(21 - half, 18 + half, y, (y + 20) % 4 < 2 ? "K" : "N");
        const inner = Math.round((y - 4) * 0.42);
        p.hline(20 - inner, 19 + inner, y, "z");
        if (y > 12) {
          const door = Math.round((y - 12) * 0.32);
          p.hline(20 - door, 19 + door, y, "n");
        }
      }
    }
    p.hline(1, 38, 25, "#");
    p.vline(20, 0, 4, "#").vline(19, 0, 4, "#");
    p.stamp(["##", "#zz#", "##"], 21, 0);
    p.px(1, 26, "#").px(38, 26, "#");
    return p.rows();
  })(),
  // 그네
  "deco.swing": (() => {
    const p = new Pix(36, 32);
    p.shadow(18, 30, 17, 1.5);
    const leg = (x0: number, dir: number) => {
      for (let y = 4; y < 30; y++) {
        const x = x0 + dir * Math.round((y - 4) * 0.2);
        p.px(x - 1, y, "#").px(x, y, "B").px(x + 1, y, "b").px(x + 2, y, "#");
      }
    };
    leg(5, -1);
    leg(10, 1);
    leg(24, -1);
    leg(29, 1);
    p.box(2, 1, 32, 4, "B");
    p.hline(3, 32, 3, "b");
    p.vline(13, 5, 21, "#").vline(22, 5, 21, "#");
    p.box(11, 21, 14, 3, "N");
    return p.rows();
  })(),
  // 곰 동상: 받침대 위에 하트를 안은 곰
  "deco.statue": (() => {
    const p = new Pix(28, 40);
    p.shadow(14, 38, 13, 1.5);
    p.box(4, 27, 20, 10, "y");
    p.box(3, 25, 22, 3, "Y");
    p.box(10, 30, 8, 4, "z");
    p.hline(11, 16, 31, "Z");
    // 곰
    p.oval(8, 4, 3, 3, "x").oval(20, 4, 3, 3, "x");
    p.oval(14, 19, 8, 7, "x");
    p.oval(14, 10, 7, 6, "y");
    p.ellipse(12, 8, 3, 2, "Y");
    p.px(11, 9, "#").px(16, 9, "#");
    p.ellipse(14, 12.5, 2.5, 1.5, "Y");
    p.px(14, 12, "#").px(13, 12, "#");
    p.oval(7, 19, 2.5, 3.5, "y").oval(21, 19, 2.5, 3.5, "y");
    p.stamp([".##.##.", "#NK#KN#", "#NKKKN#", ".#NNN#.", "..#N#..", "...#..."], 11, 17);
    return p.rows();
  })(),
  // 풍차
  "deco.windmill": (() => {
    const p = new Pix(40, 52);
    p.shadow(20, 50, 13, 1.5);
    // 몸통 (아래가 넓은 탑)
    for (let y = 17; y < 50; y++) {
      const half = 5 + Math.round((y - 17) * 0.16);
      p.hline(20 - half, 19 + half, y, "#");
      p.hline(21 - half, 18 + half, y, (y - 17) % 8 === 7 ? "d" : "c");
      p.px(18 + half, y, "d");
    }
    p.hline(13, 26, 49, "#");
    p.stamp([".##.", "#Ii#", "#iv#", ".##."], 18, 26);
    p.stamp([".####.", "#BbbB#", "#Bbbb#", "#Bbzb#", "#Bbbb#", "#Bbbb#"], 17, 43);
    // 지붕
    for (let r = 0; r < 7; r++) {
      p.hline(17 - r, 22 + r, 11 + r, "#");
      if (r > 0) p.hline(18 - r, 21 + r, 11 + r, r % 2 ? "N" : "K");
    }
    // 날개 네 장 (X자)
    const blade = (sx: number, sy: number) => {
      for (let k = 2; k < 15; k++) {
        const x = 20 + sx * k;
        const y = 16 + sy * k;
        p.px(x, y, "n");
        if (k > 4) {
          p.px(x + sx, y, "#").px(x, y + sy, "w").px(x + sx, y + sy, "w").px(x + sx * 2, y + sy, "#").px(x, y + sy * 2, "#");
        }
      }
    };
    blade(-1, -1);
    blade(1, -1);
    blade(-1, 1);
    blade(1, 1);
    p.oval(20, 16, 2, 2, "b");
    return p.rows();
  })(),
};

const FALLBACK: Sprite = (() => {
  const p = new Pix(24, 24);
  p.shadow(12, 22, 10, 1.5);
  p.box(5, 8, 14, 13, "c");
  return p.rows();
})();

export function hasDecoArt(assetKey: string) {
  return assetKey in DECO;
}

/** 광장에 놓을 때의 크기 (px) = 도트 칸 × PIXEL */
export function decoSize(assetKey: string): { width: number; height: number } {
  const { w, h } = spriteSize(DECO[assetKey] ?? FALLBACK);
  return { width: w * PIXEL, height: h * PIXEL };
}

/**
 * 장식 SVG. size가 없으면 광장 크기(PIXEL배), 있으면 미리보기용 정사각형(한 변 size px).
 * 미리보기는 도트가 고르게 나오도록 정수 배율로 그리고 남는 칸은 투명하게 둔다
 */
export function decoSvg(assetKey: string, size?: number): string {
  const rows = DECO[assetKey] ?? FALLBACK;
  if (!size) return spriteSvg(rows, { scale: PIXEL });
  const { w, h } = spriteSize(rows);
  const side = Math.max(w, h);
  const svg = spriteSvg(rows, { scale: 1, pad: { x: (side - w) / 2, y: (side - h) / 2 } });
  return svg.replace(/width="[\d.]+" height="[\d.]+"/, `width="${size}" height="${size}"`);
}

export function decoDataUri(assetKey: string, size?: number): string {
  return svgDataUri(decoSvg(assetKey, size));
}

/** 광장이 미리 불러 둘 장식 그림 (꾸미기 모드에서 바로 놓을 수 있게 전부) */
export const DECO_ASSETS = Object.keys(DECO);
