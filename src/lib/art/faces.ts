// 미용실 얼굴형 (사용자 요청 2026-10-12 "얼굴형도 추가 해줘 동그란 얼굴 그런거").
// 사람 캐릭터(남자·여자 주민, 모험가)만 바뀐다. 동물·로봇은 머리 대신 털이라 그대로 둔다 (characters.ts의 human).
// 얼굴형 하나 = 머리카락 없는 머리(hair.ts BALD_HEAD, 0~12줄)를 바꾼 글자 줄. 머리 모양·원래 머리는 이 위에 겹친다.
// 지키는 자리: 눈(7~9줄의 4·5칸과 10·11칸)은 그대로, 머리 위쪽(0~6줄)은 그대로 → 모자·안경·머리 모양이 어느 얼굴형에나 맞는다.
// 바뀌는 곳은 볼(8~11줄)과 턱(10~12줄)이다. 긴 머리는 볼을 덮으니 턱 모양과 볼터치로도 구별되게 그렸다.
import type { Sprite } from "./pixel";
import { BALD_HEAD } from "./hair";

/** 0~6줄(이마 위)은 기본 머리와 같다 */
const TOP = BALD_HEAD.slice(0, 7);

export const FACE_SHAPES: Record<string, Sprite> = {
  // 동그란 얼굴: 볼이 양옆으로 볼록, 넓고 둥근 턱
  "face.round": [
    ...TOP,
    ".#ffw#ffffw#ff#.",
    ".#ff##ffff##ff#.",
    "#fff##ffff##fff#",
    "#ffppffQQffppff#",
    ".#fppffffffppf#.",
    "..############..",
  ],
  // 갸름한 얼굴: 볼에서 턱으로 좁아지는 V자 턱
  "face.slim": [
    ...TOP,
    ".#ffw#ffffw#ff#.",
    ".#ff##ffff##ff#.",
    ".#ff##ffff##ff#.",
    "..#ppffQQffpp#..",
    "...#ffffffff#...",
    "....########....",
  ],
  // 네모난 얼굴: 각진 턱 (턱 끝까지 넓다)
  "face.square": [
    ...TOP,
    ".#ffw#ffffw#ff#.",
    ".#ff##ffff##ff#.",
    ".#ff##ffff##ff#.",
    ".#fppffQQffppf#.",
    ".#ffffffffffff#.",
    ".##############.",
  ],
  // 하트형 얼굴: 볼 아래부터 좁아져 턱 끝이 뾰족
  "face.heart": [
    ...TOP,
    ".#ffw#ffffw#ff#.",
    ".#ff##ffff##ff#.",
    ".#ff##ffff##ff#.",
    "..#ppffQQffpp#..",
    "...##ffffff##...",
    ".....######.....",
  ],
  // 찹쌀떡 볼: 아래로 통통하게 늘어진 볼과 큰 볼터치
  "face.chubby": [
    ...TOP,
    ".#ffw#ffffw#ff#.",
    ".#ff##ffff##ff#.",
    "#fff##ffff##fff#",
    "#fpppffQQffpppf#",
    "#fpppffffffpppf#",
    ".##############.",
  ],
};

/** 얼굴 줄(7~12줄)에서 원래 옆머리를 남기는 바깥 칸 수 (왼쪽 0·1칸, 오른쪽 14·15칸) */
export const SIDE_HAIR_COLS = 2;

/**
 * 캐릭터 원래 머리(머리 모양을 입지 않았을 때): 캐릭터 머리 0~12줄에서 머리카락 없는 머리와 다른 칸만 남긴다.
 * 얼굴형을 바꾸면 이 층을 바뀐 머리(shape) 위에 다시 얹는다 (여자 주민의 머리·머리띠, 모험가의 두건).
 * 얼굴 줄(7~12줄)의 옆머리는 바깥 두 칸과 얼굴형 밖(빈 칸)에만 남긴다: 여자 주민처럼 옆머리가 볼을 덮으면
 * 얼굴형이 보이지 않기 때문 (옆머리는 볼 뒤로 넘기고, 갸름한 턱 옆 빈자리는 머리카락이 채운다)
 */
export function nativeHair(rows: Sprite, shape: Sprite = BALD_HEAD): string[] {
  const outer = (x: number) => x < SIDE_HAIR_COLS || x >= 16 - SIDE_HAIR_COLS;
  return BALD_HEAD.map((bald, y) =>
    [...(rows[y] ?? bald)]
      .map((c, x) => {
        if (c === bald[x]) return ".";
        if (y < 7 || outer(x) || shape[y]?.[x] === ".") return c;
        return ".";
      })
      .join(""),
  );
}
