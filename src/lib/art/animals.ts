// 동물 농장 동물 그림 (도트, 2026-10-09 "남은 그림도 도트로"). 캐릭터처럼 코드로 그린다.
// 32 × 32 칸 도화지, 발바닥이 y=29. 단계(아기·청소년·어른)마다 몸 크기 r을 달리해 새로 그린다 (줄여서 흐려지지 않게).
// 어른은 머리에 리본을 단다. 화면에서는 32의 정수배(64·96px)로 보여야 도트가 고르다 (fitSvg).
// 동물마다 크기가 다르다 (사용자 요청 2026-10-11 "작은 동물은 작게 큰 동물은 크게"): 도화지·도트 배율은 모두 같고
// 몸 반지름만 ANIMAL_SIZE대로 달리 그린다. 그래서 어디서 보든(광장·우리 집·농장) 캐릭터와 견준 크기가 같다.
import type { AnimalStage } from "@/lib/farm";
import { type Colors, fitSvg, flipX, Pix, type Sprite, spriteRects, svgDataUri } from "./pixel";

export type AnimalTier = "small" | "medium" | "large";

/**
 * 동물 크기 표 (한 곳에서 정한다). r = 어른 몸 반지름(칸, 32칸 도화지), 캐릭터(24칸 틀, 키 약 22칸)와 견주어 정했다.
 * 단계가 셋(아기·청소년·어른)이라 r은 5 이상 (아기 3칸 < 청소년 < 어른). 작은 5~6, 중간 7~8, 큰 10~11
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

/** 이 동물·단계의 몸 반지름 (칸). 아기 ≤ 청소년 ≤ 어른, 가장 작아도 3칸 (그보다 작으면 얼굴을 못 그린다) */
export function animalRadius(assetKey: string, stage: AnimalStage): number {
  const adult = (ANIMAL_SIZE[assetKey] ?? DEFAULT_SIZE).r;
  if (stage === "adult") return adult;
  const baby = Math.max(3, Math.round(adult * 0.55));
  return stage === "baby" ? baby : Math.min(adult, Math.max(baby, Math.round(adult * 0.75)));
}

type Draw = (p: Pix, r: number, cy: number) => void;

/** 눈 두 개와 볼터치 (몸이 크면 눈이 2칸 높이, 반짝이 한 칸) */
function face(p: Pix, r: number, cy: number, adult: boolean, eye = "#") {
  const ey = Math.round(cy - r * 0.15);
  const dx = Math.max(2, Math.round(r * 0.4));
  const [lx, rx] = [15 - dx, 16 + dx];
  if (r >= 8) {
    // 큰 눈: 2×2칸, 왼쪽 위에 반짝이
    p.rect(lx - 1, ey - 1, 2, 2, eye).rect(rx, ey - 1, 2, 2, eye).px(lx - 1, ey - 1, "w").px(rx, ey - 1, "w");
  } else {
    p.px(lx, ey, eye).px(rx, ey, eye);
    // 어른은 작은 동물이어도 눈이 2칸 높이·볼터치 (단계가 보이게)
    if (r >= 7 || adult) p.px(lx, ey - 1, eye).px(rx, ey - 1, eye);
  }
  if (r >= 7 || (adult && r >= 5)) p.px(lx - 2, ey + 2, "p").px(rx + 2, ey + 2, "p");
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
      // 귀 사이를 2칸 넘게 띄운다 (작은 토끼는 귀 사이가 외곽선으로 메워져 검은 덩어리가 된다)
      const ex = Math.max(3, Math.round(r * 0.45));
      for (const x of [16 - ex - 1, 16 + ex]) {
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
  // ===== 분양 동물 (사용자 요청 2026-10-11 "펫 종류": 코인으로 데려온다, 알에서는 안 나온다) =====
  // 햄스터: 동글 납작한 몸, 흰 배, 작은 동그란 귀
  "animal.hamster": {
    colors: { 4: "#fff6e8", 5: "#f2b26b", 6: "#d98d4a", o: "#ffb3c7" },
    draw: (p, r, cy) => {
      const top = Math.round(cy - r);
      const ex = Math.round(r * 0.6) + 1;
      p.ellipse(16 - ex + 0.5, top + 1, 1.8, 1.8, "5").ellipse(16 + ex - 0.5, top + 1, 1.8, 1.8, "5");
      p.ellipse(16, cy + 0.5, r + 1.5, r - 0.5, "5");
      p.ellipse(16, cy + r * 0.45, r * 0.75, r * 0.5, "4");
      p.px(16 - ex, top + 1, "o").px(15 + ex, top + 1, "o");
      // 코·발
      p.px(15, Math.round(cy + r * 0.1), "o").px(16, Math.round(cy + r * 0.1), "o");
      p.rect(12, FEET, 2, 1, "o").rect(18, FEET, 2, 1, "o");
    },
  },
  // 아기 고양이: 뾰족 귀, 이마 줄무늬, 꼬리
  "animal.kitten": {
    colors: { 4: "#fff0dc", 5: "#ffc58a", 6: "#e89b5e", o: "#ff9fb8", D: "#e0843f" },
    draw: (p, r, cy) => {
      const top = Math.round(cy - r);
      const dx = Math.round(r * 0.55);
      p.stamp(["5..", "55.", "5o5", "555"], 16 - dx - 2, top - 2).stamp(["..5", ".55", "5o5", "555"], 15 + dx, top - 2);
      // 꼬리 (오른쪽 위로 말림)
      p.rect(16 + r, Math.round(cy), 2, 2, "6").rect(17 + r, Math.round(cy) - 3, 2, 3, "6");
      p.ellipse(16, cy, r + 0.5, r, "5");
      p.ellipse(16, cy + r * 0.45, r * 0.6, r * 0.45, "4");
      // 이마 줄무늬
      p.vline(15, top + 1, top + 2, "D").vline(17, top + 1, top + 2, "D").px(16, top + 1, "D");
      p.px(16, Math.round(cy + r * 0.15), "o");
      p.rect(12, FEET - 1, 3, 2, "4").rect(18, FEET - 1, 3, 2, "4");
    },
  },
  // 강아지: 늘어진 갈색 귀, 한쪽 눈 얼룩, 까만 코
  "animal.puppy": {
    colors: { 4: "#ffffff", 5: "#fff3e2", 6: "#e6d3bb", D: "#b7835a", o: "#ff9fb8" },
    draw: (p, r, cy) => {
      p.ellipse(16, cy, r + 0.5, r, "5");
      p.ellipse(16, cy + r * 0.5, r * 0.55, r * 0.4, "4");
      // 눈 얼룩
      p.ellipse(16 + r * 0.42, cy - r * 0.2, r * 0.3, r * 0.3, "D");
      // 늘어진 귀
      const ey = cy - r * 0.35;
      p.ellipse(16 - r + 0.5, ey + 1, 2, r * 0.5, "D").ellipse(16 + r - 0.5, ey + 1, 2, r * 0.5, "D");
      // 코와 혀
      const ny = Math.round(cy + r * 0.2);
      p.rect(15, ny, 2, 1, "#");
      if (r >= 5) p.px(16, ny + 2, "o");
      p.rect(12, FEET - 1, 3, 2, "4").rect(18, FEET - 1, 3, 2, "4");
    },
  },
  // 아기 양: 몽글몽글 털 가장자리, 살구색 얼굴, 옆 귀
  "animal.lamb": {
    colors: { 4: "#ffffff", 5: "#fbf6ec", 6: "#e4dccd", D: "#f2d0b4", d: "#d9ac8c" },
    draw: (p, r, cy) => {
      p.ellipse(16, cy, r, r - 0.5, "5");
      // 털 뭉치 (가장자리를 둘러 몽글하게)
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        p.ellipse(16 + Math.cos(a) * (r - 1), cy + Math.sin(a) * (r - 1.5), 2.2, 2.2, "5");
      }
      p.ellipse(14, cy - r * 0.55, r * 0.35, r * 0.25, "4");
      // 얼굴과 귀
      p.ellipse(16, cy + r * 0.05, r * 0.55, r * 0.5, "D");
      p.ellipse(16 - r * 0.62, cy - r * 0.2, 1.8, 1, "d").ellipse(16 + r * 0.62, cy - r * 0.2, 1.8, 1, "d");
      p.px(15, Math.round(cy + r * 0.3), "d").px(16, Math.round(cy + r * 0.3), "d");
      p.rect(12, FEET - 1, 2, 2, "d").rect(18, FEET - 1, 2, 2, "d");
    },
  },
  // 조랑말: 갈기 앞머리, 뾰족 귀, 밝은 주둥이와 콧구멍, 발굽
  "animal.pony": {
    colors: { 4: "#e9c49b", 5: "#d49a64", 6: "#b07a4a", D: "#7a4a2e", o: "#f3dcc0", O: "#d7b896" },
    draw: (p, r, cy) => {
      const top = Math.round(cy - r);
      const dx = Math.round(r * 0.45);
      p.stamp([".5", "55", "55", "55"], 16 - dx - 2, top - 3).stamp(["5.", "55", "55", "55"], 16 + dx, top - 3);
      p.ellipse(16, cy, r + 0.5, r, "5");
      p.ellipse(14, cy - r * 0.5, r * 0.4, r * 0.25, "4");
      // 갈기 (머리 위·앞머리)
      p.ellipse(16, top + 1.5, r * 0.45, 2, "D").rect(15, top - 1, 3, 2, "D").px(16, top + 3, "D");
      // 주둥이
      const ny = cy + r * 0.45;
      p.ellipse(16, ny, r * 0.5, r * 0.32, "o");
      p.hline(Math.round(16 - r * 0.4), Math.round(15 + r * 0.4), Math.round(ny + r * 0.28), "O");
      p.px(14, Math.round(ny), "#").px(17, Math.round(ny), "#");
      // 발굽
      p.rect(11, FEET - 1, 3, 2, "D").rect(18, FEET - 1, 3, 2, "D");
    },
  },
};

// 어른이 되면 다는 리본 (외곽선 포함 도장). 작은 동물은 작은 리본
const RIBBON: Sprite = [".#...#.", "#V#.#V#", "#VV#VV#", "#VVRVV#", "#VV#VV#", "#V#.#V#", ".#...#."];
const SMALL_RIBBON: Sprite = ["##.##", "#V#V#", "#VRV#", "#V#V#", "##.##"];

// ===== 스킨 (사용자 요청 2026-10-11 "펫 종류별로 스킨") =====
// 동물 종류마다 코인으로 사는 색·무늬. DB(animal_skins.asset_key)에는 키만, 실제 색·무늬는 여기서 그린다.
// colors는 그 동물의 색 칸(4·5·6·o·D…)을 바꿔 칠하고, pattern은 몸 위에 무늬를 더한다 (몸 칸 4·5·6에만 칠한다)
type Skin = { species: string; colors?: Colors; eye?: string; pattern?: Draw };

/** 몸 칸(4·5·6) 위에만 타원 무늬 */
function patch(p: Pix, cx: number, cy: number, rx: number, ry: number, c: string) {
  const body = new Set(["4", "5", "6"]);
  const mark = new Pix(32, 32).ellipse(cx, cy, rx, ry, c);
  p.map((cell, x, y) => (body.has(cell) && mark.get(x, y) === c ? c : cell));
}

export const ANIMAL_SKINS: Record<string, Skin> = {
  "skin.chick.choco": { species: "animal.chick", colors: { 4: "#f1d2a8", 5: "#d9a066", 6: "#b67a45" } },
  "skin.chick.mint": { species: "animal.chick", colors: { 4: "#e2fff3", 5: "#9fe6c8", 6: "#6cc3a2" } },
  "skin.bunny.gray": { species: "animal.bunny", colors: { 4: "#eef0f4", 5: "#c9ccd6", 6: "#a3a7b5" } },
  "skin.bunny.patch": {
    species: "animal.bunny",
    colors: { D: "#a8714a" },
    pattern: (p, r, cy) => {
      patch(p, 16 - r * 0.45, cy - r * 0.3, r * 0.45, r * 0.4, "D");
      patch(p, 16 + r * 0.6, cy + r * 0.55, r * 0.35, r * 0.3, "D");
    },
  },
  "skin.hamster.snow": { species: "animal.hamster", colors: { 4: "#ffffff", 5: "#e9e6ea", 6: "#c4bfc8" } },
  "skin.hamster.choco": { species: "animal.hamster", colors: { 4: "#f4e2cc", 5: "#a06c48", 6: "#7c5236" } },
  "skin.kitten.black": { species: "animal.kitten", colors: { 4: "#8a8096", 5: "#5a5266", 6: "#433c4d", D: "#4a4256" }, eye: "z" },
  "skin.kitten.calico": {
    species: "animal.kitten",
    colors: { 4: "#ffffff", 5: "#fbf6ef", 6: "#e3d8cb", D: "#f0a35e", C: "#f0a35e", K: "#5a5060" },
    pattern: (p, r, cy) => {
      patch(p, 16 - r * 0.55, cy - r * 0.55, r * 0.45, r * 0.4, "K");
      patch(p, 16 + r * 0.6, cy - r * 0.45, r * 0.4, r * 0.35, "C");
      patch(p, 16 + r * 0.55, cy + r * 0.45, r * 0.35, r * 0.3, "K");
    },
  },
  "skin.puppy.shiba": { species: "animal.puppy", colors: { 4: "#fff6ea", 5: "#f0a85c", 6: "#d0843c", D: "#c97a35" } },
  "skin.puppy.choco": { species: "animal.puppy", colors: { 4: "#d8b08e", 5: "#a87650", 6: "#855a3a", D: "#6b4430" } },
  "skin.piglet.spot": {
    species: "animal.piglet",
    colors: { K: "#7a5a62" },
    pattern: (p, r, cy) => {
      patch(p, 16 - r * 0.55, cy + r * 0.1, r * 0.25, r * 0.22, "K");
      patch(p, 16 + r * 0.5, cy - r * 0.55, r * 0.22, r * 0.2, "K");
      patch(p, 16 + r * 0.6, cy + r * 0.5, r * 0.2, r * 0.18, "K");
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
    pattern: (p, r, cy) => {
      // 가로 줄무늬 (2칸 띄워 1칸), 주둥이는 빼고
      const body = new Set(["4", "5", "6"]);
      p.map((c, x, y) => (body.has(c) && y > cy - r + 2 && (y - Math.round(cy)) % 3 === 0 && Math.abs(x - 15.5) > 1 ? "K" : c));
    },
  },
};

/** 이 스킨을 이 동물에 입힐 수 있는지 (그림이 있고 종류가 맞는지) */
export function skinFits(skinKey: string, assetKey: string): boolean {
  return Object.hasOwn(ANIMAL_SKINS, skinKey) && ANIMAL_SKINS[skinKey].species === assetKey;
}

function animalRows(assetKey: string, stage: AnimalStage, skinKey?: string | null): { rows: string[]; colors: Colors } {
  const art = ANIMALS[assetKey] ?? ANIMALS["animal.chick"];
  const skin = skinKey && skinFits(skinKey, assetKey) ? ANIMAL_SKINS[skinKey] : null;
  const r = animalRadius(assetKey, stage);
  const cy = FEET - r + 0.5;
  const p = new Pix(32, 32);
  art.draw(p, r, cy);
  skin?.pattern?.(p, r, cy);
  // 몸 오른쪽 아래 가장자리에 그늘 (밖과 맞닿은 칸)
  p.map((c, x, y) => (c === "5" && (p.get(x + 1, y + 1) === "." || p.get(x, y + 1) === ".") ? "6" : c));
  face(p, r, cy, stage === "adult", skin?.eye);
  p.outline();
  if (stage === "adult") {
    if (r >= 7) p.stamp(RIBBON, Math.round(16 + r * 0.25), Math.round(cy - r) - 4);
    else p.stamp(SMALL_RIBBON, Math.round(16 + r * 0.25), Math.round(cy - r) - 3);
  }
  p.shadow(16, FEET + 1.5, r + 2, 1.5);
  return { rows: p.rows(), colors: { ...art.colors, ...skin?.colors } };
}

/** 그림 키에 맞는 동물 그림이 있는지 (블로그 전시 동물은 없으면 그리지 않는다, BLOG-04 / research R-20) */
export function hasAnimalArt(assetKey: string): boolean {
  return Object.hasOwn(ANIMALS, assetKey);
}

/** 동물 SVG. 단계가 낮을수록, 작은 동물일수록 작다 (발바닥 기준, ANIMAL_SIZE). size = 화면에 보일 한 변 px (32의 배수면 도트가 고르다).
 *  skinKey: 입힌 스킨 (없거나 종류가 안 맞으면 기본 색) */
export function animalSvg(assetKey: string, stage: AnimalStage, size = 64, skinKey?: string | null): string {
  const { rows, colors } = animalRows(assetKey, stage, skinKey);
  return fitSvg(rows, size, { colors });
}

const extents = new Map<string, { half: number; height: number }>();
/** 어른 동물이 도화지(32칸)에서 실제로 차지하는 반폭(가운데에서 가장 먼 칸까지)과 키(발바닥에서 맨 위 칸까지), 그림자 빼고 */
function animalExtent(assetKey: string) {
  const cached = extents.get(assetKey);
  if (cached) return cached;
  let half = 0;
  let top = FEET;
  animalRows(assetKey, "adult").rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++)
      if (row[x] !== "." && row[x] !== ":") {
        half = Math.max(half, Math.abs(x + 0.5 - 16));
        top = Math.min(top, y);
      }
  });
  const ext = { half: Math.ceil(half), height: FEET + 1 - top };
  extents.set(assetKey, ext);
  return ext;
}

/** 반폭(칸). 따라다니는 거리를 정할 때 쓴다 (귀·꼬리까지 그린 그대로 잰다) */
export function animalHalfWidth(assetKey: string): number {
  return animalExtent(assetKey).half;
}

/** 키(칸). 캐릭터(약 20칸)보다 크면 옆에 설 때 이름표에 머리가 닿지 않게 더 떨어진다 */
export function animalHeight(assetKey: string): number {
  return animalExtent(assetKey).height;
}

// ===== 따라다니는 움직임 (사용자 요청 2026-10-11 "펫 따라다니는 모션") =====
// 그림판: 가로 5칸 × 세로 2줄(오른쪽 보기, 왼쪽 보기 = 좌우 뒤집기). 칸은 32×32.
// 0 서 있기, 1 숨쉬기(한 칸 납작), 2 착지(납작), 3 걷기(몸이 가는 쪽으로 한 칸 기욺), 4 뛰어오름(한 칸 늘어남 + 기욺)
// 서 있을 때는 0·1을 번갈아(숨쉬기), 걸을 때는 2·3·4·3을 돌린다 (뛰어오르는 높이는 쓰는 쪽에서 정한다)
export const PET_SHEET_FRAMES = 5;
export const PET_IDLE_FRAMES = [0, 1] as const;
export const PET_WALK_FRAMES = [2, 3, 4, 3] as const;
/** 걷기 칸마다 띄우는 높이 (도트 칸, PET_WALK_FRAMES와 같은 순서) */
export const PET_WALK_LIFT = [0, 1, 2, 1] as const;
export type PetFacing = "right" | "left";

/** 몸 가운데 줄(이 줄을 빼거나 한 번 더 그려 납작·늘어남을 만든다) */
function middleRow(assetKey: string, stage: AnimalStage) {
  return Math.round(FEET - animalRadius(assetKey, stage) + 0.5);
}

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
export function petSheetSvg(assetKey: string, skinKey: string | null | undefined, scale: number): string {
  const { rows, colors } = animalRows(assetKey, "adult", skinKey);
  const mid = middleRow(assetKey, "adult");
  let body = "";
  for (let f = 0; f < PET_SHEET_FRAMES; f++) {
    const right = petFrame(rows, mid, f);
    body += spriteRects(right, colors, f * 32, 0) + spriteRects(flipX(right), colors, f * 32, 32);
  }
  const w = 32 * PET_SHEET_FRAMES;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 64" width="${w * scale}" height="${64 * scale}" shape-rendering="crispEdges">${body}</svg>`;
}

export function petSheetDataUri(assetKey: string, skinKey: string | null | undefined, scale: number): string {
  return svgDataUri(petSheetSvg(assetKey, skinKey, scale));
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
