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

/** 화분 (4·5·6): 가운데 cx, 위 top, 반폭 half, 몸통 h줄. 위 테두리 3줄 + 아래로 좁아지는 몸통 */
function pot(p: Pix, cx: number, top: number, half: number, h: number) {
  p.rect(cx - half, top, half * 2, 3, "4").hline(cx - half, cx + half - 1, top + 2, "5");
  for (let i = 0; i < h; i++) {
    const y = top + 3 + i;
    const inset = 1 + Math.floor(i / 3);
    p.hline(cx - half + inset, cx + half - 1 - inset, y, "5");
    p.px(cx - half + inset, y, "4").px(cx + half - 1 - inset, y, "6").px(cx + half - 2 - inset, y, "6");
  }
}

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
  // ===== 가구 더하기 (사용자 요청 2026-10-11 "돈 사용할 사용처 많아지게") =====
  // 나무 스툴: 동그란 앉는 판과 다리 세 개
  "furniture.stool": {
    rows: (() => {
      const p = new Pix(32, 32);
      p.rect(9, 18, 2, 11, "b").vline(9, 18, 28, "B");
      p.rect(21, 18, 2, 11, "b").vline(22, 18, 28, "n");
      p.rect(15, 19, 2, 9, "n");
      p.hline(10, 21, 24, "n");
      p.ellipse(16, 17, 9, 2.5, "b");
      p.ellipse(16, 16, 9, 2.5, "B");
      p.ellipse(13, 15.5, 4, 1, "Z");
      return finish(p, 10);
    })(),
  },
  // 선인장 화분: 팔 두 개, 꼭대기에 분홍 꽃 (토분은 4·5·6)
  "furniture.cactus": {
    colors: tint("#d9825b"),
    rows: (() => {
      const p = new Pix(32, 32);
      // 몸통과 팔
      p.rect(13, 7, 6, 13, "l").ellipse(16, 7, 3, 2.5, "l");
      p.vline(14, 6, 19, "L").vline(18, 6, 19, "m");
      p.rect(8, 9, 3, 6, "l").ellipse(9.5, 9, 1.5, 1.5, "l").rect(8, 14, 6, 3, "l").vline(8, 9, 15, "L").hline(9, 12, 16, "m");
      p.rect(21, 7, 3, 7, "l").ellipse(22.5, 7, 1.5, 1.5, "l").rect(18, 12, 6, 3, "l").vline(23, 7, 13, "m").hline(19, 22, 14, "m");
      // 가시
      for (const [x, y] of [[15, 9], [17, 12], [15, 15], [9, 11], [22, 9], [16, 18]]) p.px(x, y, "w");
      // 꽃
      p.px(16, 3, "V").px(15, 4, "V").px(17, 4, "V").px(16, 4, "R").px(16, 5, "V");
      pot(p, 16, 20, 7, 7);
      return finish(p, 9);
    })(),
  },
  // 과일 상자: 나무 상자에 사과·귤이 수북
  "furniture.crate": {
    rows: (() => {
      const p = new Pix(32, 32);
      // 과일 (상자 위로 볼록)
      const fruit = (x: number, y: number, a: string, b: string, c: string) => p.ellipse(x, y, 2.5, 2.5, b).px(Math.floor(x) - 1, Math.floor(y) - 1, a).px(Math.floor(x) + 1, Math.floor(y) + 1, c);
      fruit(9, 16, "K", "N", "Q");
      fruit(14, 15, "Z", "z", "u");
      fruit(19, 16, "K", "N", "Q");
      fruit(24, 16, "Z", "z", "u");
      fruit(11.5, 13, "Z", "z", "u");
      fruit(17, 12.5, "K", "N", "Q");
      fruit(22, 13, "Z", "z", "u");
      p.px(17, 9, "n").px(18, 9, "l").px(11, 10, "n").px(22, 10, "l");
      // 상자: 판자 세 줄
      p.rect(5, 17, 22, 12, "B");
      for (const y of [17, 21, 25]) p.hline(5, 26, y, "Z").hline(5, 26, y + 3, "b");
      p.vline(5, 17, 28, "n").vline(26, 17, 28, "n").vline(6, 17, 28, "b").vline(25, 17, 28, "b");
      p.rect(13, 22, 6, 2, "n");
      return finish(p, 13);
    })(),
  },
  // 털실 바구니: 엮은 바구니에 털실 뭉치 셋과 뜨개바늘
  "furniture.yarn": {
    rows: (() => {
      const p = new Pix(32, 32);
      // 뜨개바늘
      for (let i = 0; i < 9; i++) p.px(19 + i, 14 - i, "x").px(9 + i, 6 + i, "x");
      p.px(27, 5, "z").px(9, 5, "z");
      // 털실
      p.ellipse(11, 17, 4.5, 4, "V").ellipse(10, 16, 2, 1.5, "w");
      p.ellipse(21, 17, 4.5, 4, "U").ellipse(20, 16, 2, 1.5, "w");
      p.ellipse(16, 15, 4, 3.5, "i").ellipse(15, 14, 1.5, 1, "w");
      for (const [x, y] of [[12, 18], [13, 16], [22, 18], [23, 16], [17, 16]]) p.px(x, y, "R");
      p.px(17, 16, "v").px(18, 15, "v");
      // 바구니 (엮은 무늬)
      for (let y = 19; y < 30; y++) {
        const inset = y > 26 ? y - 26 : 0;
        p.hline(5 + inset, 26 - inset, y, (y % 2 === 0) ? "B" : "b");
      }
      p.map((c, x, y) => (y >= 20 && y < 30 && (c === "B" || c === "b") && (x + Math.floor(y / 2)) % 3 === 0 ? "n" : c));
      p.hline(4, 27, 19, "Z").hline(4, 27, 20, "B");
      return finish(p, 12);
    })(),
  },
  // 튤립 화분: 빨강·분홍·노랑 튤립 셋 (화분은 4·5·6)
  "furniture.tulip": {
    colors: tint("#8ec5ff"),
    rows: (() => {
      const p = new Pix(32, 32);
      const tulip = (x: number, top: number, a: string, b: string, c: string) => {
        p.vline(x, top + 4, 21, "m").vline(x + 1, top + 4, 21, "l");
        p.rect(x - 1, top, 4, 4, b).px(x - 1, top - 1, b).px(x + 2, top - 1, b).px(x, top - 1, a).px(x - 1, top, a).px(x + 2, top + 3, c).px(x + 1, top + 3, c);
      };
      tulip(10, 7, "K", "N", "Q");
      tulip(15, 4, "V", "R", "Q");
      tulip(20, 8, "Z", "z", "u");
      p.ellipse(9, 17, 3, 1.5, "l").ellipse(22, 16, 3, 1.5, "l").ellipse(14, 15, 1.5, 3, "m").px(8, 16, "L").px(23, 15, "L");
      pot(p, 16, 20, 8, 7);
      return finish(p, 10);
    })(),
  },
  // 빈백 소파: 푹 꺼지는 커다란 콩주머니 (천은 4·5·6)
  "furniture.beanbag": {
    colors: tint("#ffad66"),
    rows: (() => {
      const p = new Pix(32, 32);
      p.ellipse(16, 22, 13, 8, "5");
      p.ellipse(16, 27, 13, 3, "6");
      p.ellipse(16, 22, 13, 4, "5");
      p.ellipse(11, 17, 6, 3, "4").ellipse(9, 16, 2, 1, "w");
      // 앉아서 움푹 들어간 자리
      p.ellipse(18, 21, 6, 2.5, "6").ellipse(18, 20.5, 5, 1.5, "5");
      p.px(5, 24, "6").px(27, 24, "6").hline(9, 23, 29, "6");
      return finish(p, 14);
    })(),
  },
  // 라디오: 작은 받침 위의 옛날 나무 라디오
  "furniture.radio": {
    rows: (() => {
      const p = new Pix(32, 32);
      // 안테나
      for (let i = 0; i < 6; i++) p.px(21 + i, 9 - i, "x");
      p.px(27, 3, "N");
      // 몸통 (둥근 위)
      p.rect(6, 11, 20, 11, "b").ellipse(16, 11, 10, 3, "b").hline(7, 24, 9, "B").hline(6, 25, 10, "B");
      p.vline(6, 10, 21, "B").vline(25, 10, 21, "n");
      // 스피커 그물과 다이얼
      p.rect(8, 13, 9, 7, "c");
      for (let y = 14; y < 20; y += 2) p.hline(9, 15, y, "d");
      p.oval(21, 15, 2.5, 2.5, "z").px(21, 14, "#");
      p.rect(19, 19, 5, 1, "Y").px(20, 19, "N");
      // 받침
      p.rect(5, 22, 22, 2, "n").hline(5, 26, 22, "b");
      p.rect(7, 24, 2, 5, "n").rect(23, 24, 2, 5, "n").hline(9, 22, 26, "b");
      return finish(p, 11);
    })(),
  },
  // 곰 인형: 앉아 있는 갈색 곰, 빨간 리본
  "furniture.bear": {
    colors: { 7: "#e8b57f", 8: "#c98a52", 9: "#9a6236", k: "#f6dcb4" },
    rows: (() => {
      const p = new Pix(32, 32);
      // 몸과 다리
      p.ellipse(16, 23, 8, 6.5, "8").ellipse(15, 22, 4, 4, "k");
      p.ellipse(9, 27, 3.5, 2.5, "8").ellipse(23, 27, 3.5, 2.5, "8").ellipse(9, 27.5, 1.5, 1.2, "k").ellipse(23, 27.5, 1.5, 1.2, "k");
      p.ellipse(8, 20, 2.5, 3.5, "8").ellipse(24, 20, 2.5, 3.5, "9");
      // 머리와 귀
      p.ellipse(10, 6, 2.5, 2.5, "8").ellipse(22, 6, 2.5, 2.5, "8").px(10, 6, "k").px(22, 6, "k");
      p.ellipse(16, 11, 7.5, 6, "8").ellipse(13, 8, 3, 2, "7");
      p.ellipse(16, 13.5, 3, 2, "k").px(16, 13, "#").px(15, 15, "#").px(17, 15, "#").px(16, 15, "#");
      p.px(13, 11, "#").px(19, 11, "#").px(12, 13, "p").px(20, 13, "p");
      // 리본
      p.rect(12, 17, 3, 2, "N").rect(17, 17, 3, 2, "N").rect(15, 17, 2, 2, "Q").px(12, 17, "K").px(17, 17, "K");
      return finish(p, 12);
    })(),
  },
  // 나무 책상: 서랍, 공책·연필·머그잔
  "furniture.desk": {
    rows: (() => {
      const p = new Pix(32, 32);
      // 위에 놓인 것
      p.rect(4, 11, 9, 2, "w").hline(4, 12, 12, "Y").vline(8, 11, 12, "i");
      for (let i = 0; i < 6; i++) p.px(13 + i, 12 - Math.floor(i / 2), i === 5 ? "z" : "N");
      p.rect(22, 8, 5, 5, "i").vline(22, 8, 12, "I").vline(26, 8, 12, "v").px(27, 9, "v").px(28, 10, "v").px(27, 11, "v");
      // 상판
      p.rect(1, 13, 30, 3, "B").hline(1, 30, 13, "Z").hline(1, 30, 15, "b");
      // 서랍장 (오른쪽)과 다리 (왼쪽)
      p.rect(18, 16, 11, 13, "b").vline(18, 16, 28, "B");
      p.hline(19, 28, 22, "n").rect(22, 18, 3, 1, "z").rect(22, 25, 3, 1, "z");
      p.rect(3, 16, 3, 13, "b").vline(3, 16, 28, "B");
      p.hline(6, 17, 17, "n");
      return finish(p, 15);
    })(),
  },
  // 지구본: 나무 받침에 걸린 파란 지구
  "furniture.globe": {
    rows: (() => {
      const p = new Pix(32, 32);
      p.ellipse(16, 13, 8, 8, "v");
      // 땅
      p.ellipse(13, 9, 3.5, 2.5, "l").ellipse(12, 12, 2, 2.5, "l").ellipse(19, 14, 3, 3, "l").ellipse(20, 17.5, 1.5, 1.5, "l").ellipse(15, 18, 2, 1, "l");
      p.px(12, 8, "L").px(18, 13, "L");
      p.ellipse(13, 9, 2, 1.5, "i").map((c, x, y) => (c === "i" && (x + y) % 2 ? "v" : c));
      p.ellipse(12, 9, 1.5, 1, "I");
      // 금속 고리와 받침
      for (let a = 0; a < 40; a++) {
        const t = (Math.PI * a) / 40 + Math.PI / 2;
        p.px(Math.round(16 - Math.cos(t) * 10), Math.round(13 - Math.sin(t) * 10), "u");
      }
      p.px(16, 3, "z").px(16, 23, "u");
      p.rect(15, 23, 2, 4, "n");
      p.ellipse(16, 28, 6, 1.5, "b").hline(11, 20, 27, "B");
      return finish(p, 8);
    })(),
  },
  // 서랍장: 세 칸 서랍 위에 동그란 거울
  "furniture.dresser": {
    rows: (() => {
      const p = new Pix(32, 32);
      // 거울
      p.oval(16, 7, 6, 6, "i").ellipse(14, 5, 2, 2.5, "I").px(18, 9, "I");
      p.rect(15, 13, 2, 2, "b");
      // 꽃병과 향수
      p.rect(6, 10, 3, 4, "U").px(7, 9, "U").px(6, 8, "V").px(8, 7, "V").px(7, 7, "l");
      p.rect(23, 11, 3, 3, "V").px(24, 10, "w");
      // 몸통
      p.rect(4, 14, 24, 2, "B").hline(4, 27, 14, "Z");
      p.rect(5, 16, 22, 13, "b");
      for (const y of [16, 20, 24]) {
        p.rect(6, y + 1, 20, 3, "B").hline(6, 25, y + 1, "Z");
        p.rect(15, y + 2, 2, 1, "z");
      }
      p.rect(5, 29, 2, 1, "n").rect(25, 29, 2, 1, "n");
      return finish(p, 13);
    })(),
  },
  // 안락의자: 날개 달린 등받이, 둥근 팔걸이 (천은 4·5·6)
  "furniture.armchair": {
    colors: tint("#c97b9a"),
    rows: (() => {
      const p = new Pix(32, 32);
      // 등받이 (위가 둥글게)
      p.ellipse(16, 8, 9, 4, "5").rect(7, 8, 18, 12, "5");
      p.ellipse(15, 7, 6, 2, "4");
      for (const [x, y] of [[12, 11], [16, 11], [20, 11], [14, 14], [18, 14]]) p.px(x, y, "6");
      // 방석
      p.rect(8, 19, 16, 4, "4").hline(8, 23, 22, "5");
      // 팔걸이
      for (const x of [3, 23]) {
        p.rect(x, 14, 6, 12, "5").ellipse(x + 3, 14, 3, 2, "4");
        p.vline(x + 5, 15, 25, "6");
      }
      p.rect(4, 25, 24, 2, "6");
      p.rect(5, 27, 2, 2, "n").rect(25, 27, 2, 2, "n");
      return finish(p, 13);
    })(),
  },
  // 옷장: 두 짝 문, 둥근 장식 머리
  "furniture.wardrobe": {
    rows: (() => {
      const p = new Pix(32, 32);
      p.rect(5, 3, 22, 26, "b");
      p.rect(4, 2, 24, 2, "B").ellipse(16, 2, 5, 2, "B").hline(4, 27, 2, "Z").px(16, 0, "z");
      // 문 두 짝 (판자 테두리)
      for (const x of [6, 16]) {
        p.rect(x, 5, 10, 21, "B").rect(x + 2, 7, 6, 8, "b").rect(x + 2, 17, 6, 7, "b");
        p.hline(x + 2, x + 7, 7, "n").hline(x + 2, x + 7, 17, "n");
      }
      p.vline(16, 5, 25, "n");
      p.rect(14, 14, 1, 3, "z").rect(17, 14, 1, 3, "z");
      p.rect(5, 26, 22, 2, "n");
      p.rect(6, 28, 2, 2, "n").rect(24, 28, 2, 2, "n");
      return finish(p, 13);
    })(),
  },
  // 그릇 찬장: 위 칸에 접시 셋, 아래는 문
  "furniture.cupboard": {
    rows: (() => {
      const p = new Pix(32, 32);
      p.rect(5, 2, 22, 27, "b").rect(4, 1, 24, 2, "B").hline(4, 27, 1, "Z");
      // 위 칸 (유리 뒤 접시)
      p.rect(7, 4, 18, 11, "c");
      p.hline(7, 24, 14, "B");
      for (const [x, c, d] of [[10, "i", "v"], [16, "V", "R"], [22, "z", "u"]] as const) {
        p.oval(x, 9, 3, 3.5, "w").px(x, 9, c).px(x - 1, 9, c).px(x + 1, 9, c).px(x, 8, c).px(x, 10, d);
      }
      p.vline(13, 4, 13, "I").vline(19, 4, 13, "I");
      // 가운데 선반과 찻잔
      p.rect(5, 15, 22, 2, "B").hline(5, 26, 15, "Z");
      // 아래 문
      p.rect(7, 18, 8, 10, "B").rect(17, 18, 8, 10, "B");
      p.rect(9, 20, 4, 6, "b").rect(19, 20, 4, 6, "b");
      p.px(14, 23, "z").px(17, 23, "z");
      return finish(p, 13);
    })(),
  },
  // 냉장고: 민트색 옛날 냉장고 (몸통은 4·5·6)
  "furniture.fridge": {
    colors: tint("#8fd8c4"),
    rows: (() => {
      const p = new Pix(32, 32);
      p.rect(7, 3, 18, 26, "5").ellipse(16, 4, 9, 2, "5");
      p.vline(7, 3, 28, "4").vline(8, 3, 28, "4").vline(24, 3, 28, "6").hline(9, 23, 2, "4");
      // 문 사이 틈과 손잡이
      p.hline(7, 24, 11, "6");
      p.rect(21, 6, 2, 4, "Y").vline(22, 6, 9, "x").rect(21, 14, 2, 6, "Y").vline(22, 14, 19, "x");
      // 자석과 메모
      p.rect(11, 14, 5, 5, "w").hline(12, 14, 16, "x").hline(12, 15, 17, "x").px(13, 14, "N");
      p.oval(12, 6.5, 1.5, 1.5, "V").px(16, 7, "z").px(17, 7, "z");
      // 발
      p.rect(8, 29, 3, 1, "x").rect(21, 29, 3, 1, "x");
      return finish(p, 11);
    })(),
  },
  // 주방 화덕: 하얀 화덕, 오븐 창에 빵, 냄비에서 김
  "furniture.stove": {
    rows: (() => {
      const p = new Pix(32, 32);
      // 냄비
      p.rect(8, 6, 9, 5, "N").hline(8, 16, 6, "K").hline(7, 17, 6, "Q").rect(6, 7, 1, 2, "Q").rect(18, 7, 1, 2, "Q").hline(8, 16, 10, "Q");
      // 몸통
      p.rect(4, 11, 24, 18, "Y").hline(4, 27, 11, "w").vline(27, 11, 28, "y");
      p.rect(4, 11, 24, 2, "X").hline(5, 26, 11, "x");
      p.rect(21, 9, 4, 2, "X");
      // 조절 손잡이
      for (const x of [7, 11, 15, 19, 23]) p.px(x, 14, "#").px(x + 1, 14, "x");
      // 오븐 창
      p.box(6, 16, 20, 11, "v");
      p.rect(7, 17, 18, 9, "u").rect(7, 17, 18, 2, "z");
      p.ellipse(16, 23, 5, 2, "B").hline(13, 18, 22, "Z").px(14, 23, "b").px(17, 23, "b");
      p.hline(9, 22, 15, "x");
      p.rect(5, 29, 2, 1, "X").rect(25, 29, 2, 1, "X");
      p.outline();
      for (const [x, y] of [[10, 4], [11, 3], [11, 2], [14, 4], [13, 3], [13, 2]]) p.px(x, y, "y");
      return p.shadow(16, 30.5, 13, 1.5).rows();
    })(),
  },
  // 몬스테라: 구멍 난 큰 잎, 하얀 화분
  "furniture.monstera": {
    colors: { 4: "#ffffff", 5: "#ece6dc", 6: "#c9bfb0" },
    rows: (() => {
      const p = new Pix(32, 32);
      const leaf = (cx: number, cy: number, rx: number, ry: number) => {
        p.ellipse(cx, cy, rx, ry, "m").ellipse(cx - 1, cy - 1, rx - 1.5, ry - 1.5, "l");
        p.vline(Math.round(cx), Math.round(cy - ry + 1), Math.round(cy + ry - 1), "M");
        // 갈라진 틈
        p.px(Math.round(cx - rx + 1), Math.round(cy), ".").px(Math.round(cx + rx - 1), Math.round(cy - 1), ".").px(Math.round(cx - rx + 2), Math.round(cy + 1), ".");
      };
      p.vline(12, 12, 20, "M").vline(20, 10, 20, "M").vline(16, 8, 20, "M");
      leaf(9, 11, 6, 5);
      leaf(23, 9, 6, 5);
      leaf(16, 6, 5, 5);
      leaf(15, 15, 5, 3.5);
      p.px(7, 9, "L").px(21, 7, "L").px(14, 4, "L");
      pot(p, 16, 20, 7, 7);
      return finish(p, 9);
    })(),
  },
  // 이젤: 나무 이젤에 해와 언덕 그림
  "furniture.easel": {
    rows: (() => {
      const p = new Pix(32, 32);
      // 다리
      for (let y = 2; y < 30; y++) {
        const dx = Math.floor((y - 2) / 4);
        p.px(14 - dx, y, "b").px(17 + dx, y, "b");
      }
      p.vline(16, 4, 29, "n");
      // 그림판
      p.box(6, 5, 20, 15, "I");
      p.rect(7, 6, 18, 8, "i");
      p.ellipse(20, 9, 2.5, 2.5, "z");
      p.ellipse(11, 16, 7, 4, "l").ellipse(21, 16, 6, 3, "L").rect(7, 15, 18, 4, "l");
      p.px(10, 13, "m").px(12, 14, "V");
      p.hline(5, 26, 20, "B").hline(5, 26, 21, "b");
      // 물감 통
      p.rect(22, 25, 4, 4, "w").hline(22, 25, 25, "N").px(23, 24, "u");
      return finish(p, 10);
    })(),
  },
  // 버섯 조명: 빨간 갓에 하얀 점, 은은한 빛
  "furniture.mushroom": {
    rows: (() => {
      const p = new Pix(32, 32);
      // 기둥
      p.rect(13, 14, 6, 15, "c").vline(13, 14, 28, "w").vline(18, 14, 28, "d");
      p.rect(14, 22, 4, 3, "z").hline(14, 17, 22, "Z");
      // 갓
      p.ellipse(16, 12, 12, 8, "N").rect(4, 12, 24, 3, ".");
      p.ellipse(16, 12, 12, 2.5, "Q").ellipse(16, 11, 12, 2, "N");
      p.ellipse(13, 7, 5, 2.5, "K");
      for (const [x, y, r] of [[10, 9, 1.5], [16, 6, 2], [22, 9, 1.5], [19, 11, 1]] as const) p.ellipse(x, y, r, r, "w");
      p.ellipse(16, 29, 6, 1, "b").hline(11, 20, 28, "B");
      p.outline();
      for (const [x, y] of [[3, 16], [28, 16], [5, 18], [26, 18]]) p.px(x, y, "Z");
      return p.shadow(16, 30.5, 8, 1.5).rows();
    })(),
  },
  // 브라운관 TV: 다리 달린 나무 TV, 파란 화면에 무지개 띠
  "furniture.tv": {
    rows: (() => {
      const p = new Pix(32, 32);
      // 안테나
      for (let i = 0; i < 5; i++) p.px(14 - i, 6 - i, "x").px(18 + i, 6 - i, "x");
      p.px(9, 1, "N").px(23, 1, "N");
      p.ellipse(16, 7, 2.5, 1.5, "X");
      // 몸통
      p.rect(3, 8, 26, 16, "b").hline(3, 28, 8, "B").vline(3, 8, 23, "B").vline(28, 8, 23, "n");
      // 화면 (둥근 모서리)
      p.rect(5, 10, 17, 12, "#").rect(6, 11, 15, 10, "v");
      p.rect(6, 11, 15, 2, "i").px(7, 12, "I").px(8, 12, "I");
      for (const [y, c] of [[15, "K"], [16, "z"], [17, "l"], [18, "U"]] as const) p.hline(9, 18, y, c);
      // 다이얼
      p.oval(25, 13, 2, 2, "Y").px(25, 12, "#");
      p.oval(25, 18.5, 2, 2, "Y").px(26, 18, "#");
      // 다리
      p.rect(5, 24, 2, 5, "n").rect(25, 24, 2, 5, "n");
      return finish(p, 13);
    })(),
  },
  // 괘종시계: 키 큰 나무 시계, 금빛 추
  "furniture.clock": {
    rows: (() => {
      const p = new Pix(32, 32);
      // 머리 (둥근 지붕)
      p.ellipse(16, 4, 7, 3, "b").rect(9, 4, 14, 9, "b").hline(9, 22, 1, "B").px(16, 0, "z");
      p.oval(16, 8, 4.5, 4.5, "w");
      p.px(16, 6, "#").px(16, 7, "#").px(17, 8, "#").px(18, 8, "#").px(16, 8, "N");
      p.px(16, 4, "x").px(12, 8, "x").px(20, 8, "x").px(16, 12, "x");
      // 몸통과 유리창
      p.rect(11, 13, 10, 13, "b").vline(11, 13, 25, "B").vline(20, 13, 25, "n");
      p.rect(13, 15, 6, 9, "n").vline(15, 15, 21, "u").vline(16, 15, 21, "u");
      p.oval(15.5, 21.5, 2, 2, "z");
      // 받침
      p.rect(8, 26, 16, 3, "b").hline(8, 23, 26, "B").hline(8, 23, 28, "n");
      return finish(p, 9);
    })(),
  },
  // 어항: 받침 위 유리 어항, 물고기·수초·물방울
  "furniture.aquarium": {
    rows: (() => {
      const p = new Pix(32, 32);
      // 물과 유리
      p.rect(3, 6, 26, 15, "i").rect(3, 6, 26, 2, "I");
      p.rect(3, 18, 26, 3, "z").hline(3, 28, 18, "Z").px(8, 19, "u").px(20, 20, "u");
      // 수초
      for (const [x, h] of [[6, 8], [8, 5], [24, 9], [26, 6]] as const) for (let y = 18 - h; y < 18; y++) p.px(x + ((y % 3) === 0 ? 1 : 0), y, y % 2 ? "l" : "m");
      // 물고기
      p.ellipse(14, 11, 2.5, 1.5, "K").px(11, 10, "N").px(11, 12, "N").px(11, 11, "N").px(15, 10, "#");
      p.ellipse(20, 15, 2, 1.2, "z").px(22, 14, "u").px(22, 16, "u").px(22, 15, "u").px(19, 15, "#");
      p.px(16, 8, "w").px(17, 7, "w").px(15, 6, "w");
      p.vline(4, 8, 16, "I");
      // 테두리와 받침
      p.hline(2, 29, 5, "x").hline(2, 29, 21, "x").vline(2, 5, 21, "x").vline(29, 5, 21, "x");
      p.rect(3, 22, 26, 3, "b").hline(3, 28, 22, "B");
      p.rect(4, 25, 3, 4, "n").rect(25, 25, 3, 4, "n").hline(7, 24, 26, "b");
      return finish(p, 14);
    })(),
  },
  // 분재: 낮은 화분 위 구불구불한 소나무
  "furniture.bonsai": {
    rows: (() => {
      const p = new Pix(32, 32);
      // 줄기
      for (const [x, y] of [[16, 23], [16, 22], [15, 21], [14, 20], [14, 19], [15, 18], [16, 17], [17, 16], [18, 15], [18, 14], [17, 13], [16, 12], [15, 11]]) p.rect(x, y, 2, 1, "n").px(x, y, "b");
      p.hline(18, 22, 15, "n").hline(10, 14, 17, "n");
      // 잎 구름
      p.ellipse(9, 15, 5, 2.5, "m").ellipse(8, 14, 3, 1.5, "l");
      p.ellipse(23, 13, 6, 2.5, "m").ellipse(22, 12, 4, 1.5, "l");
      p.ellipse(15, 8, 7, 3.5, "m").ellipse(14, 7, 5, 2, "l").ellipse(12, 6, 2, 1, "L");
      p.px(25, 12, "L").px(7, 14, "L");
      // 이끼와 낮은 화분
      p.ellipse(16, 24, 9, 1.5, "l");
      p.rect(5, 24, 22, 4, "t").hline(5, 26, 24, "T").hline(5, 26, 27, "q");
      p.rect(7, 28, 3, 1, "q").rect(22, 28, 3, 1, "q");
      return finish(p, 12);
    })(),
  },
  // 축음기: 나무 상자 위 금빛 나팔
  "furniture.gramophone": {
    rows: (() => {
      const p = new Pix(32, 32);
      // 나팔 (오른쪽 위로 벌어진다)
      for (let i = 0; i < 12; i++) {
        const r = 1 + i * 0.75;
        p.ellipse(13 + i, 15 - i, r * 0.6, r, i > 9 ? "u" : "z");
      }
      p.ellipse(25, 4, 4.5, 6.5, "u").ellipse(26, 4, 3, 5, "n").ellipse(26, 4, 1.5, 3, "#");
      p.ellipse(22, 6, 1, 3, "Z");
      p.rect(11, 15, 2, 4, "u");
      // 판 (레코드)
      p.ellipse(13, 19, 9, 1.8, "#").ellipse(13, 19, 3, 0.8, "N");
      // 상자
      p.rect(4, 20, 20, 8, "b").hline(4, 23, 20, "B").vline(23, 20, 27, "n");
      p.rect(7, 22, 14, 4, "n").rect(8, 23, 12, 2, "u");
      p.px(25, 23, "x").px(26, 22, "x").px(27, 22, "#");
      p.rect(5, 28, 2, 1, "n").rect(21, 28, 2, 1, "n");
      return finish(p, 11);
    })(),
  },
  // 벽난로: 붉은 벽돌, 활활 타는 불, 나무 선반 위 촛불
  "furniture.fireplace": {
    colors: { 7: "#d97b5c", 8: "#b85c45", 9: "#8a3f35" },
    rows: (() => {
      const p = new Pix(32, 32);
      // 촛불
      p.rect(7, 1, 2, 4, "w").px(7, 0, "z").rect(23, 2, 2, 3, "w").px(23, 1, "z");
      // 선반
      p.rect(1, 5, 30, 3, "B").hline(1, 30, 5, "Z").hline(1, 30, 7, "b");
      // 벽돌 몸통
      p.rect(3, 8, 26, 21, "8");
      p.map((c, x, y) => {
        if (c !== "8" || y < 8) return c;
        const row = Math.floor((y - 8) / 3);
        if ((y - 8) % 3 === 2) return "9";
        return (x + (row % 2) * 3) % 6 === 0 ? "9" : (x + y) % 7 === 0 ? "7" : c;
      });
      // 불 구멍 (아치)
      p.ellipse(16, 15, 8, 5, "#").rect(8, 15, 16, 12, "#");
      p.ellipse(16, 15.5, 7, 4.5, "n").rect(9, 15, 14, 12, "n");
      // 장작과 불
      p.rect(10, 25, 12, 2, "b").hline(10, 21, 25, "B");
      p.ellipse(16, 21, 5, 5, "N").ellipse(16, 22, 3.5, 3.5, "K").ellipse(16, 23, 2, 2.5, "z").px(16, 23, "Z");
      p.px(12, 18, "K").px(20, 17, "N").px(16, 14, "N").px(15, 15, "K");
      // 바닥 돌
      p.rect(2, 27, 28, 2, "x").hline(2, 29, 27, "y");
      return finish(p, 15);
    })(),
  },
  // 크리스마스 트리: 별, 장식 공, 선물 상자
  "furniture.xmastree": {
    rows: (() => {
      const p = new Pix(32, 32);
      // 나무 세 층
      for (const [top, half, h] of [[3, 5, 6], [8, 8, 7], [14, 11, 8]] as const) {
        for (let y = 0; y < h; y++) {
          const w = Math.round(1 + ((half - 1) * (y + 1)) / h);
          p.hline(16 - w, 15 + w, top + y, "m");
          p.hline(16 - w, 15 - Math.floor(w / 2), top + y, "l");
        }
      }
      p.rect(14, 22, 4, 3, "n");
      // 별과 장식
      p.px(15, 0, "z").px(16, 0, "z").rect(14, 1, 4, 2, "z").px(13, 2, "Z").px(18, 2, "Z").px(15, 3, "u").px(16, 3, "u");
      for (const [x, y, c] of [[14, 7, "N"], [18, 11, "z"], [12, 13, "U"], [20, 17, "N"], [10, 19, "z"], [16, 16, "i"], [22, 20, "U"], [15, 20, "V"]] as const) p.px(x, y, c).px(x + 1, y, c);
      for (let x = 11; x < 21; x += 2) p.px(x, 10 + (((x - 11) / 2) % 2), "Z");
      // 선물
      p.rect(5, 23, 8, 6, "N").vline(8, 23, 28, "z").hline(5, 12, 25, "z").px(7, 22, "z").px(9, 22, "z");
      p.rect(19, 25, 8, 4, "i").vline(22, 25, 28, "V").hline(19, 26, 26, "V");
      return finish(p, 13);
    })(),
  },
  // 피아노: 까만 업라이트 피아노, 흰 건반, 악보
  "furniture.piano": {
    colors: { 7: "#5a4a5e", 8: "#3a2f40", 9: "#241c29" },
    rows: (() => {
      const p = new Pix(32, 32);
      p.rect(2, 4, 28, 25, "8").hline(2, 29, 4, "7").vline(2, 4, 28, "7");
      p.rect(1, 3, 30, 2, "7");
      // 악보
      p.rect(11, 6, 10, 7, "w").vline(16, 6, 12, "Y");
      for (const y of [8, 10]) p.hline(12, 15, y, "x").hline(17, 20, y, "x");
      p.px(13, 9, "#").px(18, 7, "#");
      // 촛대
      p.rect(4, 1, 2, 3, "w").px(4, 0, "z").rect(26, 1, 2, 3, "w").px(26, 0, "z");
      // 건반
      p.rect(2, 14, 28, 1, "9");
      p.rect(2, 15, 28, 4, "w").hline(2, 29, 18, "Y");
      for (let x = 3; x < 30; x += 3) p.vline(x, 15, 18, "y");
      for (const x of [4, 7, 13, 16, 19, 25, 28]) p.rect(x, 15, 2, 2, "#");
      p.rect(2, 19, 28, 1, "9");
      // 다리와 페달
      p.rect(3, 20, 3, 9, "9").rect(26, 20, 3, 9, "9");
      p.rect(14, 26, 2, 1, "z").rect(17, 26, 2, 1, "z");
      return finish(p, 15);
    })(),
  },
  // 컴퓨터 책상: 블로그 글이 떠 있는 모니터, 키보드, 화분
  "furniture.computer": {
    rows: (() => {
      const p = new Pix(32, 32);
      // 모니터
      p.rect(7, 1, 18, 12, "x").hline(7, 24, 1, "Y").vline(7, 1, 12, "y");
      p.rect(9, 3, 14, 8, "I");
      p.rect(9, 3, 14, 2, "l").px(10, 3, "w").px(11, 3, "w");
      p.hline(10, 18, 6, "x").hline(10, 21, 8, "y").hline(10, 16, 9, "y").rect(19, 6, 3, 2, "V");
      p.rect(14, 13, 4, 2, "X").rect(12, 15, 8, 1, "X");
      // 키보드와 머그
      p.rect(8, 16, 13, 2, "Y").hline(8, 20, 17, "x");
      for (let x = 9; x < 20; x += 2) p.px(x, 16, "y");
      p.rect(24, 13, 3, 4, "N").px(27, 14, "N").px(25, 13, "K");
      p.rect(3, 13, 3, 4, "K").ellipse(4.5, 11, 2.5, 2, "l").px(4, 10, "L");
      // 책상
      p.rect(1, 18, 30, 3, "B").hline(1, 30, 18, "Z").hline(1, 30, 20, "b");
      p.rect(2, 21, 3, 8, "b").rect(27, 21, 3, 8, "b").vline(2, 21, 28, "B");
      p.rect(19, 21, 8, 6, "b").rect(21, 23, 4, 1, "z");
      return finish(p, 15);
    })(),
  },
  // 캐노피 침대: 기둥 넷, 연보라 휘장과 이불 (천은 4·5·6)
  "furniture.canopy": {
    colors: tint("#b49cf0"),
    rows: (() => {
      const p = new Pix(32, 32);
      // 지붕 천 (물결 모양 끝)
      p.rect(1, 1, 30, 4, "5").hline(1, 30, 1, "4");
      for (let x = 1; x < 31; x++) if (x % 4 !== 0) p.px(x, 5, "5");
      for (let x = 2; x < 31; x += 4) p.px(x, 6, "6");
      // 기둥
      p.rect(1, 5, 2, 25, "z").vline(1, 5, 29, "Z").rect(29, 5, 2, 25, "u").vline(29, 5, 29, "z");
      // 안쪽 휘장 (뒤판)
      p.rect(3, 6, 26, 13, "4");
      for (let x = 6; x < 27; x += 4) p.vline(x, 7, 17, "5");
      // 늘어진 휘장
      for (let y = 5; y < 22; y++) {
        const w = Math.max(1, 4 - Math.floor((y - 5) / 5));
        p.hline(3, 2 + w, y, "5").px(2 + w, y, "6").hline(29 - w, 28, y, "6");
      }
      p.hline(3, 5, 13, "z").hline(26, 28, 13, "z");
      // 침대
      p.rect(3, 23, 26, 3, "B").hline(3, 28, 23, "Z").hline(3, 28, 25, "b");
      p.rect(3, 18, 26, 5, "w").hline(3, 28, 22, "Y");
      p.rect(5, 14, 7, 4, "w").hline(6, 10, 14, "I").hline(5, 11, 17, "Y");
      p.rect(13, 15, 16, 8, "5").hline(13, 28, 15, "4").hline(13, 28, 22, "6").rect(13, 15, 2, 7, "4");
      for (const [x, y] of [[18, 18], [23, 19], [26, 17]]) p.px(x, y, "Z");
      p.rect(3, 26, 2, 4, "u").rect(27, 26, 2, 4, "u");
      return finish(p, 15);
    })(),
  },
  // 황금 왕좌: 금빛 틀, 빨간 벨벳, 보석
  "furniture.throne": {
    rows: (() => {
      const p = new Pix(32, 32);
      // 등받이 (뾰족한 세 봉우리)
      p.rect(8, 6, 16, 14, "z");
      for (const [x, top] of [[8, 3], [16, 0], [23, 3]] as const) p.ellipse(x, top + 2, 2, 2, "z").px(x, top, "Z");
      p.ellipse(16, 4, 4, 3, "z");
      p.rect(10, 6, 12, 12, "N").ellipse(16, 6, 6, 2.5, "N").ellipse(14, 9, 3, 2, "K");
      p.oval(16, 4, 1.5, 1.5, "i");
      p.px(8, 3, "V").px(23, 3, "V");
      // 방석과 팔걸이
      p.rect(9, 18, 14, 4, "K").hline(9, 22, 21, "N");
      for (const x of [3, 24]) {
        p.rect(x, 14, 5, 12, "z").hline(x, x + 4, 14, "Z").vline(x + 4, 15, 25, "u");
        p.ellipse(x + 2.5, 14, 2.5, 1.5, "Z");
      }
      p.px(5, 18, "i").px(26, 18, "i");
      // 아래 틀과 다리
      p.rect(3, 22, 26, 4, "z").hline(3, 28, 22, "Z").hline(3, 28, 25, "u");
      p.px(16, 23, "N").px(10, 23, "i").px(22, 23, "i");
      p.rect(4, 26, 3, 3, "u").rect(25, 26, 3, 3, "u");
      return finish(p, 14);
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

/** 우리 집 방(room-furniture.ts)용: 가구 글자 줄과 바꿔 칠할 색 (그림이 없으면 기본 상자) */
export function furnitureArtOf(assetKey: string): { rows: Sprite; colors: Colors } {
  const art = FURNITURE[assetKey] ?? FALLBACK;
  return { rows: art.rows, colors: art.colors ?? {} };
}
