// "우리 집" 방 안 도트 그림 (2026-10-09 "남은 그림도 도트로"): 벽지·마루 타일, 창문, 문.
// 방 화면(house-room.tsx)은 모두 ROOM_PIXEL(4)배로 그린다. 타일은 16 × 16칸이라 64px마다 되풀이한다.
import { type Colors, Pix, spriteSvg, svgDataUri, type Sprite } from "./pixel";

/** 방 안 도트 한 칸 = 4px */
export const ROOM_PIXEL = 4;

const COLORS: Colors = {
  // 벽지: 크림색 줄무늬 두 가지 + 작은 꽃무늬
  7: "#fff4dc",
  8: "#fbe9c6",
  9: "#f3d9ad",
  // 마루: 판자 두 가지, 밝은 결, 이음매
  D: "#d89a63",
  F: "#cf8f58",
  J: "#e4ab74",
  O: "#a8703f",
};

const WALL: Sprite = [
  "7777777788888888",
  "7777777788888888",
  "7779777788888888",
  "7797977788888888",
  "7779777788888888",
  "7777777788888888",
  "7777777788888888",
  "7777777788888888",
  "7777777788888888",
  "7777777788888888",
  "7777777788888888",
  "7777777788888888",
  "7777777788889888",
  "7777777788898988",
  "7777777788889888",
  "7777777788888888",
];

const FLOOR: Sprite = [
  "JJJJJJJJJJJOJJJJ",
  "DDDDDDDDDDDODDDD",
  "DDDDDDDDDDDODDDD",
  "OOOOOOOOOOOOOOOO",
  "JJJJOJJJJJJJJJJJ",
  "FFFFOFFFFFFFFFFF",
  "FFFFOFFFFFFFFFFF",
  "OOOOOOOOOOOOOOOO",
  "JJJJJJJJJJJJJOJJ",
  "DDDDDDDDDDDDDODD",
  "DDDDDDDDDDDDDODD",
  "OOOOOOOOOOOOOOOO",
  "JJJJJJJJOJJJJJJJ",
  "FFFFFFFFOFFFFFFF",
  "FFFFFFFFOFFFFFFF",
  "OOOOOOOOOOOOOOOO",
];

// 창문: 나무 틀, 하늘이 비치는 유리, 십자 창살, 창턱
const WINDOW: Sprite = (() => {
  const p = new Pix(20, 17);
  p.box(0, 0, 20, 15, "B");
  p.rect(2, 2, 16, 11, "i");
  p.rect(3, 3, 3, 1, "I").rect(3, 4, 1, 2, "I").rect(12, 8, 2, 1, "I");
  p.hline(4, 9, 6, "w").hline(5, 7, 5, "w");
  p.rect(9, 2, 2, 11, "B").rect(2, 7, 16, 1, "B");
  p.vline(1, 1, 13, "Z").hline(1, 18, 1, "Z").vline(18, 1, 13, "b").hline(1, 18, 13, "b");
  p.box(0, 14, 20, 3, "B");
  p.hline(1, 18, 15, "b");
  return p.rows();
})();

// 문: 둥근 위, 판자 두 칸, 손잡이
const DOOR: Sprite = (() => {
  const p = new Pix(16, 28);
  p.ellipse(8, 7, 8, 7, "#").rect(0, 7, 16, 21, "#");
  p.ellipse(8, 7.5, 7, 6.5, "b").rect(1, 7, 14, 20, "b");
  p.vline(1, 6, 26, "B").vline(2, 4, 6, "B");
  p.box(3, 7, 10, 8, "B").box(3, 16, 10, 9, "B");
  p.hline(4, 11, 8, "Z").hline(4, 11, 17, "Z");
  p.vline(8, 2, 26, "n");
  p.rect(11, 15, 2, 2, "z").px(11, 15, "Z");
  return p.rows();
})();

const uri = (rows: Sprite) => svgDataUri(spriteSvg(rows, { scale: ROOM_PIXEL, colors: COLORS }));

/** 방 그림 data URI (모두 ROOM_PIXEL배 크기) */
export const ROOM_ART = {
  wall: uri(WALL),
  floor: uri(FLOOR),
  window: uri(WINDOW),
  door: uri(DOOR),
  /** 타일 한 변 px */
  tile: 16 * ROOM_PIXEL,
  windowSize: { width: 20 * ROOM_PIXEL, height: 17 * ROOM_PIXEL },
  doorSize: { width: 16 * ROOM_PIXEL, height: 28 * ROOM_PIXEL },
};
