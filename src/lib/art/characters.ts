// Blogville 창작 캐릭터 (도트 16×24, 사용자 결정 2026-10-09 "도트로 바꾸기"). 외부 그림 없이 글자 줄로 그린다.
// 모든 캐릭터가 같은 틀을 쓴다: 머리 0~12줄(눈은 7~9줄의 4·5칸과 10·11칸), 몸 13~21줄, 22~23줄은 그림자.
// 그래서 아바타 꾸미기(SHOP-06, avatar.ts)의 모자·옷·소품이 어느 캐릭터에나 맞는다.
// 글자 뜻은 pixel.ts PALETTE. 동물은 털 7·8·9(밝은 면·기본·그늘), 배 k, 코·귀 안쪽 o, 발 F를 캐릭터마다 칠한다.
// DB의 asset_key("char.cat" 등)로 고른다.
import { MANNEQUIN, outfitLayers } from "./avatar";
import { outfit, spriteRects, svgDataUri, type Colors, type Sprite } from "./pixel";

// ===== 사람 =====
// 사람 얼굴 (7~12줄): 눈, 볼터치, 입
const FACE = [
  ".#hfw#ffffw#fh#.",
  ".#hf##ffff##fh#.",
  ".#ff##ffff##ff#.",
  ".#fppffQQffppf#.",
  "..#ffffffffff#..",
  "...##########...",
];
// 사람 몸 (13~23줄): 깃 달린 반팔(옷 4·5·6), 금색 버클 벨트, 남색 바지
const HUMAN_BODY = [
  "..#44wwggww56#..",
  ".#4#455ww556#6#.",
  ".#f#45555556#f#.",
  ".#f#55555566#f#.",
  "..##nnnzznnn##..",
  "...#tttttttt#...",
  "...#ttt##ttt#...",
  "...#ttt##ttt#...",
  "..#nnnn##nnnn#..",
  ".:############:.",
  "..::::::::::::..",
];
// 짧은 갈색 머리 (0~6줄)
const SHORT_HAIR = [
  ".....######.....",
  "...##HHHhhh##...",
  "..#HHhhhhhhhh#..",
  ".#hHhhhhhhhhhh#.",
  ".#hhhhhhhhhhhj#.",
  ".#hhhhhhhhhhjj#.",
  ".#hhhgghhhgghj#.",
];

const BOY: Sprite = [...SHORT_HAIR, ...FACE, ...HUMAN_BODY];

// 여자 주민: 어깨까지 오는 머리, 분홍 머리띠, 원피스(옷 4·5·6), 빨간 구두
const GIRL: Sprite = [
  ".....######.....",
  "...##HHHhhh##...",
  "..#HHhhhhhhhh#..",
  ".#VVVVVVVVVVVR#.",
  ".#hHhhhhhhhhhj#.",
  "##hhhhhhhhhhjj##",
  "#hhhhgghhhgghhj#",
  "#hh#w#ffffw##hj#",
  "#hhf##ffff##fhj#",
  "#hhf##ffff##fhj#",
  "#hhppffQQffpphj#",
  "#hhh#ffffff#hhj#",
  "#hhhh######hhhj#",
  ".##44wwggww56##.",
  ".#4#45555556#6#.",
  ".#f#45555556#f#.",
  ".#f#66666666#f#.",
  "..#4555555556#..",
  ".#455555555556#.",
  ".##############.",
  "....#ff##ff#....",
  "...#NNN##NNN#...",
  ".::##########::.",
  "..::::::::::::..",
];

// 모험가: 빨간 두건과 목도리, 초록 튜닉, 갈색 바지
const HUMAN: Sprite = [
  ".....######.....",
  "...##HHHhhh##...",
  "..#HHhhhhhhhh#..",
  ".#KKKKKKKKKKKN#.",
  ".#hHhhhhhhhhhjNN",
  ".#hhhhhhhhhhjj#N",
  ".#hhhgghhhgghj#.",
  ...FACE,
  "..#NKKKKKKKKN#..",
  ".#4#4NN55556#6#.",
  ".#f#4N555556#f#.",
  ".#f#55555566#f#.",
  "..##nnnzznnn##..",
  "...#bbbbbbbb#...",
  "...#bbb##bbb#...",
  "...#bbb##bbb#...",
  "..#nnnn##nnnn#..",
  ".:############:.",
  "..::::::::::::..",
];

// ===== 동물 =====
// 동물 몸 (13~23줄): 털 7·8·9, 배 k, 발 F
const ANIMAL_BODY = [
  "..#7888kk8889#..",
  ".#7#8kkkkkk8#9#.",
  ".#8#8kkkkkk9#9#.",
  ".#8#88kkkk99#9#.",
  "..##88888899##..",
  "...#88888899#...",
  "...#888##899#...",
  "...#888##899#...",
  "..#FFFF##FFFF#..",
  ".:############:.",
  "..::::::::::::..",
];
// 둥근 동물 머리 (2~12줄): 눈, 볼터치, 코 o
const ANIMAL_HEAD = [
  "....########....",
  "..##77788888##..",
  ".#778888888889#.",
  ".#788888888889#.",
  ".#888888888899#.",
  ".#88w#8888w#89#.",
  ".#88##8888##89#.",
  ".#88##8888##89#.",
  ".#8pp88oo88pp9#.",
  "..#9888888889#..",
  "...##########...",
];
const EMPTY = "................";

/** 줄 번호(row)부터 rows로 바꾼다 */
function edit(base: Sprite, row: number, rows: Sprite): string[] {
  const out = [...base];
  rows.forEach((r, i) => (out[row + i] = r));
  return out;
}

const ANIMAL: Sprite = [EMPTY, EMPTY, ...ANIMAL_HEAD, ...ANIMAL_BODY];

// 고양이: 세모 귀(분홍 안쪽), 이마 줄무늬, 말린 꼬리
const CAT = edit(
  edit(ANIMAL, 0, [
    ".##..........##.",
    ".#o#........#o#.",
    ".#oo########oo#.",
    ".#777898988889#.",
    ".#778889888889#.",
  ]),
  10,
  [".#8pp8kook8pp9#.", "..#988kkkk889#.."],
);
const CAT_TAIL = edit(CAT, 16, [
  ".#8#88kkkk99#9##",
  "..##88888899##8#",
  "...#88888899#89#",
  "...#888##899#9#.",
  "...#888##899##..",
]);

// 강아지: 늘어진 갈색 귀, 오른쪽 눈 얼룩, 내민 혀
const DOG = edit(ANIMAL, 4, [
  "#b#7888888889#n#",
  "#b#8888888889#n#",
  "#b#8888888899#n#",
  "#b#8w#888Bw#B#n#",
  "#n#8##888B##B#n#",
  "#n#8##8888##9#n#",
  ".##pp8k##k8pp##.",
  "..#98kkKKkk89#..",
]);

// 토끼: 긴 귀(분홍 안쪽), 앞니, 동그란 꼬리
const RABBIT = edit(
  edit(ANIMAL, 0, ["....##....##....", "...#7o#..#o9#...", "...#7o#..#o9#...", "...#7o####o9#...", ".##7788888889##."]),
  11,
  ["..#9888ww8889#.."],
);
const RABBIT_TAIL = edit(RABBIT, 17, ["..##88888899###.", "...#88888899#ww#", "...#888##899###."]);

// 여우: 끝이 까만 세모 귀, 흰 볼, 흰 끝 꼬리
const FOX = edit(
  edit(ANIMAL, 0, [".##..........##.", ".###........###.", ".#78########89#.", ".#777888888889#.", ".#778888888889#."]),
  9,
  [".#k8##8888##8k#.", ".#kppkk##kkppk#.", "..#kkkkkkkkkk#.."],
);
const FOX_TAIL = edit(FOX, 16, [
  ".#8#88kkkk99#9##",
  "..##88888899##8#",
  "...#88888899#88#",
  "...#888##899#8k#",
  "...#888##899#kk#",
  "..#FFFF##FFFF###",
]);

// 판다: 까만 귀·눈 무늬·팔다리
const PANDA = edit(
  edit(ANIMAL, 0, [
    EMPTY,
    "..###......###..",
    ".#DDD######DDD#.",
    ".#DD78888888DD#.",
    ".#778888888889#.",
    ".#788888888889#.",
    ".#8DDD8888DDD9#.",
    ".#8Dw#D88Dw#D9#.",
    ".#8D##D88D##D9#.",
    ".#8DDD8888DDD9#.",
    ".#8pp88##88pp9#.",
  ]),
  14,
  [".#D#8kkkkkk8#D#.", ".#D#8kkkkkk9#D#.", ".#D#88kkkk99#D#.", "..##DDDDDDDD##..", "...#88888899#...", "...#888##899#..."],
);

// 로봇: 네모 머리, 화면 얼굴(하늘색 눈·입), 빨간 안테나, 귀 나사
const ROBOT = edit(
  edit(ANIMAL, 0, [
    "......#NN#......",
    ".......##.......",
    "..############..",
    ".#777788888889#.",
    ".#788888888889#.",
    ".#7SSSSSSSSSS9#.",
    "##7SSSSSSSSSS9##",
    "#87SCCSSSSCCS98#",
    "##7SCCSSSSCCS9##",
    ".#7SSSCSSCSSS9#.",
    ".#7SSSSCCSSSS9#.",
    ".#999999999999#.",
    "..############..",
  ]),
  13,
  ["..#7888888889#..", ".#7#8kzkkNk8#9#.", ".#8#8kkkkkk9#9#."],
);

// 드래곤: 크림색 뿔, 콧구멍, 크림색 배, 꼬리
const DRAGON = edit(
  edit(ANIMAL, 0, ["..#..........#..", "..#k#......#k#..", "...#k######k#..."]),
  10,
  [".#8pp8#88#8pp9#."],
);
const DRAGON_TAIL = edit(DRAGON, 17, ["..##88888899##..", "...#88888899#.#.", "...#888##899##8#", "...#888##899#8k#", "..#FFFF##FFFF###"]);

// 유니콘: 금색 뿔, 무지개 갈기, 분홍 꼬리
const UNICORN = edit(ANIMAL, 0, [
  ".......##.......",
  "......#zu#......",
  "....##zZu###....",
  "..#VV7788888##..",
  ".#VzU788888889#.",
  ".#UVi888888889#.",
  "#VUi8888888899#.",
  "#Ui8w#8888w#89#.",
  "#iz8##8888##89#.",
  ".#z8##8888##89#.",
]);
const UNICORN_TAIL = edit(UNICORN, 16, [".#8#88kkkk99#9##", "..##88888899##V#", "...#88888899#VR#", "...#888##899#U#.", "...#888##899##.."]);

// 마네킹: 얼굴 없는 회색 몸 (아바타 아이템 미리보기)
const MANNEQUIN_ROWS = edit(ANIMAL, 7, [
  ".#888888888889#.",
  ".#888888888889#.",
  ".#888888888899#.",
  ".#888888888899#.",
]);

// 털 색 7·8·9, 배 k, 코·귀 o, 발 F, 그 밖의 칸(D 판다 무늬, S·C 로봇 화면)
const fur = (light: string, base: string, shade: string, rest: Record<string, string> = {}): Colors => ({
  7: light,
  8: base,
  9: shade,
  k: "#fff5e6",
  o: "#ff9eaa",
  F: base,
  ...rest,
});

type Look = { rows: Sprite; colors?: Colors };

const CHARACTERS: Record<string, Look> = {
  "char.human": { rows: HUMAN, colors: { ...outfit("#4caf7a"), b: "#9c6a45", h: "#7a4b2a", H: "#a06a3e" } },
  // 가입할 때 고르는 기본 캐릭터: 남자 주민(하늘색 셔츠), 여자 주민(분홍 원피스)
  "char.boy": { rows: BOY },
  "char.girl": { rows: GIRL, colors: { 4: "#ffc6dc", 5: "#ff9ec3", 6: "#d9709e" } },
  "char.cat": { rows: CAT_TAIL, colors: fur("#ffc98a", "#f6a24e", "#d9781f", { k: "#fde3c4" }) },
  "char.dog": { rows: DOG, colors: fur("#fff6e6", "#f1d3a1", "#d6ad78", { k: "#fffaf0", b: "#a8683b", n: "#7a4a2e", B: "#c98c55", F: "#c98c55" }) },
  "char.rabbit": { rows: RABBIT_TAIL, colors: fur("#ffffff", "#fbf7f2", "#e3d9cf", { k: "#ffffff", o: "#ffc2cf", F: "#f1e6dc" }) },
  "char.fox": { rows: FOX_TAIL, colors: fur("#ffb27a", "#ef7a35", "#c95a26", { k: "#fff5ea", F: "#4a3426" }) },
  "char.panda": { rows: PANDA, colors: fur("#ffffff", "#fbfbf8", "#dcd8d0", { k: "#fbfbf8", D: "#3a3232", F: "#3a3232" }) },
  "char.robot": { rows: ROBOT, colors: fur("#d4e1ec", "#b8c9d9", "#8aa2b8", { k: "#c7d6e3", S: "#23324a", C: "#6ff3ff", F: "#6f879d" }) },
  "char.dragon": { rows: DRAGON_TAIL, colors: fur("#a6e09a", "#6cc070", "#4f9a55", { k: "#f3e7b0" }) },
  "char.unicorn": { rows: UNICORN_TAIL, colors: fur("#ffffff", "#fffaff", "#e6dcf0", { k: "#ffffff", o: "#ffc2cf", F: "#d9c2ff" }) },
};

/** 상점·꾸미기 카드에서 아바타 아이템을 입혀 보여 줄 회색 몸 */
CHARACTERS[MANNEQUIN] = { rows: MANNEQUIN_ROWS, colors: fur("#efe9e1", "#e2dbd2", "#c9c0b5", { k: "#ece6de", F: "#c9c0b5" }) };

/** 로그인하지 않은 방문자용 (광장 구경): 회색 주민 */
export const VISITOR_CHARACTER = "char.visitor";
CHARACTERS[VISITOR_CHARACTER] = {
  rows: BOY,
  colors: {
    f: "#ece6de", g: "#d8d0c6", p: "#e6d3cc", Q: "#b8a49a",
    H: "#c4bbb0", h: "#b0a69a", j: "#958a7e",
    4: "#e8e2da", 5: "#d8d2ca", 6: "#bfb7ad", t: "#a8a097", n: "#8f857a", z: "#c9c0b5",
  },
};

const FALLBACK: Look = { rows: ANIMAL, colors: fur("#e2dbd2", "#cfc4b8", "#b3a797") };

/** 그림 틀: 16×24 캐릭터를 가운데 둔 24×24 정사각형 (옛 그림처럼 정사각형으로 쓰는 곳이 많다) */
const FRAME = 24;

/**
 * 캐릭터 SVG 문자열. size는 정사각형 한 변 픽셀 (24의 배수면 도트가 고르게 나온다).
 * outfit = 입은 아바타 asset_key 목록 (옷은 몸 위, 소품·모자는 맨 위)
 */
export function characterSvg(assetKey: string, size = 72, outfit: readonly string[] = []): string {
  const look = CHARACTERS[assetKey] ?? FALLBACK;
  const layers = outfitLayers(outfit);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 0 ${FRAME} ${FRAME}" width="${size}" height="${size}" shape-rendering="crispEdges">` +
    `${spriteRects(look.rows, look.colors)}${layers.body}${layers.top}</svg>`
  );
}

export function characterDataUri(assetKey: string, size = 72, outfit: readonly string[] = []): string {
  return svgDataUri(characterSvg(assetKey, size, outfit));
}

/** 캐릭터 + 차림을 하나로 나타내는 키 (입은 순서와 상관없이 같다). 차림이 없으면 asset_key 그대로 */
export function lookKey(assetKey: string, outfit: readonly string[] = []): string {
  return outfit.length ? `${assetKey}+${[...outfit].sort().join("+")}` : assetKey;
}

/** 시험·미리보기용: 캐릭터 글자 줄 (모든 캐릭터가 16×24인지 확인한다) */
export function characterRows(assetKey: string): Sprite | null {
  return CHARACTERS[assetKey]?.rows ?? null;
}
export const CHARACTER_KEYS = () => Object.keys(CHARACTERS);
