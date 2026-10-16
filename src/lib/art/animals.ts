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
  // 야생 동물 (2026-10-12 "동물 가짓수 더"): 여우·거북이는 작은, 늑대·치타·표범·독수리는 중간, 곰·호랑이·사자·사슴은 큰
  "animal.fox": { tier: "small", r: 6 },
  "animal.turtle": { tier: "small", r: 6 },
  "animal.eagle": { tier: "medium", r: 7 },
  "animal.wolf": { tier: "medium", r: 8 },
  "animal.cheetah": { tier: "medium", r: 8 },
  "animal.leopard": { tier: "medium", r: 8 },
  "animal.deer": { tier: "large", r: 10 },
  "animal.bear": { tier: "large", r: 10 },
  "animal.tiger": { tier: "large", r: 10 },
  "animal.lion": { tier: "large", r: 10 },
  // 도감을 다 채우면 오는 용 (2026-10-16 "도감 다 해금하면 용같은거 주자"): 날개·뿔·꼬리가 길어 몸은 8칸 (32칸 도화지에 다 들어가게)
  "animal.dragon": { tier: "medium", r: 8 },
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
type G = { u: number; t: number; sex?: AnimalSex | null; pose?: FlyPose | null };
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

/** fly = 따라다닐 때 걷지 않고 날갯짓한다 (독수리, 그림판 걷기 칸을 pose로 다시 그린다) */
const ANIMALS: Record<string, { colors: Colors; fly?: boolean; draw: (p: Pix, g: G, eyeC: string) => Geo }> = {
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
  // ===== 야생 동물 열 종류 (사용자 요청 2026-10-12 "곰, 여우, 늑대, 호랑이, 사자, 독수리, 거북이, 치타, 표범, 사슴") =====
  // 모두 옆모습(오른쪽을 본다), 아기 → 어른 비율은 위 동물들과 같은 방법(Span [아기, 어른])으로 잰다.
  // 곰: 통통한 몸에 짧고 굵은 다리, 동그란 귀, 밝은 주둥이. 아기는 동글 공, 수곰은 어깨 혹이 솟는다
  "animal.bear": {
    colors: { 4: "#bb8b5f", 5: "#8f6243", 6: "#6b4530", o: "#e8c99e", D: "#3e2a20" },
    draw: (p, g, eyeC) =>
      quad(p, g, { bw: [0.85, 0.92], bh: [0.7, 0.64], leg: [0.22, 0.36], legW: [0.42, 0.36], head: [0.74, 0.5], rise: [0.3, 0.38], fwd: [-0.22, 0.0], neck: 0.95 }, {
        back: (geo) => p.ellipse(geo.bx - geo.bw, geo.by - geo.bh * 0.35, Math.max(1, g.u * 0.14), Math.max(1, g.u * 0.14), "5"),
        body: (geo) => {
          const { bx, by, bw, bh } = geo;
          p.ellipse(bx, by, bw + 0.3, bh, "5");
          // 수곰: 어깨 혹 (불곰처럼 등 앞이 솟는다)
          if (isMale(g)) {
            p.ellipse(bx + bw * 0.3, by - bh * 0.7, bw * 0.42, bh * 0.55, "5");
            p.ellipse(bx + bw * 0.3, by - bh * 0.95, bw * 0.25, Math.max(0.8, bh * 0.2), "4");
          }
        },
        front: (geo) => {
          const { hx, hy, hr } = geo;
          shine(p, geo);
          // 동그란 귀 둘 (뒤쪽은 그늘), 안쪽은 밝게
          const er = Math.max(1, hr * 0.32);
          for (const [dx, c] of [[-0.55, "6"], [0.05, "5"]] as const) {
            p.ellipse(hx + hr * dx, hy - hr * 0.82, er, er, c);
            if (c === "5" && er >= 1.4) p.px(Math.round(hx + hr * dx), Math.round(hy - hr * 0.82), "o");
          }
          // 밝은 주둥이와 까만 코
          p.ellipse(hx + hr * 0.72, hy + hr * 0.32, Math.max(1.3, hr * 0.5), Math.max(1, hr * 0.4), "o");
          p.rect(Math.round(hx + hr * 1.08), Math.round(hy + hr * 0.08), hr >= 4 ? 2 : 1, 1, "D");
          eye(p, hx + hr * 0.18, hy - hr * 0.22, hr, eyeC, true, isFemale(g));
        },
      }),
  },
  // 여우: 날씬한 몸, 뾰족하고 큰 귀(끝이 까맣다), 길쭉한 주둥이와 흰 볼, 끝이 하얀 복슬 꼬리, 까만 발. 수여우는 꼬리와 가슴 털이 더 풍성하다
  "animal.fox": {
    colors: { 4: "#ffbf80", 5: "#f28b3c", 6: "#c9682a", D: "#5a3a2a", W: "#fffaf0" },
    draw: (p, g, eyeC) => canid(p, g, eyeC, "fox"),
  },
  // 늑대: 회색 털에 등은 짙고 배·주둥이는 밝다, 쫑긋한 귀, 아래로 늘어진 복슬 꼬리. 수늑대는 목 갈기가 풍성하다
  "animal.wolf": {
    colors: { 4: "#dfe3e8", 5: "#a1a9b3", 6: "#767f8a", D: "#525a64", W: "#f4f6f8" },
    draw: (p, g, eyeC) => canid(p, g, eyeC, "wolf"),
  },
  // 호랑이: 주황 몸에 까만 줄무늬(다리·꼬리까지), 흰 볼·배, 동그란 귀. 아기는 머리가 크고 줄이 성기다. 수호랑이는 볼 털이 옆으로 뻗는다
  "animal.tiger": {
    colors: { 4: "#ffd29c", 5: "#f59a3e", 6: "#d0772a", K: "#3a2a2a", W: "#fffaf0", o: "#ff9fb8" },
    draw: (p, g, eyeC) =>
      quad(p, g, { bw: [0.85, 0.92], bh: [0.64, 0.54], leg: [0.26, 0.45], legW: [0.38, 0.3], head: [0.76, 0.48], rise: [0.42, 0.55], fwd: [-0.22, -0.1], neck: 0.85 }, {
        back: (geo) => {
          // 긴 꼬리: 뒤로 내려갔다가 끝이 살짝 올라간다
          const len = sz([0.5, 0.9], g);
          const x = geo.bx - geo.bw * 0.9;
          const y = geo.by - geo.bh * 0.3;
          curve(p, [[x, y], [x - len * 0.25, y + len * 0.45], [x - len * 0.38, y + len * 0.7], [x - len * 0.5, y + len * 0.6]], Math.max(0.6, g.u * 0.12), "5");
        },
        front: (geo) => {
          const { hx, hy, hr, by, bh } = geo;
          shine(p, geo);
          // 줄무늬: 비스듬한 세로 줄 (얼굴 앞은 빼고), 아기는 성기게. 배는 하얗게
          const gap = g.t === 0 ? 5 : 4;
          const { bx, bw } = geo;
          paintBody(p, (x, y) => {
            if (inFace(geo, x, y)) return null;
            const [ex, ey] = [(x + 0.5 - bx) / bw, (y + 0.5 - by) / bh];
            if (ey > 0.5 && ex * ex + ey * ey <= 1) return "W";
            return (x + Math.floor(y / 2)) % gap === 0 && (y * 3 + x) % 7 !== 0 ? "K" : null;
          });
          // 동그란 귀 (가운데 흰 점)
          const er = Math.max(1, hr * 0.3);
          p.ellipse(hx - hr * 0.55, hy - hr * 0.82, er, er, "6");
          p.ellipse(hx + hr * 0.05, hy - hr * 0.85, er, er, "5");
          if (er >= 1.4) p.px(Math.round(hx + hr * 0.05), Math.round(hy - hr * 0.85), "W");
          // 이마 줄무늬
          const ty = Math.round(hy - hr * 0.6);
          p.px(Math.round(hx - hr * 0.15), ty, "K").px(Math.round(hx + hr * 0.25), ty, "K");
          if (hr >= 3.5) p.px(Math.round(hx + hr * 0.05), ty - 1, "K");
          // 수호랑이: 볼 털이 머리 뒤로 뻗는다
          if (isMale(g)) {
            p.ellipse(hx - hr * 0.45, hy + hr * 0.4, hr * 0.55, hr * 0.42, "W");
            p.px(Math.round(hx - hr * 1.05), Math.round(hy + hr * 0.25), "W").px(Math.round(hx - hr * 0.95), Math.round(hy + hr * 0.7), "W");
          }
          // 흰 볼과 분홍 코
          p.ellipse(hx + hr * 0.62, hy + hr * 0.4, Math.max(1, hr * 0.42), Math.max(1, hr * 0.32), "W");
          p.px(Math.round(hx + hr * 1.02), Math.round(hy + hr * 0.08), "o");
          eye(p, hx + hr * 0.22, hy - hr * 0.2, hr, eyeC, false, isFemale(g));
        },
      }),
  },
  // 사자: 모래색 몸, 끝에 털뭉치가 달린 꼬리. 수사자는 머리를 둘러싼 큰 갈기, 암사자는 갈기가 없다.
  // 아기는 몸에 옅은 점무늬, 청소년은 갈기가 아직 없다 (암수를 모르는 미리보기 어른은 작은 갈기)
  "animal.lion": {
    colors: { 4: "#f7d793", 5: "#dcab5e", 6: "#b8873f", J: "#b8692e", j: "#8a4a22", D: "#5a3a2a", o: "#f7e7c4" },
    draw: (p, g, eyeC) =>
      quad(p, g, { bw: [0.85, 0.9], bh: [0.6, 0.52], leg: [0.28, 0.48], legW: [0.36, 0.3], head: [0.72, 0.46], rise: [0.42, 0.58], fwd: [-0.2, 0.08], neck: 0.85 }, {
        back: (geo) => {
          const len = sz([0.45, 0.95], g);
          const x = geo.bx - geo.bw * 0.9;
          const y = geo.by - geo.bh * 0.45;
          const end: [number, number] = [x - len * 0.3, y + len * 0.8];
          curve(p, [[x, y], [x - len * 0.25, y + len * 0.25], end], Math.max(0.5, g.u * 0.08), "5");
          if (g.t > 0) p.ellipse(end[0], end[1], Math.max(1, g.u * 0.13), Math.max(1, g.u * 0.13), "J");
        },
        front: (geo) => {
          const { hx, hy, hr } = geo;
          shine(p, geo);
          // 아기·청소년: 옅은 점무늬 (자라면 사라진다)
          if (g.t < 1) paintBody(p, (x, y) => ((x * 5 + y * 3) % (g.t === 0 ? 7 : 11) === 0 && Math.hypot(x + 0.5 - hx, y + 0.5 - hy) > hr ? "6" : null));
          const maned = g.t === 1 && g.sex !== "female";
          if (maned) {
            // 갈기: 머리 뒤를 크게 둘러싼다 (수컷은 바깥 짙은 털까지 두 겹)
            const big = isMale(g);
            const mr = hr * (big ? 1.5 : 1.22);
            if (big) p.ellipse(hx - hr * 0.3, hy + hr * 0.15, mr + 0.8, mr + 0.5, "j");
            p.ellipse(hx - hr * 0.25, hy + hr * 0.12, mr, mr * 0.95, "J");
            p.ellipse(hx + hr * 0.08, hy, hr * 0.92, hr * 0.92, "5");
          } else {
            // 동그란 귀
            const er = Math.max(1, hr * 0.28);
            p.ellipse(hx - hr * 0.5, hy - hr * 0.85, er, er, "6");
            p.ellipse(hx + hr * 0.05, hy - hr * 0.88, er, er, "5");
          }
          // 밝은 주둥이와 코
          p.ellipse(hx + hr * 0.6, hy + hr * 0.38, Math.max(1.2, hr * 0.48), Math.max(1, hr * 0.36), "o");
          p.px(Math.round(hx + hr * 1.0), Math.round(hy + hr * 0.1), "D");
          eye(p, hx + hr * 0.25, hy - hr * 0.2, hr, eyeC, false, isFemale(g));
        },
      }),
  },
  // 독수리: 서 있는 옆모습. 아기는 회색 솜털 공, 청소년은 온몸이 갈색, 어른은 흰 머리·흰 꽁지에 노란 부리·발.
  // 날 때(pose)는 다리를 접고 날개를 펼친다 (따라다닐 때 날갯짓, petSheetSvg)
  "animal.eagle": {
    colors: { 4: "#a87b52", 5: "#7b5135", 6: "#5a3a26", W: "#fffaf0", o: "#ffd36e", O: "#d99a36" },
    fly: true,
    draw: (p, g, eyeC) => eagle(p, g, eyeC),
  },
  // 용 (2026-10-16 도감 보상): 초록 비늘, 노란 배, 등 가시, 뿔, 박쥐 날개, 위로 말린 꼬리. 아기는 머리가 크고 뿔·날개가 작다.
  // 독수리처럼 따라다닐 때는 날갯짓하며 난다 (fly)
  "animal.dragon": {
    colors: { 4: "#a8e486", 5: "#4fb35a", 6: "#2f7d45", o: "#ffe9a0", O: "#e8a93c", H: "#fff4d0", h: "#d9c79a", R: "#7fcfa0", r: "#2f7d45" },
    fly: true,
    draw: (p, g, eyeC) => dragon(p, g, eyeC),
  },
  // 거북이: 둥근 등딱지(무늬 칸), 짧은 다리, 앞으로 내민 머리. 아기는 머리가 크고 등딱지가 동글. 수컷은 꼬리가 길다
  "animal.turtle": {
    colors: { 4: "#a6d77e", 5: "#5fa65a", 6: "#3f7d48", D: "#2f5c38", o: "#d6e3a2", O: "#a9bd76" },
    draw: (p, g, eyeC) => turtle(p, g, eyeC),
  },
  // 치타: 아주 긴 다리와 날씬한 몸, 작은 머리, 까만 점무늬, 눈에서 입으로 내려오는 눈물 줄, 끝이 흰 긴 꼬리.
  // 아기는 등에 은회색 털(망토)이 있다. 수치타는 목덜미 털이 조금 선다
  "animal.cheetah": {
    colors: { 4: "#ffe3ab", 5: "#f0bf6a", 6: "#cf9b4a", K: "#3a2a22", W: "#fffaf0", Y: "#e8e6e1", o: "#ff9fb8" },
    draw: (p, g, eyeC) =>
      quad(p, g, { bw: [0.75, 1.0], bh: [0.56, 0.4], leg: [0.32, 0.64], legW: [0.32, 0.22], head: [0.72, 0.42], rise: [0.48, 0.62], fwd: [-0.15, 0.1], neck: 0.7 }, {
        back: (geo) => {
          const len = sz([0.5, 1.35], g);
          const x = geo.bx - geo.bw * 0.9;
          const y = geo.by - geo.bh * 0.2;
          const pts: [number, number][] = [[x, y], [x - len * 0.3, y + len * 0.55], [x - len * 0.62, y + len * 0.4]];
          curve(p, pts, Math.max(0.5, g.u * 0.09), "5");
          if (g.t > 0) p.px(Math.round(pts[2][0]), Math.round(pts[2][1]), "W");
        },
        front: (geo) => {
          const { hx, hy, hr, bx, bw } = geo;
          shine(p, geo);
          // 점무늬 (얼굴 앞은 빼고)
          spots(p, geo, 6);
          // 아기: 등에 은회색 털 망토 (청소년은 얇게)
          if (g.t < 1) for (let x = Math.round(bx - bw * 0.8); x <= Math.round(bx + bw * 0.35); x++) {
            const y = bodyTop(p, x);
            if (y > 0) for (let k = 0; k < (g.t === 0 ? 2 : 1); k++) if (BODY.has(p.get(x, y + k)) || p.get(x, y + k) === "K") p.px(x, y + k, "Y");
          }
          if (isMale(g)) bristles(p, bx + bw * 0.35, bx + bw * 0.85, "6");
          // 작은 동그란 귀
          const er = Math.max(1, hr * 0.28);
          p.ellipse(hx - hr * 0.6, hy - hr * 0.8, er, er, "6");
          p.ellipse(hx - hr * 0.05, hy - hr * 0.88, er, er, "5");
          // 주둥이·코
          p.ellipse(hx + hr * 0.62, hy + hr * 0.35, Math.max(1, hr * 0.42), Math.max(1, hr * 0.32), "W");
          p.px(Math.round(hx + hr * 1.0), Math.round(hy + hr * 0.08), "#");
          const ex = hx + hr * 0.25;
          const ey = hy - hr * 0.2;
          eye(p, ex, ey, hr, eyeC, false, isFemale(g));
          // 눈물 줄 (눈 앞 아래에서 입가로)
          thin(p, Math.round(ex) + 1, Math.round(ey) + 1, Math.round(ex + hr * 0.3) + 1, Math.round(hy + hr * 0.75), "K");
        },
      }),
  },
  // 표범: 치타보다 다리가 짧고 몸이 단단하다. 꽃 모양 무늬(가운데가 짙은 고리), 끝이 위로 말리는 긴 꼬리. 수표범은 머리·목이 굵다
  "animal.leopard": {
    colors: { 4: "#ffe0a0", 5: "#e9b55e", 6: "#c58e3e", K: "#4a3426", C: "#b8742e", W: "#fffaf0", o: "#ff9fb8" },
    draw: (p, g, eyeC) =>
      quad(
        p,
        g,
        { bw: [0.82, 0.98], bh: [0.6, 0.48], leg: [0.28, 0.44], legW: [0.36, 0.28], head: [0.74, isMale(g) ? 0.52 : 0.46], rise: [0.45, 0.55], fwd: [-0.2, 0.06], neck: isMale(g) ? 1.0 : 0.8 },
        {
          back: (geo) => {
            const len = sz([0.5, 1.2], g);
            const x = geo.bx - geo.bw * 0.9;
            const y = geo.by - geo.bh * 0.3;
            curve(p, [[x, y], [x - len * 0.3, y + len * 0.5], [x - len * 0.55, y + len * 0.3], [x - len * 0.5, y + len * 0.05]], Math.max(0.6, g.u * 0.11), "5");
          },
          front: (geo) => {
            const { hx, hy, hr } = geo;
            shine(p, geo);
            rosettes(p, geo, g);
            const er = Math.max(1, hr * 0.28);
            p.ellipse(hx - hr * 0.5, hy - hr * 0.85, er, er, "6");
            p.ellipse(hx + hr * 0.05, hy - hr * 0.88, er, er, "5");
            p.ellipse(hx + hr * 0.6, hy + hr * 0.38, Math.max(1.1, hr * 0.46), Math.max(1, hr * 0.34), "W");
            p.px(Math.round(hx + hr * 1.0), Math.round(hy + hr * 0.1), "o");
            eye(p, hx + hr * 0.25, hy - hr * 0.2, hr, eyeC, false, isFemale(g));
          },
        },
      ),
  },
  // 사슴: 가는 긴 다리와 긴 목, 흰 꼬리, 큰 귀. 아기(꽃사슴 새끼)는 등에 흰 점, 자라면 사라진다.
  // 수사슴은 가지 친 큰 뿔, 암사슴은 뿔이 없다 (암수를 모르는 미리보기 어른은 작은 뿔)
  "animal.deer": {
    colors: { 4: "#e8b47c", 5: "#c98a52", 6: "#a46a3a", W: "#fffaf0", D: "#4a3426", o: "#f2d2b0" },
    draw: (p, g, eyeC) =>
      quad(p, g, { bw: [0.66, 0.74], bh: [0.48, 0.38], leg: [0.5, 0.64], legW: [0.26, 0.2], head: [0.55, 0.36], rise: [0.55, 0.62], fwd: [0.0, 0.42], neck: 0.45, hoof: "D" }, {
        back: (geo) => {
          // 짧게 선 흰 꼬리
          const x = Math.round(geo.bx - geo.bw - 0.5);
          const y = Math.round(geo.by - geo.bh * 0.65);
          p.rect(x - 1, y - 1, 2, 1, "5").rect(x - 1, y, 2, g.u >= 6 ? 2 : 1, "W");
        },
        front: (geo) => {
          const { hx, hy, hr, bx, bw, by, bh } = geo;
          shine(p, geo);
          // 아기 흰 점 (청소년은 몇 개만)
          if (g.t < 1) paintBody(p, (x, y) => (y + 0.5 < by - bh * 0.05 && Math.abs(x + 0.5 - bx) < bw * 0.85 && (x * 3 + y * 5) % (g.t === 0 ? 7 : 13) === 0 ? "W" : null));
          // 큰 귀 (옆으로)
          p.ellipse(hx - hr * 0.75, hy - hr * 0.75, Math.max(1.2, hr * 0.55), Math.max(0.8, hr * 0.3), "6");
          // 주둥이·코
          p.ellipse(hx + hr * 0.85, hy + hr * 0.42, Math.max(1.2, hr * 0.5), Math.max(1, hr * 0.42), "o");
          p.px(Math.round(hx + hr * 1.25), Math.round(hy + hr * 0.25), "D");
          eye(p, hx + hr * 0.15, hy - hr * 0.15, hr, eyeC, false, isFemale(g));
          // 뿔: 수사슴은 크게 가지 치고, 암수를 모르면 작게, 암사슴·아기·청소년은 없다
          if (g.t === 1 && g.sex !== "female") antlers(p, geo, g, isMale(g) ? "big" : "small", "b", "n");
        },
      }),
  },
};

// ===== 야생 동물 그리기 도구 (2026-10-12 "동물 가짓수 더") =====
/** 여러 점을 잇는 굵은 선 (꼬리): 반지름 r */
function curve(p: Pix, pts: readonly (readonly [number, number])[], r: number, c: string) {
  for (let i = 1; i < pts.length; i++) thick(p, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], r, c);
}
/** 머리 둘레 (얼굴 앞쪽): 무늬를 그리지 않는 곳 */
const inFace = (geo: Geo, x: number, y: number) => Math.hypot(x + 0.5 - geo.hx, y + 0.5 - geo.hy) < geo.hr * 0.9 && x + 0.5 > geo.hx - geo.hr * 0.3;
/** 칸마다 정해진 0 ~ n-1 (무늬를 줄 맞춰 늘어서지 않게 흩뿌린다. 같은 칸은 늘 같은 값이라 그림이 바뀌지 않는다) */
function cellHash(x: number, y: number, n: number) {
  const h = Math.imul(x * 73 + 11, 0x9e3779b1) ^ Math.imul(y * 151 + 7, 0x85ebca6b);
  return ((h ^ (h >>> 15)) >>> 0) % n;
}
/** 점무늬 (치타): 몸 칸에 한 칸 점, 이웃한 점은 붙지 않게. every가 클수록 성기다 */
function spots(p: Pix, geo: Geo, every: number) {
  paintBody(p, (x, y) => (!inFace(geo, x, y) && cellHash(x, y, every) === 0 && p.get(x - 1, y) !== "K" && p.get(x, y - 1) !== "K" && p.get(x - 1, y - 1) !== "K" ? "K" : null));
}
/** 꽃 모양 무늬 (표범): 4칸마다 짙은 모서리 고리와 가운데 갈색. 아기는 작은 점 */
function rosettes(p: Pix, geo: Geo, g: G) {
  if (g.u < 5) {
    spots(p, geo, 4);
    return;
  }
  paintBody(p, (x, y) => {
    if (inFace(geo, x, y)) return null;
    const row = Math.floor(y / 4);
    const gx = (x + (row % 2) * 2) % 4;
    const gy = y % 4;
    if (gx === 1 && gy === 1) return "C";
    if ((gx === 0 || gx === 2) && (gy === 0 || gy === 2) && !(gx === 2 && gy === 0)) return "K";
    return null;
  });
}
/** 뿔 그림 (머리 위 가운데 아래가 뿌리, n = 뒤쪽 뿔 그늘, b = 앞쪽 뿔). 큰 것부터, 도화지에 들어가는 가장 큰 것을 쓴다 */
const ANTLERS: Record<"small" | "big" | "grand", Sprite[]> = {
  small: [["n...b", ".n.b.", ".n.b."], ["n.b", "n.b"]],
  big: [
    ["n.......b", "n..n.b..b", ".n.n.b.b.", "..nn.bb..", "...n.b..."],
    ["n.....b", "n.n.b.b", ".nn.bb.", "..n.b.."],
    ["n...b", ".n.b.", ".n.b."],
  ],
  grand: [
    ["nn.......bb", ".n.n...b.b.", ".n.n...b.b.", "..nn...bb..", "...n...b...", "....n.b...."],
    ["n.......b", "n..n.b..b", ".n.n.b.b.", "..nn.bb..", "...n.b..."],
    ["n...b", ".n.b.", ".n.b."],
  ],
};
/** 뿔 (사슴·순록): 머리 위에 앞에서 본 듯 두 갈래로 벌어진 뿔. 도화지 맨 위(둘째 줄)를 넘지 않는 가장 큰 그림 */
function antlers(p: Pix, geo: Geo, g: G, kind: keyof typeof ANTLERS, near: string, far: string) {
  const x0 = Math.round(geo.hx - geo.hr * 0.15);
  const y0 = Math.round(geo.hy - geo.hr) + 1;
  const list = ANTLERS[kind].filter((sp) => g.u >= 7 || sp[0].length <= 5);
  const sp = list.find((r) => y0 - r.length >= 1) ?? list[list.length - 1];
  const left = x0 - Math.floor(sp[0].length / 2);
  sp.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] !== ".") p.px(left + i, Math.max(1, y0 - sp.length + j), row[i] === "b" ? near : far);
  });
}

/** 뾰족 귀: 아래(base 줄)에서 위로 좁아지는 세모, 끝(tip)은 다른 색일 수 있다 */
function pointEar(p: Pix, x: number, base: number, h: number, w: number, c: string, tip: string | null) {
  for (let i = 0; i < h; i++) {
    const width = Math.max(1, Math.round(w * (1 - i / h)));
    p.rect(x + (w - width), base - i, width, 1, i === h - 1 && tip ? tip : c);
  }
}

/** 여우·늑대 (개과): 주둥이가 길고 귀가 쫑긋, 복슬 꼬리 */
function canid(p: Pix, g: G, eyeC: string, kind: "fox" | "wolf"): Geo {
  const fox = kind === "fox";
  const q: Quad = fox
    ? { bw: [0.78, 1.0], bh: [0.58, 0.44], leg: [0.28, 0.5], legW: [0.32, 0.24], head: [0.76, 0.48], rise: [0.5, 0.68], fwd: [-0.18, 0.1], hoof: "D" }
    : { bw: [0.8, 1.05], bh: [0.6, 0.48], leg: [0.3, 0.58], legW: [0.34, 0.26], head: [0.74, 0.46], rise: [0.5, 0.68], fwd: [-0.18, 0.12], neck: 0.8 };
  return quad(p, g, q, {
    back: (geo) => {
      // 복슬 꼬리: 여우는 뒤로 길게 뻗다가 끝이 살짝 들리고 끝이 하얗다, 늑대는 아래로 늘어진다
      const len = sz([0.45, fox ? 1.15 : 0.95], g);
      const x = geo.bx - geo.bw * 0.85;
      const y = geo.by - geo.bh * 0.25;
      const w = Math.max(0.8, g.u * (isMale(g) ? 0.27 : 0.22) * (fox ? 1 : 0.85));
      const end: [number, number] = fox ? [x - len * 0.85, y + len * 0.1] : [x - len * 0.35, y + len * 0.85];
      const mid: [number, number] = fox ? [x - len * 0.45, y + len * 0.3] : [x - len * 0.3, y + len * 0.4];
      thick(p, x, y, mid[0], mid[1], w * 0.7, "5");
      thick(p, mid[0], mid[1], end[0], end[1], w, "5");
      p.ellipse(end[0] + (fox ? -0.3 : 0), end[1] + (fox ? 0 : 0.4), w * 0.85, w * 0.85, fox ? "W" : "D");
    },
    front: (geo) => {
      const { hx, hy, hr, bx, bw, by, bh } = geo;
      shine(p, geo);
      // 늑대: 등은 짙고 배는 밝다
      if (!fox) paintBody(p, (x, y) => (inFace(geo, x, y) ? null : y + 0.5 < by - bh * 0.45 && Math.abs(x + 0.5 - bx) < bw * 0.8 ? "D" : y + 0.5 > by + bh * 0.5 ? "4" : null));
      // 가슴 흰 털 (수컷은 목 갈기까지 풍성하게)
      const chest = isMale(g) ? 0.6 : 0.42;
      p.ellipse(bx + bw * 0.8, by - bh * 0.05, Math.max(1, hr * chest), Math.max(1, hr * (chest + 0.15)), fox ? "W" : "4");
      if (isMale(g)) p.ellipse(hx - hr * 0.6, hy + hr * 0.55, hr * 0.6, hr * 0.5, fox ? "W" : "4");
      // 귀: 아기는 작고, 어른은 크고 뾰족 (여우는 끝이 까맣다)
      const tall = Math.max(2, Math.round(sz([0.4, fox ? 0.75 : 0.62], g)));
      const base = Math.round(hy - hr * 0.55);
      pointEar(p, Math.round(hx - hr * 0.62), base, tall, hr >= 3 ? 3 : 2, "6", fox && g.t > 0 ? "D" : null);
      pointEar(p, Math.round(hx - hr * 0.05), base, tall, hr >= 3 ? 3 : 2, "5", fox && g.t > 0 ? "D" : null);
      // 길쭉한 주둥이 (여우는 흰 볼), 까만 코
      const len = Math.max(1, Math.round(sz([0.15, fox ? 0.48 : 0.42], g)));
      const sh = Math.max(2, Math.round(hr * 0.6));
      const sx = Math.round(hx + hr * 0.55);
      const sy = Math.round(hy + hr * 0.05);
      p.rect(sx, sy, len + 1, sh, "5").rect(sx, sy + Math.floor(sh / 2), len + 1, Math.ceil(sh / 2), fox ? "W" : "4");
      if (fox) p.ellipse(hx + hr * 0.15, hy + hr * 0.45, hr * 0.5, hr * 0.35, "W");
      p.rect(sx + len, sy, 1, 1, "#");
      eye(p, hx + hr * 0.22, hy - hr * 0.22, hr, eyeC, false, isFemale(g));
    },
  });
}

/** 독수리 날 때 날개 모양 (따라다니는 그림판의 걷기 칸 = 날갯짓) */
export type FlyPose = "up" | "glide" | "down";

/** 독수리: 서 있으면 날개를 접고, pose가 있으면 다리를 접고 날개를 펼친다 */
function eagle(p: Pix, g: G, eyeC: string): Geo {
  const { t, u } = g;
  const flying = !!g.pose;
  const bw = sz([0.8, 0.72], g);
  const bh = sz([0.85, 0.95], g);
  const leg = flying ? 0 : Math.max(1, Math.round(sz([0.2, 0.32], g)));
  const hr = sz([0.62, 0.42], g);
  // 날 때는 몸을 조금 눕히고 위로 띄운다
  const by = FEET - leg - bh + 1 - (flying ? Math.round(u * 0.35) : 0);
  const bx = CX - hr * 0.3;
  const geo: Geo = { bx, by, bw, bh, hx: bx + bw * lerp(0.35, 0.55, t), hy: by - bh * lerp(0.6, 0.8, t), hr };
  // 아기는 솜털(Y), 청소년은 온몸 갈색, 어른은 흰 머리·흰 꽁지
  const fluff = t === 0;
  const headC = fluff ? "Y" : t === 1 ? "W" : "4";
  const tailC = t === 1 ? "W" : "6";
  const bodyC = fluff ? "Y" : "5";
  // 꽁지깃 (뒤 아래로, 날 때는 뒤로 수평)
  if (!fluff) {
    const tl = sz([0.3, 0.7], g);
    const [tx, ty] = flying ? [bx - bw - tl, by + bh * 0.2] : [bx - bw * 0.7 - tl * 0.5, Math.min(FEET - 1, by + bh * 0.6 + tl * 0.6)];
    thick(p, bx - bw * 0.4, by + bh * 0.35, tx, ty, Math.max(1, u * 0.18), tailC);
  }
  // 다리 (노란 발과 발톱)
  if (!flying) {
    for (const [x, c] of [[Math.round(bx + bw * 0.2), "o"], [Math.round(bx - bw * 0.25), "O"]] as const) {
      p.vline(x, Math.round(by + bh * 0.6), FEET, c).px(x + 1, FEET, c);
      if (u >= 5) p.px(x + 2, FEET, "#");
    }
  } else p.px(Math.round(bx), Math.round(by + bh), "O");
  p.ellipse(bx, by, bw + 0.3, bh, bodyC);
  if (!fluff) {
    // 다리 깃털 바지
    if (!flying) p.ellipse(bx, by + bh * 0.65, bw * 0.6, bh * 0.35, "6");
    shine(p, geo);
  } else p.ellipse(bx - bw * 0.2, by - bh * 0.2, bw * 0.5, bh * 0.4, "w");
  // 머리 (목 없이 몸에 붙는다)
  thick(p, bx + bw * 0.2, by - bh * 0.4, geo.hx, geo.hy, Math.max(1, hr * 0.75), headC);
  p.ellipse(geo.hx, geo.hy, hr + 0.3, hr, headC);
  // 수컷: 뒤통수 깃 두 가닥
  if (isMale(g)) p.px(Math.round(geo.hx - hr - 0.5), Math.round(geo.hy - hr * 0.3), headC).px(Math.round(geo.hx - hr - 1.5), Math.round(geo.hy - hr * 0.1), headC);
  // 날개
  const rootX = bx + bw * 0.1;
  const rootY = by - bh * 0.35;
  const wingC = fluff ? "y" : "6";
  if (!flying) {
    // 접은 날개: 옆구리에 붙어 뒤 아래로 끝이 뾰족
    p.ellipse(bx - bw * 0.1, by + bh * 0.05, bw * 0.75, bh * 0.68, wingC);
    if (!fluff) {
      thick(p, bx - bw * 0.3, by + bh * 0.3, bx - bw * 1.05, by + bh * 0.75, Math.max(0.6, u * 0.1), wingC);
      // 날개 윗선 (밝은 깃)
      p.map((c, x, y) => (c === wingC && "45".includes(p.get(x, y - 1)) && x + 0.5 < bx + bw * 0.5 ? "4" : c));
    }
  } else {
    // 펼친 날개: 위·수평·아래 (위로는 도화지 둘째 줄까지만)
    const reach = u * (fluff ? 0.7 : 1.15);
    const dir = g.pose === "up" ? [[-0.35, -1], [-0.75, -0.8], [-1, -0.45]] : g.pose === "glide" ? [[-0.4, -0.55], [-0.85, -0.35], [-1.05, -0.05]] : [[-0.4, 0.55], [-0.75, 0.75], [-1, 0.45]];
    const r = Math.max(0.8, u * 0.13);
    for (const [kx, ky] of dir) thick(p, rootX, rootY, rootX + reach * kx, Math.max(2 + r, rootY + reach * ky), r, wingC);
    if (!fluff) for (const [kx, ky] of dir) p.px(Math.round(rootX + reach * kx), Math.round(Math.max(2 + r, rootY + reach * ky)), "D");
  }
  // 갈고리 부리
  const bkx = Math.round(geo.hx + hr);
  const bky = Math.round(geo.hy);
  p.rect(bkx - 1, bky - 1, t === 1 ? 3 : 2, 2, "o").px(bkx + (t === 1 ? 1 : 0), bky + 1, "O");
  eye(p, geo.hx + hr * 0.2, geo.hy - hr * 0.2, hr, eyeC, false, isFemale(g));
  return geo;
}

/** 용: 서 있으면 네 다리로 서고 날개를 등에 세운다. pose가 있으면 다리를 접고 날개를 펼쳐 난다 (독수리와 같은 날갯짓 칸) */
function dragon(p: Pix, g: G, eyeC: string): Geo {
  const { t, u } = g;
  const flying = !!g.pose;
  const bw = sz([0.75, 0.8], g);
  const bh = sz([0.62, 0.52], g);
  const leg = flying ? 0 : Math.max(1, Math.round(sz([0.28, 0.42], g)));
  const lw = Math.max(1, Math.round(sz([0.24, 0.22], g)));
  const hr = sz([0.62, 0.42], g);
  const by = FEET - leg - bh + 1 - (flying ? Math.round(u * 0.35) : 0);
  const bx = CX - u * 0.15;
  const geo: Geo = { bx, by, bw, bh, hx: bx + bw + sz([0.15, 0.3], g), hy: by - sz([0.5, 0.95], g), hr };
  const { hx, hy } = geo;
  // 날개 (뒤쪽 날개는 그늘색으로 몸 뒤에, 앞쪽 날개는 몸 위에)
  const rootX = bx - bw * 0.05;
  const rootY = by - bh * 0.7;
  const reach = u * (t === 0 ? 0.45 : flying ? 1.1 : 0.8);
  const dir =
    !flying ? [[-0.45, -1], [-0.85, -0.75], [-1, -0.3]]
    : g.pose === "up" ? [[-0.3, -1], [-0.7, -0.85], [-1, -0.5]]
    : g.pose === "glide" ? [[-0.35, -0.6], [-0.8, -0.4], [-1.05, -0.1]]
    : [[-0.35, 0.5], [-0.7, 0.7], [-1, 0.4]];
  const r = Math.max(0.7, u * 0.12);
  const tips = dir.map(([kx, ky]) => [rootX + reach * kx, Math.max(1.5 + r, rootY + reach * ky)] as const);
  const drawWing = (dx: number, membrane: string, edge: string) => {
    // 날개막: 뿌리에서 끝까지 굵은 선을 촘촘히, 뼈대는 진한 선
    for (let i = 0; i < tips.length - 1; i++)
      for (let k = 0; k <= 4; k++) {
        const x = lerp(tips[i][0], tips[i + 1][0], k / 4) + dx;
        const y = lerp(tips[i][1], tips[i + 1][1], k / 4);
        thick(p, rootX + dx, rootY, x, y, r, membrane);
      }
    for (const [x, y] of tips) thin(p, rootX + dx, rootY, x + dx, y, edge);
  };
  if (t > 0) drawWing(-1, "6", "6");
  // 꼬리: 몸 뒤에서 아래로 갔다가 위로 말린다, 끝에 주황 가시
  const tr = Math.max(0.7, u * 0.15);
  const tail = flying
    ? ([[bx - bw * 0.7, by], [bx - bw - u * 0.3, by + bh * 0.2], [bx - bw - u * 0.55, by - bh * 0.2]] as const)
    : ([[bx - bw * 0.7, by], [bx - bw - u * 0.25, by + bh * 0.3], [bx - bw - u * 0.45, by - bh * 0.7]] as const);
  curve(p, tail, tr, "5");
  const [tx, ty] = tail[tail.length - 1];
  p.px(Math.round(tx), Math.round(ty - tr) - 1, "O").px(Math.round(tx) - 1, Math.round(ty - tr), "O");
  // 다리 (뒤쪽은 그늘, 발톱은 크림색)
  const top = Math.round(by);
  const legs = [bx - bw * 0.55, bx + bw * 0.45].map((x) => Math.round(x - lw / 2));
  if (!flying) for (const x of legs) p.rect(x + lw + 1, top, lw, FEET - top + 1, "6");
  p.ellipse(bx, by, bw + 0.3, bh, "5");
  // 노란 배
  p.ellipse(bx + bw * 0.15, by + bh * 0.5, bw * 0.7, Math.max(1, bh * 0.4), "o");
  if (!flying)
    for (const x of legs) {
      p.rect(x, top, lw, FEET - top + 1, "5");
      if (u >= 5) p.px(x + lw, FEET, "H");
    }
  else for (const x of legs) p.rect(x, Math.round(by + bh * 0.6), lw, Math.max(1, Math.round(u * 0.15)), "6");
  // 목과 머리, 앞으로 나온 주둥이
  thick(p, bx + bw * 0.55, by - bh * 0.3, hx, hy, Math.max(1, hr * 0.6), "5");
  p.ellipse(hx, hy, hr + 0.3, hr, "5");
  p.ellipse(hx + hr * 0.85, hy + hr * 0.3, Math.max(1, hr * 0.7), Math.max(1, hr * 0.5), "5");
  p.px(Math.round(hx + hr * 1.4), Math.round(hy + hr * 0.05), "6");
  // 등 가시 (몸·목 위로 한 칸 걸러)
  bristles(p, bx - bw * 0.8, bx + bw * 0.7, "O");
  if (t > 0) shine(p, geo);
  // 뿔 (머리 뒤 위로, 수컷은 더 길다). 아기는 작은 혹
  const hornLen = t === 0 ? 0.5 : isMale(g) ? 1.9 : isFemale(g) ? 1.3 : 1.6;
  const clampY = (y: number) => Math.max(1, y);
  thin(p, hx - hr * 0.35, hy - hr * 0.8, hx - hr * (0.35 + hornLen * 0.5), clampY(hy - hr * (0.8 + hornLen * 0.7)), "H");
  thin(p, hx + hr * 0.1, hy - hr * 0.85, hx - hr * (0.05 + hornLen * 0.35), clampY(hy - hr * (0.85 + hornLen * 0.5)), "h");
  // 앞쪽 날개
  if (t > 0 || !flying) drawWing(0, "R", "r");
  eye(p, hx + hr * 0.15, hy - hr * 0.25, hr, eyeC, false, isFemale(g));
  return geo;
}

/** 거북이: 둥근 등딱지 + 짧은 다리 + 앞으로 내민 머리 */
function turtle(p: Pix, g: G, eyeC: string): Geo {
  const { t, u } = g;
  const bw = sz([0.95, 1.15], g);
  const bh = sz([0.95, 0.72], g);
  const legH = Math.max(1, Math.round(sz([0.22, 0.3], g)));
  const hr = sz([0.62, 0.4], g);
  const rim = FEET - legH;
  const bx = CX - hr * 0.6;
  const geo: Geo = { bx, by: rim - bh * 0.5, bw, bh: bh * 0.55, hx: bx + bw + hr * lerp(0.5, 0.9, t), hy: rim - hr * lerp(0.9, 1.2, t), hr };
  const lw = Math.max(1, Math.round(u * 0.32));
  // 뒤쪽 다리 (그늘)
  for (const x of [bx - bw * 0.55, bx + bw * 0.45]) p.rect(Math.round(x) + lw, rim, lw, legH + 1, "O");
  // 꼬리 (수컷은 길다)
  const tl = Math.max(1, Math.round(sz([0.15, isMale(g) ? 0.42 : 0.22], g)));
  thin(p, Math.round(bx - bw), rim - 1, Math.round(bx - bw) - tl, rim, "o");
  // 목과 머리
  thick(p, bx + bw * 0.7, rim - 1, geo.hx, geo.hy, Math.max(1, hr * 0.62), "o");
  p.ellipse(geo.hx, geo.hy, hr + 0.3, hr, "o");
  // 등딱지: 반달 모양
  for (let y = Math.floor(rim - bh); y <= rim; y++) {
    const k = (rim - y) / bh;
    const half = bw * Math.sqrt(Math.max(0, 1 - k * k));
    if (half > 0.3) p.hline(Math.round(bx - half), Math.round(bx + half) - 1, y, "5");
  }
  shine(p, { ...geo, by: rim - bh * 0.45, bh: bh * 0.6 });
  // 등딱지 무늬 (가운데 큰 칸 + 양옆 줄)와 아래 테두리
  if (u >= 3) {
    const cx = Math.round(bx);
    const top = Math.round(rim - bh * 0.62);
    const side = Math.max(1, Math.round(bw * 0.45));
    p.map((c, x, y) => (BODY.has(c) && ((y === top && Math.abs(x - cx) <= side) || (Math.abs(Math.abs(x - cx) - side) < 0.5 && y > top && y < rim)) ? "D" : c));
  }
  p.hline(Math.round(bx - bw), Math.round(bx + bw) - 1, rim, "6");
  // 앞쪽 다리
  for (const x of [bx - bw * 0.55, bx + bw * 0.45]) p.rect(Math.round(x), rim, lw, legH + 1, "o");
  // 웃는 입
  p.px(Math.round(geo.hx + hr * 0.6), Math.round(geo.hy + hr * 0.45), "O");
  eye(p, geo.hx + hr * 0.25, geo.hy - hr * 0.2, hr, eyeC, true, isFemale(g));
  return geo;
}

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
  // 야생 동물 스킨 (2026-10-12): 종류마다 둘. 이름이 특별 진화(판다곰·은여우·백호…)와 겹치지 않는 색·무늬
  "skin.bear.moon": {
    species: "animal.bear",
    colors: { 4: "#5a5260", 5: "#3b3540", 6: "#2a252e", o: "#c9a98a", W: "#fffaf0" },
    eye: "w",
    // 반달가슴곰: 가슴에 흰 반달
    pattern: (p, { bx, by, bw, bh }) => paintBody(p, (x, y) => (Math.abs(y + 0.5 - (by - bh * 0.05) - Math.abs(x + 0.5 - (bx + bw * 0.78)) * 0.6) < 0.8 && Math.abs(x + 0.5 - (bx + bw * 0.78)) < bw * 0.28 ? "W" : null)),
  },
  "skin.bear.honey": { species: "animal.bear", colors: { 4: "#f2c67e", 5: "#d79a4a", 6: "#ad7432", o: "#fbe2b4" } },
  "skin.fox.arctic": { species: "animal.fox", colors: { 4: "#ffffff", 5: "#f2f2f4", 6: "#cfd2da", D: "#8a8f9c" } },
  "skin.fox.fennec": { species: "animal.fox", colors: { 4: "#fff1d6", 5: "#f2d3a2", 6: "#d4ae76", D: "#b4865a" } },
  "skin.wolf.black": { species: "animal.wolf", colors: { 4: "#6c6a74", 5: "#4a4852", 6: "#35333c", D: "#26242c", W: "#9a98a3" }, eye: "z" },
  "skin.wolf.red": { species: "animal.wolf", colors: { 4: "#f3cfa8", 5: "#c98a5a", 6: "#a2683e", D: "#7a4a2e" } },
  "skin.tiger.golden": { species: "animal.tiger", colors: { 4: "#fff0c8", 5: "#f6d38a", 6: "#dcae5e", K: "#c0803e" } },
  "skin.tiger.blossom": { species: "animal.tiger", colors: { 4: "#ffe6ef", 5: "#ffbcd2", 6: "#ec93b2", K: "#b0507a" } },
  "skin.lion.dark": { species: "animal.lion", colors: { J: "#4a3426", j: "#2c1e16" } },
  "skin.lion.cream": { species: "animal.lion", colors: { 4: "#fff3d8", 5: "#f2dcae", 6: "#d4ba86", J: "#e8b870", j: "#c08a4a" } },
  "skin.eagle.gray": { species: "animal.eagle", colors: { 4: "#b9bec8", 5: "#868c99", 6: "#636874" } },
  "skin.eagle.red": { species: "animal.eagle", colors: { 4: "#d8895e", 5: "#a85536", 6: "#7c3a26", W: "#ffe6cf" } },
  "skin.turtle.star": {
    species: "animal.turtle",
    colors: { 4: "#5e5a4e", 5: "#3f3b33", 6: "#2c2924", D: "#f2c94c" },
    // 별 거북: 짙은 등딱지에 노란 무늬 줄
  },
  "skin.turtle.pink": { species: "animal.turtle", colors: { 4: "#ffe0ec", 5: "#f7a8c4", 6: "#d97a9e", D: "#b85a80" } },
  "skin.cheetah.cream": { species: "animal.cheetah", colors: { 4: "#fff6e4", 5: "#f6e2bc", 6: "#d9c08e", K: "#9a7a52" } },
  "skin.cheetah.silver": { species: "animal.cheetah", colors: { 4: "#f0f1f4", 5: "#c9ccd4", 6: "#a2a7b2", K: "#3d3f48" } },
  "skin.leopard.amber": { species: "animal.leopard", colors: { 4: "#ffd08a", 5: "#e8963e", 6: "#c0702a", C: "#9a4a1e" } },
  "skin.leopard.cloud": {
    species: "animal.leopard",
    colors: { 4: "#e9e2cf", 5: "#c9bb98", 6: "#a8996f", K: "#4a4434", C: "#8a7a58" },
    // 구름표범: 무늬 위에 큰 구름 얼룩을 더한다
    pattern: (p, geo) => paintBody(p, (x, y) => (!inFace(geo, x, y) && cellHash(Math.floor(x / 3), Math.floor(y / 3), 3) === 0 && (x + y) % 3 !== 0 ? "C" : null)),
  },
  "skin.deer.sika": {
    species: "animal.deer",
    colors: { 4: "#e9a874", 5: "#c77a44", 6: "#9e5a30" },
    // 꽃사슴: 다 자라도 등에 흰 점
    pattern: (p, { bx, by, bw, bh }) => paintBody(p, (x, y) => (y + 0.5 < by && Math.abs(x + 0.5 - bx) < bw * 0.85 && y + 0.5 > by - bh && (x * 3 + y * 5) % 6 === 0 ? "W" : null)),
  },
  "skin.deer.red": { species: "animal.deer", colors: { 4: "#c98a6a", 5: "#9a5a3e", 6: "#74402a", o: "#e6c2a8" } },
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
  // ===== 야생 동물 특별 진화 (2026-10-12) =====
  // 판다곰: 흰 몸에 까만 다리·귀·눈가·어깨띠
  panda_bear: {
    species: "animal.bear",
    colors: { 4: "#ffffff", 5: "#f5f3f0", 6: "#d8d4cf", K: "#2f2a33", o: "#f5f3f0", D: "#2f2a33" },
    eye: "w",
    pattern: (p, { bx, by, bw, bh, hx, hy, hr }) => {
      paintBody(p, (x, y) => {
        // 다리 (몸 아래)·어깨띠·귀
        if (y + 0.5 > by + bh * 0.55) return "K";
        if (Math.abs(x + 0.5 - (bx + bw * 0.45)) < bw * 0.22 && y + 0.5 > by - bh * 0.9) return "K";
        if (y + 0.5 < hy - hr * 0.8 && Math.abs(x + 0.5 - hx) < hr * 1.2) return "K";
        return null;
      });
      patch(p, hx + hr * 0.2, hy - hr * 0.2, Math.max(1, hr * 0.32), Math.max(1, hr * 0.32), "K");
    },
  },
  // 북극곰: 새하얀 털에 얼음빛 그늘
  polar_bear: {
    species: "animal.bear",
    colors: { 4: "#ffffff", 5: "#f4f6f8", 6: "#c9d9e6", o: "#ffffff", D: "#2f2a33" },
  },
  // 은여우: 은빛이 섞인 까만 털, 끝이 하얀 꼬리
  silver_fox: {
    species: "animal.fox",
    colors: { 4: "#7c7887", 5: "#4f4b5a", 6: "#3a3744", D: "#26232e" },
    eye: "z",
    pattern: (p) => paintBody(p, (x, y) => (cellHash(x, y, 5) === 0 ? "Y" : null)),
  },
  // 구미호: 하얀 털, 여러 갈래 꼬리, 푸른 여우불
  nine_tailed: {
    species: "animal.fox",
    colors: { 4: "#ffffff", 5: "#fbf6ee", 6: "#e4d6c2", D: "#f2a65a" },
    extra: (p, { bx, by, bw, bh }, g) => {
      const len = sz([0.45, 1.05], g);
      const x = bx - bw * 0.85;
      const y = by - bh * 0.25;
      const w = Math.max(0.7, g.u * 0.17);
      // 위로 부채처럼 펼친 꼬리 셋 (본래 꼬리까지 넷), 끝은 금빛
      for (const a of [0.5, 0.95, 1.4]) {
        const ex = x - Math.cos(a) * len;
        const ey = Math.max(2 + w, y - Math.sin(a) * len);
        thick(p, x, y, ex, ey, w, "5");
        p.ellipse(ex, ey, w * 0.8, w * 0.8, "z");
      }
      // 여우불
      const fx = Math.round(x - len * 0.2);
      const fy = Math.max(1, Math.round(y - len * 1.05));
      p.px(fx, fy, "I").px(fx, fy + 1, "i").px(fx - 1, fy + 1, "v");
    },
  },
  // 설원 늑대: 눈처럼 하얀 털, 얼음빛 눈
  snow_wolf: {
    species: "animal.wolf",
    colors: { 4: "#ffffff", 5: "#eef3f8", 6: "#c3d2e2", D: "#b4c6da", W: "#ffffff" },
    eye: "v",
  },
  // 백호: 하얀 몸에 짙은 줄무늬, 파란 눈
  white_tiger: {
    species: "animal.tiger",
    colors: { 4: "#ffffff", 5: "#f5f2ec", 6: "#d4d0ca", K: "#3d3a46" },
    eye: "v",
  },
  // 백사자: 크림빛 하얀 몸과 갈기
  white_lion: {
    species: "animal.lion",
    colors: { 4: "#ffffff", 5: "#f4ecdc", 6: "#d6c8ae", J: "#f0d9a8", j: "#c9a874", o: "#ffffff" },
    eye: "v",
  },
  // 황금 독수리: 금빛 깃털에 반짝이 무늬
  golden_eagle: {
    species: "animal.eagle",
    colors: { 4: "#ffe28e", 5: "#eeb23e", 6: "#bb7c1e", W: "#fff4c8", Y: "#fff4c8", y: "#f2d488", o: "#fff0a8", O: "#d99a36" },
    pattern: (p, { bx, by, bw, bh }) => paintBody(p, (x, y) => ((x * 3 + y * 5) % 9 === 0 && Math.abs(x + 0.5 - bx) < bw * 0.8 && Math.abs(y + 0.5 - by) < bh * 0.8 ? "Z" : null)),
  },
  // 불사조: 불꽃빛 몸, 머리 위 불꽃 볏, 길게 늘어진 꼬리 깃
  phoenix: {
    species: "animal.eagle",
    colors: { 4: "#ffc46a", 5: "#f2643a", 6: "#b83a2a", W: "#ffd36e", Y: "#ffd0a0", y: "#f59a6a", D: "#ffd36e" },
    extra: (p, { bx, by, bw, bh, hx, hy, hr }, g) => {
      // 꼬리 깃 (불꽃 세 가닥)
      const len = sz([0.4, 1.1], g);
      const x = bx - bw * 0.6;
      const y = by + bh * 0.4;
      for (const [dy, c] of [[-0.35, "z"], [0, "N"], [0.25, "K"]] as const) thick(p, x, y, x - len, Math.min(FEET - 1, y + len * (0.15 + dy)), Math.max(0.5, g.u * 0.08), c);
      // 불꽃 볏
      const top = Math.round(hy - hr);
      const cx = Math.round(hx - hr * 0.2);
      p.px(cx, top - 1, "N").px(cx - 1, top - 2, "z").px(cx + 1, top - 2, "N");
      if (g.u >= 5) p.px(cx, top - 3, "z").px(cx - 2, top - 1, "N");
    },
  },
  // 황금 거북: 금빛 등딱지에 반짝이
  golden_turtle: {
    species: "animal.turtle",
    colors: { 4: "#fff1a0", 5: "#f6bf2e", 6: "#c47e16", D: "#a8640f", o: "#ffe8a8", O: "#e0b464" },
    pattern: (p) => paintBody(p, (x, y) => ((x * 3 + y * 5) % 7 === 0 ? "Z" : null)),
  },
  // 킹치타: 점이 이어져 굵은 얼룩과 등줄무늬
  king_cheetah: {
    species: "animal.cheetah",
    colors: { 4: "#ffe0a0", 5: "#eeb557", 6: "#c98f3c" },
    pattern: (p, geo) => {
      paintBody(p, (x, y) => (!inFace(geo, x, y) && cellHash(Math.floor(x / 2), Math.floor(y / 2), 3) === 0 ? "K" : null));
      for (let x = Math.round(geo.bx - geo.bw * 0.9); x <= Math.round(geo.bx + geo.bw * 0.6); x++) {
        const y = bodyTop(p, x);
        if (y > 0) p.px(x, y, "K");
      }
    },
  },
  // 흑표범: 까만 털에 희미한 무늬, 노란 눈
  black_panther: {
    species: "animal.leopard",
    colors: { 4: "#5d5868", 5: "#3b3644", 6: "#2a2631", K: "#221e28", C: "#332e3b", W: "#4a4552", o: "#8a6a7a" },
    eye: "z",
  },
  // 눈표범: 하얀 털에 회색 꽃무늬
  snow_leopard: {
    species: "animal.leopard",
    colors: { 4: "#ffffff", 5: "#ebeae6", 6: "#c9c6c0", K: "#5a5560", C: "#b6b2ac" },
    eye: "v",
  },
  // 은빛 사슴: 은빛 털, 수정처럼 빛나는 하늘색 뿔
  silver_deer: {
    species: "animal.deer",
    colors: { 4: "#ffffff", 5: "#e3e8f0", 6: "#b4bdcc", b: "#a9def5", n: "#6db2d6", o: "#ffffff" },
    pattern: (p) => paintBody(p, (x, y) => ((x * 5 + y * 3) % 11 === 0 ? "I" : null)),
  },
  // 빛나는 순록: 크고 넓은 뿔, 하얀 목털, 빨갛게 빛나는 코 (암수 모두 뿔이 있다)
  glowing_reindeer: {
    species: "animal.deer",
    colors: { 4: "#c9a27e", 5: "#9a7452", 6: "#76563a", b: "#e8d4b0", n: "#bfa47e", W: "#ffffff" },
    extra: (p, geo, g) => {
      const { hx, hy, hr, bx, bw, by, bh } = geo;
      // 하얀 목털
      p.ellipse(bx + bw * 0.85, by - bh * 0.6, Math.max(1, hr * 0.6), Math.max(1, hr * 0.7), "W");
      // 큰 뿔 (아기는 작게, 원래 뿔은 덮는다)
      if (g.t === 1) antlers(p, geo, g, "grand", "b", "n");
      else antlers(p, geo, g, "small", "b", "n");
      // 빨간 코 (빛)
      const nx = Math.round(hx + hr * 1.25);
      const ny = Math.round(hy + hr * 0.25);
      p.rect(nx - 1, ny - 1, 2, 2, "N").px(nx - 1, ny - 1, "K");
    },
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
function animalRows(assetKey: string, stage: AnimalStage, skinKey?: string | null, size: AnimalDisplaySize = "normal", look: AnimalLook = {}, pose: FlyPose | null = null): Rows {
  const variantKey = variantFits(look.variant, assetKey) ? look.variant! : null;
  const sex = look.sex ?? null;
  const key = `${assetKey}|${stage}|${skinKey ?? ""}|${size}|${sex ?? ""}|${variantKey ?? ""}|${pose ?? ""}`;
  const hit = rowsCache.get(key);
  if (hit) return hit;
  const variant = variantKey ? ANIMAL_VARIANT_ART[variantKey] : null;
  // 특별한 동물은 스킨을 입지 않는다
  const skin = !variant && skinKey && skinFits(skinKey, assetKey) ? ANIMAL_SKINS[skinKey] : null;
  const { p, geo, l, r, colors } = drawArt(assetKey, { u: animalRadius(assetKey, stage, size), t: MATURITY[stage], sex, pose }, skin, stage === "adult", variant);
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

/** 나는 동물(독수리)의 걷기 칸 = 날갯짓: 2 날개 위, 3 펼침, 4 날개 아래 (PET_WALK_FRAMES 2·3·4·3 순서로 퍼덕인다) */
const FLY_POSES: Record<number, FlyPose> = { 2: "up", 3: "glide", 4: "down" };

/** 이 동물이 따라다닐 때 나는지 (독수리) */
export function animalFlies(assetKey: string): boolean {
  return !!ANIMALS[assetKey]?.fly;
}

/**
 * 따라다니는 걸음새 (2026-10-12 "독수리는 날고 거북이는 느리게"). 광장 scene.ts와 우리 집 room-resident.tsx가 같이 쓴다.
 * stride = 걷기 그림 한 칸에 걷는 거리(시간)의 배수 (클수록 다리를 천천히 놀린다), lift = 걷기 칸마다 띄우는 높이(도트 칸, PET_WALK_FRAMES 순서),
 * speed = 가장 빠른 걸음의 배수 (작으면 주인보다 느려서 조금씩 뒤처졌다가 주인이 서면 따라붙는다)
 */
export type PetGait = { stride: number; lift: readonly number[]; speed: number };
const GAITS: Record<string, PetGait> = {
  // 거북이: 통통 뛰지 않고 느릿느릿 (주인보다 조금 느리다)
  "animal.turtle": { stride: 2.2, lift: [0, 0, 0, 0], speed: 0.6 },
  // 독수리: 날개를 퍼덕이며 주인 머리 높이쯤 떠서 날아온다
  "animal.eagle": { stride: 1.4, lift: [4, 5, 4, 3], speed: 1.2 },
  // 용: 큰 날개로 천천히 퍼덕이며 주인 옆을 난다
  "animal.dragon": { stride: 1.7, lift: [3, 4, 3, 2], speed: 1.1 },
};
const WALK_GAIT: PetGait = { stride: 1, lift: PET_WALK_LIFT, speed: 1 };
/** 이 동물의 걸음새 (늘 같은 객체를 돌려준다: 화면 쪽 의존성 목록에 넣어도 된다) */
export function petGait(assetKey: string): PetGait {
  return GAITS[assetKey] ?? WALK_GAIT;
}

/** 따라다니는 동물 그림판 SVG (가로 5칸 × 세로 2줄, 한 칸 32칸 × scale). 나는 동물은 걷기 칸이 날갯짓 그림이다 */
export function petSheetSvg(assetKey: string, skinKey: string | null | undefined, scale: number, size: AnimalDisplaySize = "normal", look: PetLook = {}): string {
  const { rows, colors, mid } = animalRows(assetKey, petStage(look), skinKey, size, look);
  const fly = animalFlies(assetKey);
  let body = "";
  for (let f = 0; f < PET_SHEET_FRAMES; f++) {
    const right = fly && FLY_POSES[f] ? animalRows(assetKey, petStage(look), skinKey, size, look, FLY_POSES[f]).rows : petFrame(rows, mid, f);
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
