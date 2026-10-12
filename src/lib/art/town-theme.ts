// 마을 테마 (사용자 요청 2026-10-12 "상점에 파는 배경 같은건 눈배경이다 하면 마을에 눈쌓여있고 이런식으로 변경 되나
// 보라색 배경이면 보라색 느낌 마을로 바꾸고"): 꾸미기에서 고른 배경(items.type = background)이 마을의 계절·분위기도 바꾼다.
// 배경 asset_key → 테마 하나. 테마는 그림을 새로 그리지 않고 색만 바꾼다 (도트가 번지지 않게 칸마다 색 계산):
//   1) 바닥(ground.ts)을 구울 때 잔디·하늘·먼 산·먼 숲·물·꽃 팔레트를 바꿔 끼운다
//   2) 구운 바닥과 건물·나무 그림에 색 보정(grade: 곱하기 + 섞기)을 칸마다 한 번 입힌다 (캐릭터는 더 약하게)
//   3) 눈 테마는 지붕·나무 윗면에 눈을 얹고(snowCapPixels) 길에 눈을 흩뿌린다
//   4) 날씨(눈송이·꽃잎·반딧불·별·반짝임)는 화면 위에 도트 알갱이로 (scene.ts)
// 기본(초원)은 지금 마을 그대로. 친구 마을(/town/[slug])은 그 마을 주인의 배경을 따른다.
import { PALETTE, rgbOf } from "./pixel";

export const TOWN_THEME_KEYS = ["meadow", "beach", "snow", "sakura", "night", "space"] as const;
export type TownThemeKey = (typeof TOWN_THEME_KEYS)[number];
export type Weather = "snow" | "petals" | "fireflies" | "stars" | "glints";

type Four = readonly [string, string, string, string];
export type Grade = {
  /** 채널마다 곱하기 (1 = 그대로) */
  mul: readonly [number, number, number];
  /** 그다음 이 색을 amount만큼 섞는다 */
  mix: string;
  amount: number;
};

export type TownTheme = {
  key: TownThemeKey;
  /** 꾸미기·상점에 보이는 이름 */
  name: string;
  /** 잔디 색: 높이(0~3)마다 [밝은, 기본, 짙은, 아주 짙은] */
  grass: Readonly<Record<number, Four>>;
  /** 지평선 위 하늘(위→아래), 먼 산 2색, 먼 숲 3색 */
  sky: Four;
  hills: readonly [string, string];
  farForest: readonly [string, string, string];
  /** 풀밭의 작은 꽃 색 (빈 배열이면 꽃 대신 풀 점) */
  flowers: readonly string[];
  /** 연못 물 [짙은 테두리, 물, 반짝임, 물결] */
  water: Four;
  /** 멀리(북쪽)를 덮는 공기 색 */
  haze: string;
  /** 바닥·건물·나무 색 보정 (null = 그대로). 캐릭터·동물은 charStrength만큼만 */
  grade: Grade | null;
  charStrength: number;
  /** 눈이 쌓인다 (지붕·나무 윗면, 길에 흩뿌림) */
  snow: boolean;
  weather: Weather | null;
  /** 화면 바탕색 (그림이 뜨기 전·바닥 바깥) */
  bg: string;
};

const MEADOW: TownTheme = {
  key: "meadow",
  name: "초원",
  grass: {
    0: ["#a6dc8c", "#86c874", "#6cb062", "#4f8f4f"], // 남쪽 들판 (가장 가깝고 짙다)
    1: [PALETTE.G, PALETTE.e, PALETTE.E, "#5e9f5c"],
    2: ["#bde5a0", "#a2d996", "#86c67e", "#66a565"],
    3: ["#c6e8a6", "#abdc9c", "#8fca84", "#6eaa6a"],
  },
  sky: ["#cfe9f7", "#d9eef8", "#e3f2f8", "#ecf5f2"],
  hills: ["#b7cfe0", "#a3c1d6"],
  farForest: ["#7fae9c", "#6a9c8b", "#5a8c7c"],
  flowers: [PALETTE.w, PALETTE.V, PALETTE.z, PALETTE.U, "#ffb08a"],
  water: [PALETTE.v, PALETTE.i, PALETTE.I, "#bfe8f8"],
  haze: "#dcebf2",
  grade: null,
  charStrength: 0,
  snow: false,
  weather: null,
  bg: "#8fd18a",
};

export const TOWN_THEMES: Readonly<Record<TownThemeKey, TownTheme>> = {
  meadow: MEADOW,
  // 바닷가: 햇살 가득한 연둣빛 풀, 맑은 하늘, 옥빛 연못, 따뜻한 빛. 물결 반짝임
  beach: {
    ...MEADOW,
    key: "beach",
    name: "바닷가",
    grass: {
      0: ["#d3e69a", "#bcd982", "#a1c66c", "#7fa955"],
      1: ["#dcebaa", "#c8df92", "#accd7a", "#8bb262"],
      2: ["#e3eeb4", "#d0e39e", "#b6d486", "#95ba6c"],
      3: ["#e8f1bd", "#d6e7a8", "#bed990", "#9dc176"],
    },
    sky: ["#bfe6ff", "#cdedff", "#dcf3ff", "#ebf9ff"],
    hills: ["#a7d8ee", "#92cbe6"],
    farForest: ["#86c49a", "#70b088", "#5f9f78"],
    flowers: [PALETTE.w, "#ff9e7a", "#ffd36e", "#7fd0ff", PALETTE.V],
    water: ["#2fb2c4", "#72dbe3", "#ecffff", "#a8eef2"],
    haze: "#e6f6fb",
    grade: { mul: [1.04, 1.01, 0.94], mix: "#ffe7aa", amount: 0.07 },
    charStrength: 0.4,
    weather: "glints",
    bg: "#c8df92",
  },
  // 눈 마을: 눈 덮인 땅, 흐린 하늘, 눈 쌓인 먼 숲, 얼어붙은 연못, 지붕·나무 위의 눈, 내리는 눈송이
  snow: {
    ...MEADOW,
    key: "snow",
    name: "눈 마을",
    grass: {
      0: ["#ffffff", "#edf3fa", "#d9e4f0", "#b6c6d9"],
      1: ["#ffffff", "#f1f6fb", "#dfe8f3", "#c0cfe0"],
      2: ["#ffffff", "#f3f7fc", "#e3ebf5", "#c6d4e4"],
      3: ["#ffffff", "#f5f9fd", "#e7eef7", "#cbd8e7"],
    },
    sky: ["#c4d1e2", "#d1dce9", "#dde5ef", "#e9eef5"],
    hills: ["#e9eff7", "#d4deeb"],
    farForest: ["#eef3f9", "#8296ab", "#647b91"],
    flowers: [],
    water: ["#9fc4dc", "#cfe6f3", "#ffffff", "#e4f2fa"],
    haze: "#eef3f9",
    grade: { mul: [0.97, 0.99, 1.05], mix: "#eaf1fb", amount: 0.06 },
    charStrength: 0.35,
    snow: true,
    weather: "snow",
    bg: "#eef3f9",
  },
  // 벚꽃길: 연한 봄 풀, 분홍 하늘·먼 벚꽃 숲, 분홍 꽃이 많은 풀밭, 흩날리는 꽃잎
  sakura: {
    ...MEADOW,
    key: "sakura",
    name: "벚꽃길",
    grass: {
      0: ["#bfe3a2", "#a3d68e", "#88c37b", "#68a565"],
      1: ["#c8e8ad", "#addb98", "#92c983", "#73ac6c"],
      2: ["#d0ecb6", "#b8e0a3", "#9dcf8c", "#7fb474"],
      3: ["#d8f0bf", "#c1e5ad", "#a6d496", "#89bb7d"],
    },
    sky: ["#ffdcea", "#ffe5f0", "#ffeef5", "#fff5f9"],
    hills: ["#f6c6da", "#eab0c8"],
    farForest: ["#f6b9d2", "#e89cbc", "#d085a8"],
    flowers: [PALETTE.V, PALETTE.R, "#ffd1e3", PALETTE.w, PALETTE.V],
    water: ["#7cb7da", "#b5def3", "#fff2f8", "#d8eefa"],
    haze: "#fbe4ee",
    grade: { mul: [1.02, 0.96, 0.99], mix: "#ffc6de", amount: 0.09 },
    charStrength: 0.35,
    weather: "petals",
    bg: "#addb98",
  },
  // 밤의 도시: 어두운 남색 하늘·땅, 짙은 공기, 반딧불이
  night: {
    ...MEADOW,
    key: "night",
    name: "밤의 도시",
    sky: ["#141a3a", "#1d2350", "#282b63", "#343276"],
    hills: ["#3c4280", "#30366c"],
    farForest: ["#2b4a55", "#223e49", "#1b333d"],
    flowers: ["#ffe08a", "#c7d2fe", PALETTE.w],
    water: ["#24406b", "#3a5d8c", "#ffe08a", "#4d72a3"],
    haze: "#2a3060",
    grade: { mul: [0.45, 0.52, 0.8], mix: "#1b2052", amount: 0.12 },
    charStrength: 0.55,
    weather: "fireflies",
    bg: "#2c3a52",
  },
  // 우주: 보랏빛 풀·하늘·먼 숲, 보라 연못, 반짝이는 별
  space: {
    ...MEADOW,
    key: "space",
    name: "우주",
    grass: {
      0: ["#c5afec", "#ab92e0", "#8f76cd", "#6d56ae"],
      1: ["#d1bff2", "#b9a1e8", "#9d84d7", "#7b62bb"],
      2: ["#dacbf5", "#c4afed", "#a991dd", "#886fc4"],
      3: ["#e2d6f8", "#cdbbf1", "#b49ee3", "#957ccc"],
    },
    sky: ["#2e1a6b", "#3d2488", "#4f309b", "#6340ad"],
    hills: ["#8b6cc9", "#7a5bb8"],
    farForest: ["#6b4fa0", "#5b4190", "#4c3580"],
    flowers: ["#f0abfc", PALETTE.w, "#c084fc", "#fde68a", "#f0abfc"],
    water: ["#7d58cf", "#b99bff", "#f5ecff", "#cdb6ff"],
    haze: "#e0d2fa",
    grade: { mul: [0.96, 0.86, 1.06], mix: "#b48cff", amount: 0.12 },
    charStrength: 0.4,
    weather: "stars",
    bg: "#b9a1e8",
  },
};

/** 배경 asset_key("bg.snow") → 마을 테마. 모르는 배경·배경이 없으면 기본(초원) */
export function townThemeOf(backgroundAssetKey: string | null | undefined): TownThemeKey {
  const key = backgroundAssetKey?.startsWith("bg.") ? backgroundAssetKey.slice(3) : "";
  return (TOWN_THEME_KEYS as readonly string[]).includes(key) ? (key as TownThemeKey) : "meadow";
}

export function townTheme(key: string | null | undefined): TownTheme {
  return TOWN_THEMES[(key ?? "meadow") as TownThemeKey] ?? MEADOW;
}

// ===== 칸마다 색 계산 (도트가 번지지 않는다) =====
const mixCache = new Map<string, [number, number, number]>();
const rgb = (hex: string) => {
  let v = mixCache.get(hex);
  if (!v) mixCache.set(hex, (v = rgbOf(hex)));
  return v;
};

/** 한 색에 색 보정을 strength(0~1)만큼 */
export function gradeRgb(r: number, g: number, b: number, grade: Grade | null, strength = 1): [number, number, number] {
  if (!grade || strength <= 0) return [r, g, b];
  const m = rgb(grade.mix);
  const k = grade.amount;
  const out: [number, number, number] = [0, 0, 0];
  const src = [r, g, b];
  for (let c = 0; c < 3; c++) {
    const graded = Math.min(255, src[c] * grade.mul[c]) * (1 - k) + m[c] * k;
    out[c] = Math.round(src[c] + (graded - src[c]) * strength);
  }
  return out;
}

/** RGBA 칸 전체에 색 보정 (투명 칸은 그대로) */
export function gradePixels(data: Uint8ClampedArray, grade: Grade | null, strength = 1): Uint8ClampedArray {
  if (!grade || strength <= 0) return data;
  for (let o = 0; o < data.length; o += 4) {
    if (data[o + 3] === 0) continue;
    const [r, g, b] = gradeRgb(data[o], data[o + 1], data[o + 2], grade, strength);
    data[o] = r;
    data[o + 1] = g;
    data[o + 2] = b;
  }
  return data;
}

const SNOW = rgbOf("#ffffff");
const SNOW_SHADE = rgbOf("#dfe8f3");
/** 고정 난수 (0~1): 눈을 흩뿌리는 자리가 늘 같게 */
export function hashSnow(x: number, y = 0) {
  const s = Math.sin(x * 127.1 + y * 269.5 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
const snowHash = (x: number) => hashSnow(x);

/**
 * 눈 얹기: 도트 한 칸 = scale px인 그림(RGBA, w × h px)에서, 위가 비어 있는 윗면(지붕·나무 머리·담장 위)마다
 * 외곽선 한 칸 아래로 눈을 1~2칸(가끔 3칸 고드름처럼) 얹는다. 외곽선은 남겨 모양이 흐려지지 않는다
 */
export function snowCapPixels(data: Uint8ClampedArray, w: number, h: number, scale: number): Uint8ClampedArray {
  const cols = Math.floor(w / scale);
  const rows = Math.floor(h / scale);
  const solid = (cx: number, cy: number) => cy >= 0 && cy < rows && data[((cy * scale + (scale >> 1)) * w + cx * scale + (scale >> 1)) * 4 + 3] > 128;
  const paint = (cx: number, cy: number, c: readonly number[]) => {
    for (let y = cy * scale; y < (cy + 1) * scale; y++)
      for (let x = cx * scale; x < (cx + 1) * scale; x++) {
        const o = (y * w + x) * 4;
        data[o] = c[0];
        data[o + 1] = c[1];
        data[o + 2] = c[2];
      }
  };
  for (let cx = 0; cx < cols; cx++) {
    const r = snowHash(cx);
    const depth = r < 0.15 ? 3 : r < 0.6 ? 2 : 1;
    for (let cy = 0; cy < rows; cy++) {
      if (!solid(cx, cy) || solid(cx, cy - 1)) continue;
      // 윗면 외곽선(cy) 아래로 눈. 위가 너무 좁은 기둥(양옆이 비어 있음)은 1칸만
      const thin = !solid(cx - 1, cy + 1) && !solid(cx + 1, cy + 1);
      const d = thin ? 1 : depth;
      for (let k = 1; k <= d; k++) {
        if (!solid(cx, cy + k)) break;
        paint(cx, cy + k, k === d && d > 1 ? SNOW_SHADE : SNOW);
      }
    }
  }
  return data;
}
