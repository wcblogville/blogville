// 미용실 머리 모양·머리 색 (사용자 요청 2026-10-11 "미용실이랑 옷가게도 만들어서 캐릭터 스타일링").
// 사람 캐릭터(남자·여자 주민, 모험가)만 머리가 바뀐다. 동물·로봇은 머리 대신 털이라 그대로 둔다 (characters.ts의 human).
// 머리 모양은 캐릭터 틀(16×24)의 머리 0~12줄(긴 머리는 어깨 13~17줄까지)에 겹친다. 아래에는 머리카락 없는 머리(BALD_HEAD)가 깔린다.
// 머리카락 글자: H(밝은 면)·h(기본)·j(그늘). 머리 색은 이 세 칸을 ramp()로 바꿔 칠한다. g = 앞머리 그늘이 진 이마
import { ramp, type Colors, type Sprite } from "./pixel";

/** 머리카락 없는 사람 머리 + 얼굴 (0~12줄). 머리 모양을 입히면 캐릭터의 원래 머리 대신 이 위에 그린다 */
export const BALD_HEAD: Sprite = [
  ".....######.....",
  "...##ffffff##...",
  "..#ffffffffff#..",
  ".#ffffffffffff#.",
  ".#ffffffffffff#.",
  ".#ffffffffffff#.",
  ".#ffffffffffff#.",
  ".#ffw#ffffw#ff#.",
  ".#ff##ffff##ff#.",
  ".#ff##ffff##ff#.",
  ".#fppffQQffppf#.",
  "..#ffffffffff#..",
  "...##########...",
];

export const HAIR_STYLES: Record<string, Sprite> = {
  // 짧은 머리 (남자 주민의 머리와 같은 모양)
  "hair.short": [
    ".....######.....",
    "...##HHHhhh##...",
    "..#HHhhhhhhhh#..",
    ".#hHhhhhhhhhhh#.",
    ".#hhhhhhhhhhhj#.",
    ".#hhhhhhhhhhjj#.",
    ".#hhhgghhhgghj#.",
    "..h..........h..",
    "..h..........h..",
  ],
  // 단발: 일자 앞머리, 턱까지 오는 옆머리
  "hair.bob": [
    ".....######.....",
    "...##HHHHhh##...",
    "..#HHHhhhhhhh#..",
    ".#HHhhhhhhhhhj#.",
    "#HHhhhhhhhhhhhj#",
    "#Hhhhhhhhhhhhjj#",
    "#hhjhhhjhhhjhhj#",
    "#hhj........jhj#",
    "#hhj........jhj#",
    "#hhj........jhj#",
    "#hhj........jhj#",
    "#hjj........jjj#",
    ".###........###.",
  ],
  // 삐죽 머리: 위로 뻗친 머리카락
  "hair.spiky": [
    ".#...#..#...#...",
    ".##.#H##H#.##...",
    "..#HHhHhhhh#h#..",
    ".#HHhhhhhhhhhh#.",
    "#hHhhhhhhhhhhhj#",
    ".#hhhjhhhjhhjj#.",
    ".#hhgghhjgghhj#.",
    "..h..........j..",
  ],
  // 포니테일: 옆으로 넘긴 앞머리, 오른쪽 위로 묶은 꼬리 (빨간 끈)
  "hair.pony": [
    ".....######.....",
    "...##HHHhhh##...",
    "..#HHHHhhhhhh###",
    ".#HHhhhhhhhhhNN#",
    ".#Hhhhhhhhhhh#hj",
    ".#hhhhhhhhhhjj#j",
    ".#hhhhhhggghhj#j",
    "..hhhgg......#hj",
    "..h..........#hj",
    "..............#j",
    "..............#j",
    "...............#",
  ],
  // 긴 생머리: 어깨 아래까지 내려오는 옆머리
  "hair.long": [
    ".....######.....",
    "...##HHHhhh##...",
    "..#HHhhhhhhhh#..",
    ".#HHhhhhhhhhhj#.",
    "#HHhhhhhhhhhhhj#",
    "#Hhhhhhhhhhhhjj#",
    "#hhhhgghhhhhhjj#",
    "#hh#........#jj#",
    "#hh#........#hj#",
    "#hh#........#hj#",
    "#hh#........#hj#",
    "#hhh#......#hhj#",
    "#hhh#......#hhj#",
    "#hh#........#hj#",
    "#hh#........#jj#",
    "#hj#........#jj#",
    "#jj#........#jj#",
    ".##..........##.",
  ],
  // 똥머리: 양쪽 위로 동그랗게 묶은 머리 두 개
  "hair.buns": [
    ".####......####.",
    "#HHhh######hhhj#",
    "#Hhhj#HHhh#hhjj#",
    ".#j#Hhhhhhhh#j#.",
    ".#HHhhhhhhhhhj#.",
    ".#hhhhhhhhhhjj#.",
    ".#hhgghhhhgghj#.",
    "..h..........h..",
  ],
  // 뽀글 파마: 둥글게 부푼 곱슬머리
  "hair.curly": [
    "...##.####.##...",
    "..#HH#HHhh#hh#..",
    ".#HhHHhhHhhhjh#.",
    "#HhHhhHhhhhhjhj#",
    "#hHhhhhhjhhhhjj#",
    "#hhjhhjhhhjhhjj#",
    "#hjhghhjhhghjhj#",
    "#hh#........#jj#",
    "#hj#........#hj#",
    ".#j#........#j#.",
    "..#..........#..",
  ],
};

/** 머리 색 (asset_key → 기본 색). 밝은 면·그늘은 ramp()로 만든다 */
export const HAIR_COLORS: Record<string, string> = {
  "haircolor.brown": "#8a5434",
  "haircolor.black": "#3d3440",
  "haircolor.blonde": "#e8b84a",
  "haircolor.red": "#d0533b",
  "haircolor.pink": "#f07fa8",
  "haircolor.mint": "#45bf9c",
  "haircolor.lavender": "#9c80dc",
  "haircolor.silver": "#b9bccb",
};

/** 머리 색 → 머리카락 칸 H·h·j 색 */
export function hairColors(hex: string): Colors {
  const [H, h, j] = ramp(hex);
  return { H, h, j };
}
