// 동물 농장 동물 그림 (도트, 2026-10-09 "남은 그림도 도트로"). 캐릭터처럼 코드로 그린다.
// 32 × 32 칸 도화지, 발바닥이 y=29. 단계(아기·청소년·어른)마다 새로 그린다 (줄여서 흐려지지 않게). 어른은 목에 리본을 단다.
// 화면에서는 32의 정수배(64·96px)로 보여야 도트가 고르다 (fitSvg).
// 동물마다 크기가 다르다 (사용자 요청 2026-10-11 "작은 동물은 작게 큰 동물은 크게"): 도화지·도트 배율은 모두 같고
// 크기 단위 u(ANIMAL_SIZE의 r × 단계 비율)만 달리 그린다. 그래서 어디서 보든(광장·우리 집·농장) 캐릭터와 견준 크기가 같다.
//
// 자라는 비율 (사용자 요청 2026-10-12 "대가리가 커지는 게 아니라 그 동물에 맞는 비율로 성장"):
// 옆에서 본 모습(오른쪽을 본다)으로 몸·다리·목·머리·꼬리를 따로 잰다. 길이마다 [아기, 어른] 비율을 두고
// 성숙도 t(아기 0 · 청소년 0.5 · 어른 1)로 섞는다. 아기는 머리가 크고 몸이 동글·다리가 짧고, 어른은 머리가 작아지고
// 몸·다리·목·꼬리가 그 동물답게 길어진다 (조랑말 긴 다리·목, 송아지 튼튼한 몸, 양 복슬한 몸에 가는 다리,
// 강아지·고양이 긴 몸·꼬리, 병아리 → 닭 모양, 토끼 긴 귀·몸, 햄스터는 그대로 동글, 돼지 긴 코·몸).
import { type AnimalDisplaySize, type AnimalForm, type AnimalSex, type AnimalStage } from "@/lib/farm";
import { type Colors, fitSvg, flipX, Pix, type Sprite, spriteRects, svgDataUri } from "./pixel";

export type AnimalTier = "small" | "medium" | "large";

/**
 * 동물 크기 표 (한 곳에서 정한다). r = 어른 크기 단위(칸, 32칸 도화지), 캐릭터(24칸 틀, 키 약 22칸)와 견주어 정했다.
 * 작은 5~6, 중간 7~8, 큰 10~11
 */
export const ANIMAL_SIZE: Record<string, { tier: AnimalTier; r: number }> = {
  "animal.chick": { tier: "small", r: 5 },
  "animal.bunny": { tier: "small", r: 6 },
  "animal.piglet": { tier: "medium", r: 8 },
  "animal.calf": { tier: "large", r: 10 },
  // 분양 동물 (코인으로 데려온다)
  "animal.hamster": { tier: "small", r: 5 },
  "animal.kitten": { tier: "small", r: 6 },
  "animal.puppy": { tier: "medium", r: 7 },
  "animal.lamb": { tier: "medium", r: 8 },
  "animal.pony": { tier: "large", r: 11 },
};
const DEFAULT_SIZE = ANIMAL_SIZE["animal.piglet"];
const FEET = 29;
/** 그릴 때는 넓은 도화지(W칸, 가운데 CX)에 그리고, 그린 칸의 가운데를 기준으로 32칸을 잘라 낸다 (코·꼬리가 긴 동물도 가운데에 오게) */
const W = 48;
const CX = W / 2;
/** 다 키운 동물 크기 설정의 배율 (몸 크기 단위에 곱한다, 도화지에 들어가게 MAX_R까지) */
const DISPLAY_FACTOR: Record<AnimalDisplaySize, number> = { tiny: 0.5, small: 0.75, normal: 1, large: 1.25 };
const MIN_R = 3;
const MAX_R = 14;

/** 이 동물·단계의 크기 단위 (칸). 아기 ≤ 청소년 ≤ 어른, 가장 작아도 3칸. size = 주인이 고른 크기 (다 키운 동물).
 *  크게는 32칸 도화지에 들어가는 만큼까지만 (조랑말·송아지처럼 이미 큰 동물은 보통과 같을 수 있다, displaySizeChoices) */
export function animalRadius(assetKey: string, stage: AnimalStage, size: AnimalDisplaySize = "normal"): number {
  const base = (ANIMAL_SIZE[assetKey] ?? DEFAULT_SIZE).r;
  const want = Math.max(MIN_R, Math.round(base * (DISPLAY_FACTOR[size] ?? 1)));
  const adult = want > base ? Math.min(want, maxRadius(assetKey)) : want;
  if (stage === "adult") return adult;
  // 아기는 어른 크기 단위의 0.55배. 고른 크기(아기 모습으로 데리고 다닐 때)는 아기 크기에 바로 곱한다 (도화지 안이라 막을 필요 없다)
  const baby = Math.max(MIN_R, Math.round(base * 0.55 * (DISPLAY_FACTOR[size] ?? 1)));
  return stage === "baby" ? baby : Math.min(adult, Math.max(baby, Math.round(adult * 0.75)));
}

const MATURITY: Record<AnimalStage, number> = { baby: 0, teen: 0.5, adult: 1 };

/** 그리는 기준: u = 크기 단위(칸), t = 성숙도 (0 아기 ~ 1 어른), sex = 암수 (어른 모습에만 드러난다, 없으면 예전 모습) */
type G = { u: number; t: number; sex?: AnimalSex | null };
/** 다 자란 암컷·수컷인지 (아기·청소년은 암수 모습 차이가 없다, 2026-10-12 "암/수 별로 성장했을 때 모습") */
const isFemale = (g: G) => g.t === 1 && g.sex === "female";
const isMale = (g: G) => g.t === 1 && g.sex === "male";
/** 그린 몸의 자리 (무늬·리본·움직임이 쓴다): 몸 가운데 (bx, by)와 반길이·반높이, 머리 가운데와 반지름 */
export type Geo = { bx: number; by: number; bw: number; bh: number; hx: number; hy: number; hr: number };
/** [아기, 어른] 비율 (u에 곱한다) */
type Span = readonly [number, number];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const sz = (s: Span, g: G) => g.u * lerp(s[0], s[1], g.t);

/** 굵은 선 (목·꼬리): 두 점 사이를 반지름 r 원으로 찍는다 */
function thick(p: Pix, x1: number, y1: number, x2: number, y2: number, r: number, c: string) {
  const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 2));
  for (let i = 0; i <= n; i++) p.ellipse(x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n, r, r, c);
}
/** 한 칸 굵기 선 */
function thin(p: Pix, x1: number, y1: number, x2: number, y2: number, c: string) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1))));
  for (let i = 0; i <= n; i++) p.px(Math.floor(x1 + ((x2 - x1) * i) / n), Math.floor(y1 + ((y2 - y1) * i) / n), c);
}

/** 옆모습 눈 (머리가 크면 2칸, 더 크면 2×2에 반짝이) + 볼터치. lash = 다 자란 암컷의 속눈썹 (눈 앞 위로 한 칸) */
function eye(p: Pix, x: number, y: number, hr: number, c: string, cheek = true, lash = false) {
  const ex = Math.round(x);
  const ey = Math.round(y);
  if (hr >= 4.5) p.rect(ex, ey - 1, 2, 2, c).px(ex, ey - 1, c === "w" ? "#" : "w");
  else if (hr >= 2.8) p.rect(ex, ey - 1, 1, 2, c);
  else p.px(ex, ey, c);
  if (cheek && hr >= 2.8) p.px(ex - 1, ey + 2, "p");
  if (lash) {
    const top = hr >= 2.8 ? ey - 2 : ey - 1;
    const right = hr >= 4.5 ? ex + 2 : ex + 1;
    p.px(right, top, "#");
    if (hr >= 4.5) p.px(right + 1, top - 1, "#");
  }
}

/** 네발 동물 비율 (모두 u에 곱하는 [아기, 어른]) */
type Quad = {
  /** 몸 반길이·반높이 */
  bw: Span;
  bh: Span;
  /** 다리 길이·굵기 */
  leg: Span;
  legW: Span;
  /** 머리 반지름, 몸 가운데에서 머리 가운데까지 올라간 높이(목), 몸 앞끝에서 머리 가운데까지 앞으로 나간 거리 */
  head: Span;
  rise: Span;
  fwd: Span;
  /** 목 굵기 (머리 반지름에 곱한다) */
  neck?: number;
  /** 다리 색 (앞쪽 다리, 뒤쪽은 그늘 6), 발굽 색 */
  legC?: string;
  farC?: string;
  hoof?: string;
};

type Hooks = {
  /** 몸 뒤 (꼬리 등) */
  back?: (geo: Geo) => void;
  /** 몸 대신 그리기 (양털) */
  body?: (geo: Geo) => void;
  /** 머리 위 (귀·주둥이·눈·무늬) */
  front: (geo: Geo) => void;
};

/** 옆에서 본 네발 동물: 뒤쪽 다리 → 몸 → 앞쪽 다리 → 목 → 머리 순서로 그린다 */
function quad(p: Pix, g: G, q: Quad, hooks: Hooks): Geo {
  const bw = sz(q.bw, g);
  const bh = sz(q.bh, g);
  const leg = Math.max(1, Math.round(sz(q.leg, g)));
  const lw = Math.max(1, Math.round(sz(q.legW, g)));
  const hr = sz(q.head, g);
  const by = FEET - leg - bh + 1;
  const hxRel = bw + sz(q.fwd, g);
  // 몸 뒤끝 ~ 머리 앞끝의 가운데가 도화지 가운데(CX)에 오게 (다 그린 뒤 다시 가운데 맞춤)
  const bx = CX - (hxRel + hr - bw) / 2;
  const geo: Geo = { bx, by, bw, bh, hx: bx + hxRel, hy: by - sz(q.rise, g), hr };
  hooks.back?.(geo);
  const top = Math.round(by);
  const legs = [bx - bw * 0.62, bx + bw * 0.45].map((x) => Math.round(x - lw / 2));
  const off = lw + 1;
  const drawLeg = (x: number, c: string) => {
    p.rect(x, top, lw, FEET - top + 1, c);
    if (q.hoof) p.rect(x, FEET, lw, 1, q.hoof);
  };
  for (const x of legs) drawLeg(x + off, q.farC ?? "6");
  if (hooks.body) hooks.body(geo);
  else p.ellipse(bx, by, bw + 0.3, bh, "5");
  for (const x of legs) drawLeg(x, q.legC ?? "5");
  // 목: 몸 앞 위에서 머리까지
  thick(p, bx + bw * 0.5, by - bh * 0.25, geo.hx, geo.hy, Math.max(1, hr * (q.neck ?? 0.6)), "5");
  p.ellipse(geo.hx, geo.hy, hr + 0.3, hr, "5");
  hooks.front(geo);
  return geo;
}

/** 몸 칸(4·5·6)이 시작하는 맨 위 줄 (그 열에 몸이 없으면 -1) */
function bodyTop(p: Pix, x: number): number {
  for (let y = 0; y < p.h; y++) if ("456".includes(p.get(x, y))) return y;
  return -1;
}
/** 등줄기 갈기: x1~x2 열마다 몸 맨 위 바로 위에 한 칸씩 (한 칸 걸러) */
function bristles(p: Pix, x1: number, x2: number, c: string) {
  for (let x = Math.round(x1); x <= Math.round(x2); x += 2) {
    const y = bodyTop(p, x);
    if (y > 0) p.px(x, y - 1, c);
  }
}

/** 등에 밝은 면 */
function shine(p: Pix, geo: Geo) {
  p.ellipse(geo.bx - geo.bw * 0.15, geo.by - geo.bh * 0.55, geo.bw * 0.45, Math.max(0.8, geo.bh * 0.28), "4");
}

const ANIMALS: Record<string, { colors: Colors; draw: (p: Pix, g: G, eyeC: string) => Geo }> = {
  // 병아리 → 닭: 아기는 노란 털 공(머리가 몸의 반), 어른은 몸이 길어지고 목·다리가 생기고 볏·꽁지깃이 난다
  "animal.chick": {
    colors: { 4: "#fff1a0", 5: "#ffd84d", 6: "#e9ac2c", o: "#f08a24" },
    draw: (p, g, eyeC) => {
      const { t } = g;
      const bw = sz([0.95, 1.15], g);
      const bh = sz([0.9, 0.72], g);
      const leg = Math.max(1, Math.round(sz([0.2, 0.55], g)));
      const hr = sz([0.68, 0.46], g);
      const by = FEET - leg - bh + 1;
      const hxRel = bw * lerp(0.35, 0.75, t);
      const bx = CX - (hxRel + hr - bw) / 2 + 0.5;
      const geo: Geo = { bx, by, bw, bh, hx: bx + hxRel, hy: by - bh * lerp(0.55, 0.95, t) - sz([0, 0.35], g), hr };
      // 꽁지깃 (자랄수록 위로 솟는다). 암탉은 짧고, 수탉은 길게 솟고 끝에 짙은 초록 깃
      if (t > 0) {
        const tl = sz([0, isMale(g) ? 1.05 : isFemale(g) ? 0.5 : 0.75], g);
        const tx = bx - bw - tl * 0.4;
        const ty = by - bh * 0.4 - tl;
        thick(p, bx - bw * 0.6, by - bh * 0.2, tx, ty, Math.max(1, g.u * 0.22), "6");
        if (isMale(g)) {
          thick(p, bx - bw * 0.7, by - bh * 0.1, tx - g.u * 0.2, ty + g.u * 0.35, Math.max(0.7, g.u * 0.14), "m");
          p.px(Math.round(tx), Math.round(ty) - 1, "m");
        }
      }
      // 다리 (가는 주황 다리, 발가락은 앞으로)
      for (const [x, c] of [[Math.round(bx + bw * 0.15), "o"], [Math.round(bx - bw * 0.25), "u"]] as const) {
        p.vline(x, Math.round(by + bh * 0.5), FEET, c).px(x + 1, FEET, c);
      }
      p.ellipse(bx, by, bw + 0.3, bh, "5");
      thick(p, bx + bw * 0.4, by - bh * 0.3, geo.hx, geo.hy, Math.max(1, hr * 0.7), "5");
      p.ellipse(geo.hx, geo.hy, hr + 0.3, hr, "5");
      shine(p, geo);
      // 날개
      p.ellipse(bx - bw * 0.1, by + bh * 0.05, bw * 0.48, bh * 0.45, "6");
      const ty = Math.round(geo.hy - hr);
      const hx = Math.round(geo.hx);
      if (t === 0) p.px(hx - 1, ty - 1, "5").px(hx, ty - 2, "5"); // 아기 머리 깃털
      else if (isFemale(g)) {
        // 암탉: 작은 볏
        p.rect(hx - 1, ty - 1, 2, 1, "N").px(hx, ty - 2, "N");
      } else {
        // 볏과 턱볏 (어른은 크게, 수탉은 한 줄 더 높게)
        p.rect(hx - 1, ty - 1, t === 1 ? 3 : 2, 1, "N").px(hx, ty - 2, "N");
        if (t === 1) p.px(hx - 1, ty - 2, "N").px(hx + 1, ty - 2, "N");
        if (isMale(g)) p.px(hx, ty - 3, "N").px(hx - 2, ty - 1, "N");
      }
      // 부리 (앞으로 뾰족)
      const bkx = Math.round(geo.hx + hr);
      const bky = Math.round(geo.hy);
      p.rect(bkx, bky, t === 1 ? 2 : 1, 1, "o").px(bkx, bky + 1, "u");
      if (t > 0 && !isFemale(g)) p.px(bkx - 1, bky + 2, "N");
      if (isMale(g)) p.px(bkx - 1, bky + 3, "N");
      eye(p, geo.hx + hr * 0.3, geo.hy - hr * 0.2, hr, eyeC, true, isFemale(g));
      return geo;
    },
  },
  // 토끼 (앉은 옆모습): 아기는 동그란 공에 짧은 귀, 어른은 몸이 길고 뒷다리가 크고 귀가 길다
  "animal.bunny": {
    colors: { 4: "#ffffff", 5: "#f6f1ea", 6: "#ddd2c6", o: "#ffb3c7" },
    draw: (p, g, eyeC) => {
      const { t } = g;
      const bw = sz([0.95, 1.15], g);
      const bh = sz([0.85, 0.75], g);
      const hr = sz([0.72, 0.52], g);
      const by = FEET - bh + 1;
      const hxRel = bw * lerp(0.45, 0.75, t);
      const bx = CX - (hxRel + hr - bw) / 2;
      const geo: Geo = { bx, by, bw, bh, hx: bx + hxRel, hy: by - bh * lerp(0.75, 1.0, t), hr };
      // 꼬리 털뭉치
      p.ellipse(bx - bw - 0.2, by - bh * 0.1, 1.3 + t * 0.5, 1.3 + t * 0.5, "4");
      // 귀 (뒤쪽 귀 먼저, 머리 뒤에서 위로 조금 눕혀서)
      const ear = Math.max(2, Math.round(sz([0.55, 1.5], g)));
      const ew = g.u >= 4 ? 3 : 2;
      const ex = Math.round(geo.hx - hr * 0.35);
      const ey = Math.round(geo.hy - hr * 0.6);
      for (const [dx, c] of [[2, "6"], [0, "5"]] as const) {
        for (let i = 0; i < ear; i++) {
          const x = ex + dx - Math.floor((i * (t * 0.5 + 0.2)) / 1.5);
          p.rect(x, ey - i, ew, 1, c);
          if (c === "5" && ew === 3 && i > 0 && i < ear - 1) p.px(x + 1, ey - i, "o");
        }
      }
      p.ellipse(bx, by, bw + 0.3, bh, "5");
      // 큰 뒷다리 (허벅지와 길쭉한 발)
      p.ellipse(bx - bw * 0.3, FEET - bh * 0.45 + 1, bw * 0.55, bh * 0.5, "6");
      p.rect(Math.round(bx - bw * 0.5), FEET, Math.round(bw * lerp(0.7, 1.0, t)), 1, "4");
      // 앞발
      p.rect(Math.round(bx + bw * 0.55), FEET - 1, 2, 2, "4");
      p.ellipse(geo.hx, geo.hy, hr + 0.3, hr, "5");
      // 수토끼: 통통한 볼
      if (isMale(g)) p.ellipse(geo.hx + hr * 0.1, geo.hy + hr * 0.45, hr * 0.6, hr * 0.45, "4");
      shine(p, geo);
      p.px(Math.round(geo.hx + hr), Math.round(geo.hy + hr * 0.2), "o");
      eye(p, geo.hx + hr * 0.25, geo.hy - hr * 0.15, hr, eyeC, true, isFemale(g));
      return geo;
    },
  },
  // 돼지: 아기는 머리가 크고 코가 짧고, 어른은 몸이 길고 코가 앞으로 나온다. 꼬불 꼬리
  "animal.piglet": {
    colors: { 4: "#ffe0e8", 5: "#ffc2d2", 6: "#f09ab3", o: "#ff9fb8" },
    draw: (p, g, eyeC) =>
      quad(p, g, { bw: [0.9, 1.1], bh: [0.75, 0.7], leg: [0.25, 0.35], legW: [0.35, 0.3], head: [0.75, 0.52], rise: [0.35, 0.3], fwd: [-0.3, 0.05], neck: 0.9, hoof: "6" }, {
        back: (geo) => {
          // 꼬불 꼬리
          const x = Math.round(geo.bx - geo.bw);
          const y = Math.round(geo.by - geo.bh * 0.4);
          p.px(x - 1, y, "6").px(x - 2, y - 1, "6").px(x - 1, y - 2, "6");
        },
        front: (geo) => {
          shine(p, geo);
          const { hx, hy, hr } = geo;
          // 앞으로 접힌 세모 귀
          const ex = Math.round(hx - hr * 0.2);
          const ey = Math.round(hy - hr - 0.5);
          p.rect(ex, ey, 2, 2, "6").px(ex + 2, ey + 1, "6").px(ex + 1, ey - 1, "6");
          // 코 (어른일수록 길다)
          const len = Math.max(1, Math.round(sz([0.18, 0.42], g)));
          const h = Math.max(2, Math.round(hr * 0.75));
          const sx = Math.round(hx + hr * 0.75);
          const sy = Math.round(hy + hr * 0.05);
          p.rect(sx, sy, len, h, "5").rect(sx + len, sy, 1, h, "o").px(sx + len, sy + Math.floor(h / 2), "#");
          if (isMale(g)) {
            // 수퇘지: 코 밑 작은 엄니와 등줄기 갈기
            p.px(sx + Math.max(0, len - 1), sy + h, "w");
            bristles(p, geo.bx - geo.bw * 0.55, geo.bx + geo.bw * 0.35, "6");
          }
          eye(p, hx + hr * 0.15, hy - hr * 0.25, hr, eyeC, true, isFemale(g));
        },
      }),
  },
  // 송아지: 튼튼한 몸, 다리는 처음부터 길쭉, 자라면 몸이 커지고 뿔이 난다. 흰 바탕 검은 무늬
  "animal.calf": {
    colors: { 4: "#ffffff", 5: "#f7f2ea", 6: "#ddd2c6", D: "#4a3a33", o: "#ffc7a8", O: "#f4a882" },
    draw: (p, g, eyeC) =>
      quad(p, g, { bw: [0.85, 0.88], bh: [0.62, 0.55], leg: [0.42, 0.5], legW: [0.32, 0.28], head: [0.62, 0.42], rise: [0.5, 0.55], fwd: [-0.05, 0.1], neck: 0.75, hoof: "D" }, {
        back: (geo) => {
          // 가는 꼬리, 끝에 털
          const x = geo.bx - geo.bw;
          const y = geo.by - geo.bh * 0.6;
          const len = sz([0.4, 0.7], g);
          thin(p, x, y, x - 1, y + len, "6");
          p.rect(Math.floor(x - 2), Math.floor(y + len), 2, 2, "D");
        },
        front: (geo) => {
          const { hx, hy, hr, bx, by, bw, bh } = geo;
          shine(p, geo);
          // 무늬
          p.ellipse(bx - bw * 0.35, by - bh * 0.35, bw * 0.3, bh * 0.45, "D");
          p.ellipse(bx + bw * 0.35, by + bh * 0.2, bw * 0.2, bh * 0.3, "D");
          // 옆으로 난 귀와 뿔 (자라면)
          p.ellipse(hx - hr * 0.8, hy - hr * 0.45, Math.max(1.5, hr * 0.5), 1, "5");
          // 뿔: 암소는 작게, 황소는 크게 앞으로 휜다
          const horn = isFemale(g) ? 1 : g.t === 1 ? 2 : 1;
          const hornX = Math.round(hx - hr * 0.3);
          const hornY = Math.round(hy - hr);
          if (g.t > 0) p.rect(hornX, hornY - horn, 1, horn, "c");
          if (isMale(g)) p.px(hornX - 1, hornY - 1, "c").px(hornX + 1, hornY - 3, "c").px(hornX, hornY - 3, "c");
          // 암소: 배 아래 분홍 젖
          if (isFemale(g)) {
            const ux = Math.round(bx - bw * 0.05);
            const uy = Math.round(by + bh) - 1;
            p.rect(ux - 1, uy, 3, 2, "o").px(ux - 1, uy + 2, "O").px(ux + 1, uy + 2, "O");
          }
          // 주둥이
          p.ellipse(hx + hr * 0.75, hy + hr * 0.35, Math.max(1.5, hr * 0.55), Math.max(1.2, hr * 0.5), "o");
          p.px(Math.round(hx + hr * 1.1), Math.round(hy + hr * 0.25), "#");
          // 황소: 금빛 코뚜레
          if (isMale(g)) p.px(Math.round(hx + hr * 1.1), Math.round(hy + hr * 0.25) + 2, "z").px(Math.round(hx + hr * 1.1) + 1, Math.round(hy + hr * 0.25) + 1, "z");
          eye(p, hx + hr * 0.05, hy - hr * 0.25, hr, eyeC, false, isFemale(g));
        },
      }),
  },
  // ===== 분양 동물 (사용자 요청 2026-10-11 "펫 종류": 코인으로 데려온다, 알에서는 안 나온다) =====
  // 햄스터: 아기도 어른도 동글 (자라도 조금 길어질 뿐), 흰 배, 작은 동그란 귀, 볼주머니
  "animal.hamster": {
    colors: { 4: "#fff6e8", 5: "#f2b26b", 6: "#d98d4a", o: "#ffb3c7" },
    draw: (p, g, eyeC) => {
      const bw = sz([1.1, 1.3], g);
      const bh = sz([0.95, 0.9], g);
      const by = FEET - bh + 1;
      const bx = CX;
      const hr = bh * 0.75;
      const geo: Geo = { bx, by, bw, bh, hx: bx + bw * 0.45, hy: by - bh * 0.2, hr };
      const ty = Math.round(by - bh);
      p.ellipse(bx + bw * 0.1, ty + 0.5, 1.5, 1.5, "6");
      p.ellipse(bx, by, bw + 0.3, bh, "5");
      p.ellipse(bx + bw * 0.3, by + bh * 0.45, bw * 0.55, bh * 0.45, "4");
      // 볼주머니 (수컷은 더 빵빵하게)
      const pouch = isMale(g) ? 1.35 : 1;
      p.ellipse(bx + bw * 0.55, by + bh * 0.1, Math.max(1, bh * 0.35 * pouch), Math.max(1, bh * 0.3 * pouch), "4");
      p.ellipse(bx - bw * 0.2, ty + 1, 1.5, 1.5, "5").px(Math.round(bx - bw * 0.2), ty + 1, "o");
      p.px(Math.round(bx + bw), Math.round(by - bh * 0.1), "o");
      p.px(Math.round(bx + bw * 0.4), FEET, "o").px(Math.round(bx - bw * 0.5), FEET, "o");
      eye(p, bx + bw * 0.55, by - bh * 0.35, hr, eyeC, false, isFemale(g));
      return geo;
    },
  },
  // 고양이: 아기는 머리가 크고 꼬리가 짧고, 어른은 몸·다리가 길고 꼬리가 길게 위로 휜다. 뾰족 귀, 이마 줄무늬
  "animal.kitten": {
    colors: { 4: "#fff0dc", 5: "#ffc58a", 6: "#e89b5e", o: "#ff9fb8", D: "#e0843f" },
    draw: (p, g, eyeC) =>
      quad(p, g, { bw: [0.75, 1.0], bh: [0.6, 0.45], leg: [0.3, 0.5], legW: [0.3, 0.25], head: [0.75, 0.5], rise: [0.55, 0.75], fwd: [-0.15, 0.1] }, {
        back: (geo) => {
          // 꼬리: 뒤로 나갔다가 위로 휜다 (자랄수록 길다)
          const len = sz([0.5, 1.35], g);
          const x = geo.bx - geo.bw * 0.85;
          const y = geo.by - geo.bh * 0.3;
          const w = Math.max(0.6, g.u * 0.13);
          thick(p, x, y, x - len * 0.45, y - len * 0.35, w, "6");
          thick(p, x - len * 0.45, y - len * 0.35, x - len * 0.5, y - len, w, "6");
        },
        front: (geo) => {
          const { hx, hy, hr } = geo;
          shine(p, geo);
          // 뾰족 귀 두 개
          const ty = Math.round(hy - hr);
          for (const [x, c] of [[Math.round(hx + hr * 0.15), "6"], [Math.round(hx - hr * 0.55), "5"]] as const) {
            p.rect(x, ty - 1, 2, 2, c).px(x, ty - 2, c);
            if (c === "5" && hr >= 3) p.px(x + 1, ty - 1, "o");
          }
          // 이마 줄무늬
          p.px(Math.round(hx - 1), ty + 1, "D").px(Math.round(hx + 1), ty + 1, "D");
          // 수고양이: 통통한 볼살
          if (isMale(g)) p.ellipse(hx + hr * 0.1, hy + hr * 0.5, hr * 0.75, hr * 0.5, "5");
          // 주둥이·코
          p.ellipse(hx + hr * 0.7, hy + hr * 0.35, Math.max(1, hr * 0.35), Math.max(1, hr * 0.3), "4");
          p.px(Math.round(hx + hr), Math.round(hy + hr * 0.1), "o");
          eye(p, hx + hr * 0.25, hy - hr * 0.2, hr, eyeC, true, isFemale(g));
        },
      }),
  },
  // 강아지: 아기는 동글 머리에 짧은 다리, 어른은 몸·다리가 길고 주둥이가 나오고 꼬리가 선다. 늘어진 귀, 눈 얼룩
  "animal.puppy": {
    colors: { 4: "#ffffff", 5: "#fff3e2", 6: "#e6d3bb", D: "#b7835a", o: "#ff9fb8" },
    draw: (p, g, eyeC) =>
      quad(p, g, { bw: [0.8, 1.05], bh: [0.62, 0.5], leg: [0.3, 0.55], legW: [0.35, 0.3], head: [0.78, 0.52], rise: [0.55, 0.75], fwd: [-0.2, 0.1] }, {
        back: (geo) => {
          const len = sz([0.3, 0.75], g);
          const x = geo.bx - geo.bw * 0.85;
          const y = geo.by - geo.bh * 0.4;
          thick(p, x, y, x - len * 0.5, y - len, Math.max(0.6, g.u * 0.14), "5");
        },
        front: (geo) => {
          const { hx, hy, hr } = geo;
          shine(p, geo);
          // 주둥이 (자랄수록 길다)와 까만 코
          const len = Math.max(1, Math.round(sz([0.15, 0.4], g)));
          const sh = Math.max(2, Math.round(hr * 0.7));
          const sx = Math.round(hx + hr * 0.6);
          const sy = Math.round(hy + hr * 0.05);
          p.rect(sx, sy, len + 1, sh, "4").rect(sx + len, sy, 1, 1, "#");
          if (sh >= 3) p.px(sx + len - 1, sy + sh, "o");
          // 눈 얼룩
          p.ellipse(hx + hr * 0.3, hy - hr * 0.25, Math.max(1, hr * 0.28), Math.max(1, hr * 0.28), "D");
          if (isMale(g)) {
            // 수컷: 쫑긋 선 귀 (머리 위로 세모)
            const ex = Math.round(hx - hr * 0.55);
            const ey = Math.round(hy - hr);
            p.rect(ex, ey - 1, 3, 2, "D").rect(ex, ey - 2, 2, 1, "D").px(ex, ey - 3, "D");
          } else {
            // 늘어진 귀 (머리 뒤에서 아래로)
            p.ellipse(hx - hr * 0.45, hy + hr * 0.05, Math.max(1, hr * 0.38), Math.max(1.5, hr * 0.7), "D");
          }
          eye(p, hx + hr * 0.3, hy - hr * 0.2, hr, eyeC, false, isFemale(g));
        },
      }),
  },
  // 양: 복슬복슬한 털 몸에 가는 다리. 아기는 머리가 크고 털이 동글, 어른은 털 몸이 길고 다리가 길다. 살구색 얼굴
  "animal.lamb": {
    colors: { 4: "#ffffff", 5: "#fbf6ec", 6: "#e4dccd", D: "#f2d0b4", d: "#d9ac8c" },
    draw: (p, g, eyeC) =>
      quad(
        p,
        g,
        { bw: [0.8, 0.98], bh: [0.7, 0.58], leg: [0.28, 0.58], legW: [0.25, 0.18], head: [0.6, 0.42], rise: [0.45, 0.55], fwd: [-0.05, 0.2], neck: 0.7, legC: "d", farC: "d", hoof: "#" },
        {
          body: (geo) => {
            const { bx, by, bw, bh } = geo;
            p.ellipse(bx, by, bw, bh - 0.5, "5");
            // 털 뭉치 (가장자리를 둘러 몽글하게)
            const r = Math.max(1.2, g.u * 0.26);
            for (let i = 0; i < 12; i++) {
              const a = (i / 12) * Math.PI * 2;
              p.ellipse(bx + Math.cos(a) * (bw - r * 0.6), by + Math.sin(a) * (bh - r * 0.7), r, r, "5");
            }
          },
          front: (geo) => {
            const { hx, hy, hr } = geo;
            shine(p, geo);
            // 털 모자 위에 얼굴
            p.ellipse(hx + hr * 0.15, hy + hr * 0.1, hr * 0.85, hr * 0.8, "D");
            p.ellipse(hx - hr * 0.2, hy - hr * 0.55, hr * 0.7, hr * 0.5, "5");
            // 옆 귀
            p.ellipse(hx - hr * 0.75, hy, Math.max(1.2, hr * 0.45), 1, "d");
            p.px(Math.round(hx + hr * 0.9), Math.round(hy + hr * 0.45), "d");
            if (isMale(g)) {
              // 숫양: 귀 위로 돌돌 말린 뿔
              const r = Math.max(1.5, hr * 0.72);
              const cx = hx - hr * 0.45;
              const cy = hy - hr * 0.05;
              p.ellipse(cx, cy, r, r, "b").ellipse(cx + 0.3, cy + 0.2, Math.max(0.8, r * 0.62), Math.max(0.8, r * 0.62), "B");
              if (r >= 2) p.px(Math.round(cx + 0.3), Math.round(cy + 0.2), "b");
            }
            eye(p, hx + hr * 0.3, hy - hr * 0.05, hr, eyeC, true, isFemale(g));
          },
        },
      ),
  },
  // 조랑말: 아기는 머리가 크고 목이 짧고, 어른은 다리·목이 길고 머리가 작고 길쭉하다. 갈기·꼬리, 발굽
  "animal.pony": {
    colors: { 4: "#e9c49b", 5: "#d49a64", 6: "#b07a4a", D: "#7a4a2e", o: "#f3dcc0", O: "#d7b896" },
    draw: (p, g, eyeC) =>
      quad(p, g, { bw: [0.68, 0.7], bh: [0.5, 0.4], leg: [0.5, 0.68], legW: [0.28, 0.22], head: [0.55, 0.36], rise: [0.6, 0.9], fwd: [0.0, 0.12], neck: 0.75, hoof: "D" }, {
        back: (geo) => {
          // 꼬리 (뒤로 흘러내림)
          const x = geo.bx - geo.bw * 0.85;
          const y = geo.by - geo.bh * 0.6;
          // 수말은 꼬리가 더 길고 숱이 많다
          const len = sz([0.5, isMale(g) ? 0.95 : 0.8], g);
          thick(p, x, y, x - len * 0.3, y + len, Math.max(0.8, g.u * (isMale(g) ? 0.2 : 0.16)), "D");
        },
        front: (geo) => {
          const { hx, hy, hr, bx, bw, by, bh } = geo;
          shine(p, geo);
          // 길쭉한 주둥이 (앞 아래로)
          p.ellipse(hx + hr * 0.85, hy + hr * 0.45, Math.max(1.5, hr * 0.62), Math.max(1.2, hr * 0.55), "o");
          p.px(Math.round(hx + hr * 1.25), Math.round(hy + hr * 0.3), "#");
          // 갈기 (머리 뒤에서 목 등줄기를 따라). 수말은 굵게 휘날리고, 암말은 분홍 끈으로 땋았다
          const [mx1, my1, mx2, my2] = [hx - hr * 0.5, hy - hr * 0.6, bx + bw * 0.4, by - bh * 0.9];
          thick(p, mx1, my1, mx2, my2, Math.max(0.7, g.u * (isMale(g) ? 0.17 : 0.11)), "D");
          if (isMale(g)) thick(p, mx1 - 1, my1 + 1, mx2 - 1, my2 + 1, Math.max(0.7, g.u * 0.11), "D");
          if (isFemale(g)) for (let i = 1; i <= 3; i++) p.px(Math.round(lerp(mx1, mx2, i / 4)), Math.round(lerp(my1, my2, i / 4)), "V");
          p.rect(Math.round(hx), Math.round(hy - hr) - 1, isMale(g) ? 3 : 2, 2, "D");
          // 뾰족 귀
          p.rect(Math.round(hx - hr * 0.35), Math.round(hy - hr) - 2, 1, 2, "5");
          eye(p, hx + hr * 0.1, hy - hr * 0.15, hr, eyeC, false, isFemale(g));
        },
      }),
  },
};

// 어른이 되면 목에 다는 작은 리본 (얼굴을 가리지 않게 납작하게). 작은 동물은 더 작은 리본
// 암컷은 분홍 리본, 수컷은 파란 나비넥타이 (2026-10-12 암수), 암수를 모르면(미리보기) 분홍 리본
const RIBBON: Sprite = ["#V#.#V#", "#VVRVV#", "#V#.#V#"];
const SMALL_RIBBON: Sprite = ["V.V", "VRV", "V.V"];
const BOWTIE: Sprite = ["#T#.#T#", "#TTtTT#", "#T#.#T#"];
const SMALL_BOWTIE: Sprite = ["T.T", "TtT", "T.T"];

// ===== 스킨 (사용자 요청 2026-10-11 "펫 종류별로 스킨") =====
// 동물 종류마다 코인으로 사는 색·무늬. DB(animal_skins.asset_key)에는 키만, 실제 색·무늬는 여기서 그린다.
// colors는 그 동물의 색 칸(4·5·6·o·D…)을 바꿔 칠하고, pattern은 몸 위에 무늬를 더한다 (몸 칸 4·5·6에만 칠한다)
type Skin = { species: string; colors?: Colors; eye?: string; pattern?: (p: Pix, geo: Geo) => void };

const BODY = new Set(["4", "5", "6"]);
/** 몸 칸(4·5·6) 위에만 타원 무늬 */
function patch(p: Pix, cx: number, cy: number, rx: number, ry: number, c: string) {
  const mark = new Pix(W, 32).ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), c);
  p.map((cell, x, y) => (BODY.has(cell) && mark.get(x, y) === c ? c : cell));
}

export const ANIMAL_SKINS: Record<string, Skin> = {
  "skin.chick.choco": { species: "animal.chick", colors: { 4: "#f1d2a8", 5: "#d9a066", 6: "#b67a45" } },
  "skin.chick.mint": { species: "animal.chick", colors: { 4: "#e2fff3", 5: "#9fe6c8", 6: "#6cc3a2" } },
  "skin.bunny.gray": { species: "animal.bunny", colors: { 4: "#eef0f4", 5: "#c9ccd6", 6: "#a3a7b5" } },
  "skin.bunny.patch": {
    species: "animal.bunny",
    colors: { D: "#a8714a" },
    pattern: (p, { bx, by, bw, bh, hx, hy, hr }) => {
      patch(p, bx - bw * 0.2, by - bh * 0.2, bw * 0.45, bh * 0.45, "D");
      patch(p, hx + hr * 0.2, hy - hr * 0.2, hr * 0.5, hr * 0.5, "D");
    },
  },
  "skin.hamster.snow": { species: "animal.hamster", colors: { 4: "#ffffff", 5: "#e9e6ea", 6: "#c4bfc8" } },
  "skin.hamster.choco": { species: "animal.hamster", colors: { 4: "#f4e2cc", 5: "#a06c48", 6: "#7c5236" } },
  "skin.kitten.black": { species: "animal.kitten", colors: { 4: "#8a8096", 5: "#5a5266", 6: "#433c4d", D: "#4a4256" }, eye: "z" },
  "skin.kitten.calico": {
    species: "animal.kitten",
    colors: { 4: "#ffffff", 5: "#fbf6ef", 6: "#e3d8cb", D: "#f0a35e", C: "#f0a35e", K: "#5a5060" },
    pattern: (p, { bx, by, bw, bh, hx, hy, hr }) => {
      patch(p, bx - bw * 0.45, by - bh * 0.3, bw * 0.35, bh * 0.55, "K");
      patch(p, bx + bw * 0.3, by - bh * 0.4, bw * 0.3, bh * 0.45, "C");
      patch(p, hx - hr * 0.4, hy - hr * 0.4, hr * 0.5, hr * 0.5, "K");
    },
  },
  "skin.puppy.shiba": { species: "animal.puppy", colors: { 4: "#fff6ea", 5: "#f0a85c", 6: "#d0843c", D: "#c97a35" } },
  "skin.puppy.choco": { species: "animal.puppy", colors: { 4: "#d8b08e", 5: "#a87650", 6: "#855a3a", D: "#6b4430" } },
  "skin.piglet.spot": {
    species: "animal.piglet",
    colors: { K: "#7a5a62" },
    pattern: (p, { bx, by, bw, bh }) => {
      patch(p, bx - bw * 0.5, by - bh * 0.1, bw * 0.22, bh * 0.3, "K");
      patch(p, bx + bw * 0.1, by - bh * 0.45, bw * 0.18, bh * 0.25, "K");
      patch(p, bx + bw * 0.25, by + bh * 0.35, bw * 0.15, bh * 0.22, "K");
    },
  },
  "skin.piglet.black": { species: "animal.piglet", colors: { 4: "#7b6a72", 5: "#54454d", 6: "#3e3239", o: "#c98da0" }, eye: "w" },
  "skin.lamb.black": { species: "animal.lamb", colors: { 4: "#6d6676", 5: "#4b4552", 6: "#39343f" } },
  "skin.lamb.pink": { species: "animal.lamb", colors: { 4: "#fff2f7", 5: "#ffd3e4", 6: "#f3aac6" } },
  "skin.calf.hanwoo": { species: "animal.calf", colors: { 4: "#e8b98a", 5: "#c98a52", 6: "#a86c3a", D: "#b47640" } },
  "skin.calf.strawberry": { species: "animal.calf", colors: { D: "#f59ab5" } },
  "skin.pony.white": { species: "animal.pony", colors: { 4: "#ffffff", 5: "#f3efe9", 6: "#d8d0c4", D: "#b9b3c9" } },
  "skin.pony.zebra": {
    species: "animal.pony",
    colors: { 4: "#ffffff", 5: "#f7f5f2", 6: "#d9d5cf", D: "#3b3440", K: "#3b3440" },
    pattern: (p, { hx, hr }) => {
      // 세로 줄무늬 (2칸 띄워 1칸), 머리 앞쪽(주둥이)은 빼고
      p.map((c, x) => (BODY.has(c) && x % 3 === 0 && x < hx + hr * 0.3 ? "K" : c));
    },
  },
};

/** 이 스킨을 이 동물에 입힐 수 있는지 (그림이 있고 종류가 맞는지) */
export function skinFits(skinKey: string, assetKey: string): boolean {
  return Object.hasOwn(ANIMAL_SKINS, skinKey) && ANIMAL_SKINS[skinKey].species === assetKey;
}

// ===== 특별 진화 그림 (사용자 요청 2026-10-12 "망아지가 유니콘이나 페가수스 … 딸기 우유 송아지, 얼룩 토끼, 흑돼지") =====
// 종류·확률·이름은 src/lib/farm.ts SPECIAL_VARIANTS, 여기서는 모습만. 특별한 동물은 스킨을 입지 않는다 (제 모습이 곧 특별한 색·무늬).
// colors는 그 동물의 색 칸을 바꿔 칠하고, pattern은 몸 칸에 무늬를, extra는 날개·뿔·고리처럼 몸 밖으로 나오는 것을 그린다.
// 아기 모습으로 데리고 다녀도(display_form = baby) 같은 색·무늬로, 크기만 작게 그린다 (geo·u에 맞춰 그린다)
type VariantArt = { species: string; colors?: Colors; eye?: string; pattern?: (p: Pix, geo: Geo, g: G) => void; extra?: (p: Pix, geo: Geo, g: G) => void };

/** 머리 위 빈 곳 (고리·뿔 자리): 머리 둘레 열에서 가장 높은 칠한 칸 */
function headTop(p: Pix, geo: Geo): number {
  let top = p.h;
  for (let x = Math.floor(geo.hx - geo.hr); x <= Math.ceil(geo.hx + geo.hr); x++)
    for (let y = 0; y < p.h; y++)
      if (p.get(x, y) !== ".") {
        top = Math.min(top, y);
        break;
      }
  return top;
}
/** 날개 (등 위, 바깥 하늘색 + 안쪽 흰 깃). big = 페가수스처럼 위로 크게 */
function wing(p: Pix, geo: Geo, g: G, big: boolean) {
  const { bx, by, bw, bh } = geo;
  const rootX = bx - bw * 0.05;
  const rootY = by - bh * 0.75;
  const reach = big ? g.u * 0.95 : g.u * 0.6;
  const tips = big
    ? [[rootX - reach * 0.55, rootY - reach], [rootX - reach * 0.85, rootY - reach * 0.6], [rootX - reach * 0.95, rootY - reach * 0.2]]
    : [[rootX - reach * 0.5, rootY - reach * 0.75], [rootX - reach * 0.85, rootY - reach * 0.35], [rootX - reach * 0.8, rootY + reach * 0.05]];
  const r = Math.max(0.9, g.u * (big ? 0.13 : 0.15));
  for (const [x, y] of tips) thick(p, rootX, rootY, x, y, r, "i");
  for (const [x, y] of tips) thick(p, rootX, rootY, x, y, Math.max(0.5, r - 0.7), "I");
}
/** 몸 칸만 다시 칠하기 */
function paintBody(p: Pix, fn: (x: number, y: number) => string | null) {
  p.map((c, x, y) => (BODY.has(c) ? (fn(x, y) ?? c) : c));
}
const STRIPES = ["V", "K", "z", "L", "i", "U"];

export const ANIMAL_VARIANT_ART: Record<string, VariantArt> = {
  // 황금 닭: 짙은 금빛 깃털에 반짝이는 무늬
  golden_hen: {
    species: "animal.chick",
    colors: { 4: "#fff1a0", 5: "#f6bf2e", 6: "#c47e16", o: "#e8701a" },
    pattern: (p, { bx, by, bw, bh }) => paintBody(p, (x, y) => ((x * 3 + y * 5) % 9 === 0 && Math.abs(x + 0.5 - bx) < bw * 0.8 && Math.abs(y + 0.5 - by) < bh * 0.8 ? "Z" : null)),
  },
  // 얼룩 토끼 (더치): 얼굴 앞·몸 앞은 하얗고 눈가·귀·엉덩이는 진회색
  dutch_bunny: {
    species: "animal.bunny",
    colors: { 4: "#ffffff", 5: "#fbfaf8", 6: "#dcd8d2", K: "#6e6474" },
    pattern: (p, { bx, bw, hx, hy, hr }) =>
      paintBody(p, (x, y) => {
        const dx = (x + 0.5 - (hx - hr * 0.2)) / (hr * 0.75);
        const dy = (y + 0.5 - (hy - hr * 0.25)) / (hr * 0.7);
        if (y < hy - hr * 0.85 || dx * dx + dy * dy <= 1) return "K";
        return x < bx - bw * 0.1 && y > hy + hr * 0.6 ? "K" : null;
      }),
  },
  // 판다 햄스터: 흰 몸에 까만 눈가·귀·어깨띠
  panda_hamster: {
    species: "animal.hamster",
    colors: { 4: "#ffffff", 5: "#f6f4f2", 6: "#d8d3d0", K: "#3d3843" },
    eye: "w",
    pattern: (p, { bx, by, bw, bh }) => {
      patch(p, bx + bw * 0.58, by - bh * 0.38, Math.max(1.2, bw * 0.24), Math.max(1.2, bh * 0.32), "K");
      patch(p, bx - bw * 0.35, by + bh * 0.05, Math.max(1, bw * 0.22), bh, "K");
      paintBody(p, (_x, y) => (y <= Math.round(by - bh) + 1 ? "K" : null));
    },
  },
  // 흑돼지: 새까만 털과 뻣뻣한 등 갈기
  black_pig: {
    species: "animal.piglet",
    colors: { 4: "#5f5466", 5: "#3e3646", 6: "#2b2532", o: "#9a7385", K: "#1f1a24" },
    eye: "w",
    extra: (p, { bx, bw }) => {
      bristles(p, bx - bw * 0.7, bx + bw * 0.45, "K");
      bristles(p, bx - bw * 0.6, bx + bw * 0.35, "K");
    },
  },
  // 은하수 고양이: 밤하늘색 털에 별
  galaxy_cat: {
    species: "animal.kitten",
    colors: { 4: "#7d77c6", 5: "#514c93", 6: "#3a3672", D: "#a29ae8", o: "#ffb3d9" },
    eye: "z",
    pattern: (p) => paintBody(p, (x, y) => ((x * 7 + y * 11) % 13 === 0 ? "Z" : (x * 5 + y * 3) % 17 === 0 ? "w" : null)),
  },
  // 천사 강아지: 새하얀 털, 등에 날개, 머리 위 금빛 고리
  angel_puppy: {
    species: "animal.puppy",
    colors: { 4: "#ffffff", 5: "#fffdf8", 6: "#e6e2ee", D: "#f1dcc4" },
    extra: (p, geo, g) => {
      wing(p, geo, g, false);
      const y = headTop(p, geo) - 2;
      p.hline(Math.round(geo.hx - geo.hr * 0.55), Math.round(geo.hx + geo.hr * 0.35), y, "z");
    },
  },
  // 무지개 양: 털에 일곱 빛깔 줄
  rainbow_lamb: {
    species: "animal.lamb",
    pattern: (p, { by, bh }) => {
      const top = by - bh - 1;
      const band = Math.max(1, (bh * 2 + 2) / STRIPES.length);
      paintBody(p, (_x, y) => STRIPES[Math.min(STRIPES.length - 1, Math.max(0, Math.floor((y - top) / band)))]);
    },
  },
  // 딸기우유 송아지: 분홍 몸에 딸기 무늬(빨간 점 + 노란 씨 + 초록 꼭지)
  strawberry_calf: {
    species: "animal.calf",
    colors: { 4: "#fff4f8", 5: "#ffdbe7", 6: "#f2b1c8", D: "#f0506f", o: "#ffc8d8", O: "#f5a3bb" },
    pattern: (p, { by, bh }) => {
      // 몸 무늬에만 (꼬리 끝·발굽은 빼고): 씨 → 꼭지
      const spot = (y: number) => y < by + bh * 0.6;
      p.map((c, x, y) => (c === "D" && spot(y) && (x + y) % 3 === 0 && p.get(x, y - 1) === "D" ? "Z" : c));
      p.map((c, x, y) => (BODY.has(c) && spot(y) && p.get(x, y + 1) === "D" && p.get(x - 1, y + 1) === "D" && p.get(x + 1, y + 1) === "D" ? "l" : c));
    },
  },
  // 유니콘: 하얀 몸, 무지개 갈기·꼬리, 이마에 금빛 뿔
  unicorn: {
    species: "animal.pony",
    colors: { 4: "#ffffff", 5: "#f6f3fb", 6: "#d9d2e6" },
    pattern: (p) => p.map((c, x, y) => (c === "D" ? ["V", "U", "i"][(x + y) % 3] : c)),
    extra: (p, { hx, hy, hr }) => {
      const x0 = Math.round(hx + hr * 0.15);
      const y0 = Math.round(hy - hr);
      // 도화지 맨 위(외곽선 한 줄)를 넘지 않게: 큰 조랑말은 뿔이 조금 짧다
      const len = Math.min(Math.max(2, Math.round(hr * 1.1)), y0 - 2);
      for (let i = 0; i < len; i++) p.px(x0 + Math.floor((i * 2) / 3), y0 - 1 - i, i % 2 ? "Z" : "z");
    },
  },
  // 페가수스: 하늘색 갈기와 커다란 날개
  pegasus: {
    species: "animal.pony",
    colors: { 4: "#ffffff", 5: "#f1f7ff", 6: "#cbdcf0", D: "#7fb6ea" },
    extra: (p, geo, g) => wing(p, geo, g, true),
  },
};

/** 특별한 동물 반짝이 (도화지 32칸에 잘라 낸 뒤, 빈 칸에만): 가운데 밝은 노랑 + 십자 금빛 */
const SPARKLE: Sprite = [".z.", "zZz", ".z."];
function sparkle(out: Pix) {
  let [l, r, top] = [32, 0, 32];
  out.rows().forEach((row, y) => {
    for (let x = 0; x < 32; x++)
      if (row[x] !== "." && row[x] !== ":") {
        [l, r] = [Math.min(l, x), Math.max(r, x + 1)];
        top = Math.min(top, y);
      }
  });
  const fits = (x: number, y: number) =>
    x >= 1 && y >= 1 && x + 3 <= 31 && SPARKLE.every((row, j) => [...row].every((c, i) => c === "." || out.get(x + i, y + j) === "."));
  // 왼쪽 위·오른쪽 위·오른쪽 가운데 중 들어가는 곳 두 군데
  const spots = [
    [l - 2, top + 1],
    [r - 1, top + 2],
    [l - 1, top + 6],
    [r, top + 7],
    [l + 1, top - 3],
  ];
  let n = 0;
  for (const [x, y] of spots) {
    if (n >= 2) break;
    if (fits(x, y)) {
      out.stamp(SPARKLE, x, y);
      n++;
    }
  }
}

/** 동물 모습 (암수·특별 진화). 둘 다 없으면 예전 모습 */
export type AnimalLook = { sex?: AnimalSex | null; variant?: string | null };

/** 이 특별 진화 그림을 이 동물에 쓸 수 있는지 */
export function variantFits(variant: string | null | undefined, assetKey: string): boolean {
  return !!variant && Object.hasOwn(ANIMAL_VARIANT_ART, variant) && ANIMAL_VARIANT_ART[variant].species === assetKey;
}

/** 넓은 도화지에 그린다 (리본·그림자 전). 그린 칸의 왼쪽·오른쪽 끝과 맨 위 줄도 돌려준다 */
function drawArt(assetKey: string, g: G, skin: Skin | null, ribbon: boolean, variant: VariantArt | null = null) {
  const art = ANIMALS[assetKey] ?? ANIMALS["animal.chick"];
  const p = new Pix(W, 32);
  const look = variant ?? skin;
  const geo = art.draw(p, g, look?.eye ?? "#");
  look?.pattern?.(p, geo, g);
  // 몸 아래 가장자리에 그늘 (밖과 맞닿은 칸)
  p.map((c, x, y) => (c === "5" && (p.get(x + 1, y + 1) === "." || p.get(x, y + 1) === ".") ? "6" : c));
  variant?.extra?.(p, geo, g);
  p.outline();
  if (ribbon) {
    // 목(머리와 몸 사이)에 리본 (수컷은 나비넥타이)
    const big = geo.hr >= 3.5;
    const rb = g.sex === "male" ? (big ? BOWTIE : SMALL_BOWTIE) : big ? RIBBON : SMALL_RIBBON;
    const nx = lerp(geo.hx, geo.bx + geo.bw * 0.5, 0.45);
    const ny = lerp(geo.hy, geo.by - geo.bh * 0.25, 0.45) + geo.hr * 0.35;
    p.stamp(rb, Math.round(nx) - Math.floor(rb[0].length / 2), Math.round(ny) - Math.floor(rb.length / 2));
  }
  let [l, r, top] = [W, 0, 32];
  p.rows().forEach((row, y) => {
    for (let x = 0; x < row.length; x++)
      if (row[x] !== ".") {
        [l, r] = [Math.min(l, x), Math.max(r, x + 1)];
        top = Math.min(top, y);
      }
  });
  return { p, geo, l, r, top, colors: { ...art.colors, ...look?.colors } };
}

/** 이 동물에게 있을 수 있는 모든 모습 (암수 모름·암·수 × 보통·특별 진화). 도화지에 다 들어가는지 잴 때 쓴다 */
function allLooks(assetKey: string): { sex: AnimalSex | null; variant: VariantArt | null }[] {
  const variants = [null, ...Object.values(ANIMAL_VARIANT_ART).filter((v) => v.species === assetKey)];
  return variants.flatMap((variant) => ([null, "female", "male"] as const).map((sex) => ({ sex, variant })));
}

const maxR = new Map<string, number>();
/** 이 동물을 32칸 도화지에 다 담을 수 있는 가장 큰 크기 단위 (좌우 그림자 칸 + 맨 위 빈 줄을 남긴다). 암수·특별 진화 모습 모두 */
function maxRadius(assetKey: string): number {
  let best = maxR.get(assetKey);
  if (best !== undefined) return best;
  best = (ANIMAL_SIZE[assetKey] ?? DEFAULT_SIZE).r;
  grow: for (let u = best + 1; u <= MAX_R; u++) {
    for (const look of allLooks(assetKey)) {
      const { l, r, top } = drawArt(assetKey, { u, t: 1, sex: look.sex }, null, true, look.variant);
      if (r - l > 30 || top < 1) break grow;
    }
    best = u;
  }
  maxR.set(assetKey, best);
  return best;
}

/** 이 동물에게 고를 수 있는 크기 (모양이 앞 크기와 같으면 뺀다: 이미 가장 큰 동물은 "크게"가 없다).
 *  form = 데리고 다닐 모습 (아기 모습은 작아서 고를 수 있는 크기가 적다) */
export function displaySizeChoices(assetKey: string, form: AnimalForm = "adult"): AnimalDisplaySize[] {
  const out: AnimalDisplaySize[] = [];
  let prev = -1;
  for (const z of ["tiny", "small", "normal", "large"] as const) {
    const u = animalRadius(assetKey, form === "baby" ? "baby" : "adult", z);
    if (u !== prev || z === "normal") out.push(z);
    prev = u;
  }
  // "보통"과 같은 크기는 빼고 보통만 남긴다 (아기 모습의 작은 동물은 더 작게 그릴 수 없다)
  const normal = animalRadius(assetKey, form === "baby" ? "baby" : "adult", "normal");
  return out.filter((z) => z === "normal" || animalRadius(assetKey, form === "baby" ? "baby" : "adult", z) !== normal);
}

type Rows = { rows: string[]; colors: Colors; mid: number };
const rowsCache = new Map<string, Rows>();
function animalRows(assetKey: string, stage: AnimalStage, skinKey?: string | null, size: AnimalDisplaySize = "normal", look: AnimalLook = {}): Rows {
  const variantKey = variantFits(look.variant, assetKey) ? look.variant! : null;
  const sex = look.sex ?? null;
  const key = `${assetKey}|${stage}|${skinKey ?? ""}|${size}|${sex ?? ""}|${variantKey ?? ""}`;
  const hit = rowsCache.get(key);
  if (hit) return hit;
  const variant = variantKey ? ANIMAL_VARIANT_ART[variantKey] : null;
  // 특별한 동물은 스킨을 입지 않는다
  const skin = !variant && skinKey && skinFits(skinKey, assetKey) ? ANIMAL_SKINS[skinKey] : null;
  const { p, geo, l, r, colors } = drawArt(assetKey, { u: animalRadius(assetKey, stage, size), t: MATURITY[stage], sex }, skin, stage === "adult", variant);
  // 그린 칸의 가운데를 32칸 도화지 가운데로
  const start = Math.max(0, Math.min(W - 32, Math.round((l + r) / 2 - 16)));
  const out32 = new Pix(32, 32).stamp(
    p.rows().map((row) => row.slice(start, start + 32)),
    0,
    0,
  );
  const half = (Math.min(r, start + 32) - Math.max(l, start)) / 2;
  out32.shadow(16, FEET + 1.5, half + 1, 1.5);
  if (variant) sparkle(out32);
  const out = { rows: out32.rows(), colors, mid: Math.round(geo.by) };
  rowsCache.set(key, out);
  return out;
}

/** 그림 키에 맞는 동물 그림이 있는지 (블로그 전시 동물은 없으면 그리지 않는다, BLOG-04 / research R-20) */
export function hasAnimalArt(assetKey: string): boolean {
  return Object.hasOwn(ANIMALS, assetKey);
}

/** 동물 SVG. 단계가 낮을수록, 작은 동물일수록 작다 (발바닥 기준, ANIMAL_SIZE). size = 화면에 보일 한 변 px (32의 배수면 도트가 고르다).
 *  skinKey: 입힌 스킨 (없거나 종류가 안 맞으면 기본 색), displaySize: 주인이 고른 다 키운 동물 크기, look: 암수·특별 진화 */
export function animalSvg(assetKey: string, stage: AnimalStage, size = 64, skinKey?: string | null, displaySize: AnimalDisplaySize = "normal", look: AnimalLook = {}): string {
  const { rows, colors } = animalRows(assetKey, stage, skinKey, displaySize, look);
  return fitSvg(rows, size, { colors });
}

/** 데리고 다니는 모습 (광장·우리 집·농장 카드): 다 자란 동물의 모습 선택(form)까지 */
export type PetLook = AnimalLook & { form?: AnimalForm | null };
const petStage = (look: PetLook): AnimalStage => (look.form === "baby" ? "baby" : "adult");

const extents = new Map<string, { half: number; height: number }>();
/** 데리고 다니는 동물이 도화지(32칸)에서 실제로 차지하는 반폭(가운데에서 가장 먼 칸까지)과 키(발바닥에서 맨 위 칸까지), 그림자 빼고 */
function animalExtent(assetKey: string, size: AnimalDisplaySize = "normal", look: PetLook = {}) {
  const key = `${assetKey}|${size}|${look.sex ?? ""}|${look.variant ?? ""}|${petStage(look)}`;
  const cached = extents.get(key);
  if (cached) return cached;
  let half = 0;
  let top = FEET;
  animalRows(assetKey, petStage(look), null, size, look).rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++)
      if (row[x] !== "." && row[x] !== ":") {
        half = Math.max(half, Math.abs(x + 0.5 - 16));
        top = Math.min(top, y);
      }
  });
  const ext = { half: Math.ceil(half), height: FEET + 1 - top };
  extents.set(key, ext);
  return ext;
}

/** 반폭(칸). 따라다니는 거리를 정할 때 쓴다 (귀·꼬리까지 그린 그대로 잰다) */
export function animalHalfWidth(assetKey: string, size: AnimalDisplaySize = "normal", look: PetLook = {}): number {
  return animalExtent(assetKey, size, look).half;
}

/** 키(칸). 캐릭터(약 20칸)보다 크면 옆에 설 때 이름표에 머리가 닿지 않게 더 떨어진다 */
export function animalHeight(assetKey: string, size: AnimalDisplaySize = "normal", look: PetLook = {}): number {
  return animalExtent(assetKey, size, look).height;
}

// ===== 따라다니는 움직임 (사용자 요청 2026-10-11 "펫 따라다니는 모션") =====
// 그림판: 가로 5칸 × 세로 2줄(오른쪽 보기, 왼쪽 보기 = 좌우 뒤집기). 칸은 32×32.
// 0 서 있기, 1 숨쉬기(한 칸 납작), 2 착지(납작), 3 걷기(몸이 가는 쪽으로 한 칸 기욺), 4 뛰어오름(한 칸 늘어남 + 기욺)
// 납작·늘어남은 몸 가운데 줄(animalRows의 mid)을 빼거나 한 번 더 그려 만든다. 그림은 오른쪽을 본다
// 서 있을 때는 0·1을 번갈아(숨쉬기), 걸을 때는 2·3·4·3을 돌린다 (뛰어오르는 높이는 쓰는 쪽에서 정한다)
export const PET_SHEET_FRAMES = 5;
export const PET_IDLE_FRAMES = [0, 1] as const;
export const PET_WALK_FRAMES = [2, 3, 4, 3] as const;
/** 걷기 칸마다 띄우는 높이 (도트 칸, PET_WALK_FRAMES와 같은 순서) */
export const PET_WALK_LIFT = [0, 1, 2, 1] as const;
export type PetFacing = "right" | "left";

function petFrame(rows: string[], mid: number, frame: number): string[] {
  const blank = ".".repeat(rows[0].length);
  const body = rows.slice(0, FEET + 1);
  const ground = rows.slice(FEET + 1);
  let out = body;
  // 납작: 가운데 줄을 빼고 위에 빈 줄
  if (frame === 1 || frame === 2) out = [blank, ...body.slice(0, mid), ...body.slice(mid + 1)];
  // 늘어남: 가운데 줄을 한 번 더 (맨 위 빈 줄을 뺀다)
  if (frame === 4) out = [...body.slice(1, mid + 1), body[mid], ...body.slice(mid + 1)];
  // 기울기: 가운데보다 위를 오른쪽으로 한 칸
  if (frame === 3 || frame === 4) out = out.map((row, y) => (y < mid ? `.${row.slice(0, -1)}` : row));
  return [...out, ...ground];
}

/** 따라다니는 동물 그림판 SVG (가로 5칸 × 세로 2줄, 한 칸 32칸 × scale) */
export function petSheetSvg(assetKey: string, skinKey: string | null | undefined, scale: number, size: AnimalDisplaySize = "normal", look: PetLook = {}): string {
  const { rows, colors, mid } = animalRows(assetKey, petStage(look), skinKey, size, look);
  let body = "";
  for (let f = 0; f < PET_SHEET_FRAMES; f++) {
    const right = petFrame(rows, mid, f);
    body += spriteRects(right, colors, f * 32, 0) + spriteRects(flipX(right), colors, f * 32, 32);
  }
  const w = 32 * PET_SHEET_FRAMES;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 64" width="${w * scale}" height="${64 * scale}" shape-rendering="crispEdges">${body}</svg>`;
}

export function petSheetDataUri(assetKey: string, skinKey: string | null | undefined, scale: number, size: AnimalDisplaySize = "normal", look: PetLook = {}): string {
  return svgDataUri(petSheetSvg(assetKey, skinKey, scale, size, look));
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
