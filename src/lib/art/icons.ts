// 도트 아이콘 (2026-10-12 사용자 요청 "들어간 화면도 다 도트감성으로"): 구역 제목·헤더·배지에 쓰던 그림 글자(🪙 🔔 👑 …)를
// 광장과 같은 팔레트(pixel.ts)의 12×12칸 그림으로 그린다. 화면에는 정수배(보통 2배 = 24px)로만 키운다.
// 내용 글자(버튼 이름, 내역 사유 등)에 들어 있는 그림 글자는 뜻을 전하는 글이라 그대로 둔다. 여기 아이콘은 꾸밈이다 (alt="").
import { contentHash, Pix, spriteSvg, svgDataUri, swap, type Colors, type Sprite } from "./pixel";

/** 아이콘 한 변 (칸) */
export const ICON = 12;

// 팔레트에 없는 색 (pixel.ts에 없는 글자)
const COLORS: Colors = {
  "0": "#ffe9f1", // 연분홍
  "7": "#8fd0ff", // 밝은 하늘
  "9": "#c9a27a", // 종이 그늘
  k: "#fff4c8", // 양피지
  o: "#f7f0e4", // 종이
  r: "#3f7f50", // 짙은 풀
  C: "#6db2d6", // 파일 띠 (파일 종류마다 바꿔 칠한다)
};

function coin(): string[] {
  const p = new Pix(ICON, ICON);
  p.oval(6, 6, 6, 6, "z");
  // 밝은 왼쪽 위, 짙은 오른쪽 아래
  p.map((c, x, y) => (c === "z" && x + y <= 5 ? "Z" : c === "z" && x + y >= 15 ? "u" : c));
  // 가운데 네모 구멍 (옛날 동전)
  p.rect(5, 3, 2, 6, "u").rect(5, 3, 1, 6, "b");
  p.px(3, 3, "w");
  return p.rows();
}

function egg(): string[] {
  const p = new Pix(ICON, ICON);
  p.oval(6, 6.5, 4.5, 5.6, "w");
  p.map((c, x, y) => (c === "w" && x + y >= 13 ? "c" : c));
  p.px(4, 7, "l").px(5, 7, "l").px(7, 4, "l").px(8, 8, "l").px(8, 9, "m");
  p.px(4, 3, "I");
  return p.rows();
}

function palette(): string[] {
  const p = new Pix(ICON, ICON);
  p.oval(6, 6, 6, 5.5, "B");
  p.oval(8.2, 8.2, 1.5, 1.5, ".");
  p.px(3, 3, "N").px(4, 3, "N").px(6, 2, "z").px(7, 2, "z").px(2, 6, "l").px(3, 6, "l").px(4, 8, "v").px(5, 8, "v").px(9, 4, "U").px(9, 5, "U");
  return p.outline().rows();
}


/** 채운 칸만 그린 줄에 외곽선(#)을 두른다 (2026-10-12 "선물이나 코인이나 다 도트로" 추가 아이콘) */
function lined(rows: Sprite, after?: (p: Pix) => void): string[] {
  const p = new Pix(ICON, ICON).stamp(rows, 0, 0).outline();
  after?.(p);
  return p.rows();
}

function compass(): string[] {
  const p = new Pix(ICON, ICON);
  p.oval(6, 6, 6, 6, "z");
  p.ellipse(6, 6, 4, 4, "w");
  p.px(6, 2, "N").px(6, 3, "N").px(5, 4, "N").px(6, 4, "K").px(5, 5, "Q").px(6, 5, "#");
  p.px(6, 6, "X").px(5, 6, "x").px(6, 7, "x").px(5, 7, "y").px(5, 8, "y").px(5, 9, "y");
  p.px(3, 3, "Z");
  return p.rows();
}

function party(): string[] {
  return lined(
    [
      "............",
      "............",
      "............",
      "............",
      ".....zKz....",
      "....zKzK....",
      "...KzKzK....",
      "..zKzKzu....",
      ".KzKzKu.....",
      ".zKzuu......",
      ".uu.........",
      "............",
    ],
    (p) => {
      // 터지는 종이 조각 (외곽선 없이)
      p.px(8, 1, "V").px(10, 3, "z").px(6, 1, "U").px(9, 5, "l").px(11, 6, "K").px(3, 2, "i").px(10, 0, "z").px(8, 3, "R");
      p.px(5, 3, "#").px(7, 3, "#").px(8, 4, "#").px(8, 6, "#");
    },
  );
}

function fountain(): string[] {
  return lined(
    [
      "............",
      "............",
      ".....ii.....",
      "....iIIi....",
      ".....YY.....",
      ".....YY.....",
      "....YYYY....",
      ".YYYYYYYYYY.",
      ".YiIiiiiiiY.",
      ".yyyyyyyyyy.",
      ".xxxxxxxxxx.",
      "............",
    ],
    (p) => p.px(2, 4, "i").px(9, 4, "i").px(1, 6, "v").px(10, 6, "v").px(3, 3, "I").px(8, 3, "I"),
  );
}

const heart = [
  "............",
  ".###...###..",
  "#KwK#.#KKK#.",
  "#KKKK#KKKN#.",
  "#KKKKKKKKN#.",
  "#KKKKKKKNN#.",
  ".#KKKKKKN#..",
  "..#KKKKN#...",
  "...#KKN#....",
  "....#N#.....",
  ".....#......",
  "............",
];

const star = [
  ".....##.....",
  "....#ZZ#....",
  "....#Zz#....",
  "#####Zz#####",
  "#ZZZzzzzzzu#",
  ".#zzzzzzzu#.",
  "..#zzzzzu#..",
  "..#zzzzzz#..",
  ".#zzu##uzz#.",
  ".#zu#..#uz#.",
  "#u##....##u#",
  "##........##",
];

const file = lined([
  "............",
  "..wwwwww....",
  "..wwwwwyy...",
  "..wwwwwyyy..",
  "..wwwwwwwy..",
  "..wddddddy..",
  "..wwwwwwwy..",
  "..wddddwwy..",
  "..wwwwwwwy..",
  "..CCCCCCCC..",
  "..CCCCCCCC..",
  "............",
]);

const ICONS = {
  coin: coin(),
  egg: egg(),
  paw: [
    "...##..##...",
    "..#BB##BB#..",
    "..#Bb##Bb#..",
    "...##..##...",
    "##........##",
    "#B#.####.#B#",
    "#b##BBBB##b#",
    ".##BBBBBB##.",
    "..#BBBBBb#..",
    "..#BBBBbb#..",
    "...#bbbb#...",
    "....####....",
  ],
  palette: palette(),
  // 반짝이는 별 (경험치)
  star,
  bell: [
    ".....##.....",
    "....#Zz#....",
    "...#Zzzz#...",
    "..#Zzzzzu#..",
    "..#Zzzzzu#..",
    "..#Zzzzzu#..",
    ".#Zzzzzzzu#.",
    ".#zzzzzzzu#.",
    "#Zzzzzzzzzu#",
    "############",
    "....#uu#....",
    ".....##.....",
  ],
  crown: [
    "............",
    "#....##....#",
    "##..#ZZ#..##",
    "#Z#.#zz#.#z#",
    "#zz#zzzz#zz#",
    "#Zzzzzzzzzz#",
    "#zzzKzzKzzz#",
    "#zzKNzzNKzu#",
    "#uuuuuuuuuu#",
    "#zZzZzZzZzz#",
    "############",
    "............",
  ],
  // 가게 (줄무늬 차양)
  shop: [
    "............",
    "############",
    "#KwKwKwKwKw#",
    "#KwKwKwKwKw#",
    "#NNNNNNNNNN#",
    ".#cccccccc#.",
    ".#ciic###c#.",
    ".#ciic#Bb#c.",
    ".#cccc#Bb#c.",
    ".#dddd#Bb#d.",
    ".##########.",
    "............",
  ],
  // 배낭 (성장 아이템 가방)
  bag: [
    "....####....",
    "...#b..b#...",
    "..########..",
    ".#BBBBBBBB#.",
    ".#BBBBBBBb#.",
    ".##########.",
    ".#BB#zz#Bb#.",
    ".#BB####Bb#.",
    ".#BBBBBBBb#.",
    ".#bBBBBBbb#.",
    ".#bbbbbbbn#.",
    "..########..",
  ],
  // 새싹 (키우는 중)
  sprout: [
    "............",
    ".###....###.",
    "#LLl#..#lLL#",
    "#Llll##lllL#",
    ".#lllmmllm#.",
    "..##mmmm##..",
    ".....mm.....",
    ".....mm.....",
    "..########..",
    ".#bBBBBBBb#.",
    ".#nbbbbbbn#.",
    "..########..",
  ],
  // 메달 (다 키운 동물)
  medal: [
    "#####..#####",
    "#KKN#..#55#.",
    ".#KN#..#5#..",
    "..#N#.#6#...",
    "...#####....",
    "..#ZZzzz#...",
    ".#Zzzuzzz#..",
    ".#zzuuuzu#..",
    ".#zzzuzzu#..",
    ".#zzzzzuu#..",
    "..#uuuuu#...",
    "...#####....",
  ],
  fish: [
    "............",
    "......###...",
    ".....#55#...",
    "##..#55555#.",
    "#5#####5555#",
    "#55#4444#w5#",
    "#555444444#.",
    "#55#4444445#",
    "#5#####5555#",
    "##..#55555#.",
    ".....#55#...",
    "......###...",
  ],
  // 낚싯대와 찌
  rod: [
    "..........##",
    ".........#n#",
    "........#n#w",
    ".......#n#.w",
    "......#n#..w",
    ".....#n#...w",
    "....#n#....w",
    "...#n#....#w",
    "..#u#....#KK",
    ".#uu#....#ww",
    "#nn#......##",
    "###.........",
  ],
  calendar: [
    "..#......#..",
    ".#n#....#n#.",
    "############",
    "#NNNNNNNNNN#",
    "#QQQQQQQQQQ#",
    "############",
    "#wwwwwwwwww#",
    "#w#w#w#w#ww#",
    "#wwwwwwwwww#",
    "#w#w#w#KKww#",
    "#wwwwwwKKww#",
    "############",
  ],
  // 편지 (알림)
  mail: [
    "............",
    "............",
    "############",
    "#w#wwwwww#w#",
    "#ww#wwww#ww#",
    "#www#ww#www#",
    "#wwww##wwww#",
    "#wwwwwwwwww#",
    "#wwwwwwwwKK#",
    "#ooooooooKK#",
    "############",
    "............",
  ],
  // 장부 (경험치·코인 내역)
  book: [
    "..#########.",
    ".#55555555#.",
    "#5#5555555#.",
    "#5#5zzzz55#.",
    "#5#5zzzz55#.",
    "#5#5555555#.",
    "#5#5555555#.",
    "#5#5555555#.",
    "#5#5555555#.",
    "#5#########.",
    "#5#wwwwwwww#",
    ".##########.",
  ],
  shirt: [
    "............",
    "..###..###..",
    ".#55#..#55#.",
    "#555####555#",
    "#5555ww5555#",
    "####5555####",
    "...#5555#...",
    "...#5455#...",
    "...#5555#...",
    "...#5555#...",
    "...#6666#...",
    "...######...",
  ],
  scissors: [
    "#..........#",
    "#Y#......#Y#",
    ".#Yy#..#yY#.",
    "..#Yy##yY#..",
    "...#YyyY#...",
    "....#XX#....",
    "...##XX##...",
    "..#KK##KK#..",
    ".#K##..##K#.",
    ".#K#....#K#.",
    ".#K##..##K#.",
    "..###..###..",
  ],
  // 액자 (배경)
  frame: [
    "............",
    "############",
    "#BBBBBBBBBB#",
    "#B77777z77B#",
    "#B7777zzz7B#",
    "#B77777z77B#",
    "#B77GG777lB#",
    "#BGGGGllllB#",
    "#BllllllllB#",
    "#BBBBBBBBBb#",
    "############",
    "............",
  ],
  chair: [
    "..########..",
    "..#BBBBBB#..",
    "..#B#BB#b#..",
    "..#B#BB#b#..",
    "..#B#BB#b#..",
    "..#BBBBBb#..",
    ".##########.",
    ".#BBBBBBBb#.",
    ".##########.",
    ".#b#....#n#.",
    ".#b#....#n#.",
    ".###....###.",
  ],
  flower: [
    "....###.....",
    "...#VVV#....",
    ".###VRV###..",
    "#VVV#z#VVV#.",
    "#VRVzZzVRV#.",
    ".###VRV###..",
    "...#VVV#....",
    "....#l#.###.",
    ".###.#l#lL#.",
    "#lLl##l#ll#.",
    ".###.#l###..",
    ".....###....",
  ],
  gift: [
    "...##..##...",
    "..#zz##zz#..",
    "..#z#zz#z#..",
    "############",
    "#KKKKzzKKKK#",
    "#NNNNzzNNNN#",
    "############",
    ".#KKKzzKKK#.",
    ".#KKKzzKKK#.",
    ".#NNNzzNNN#.",
    ".#QQQuuQQQ#.",
    ".##########.",
  ],
  lock: [
    "....####....",
    "...#yyyy#...",
    "..#y#..#y#..",
    "..#y#..#y#..",
    ".##########.",
    ".#ZZzzzzzz#.",
    ".#zzz##zzu#.",
    ".#zzz##zzu#.",
    ".#zzzz#zzu#.",
    ".#zzzzzzuu#.",
    ".#uuuuuuuu#.",
    ".##########.",
  ],
  heart,
  // 통계 (막대)
  chart: [
    "............",
    "........###.",
    "........#z#.",
    "....###.#z#.",
    "....#l#.#z#.",
    "....#l#.#z#.",
    "###.#l#.#z#.",
    "#5#.#l#.#z#.",
    "#5#.#l#.#z#.",
    "#6#.#m#.#u#.",
    "############",
    "............",
  ],
  // 시험관 (테스트 지급)
  flask: [
    "...######...",
    "....#yy#....",
    "....#ww#....",
    "....#ww#....",
    "...#wwww#...",
    "..#wwwwww#..",
    ".#UUUUUUUU#.",
    "#UwUUUUUUUU#",
    "#UUUUUwUUUU#",
    "#UUUUUUUUUU#",
    ".##########.",
    "............",
  ],
  // 사람 둘 (가입 계정)
  people: [
    "............",
    "..###..###..",
    ".#fff##fff#.",
    ".#fff##fff#.",
    ".#fff##fff#.",
    "..###..###..",
    ".#555##VVV#.",
    "#55555VVVVV#",
    "#55555VVVVV#",
    "#55556VVVVR#",
    "############",
    "............",
  ],
  // 연필 (글)
  pencil: [
    ".........##.",
    "........#VV#",
    ".......#yVV#",
    "......#zzy#.",
    ".....#zzu#..",
    "....#zzu#...",
    "...#zzu#....",
    "..#zzu#.....",
    ".#ccu#......",
    ".#cc#.......",
    "#X##........",
    "##..........",
  ],
  // 말풍선 (댓글)
  chat: [
    "............",
    ".##########.",
    "#wwwwwwwwww#",
    "#w#w#w#w#ww#",
    "#wwwwwwwwww#",
    "#oooooooooo#",
    ".####o#####.",
    "....#o#.....",
    "....##......",
    "............",
    "............",
    "............",
  ],
  // 집 (내 블로그)
  house: [
    ".....##.....",
    "....#22#....",
    "...#2222#...",
    "..#222222#..",
    ".#22222222#.",
    "#2222222222#",
    "############",
    ".#cccccccc#.",
    ".#cii#bb#c#.",
    ".#cii#bb#c#.",
    ".#ccc#bb#d#.",
    ".##########.",
  ],
  // 메뉴 (줄 셋)
  menu: [
    "............",
    "############",
    "#BBBBBBBBBb#",
    "############",
    "............",
    "############",
    "#BBBBBBBBBb#",
    "############",
    "............",
    "############",
    "#BBBBBBBBBb#",
    "############",
  ],
  // 게시판 (마을 소식)
  board: [
    "############",
    "#BBBBBBBBBB#",
    "#B#######bB#",
    "#B#wwwww#bB#",
    "#B#w###w#bB#",
    "#B#wwwww#bB#",
    "#B#w####KbB#",
    "#B#wwwwwwbB#",
    "#B########B#",
    "############",
    "..#n#..#n#..",
    "..###..###..",
  ],
  // 문 (로그아웃)
  door: [
    "..########..",
    ".#BBBBBBBB#.",
    ".#B#iiii#b#.",
    ".#B#iiii#b#.",
    ".#B######b#.",
    ".#BBBBBBBb#.",
    ".#BBBBBzZb#.",
    ".#BBBBBBzb#.",
    ".#BBBBBBBb#.",
    ".#BBBBBBBb#.",
    "############",
    "#xxxxxxxxxx#",
  ],
  // 우편함 (출석)
  post: [
    "..########..",
    ".#KKKKKKKK#.",
    "#KKKKKKKKKN#",
    "#K######KKN#",
    "#K#wwww#KKN#",
    "#K######KKN#",
    "#NNNNNNNNNQ#",
    "############",
    ".....#bn#...",
    ".....#bn#...",
    "...##bbnn##.",
    "...########.",
  ],

  // ── 2026-10-12 "선물이나 코인이나 다 도트로": 남아 있던 그림 글자를 바꾸는 아이콘 ──
  // 빈 별 (즐겨찾기 안 함) · 큰 별 (특별·출석 오늘)
  starEmpty: swap(star, { Z: "w", z: "o", u: "y" }),
  // 빈 하트 (공감 안 함) · 노란 하트 (이웃 새 글)
  heartEmpty: swap(heart, { K: "w", N: "y" }),
  heartGold: swap(heart, { K: "z", N: "u" }),
  // 반짝임 (텔레포트·특별)
  sparkle: [
    "....#.......",
    "...#Z#......",
    "...#z#......",
    ".##Zzz##....",
    "#ZZzzzzu#...",
    ".##zzu##....",
    "...#z#...#..",
    "...#u#..#Z#.",
    "....#..#ZzZ#",
    "........#u#.",
    ".........#..",
    "............",
  ],
  // 지구 (전체 공개·모든 글)
  globe: lined([
    "............",
    "....iiii....",
    "...illiiv...",
    "..illlliiv..",
    "..iilllliv..",
    "..iiilllvv..",
    "..iiiiillv..",
    "..lliiiilv..",
    "...lliiiv...",
    "....vvvv....",
    "............",
    "............",
  ]),
  // 눈 (조회수)
  eye: [
    "............",
    "............",
    "...######...",
    ".##wwwwww##.",
    "#www#tt#www#",
    "#ww#tqqt#ww#",
    "#ww#tqwt#ww#",
    "#www#tt#www#",
    ".##wwwwww##.",
    "...######...",
    "............",
    "............",
  ],
  // 톱니 (설정)
  gear: [
    "....####....",
    ".##.#YY#.##.",
    "#YY#YYYy#yx#",
    "#YYYyyyyyyx#",
    ".#Yyy##yyx#.",
    "#Yyy#..#yxx#",
    "#yyy#..#xxx#",
    ".#yyy##xxx#.",
    "#yyyyyyxxxx#",
    "#yx#yxxx#xx#",
    ".##.#xx#.##.",
    "....####....",
  ],
  // 폴더 (카테고리)
  folder: [
    "............",
    ".####.......",
    "#zzzz#######",
    "#zzzzzzzzzu#",
    "############",
    "#ZZZZZZZZZz#",
    "#zzzzzzzzzu#",
    "#zzzzzzzzzu#",
    "#zzzzzzzzzu#",
    "#zuuuuuuuuu#",
    "############",
    "............",
  ],
  // 꼬리표 (태그)
  tag: [
    "............",
    "............",
    "...#########",
    "..#KKKKKKKK#",
    ".#KK#KKKKKN#",
    "#KK#w#KKKKN#",
    ".#KK#KKKKKN#",
    "..#KNNNNNNN#",
    "...#########",
    "............",
    "............",
    "............",
  ],
  // 돋보기 (검색)
  search: lined([
    "............",
    "...iiii.....",
    "..Iiiiiv....",
    ".IIiiiiiv...",
    ".Iiiiiiiv...",
    ".iiiiiivv...",
    "..iiiivv....",
    "...vvvvbb...",
    ".......bbn..",
    "........bbn.",
    ".........nn.",
    "............",
  ]),
  // 불꽃 (인기)
  fire: lined([
    "............",
    ".....K......",
    "....KK......",
    "....KKK..K..",
    "...KKzKK.K..",
    "..KKKzKKKK..",
    "..KKzzzKKK..",
    ".KKzzZzzKKK.",
    ".KKzZZZzKKN.",
    ".NKzZZZzKNN.",
    "..NNzzzNNN..",
    "............",
  ]),
  // 발자국 (방문자·걷기)
  foot: lined([
    "............",
    "..BB........",
    ".BBBB.......",
    ".BBBB...BB..",
    ".BbBB..BBBB.",
    "..bb...BBBB.",
    "..bb...BbBB.",
    "........bb..",
    "........bb..",
    "............",
    "............",
    "............",
  ]),
  // 열쇠 (로그인)
  key: lined([
    "............",
    "............",
    "..zzz.......",
    ".zZZzz......",
    ".zZ#zzzzzzz.",
    ".zzzzu..u.u.",
    "..uuu...u.u.",
    "............",
    "............",
    "............",
    "............",
    "............",
  ]),
  // 팻말 (빈 집터)
  sign: lined([
    "............",
    ".BBBBBBBBBB.",
    ".BccccccccB.",
    ".BcddddddcB.",
    ".BccccccccB.",
    ".BcddddcccB.",
    ".BccccccccB.",
    ".BBBBBBBBBB.",
    ".....bn.....",
    ".....bn.....",
    "....bbnn....",
    "............",
  ]),
  // 사람 (내 프로필·회원정보)
  user: lined([
    "............",
    "....HHHH....",
    "...HHHHHH...",
    "...f#ff#f...",
    "...fpffpf...",
    "....ffff....",
    "............",
    "..55555555..",
    ".5555555555.",
    ".5555555556.",
    ".6666666666.",
    "............",
  ]),
  // 깨어나는 병아리 (부화)
  chick: lined([
    "............",
    "....zzzz....",
    "...zZzzzz...",
    "...z#zz#z...",
    "...zzKKzz...",
    "...zzzzzu...",
    "..w#ww#ww#..",
    "..wwwwwwwc..",
    "..wwwwwwcc..",
    "...wwwwcc...",
    "....cccc....",
    "............",
  ]),
  // 젖병 (아기 모습)
  bottle: lined([
    "............",
    ".....yy.....",
    "....yyyy....",
    "...VVVVVV...",
    "....IIIi....",
    "....IwIi....",
    "....IIIi....",
    "....wwwi....",
    "....wwwi....",
    "....wwwi....",
    "....yyyy....",
    "............",
  ]),
  // 당근 (밥 주기)
  carrot: lined([
    "............",
    "........l.l.",
    ".......lLl..",
    "......KKl...",
    ".....KKKK...",
    "....KKKKN...",
    "....KKKN....",
    "...KKKN.....",
    "...KKN......",
    "..KNN.......",
    "..N.........",
    "............",
  ]),
  // 물방울 (물 주기)
  drop: lined([
    "............",
    ".....i......",
    ".....i......",
    "....iii.....",
    "....iiv.....",
    "...iIiiv....",
    "..iIiiiiv...",
    "..iIiiiiv...",
    "..iiiiivv...",
    "...iiivv....",
    "....vvv.....",
    "............",
  ]),
  // 손 (쓰다듬기)
  hand: lined([
    "............",
    "...f.f.f....",
    "...f.f.f.f..",
    "...f.f.f.f..",
    "...fffffff..",
    ".f.fffffff..",
    ".fffffffff..",
    "..ffffffgf..",
    "...ffffgg...",
    "....fffg....",
    "....fffg....",
    "............",
  ]),
  // 장바구니 (상점에서 더 사기)
  cart: lined([
    "............",
    "............",
    ".bb.........",
    "...KKKKKKKK.",
    "...KwKwKwKN.",
    "....KKKKKN..",
    "....NNNNNN..",
    "....b.......",
    "....bbbbbbb.",
    ".....X...X..",
    "............",
    "............",
  ]),
  // 디스켓 (저장)
  save: lined([
    "............",
    ".TTTTTTTTT..",
    ".TwwwwwwwTT.",
    ".TwwwwwwwTT.",
    ".TTTTTTTTTT.",
    ".TTYYYYYYTT.",
    ".TTYYYYYYTT.",
    ".TTYYyyYYTT.",
    ".TTYYyyYYTT.",
    ".tttttttttt.",
    "............",
    "............",
  ]),
  // 상자 (가구 빼기)
  box: lined([
    "............",
    "............",
    ".BBBBccBBBB.",
    ".BBBBccBBBb.",
    ".nnnnnnnnnn.",
    ".BBBBBBBBBb.",
    ".BBBBBBBBBb.",
    ".BBBBBBBBBb.",
    ".BBBBBBBBBb.",
    ".bbbbbbbbbb.",
    "............",
    "............",
  ]),
  // 초록 확인 (출석 완료)
  check: lined([
    "............",
    ".LLLLLLLLLL.",
    ".Lllllllllm.",
    ".Lllllllwlm.",
    ".Llllllwwlm.",
    ".Llwllwwllm.",
    ".Llwwwwlllm.",
    ".Lllwwllllm.",
    ".Lllllllllm.",
    ".mmmmmmmmmm.",
    "............",
    "............",
  ]),
  // 폭죽 (축하)
  party: party(),
  // 두루마리 (릴리스 노트)
  scroll: lined([
    "............",
    "..9999999...",
    ".kkkkkkkkk..",
    "..kddddddk..",
    "..kkkkkkkk..",
    "..kddddddk..",
    "..kkkkkkkk..",
    "..kdddddkk..",
    "..kkkkkkkk..",
    ".kkkkkkkkk..",
    "..9999999...",
    "............",
  ]),
  // 나침반 (길 잃음)
  compass: compass(),
  // 공사 중 (오류)
  cone: lined([
    "............",
    "............",
    ".zzqqzzqqzz.",
    ".zqqzzqqzzq.",
    ".qqzzqqzzqq.",
    ".zzqqzzqqzz.",
    "..X.....X...",
    "..X.....X...",
    "..X.....X...",
    ".XXX...XXX..",
    "............",
    "............",
  ]),
  // 소 (동물 농장)
  cow: lined([
    "............",
    "..y......y..",
    ".nwwwwwwwwn.",
    "..w#wwww#w..",
    "..wwwwnnww..",
    "..wwwwnnww..",
    "..VVVVVVVV..",
    "..VRVVVVRV..",
    "..VVVVVVVV..",
    "............",
    "............",
    "............",
  ]),
  // 분수 (광장)
  fountain: fountain(),
  // 사슬 (링크)
  link: [
    "............",
    "............",
    "............",
    ".####..####.",
    "#YYYY##YYYY#",
    "#Y##YYYY##Y#",
    "#xxxx##xxxx#",
    ".####..####.",
    "............",
    "............",
    "............",
    "............",
  ],
  // 종이 (글·파일)
  file,
} satisfies Record<string, Sprite>;

/** 아이콘 이름 */
export type IconName = keyof typeof ICONS;
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

const cache = new Map<string, string>();
/** 아이콘 data URI (scale = 정수 배율, 기본 2배 = 24px) */
export function iconDataUri(name: IconName, scale = 2): string {
  const key = `${name}@${scale}`;
  let uri = cache.get(key);
  if (!uri) {
    uri = svgDataUri(spriteSvg(ICONS[name], { scale, colors: COLORS }));
    cache.set(key, uri);
  }
  return uri;
}

/** 아이콘 SVG 글자 (1배, 12×12). 화면에서 몇 배로 그리든 같은 파일을 쓴다 (도트는 crispEdges라 늘려도 또렷하다) */
export function iconSvg(name: IconName): string {
  return spriteSvg(ICONS[name], { scale: 1, colors: COLORS });
}

const srcCache = new Map<IconName, string>();
/**
 * 아이콘 주소 `/px/<이름>?v=<그림 해시>` (src/app/px/[icon]/route.ts가 그린다).
 * 같은 아이콘이 한 화면에 수십 번 나와도 브라우저가 한 번만 받아 오래 캐시한다 (data URI는 매번 HTML에 통째로 들어가 상점 HTML이 0.9MB였다).
 * 그림이 바뀌면 해시가 바뀌어 새로 받는다
 */
export function iconSrc(name: IconName): string {
  let src = srcCache.get(name);
  if (!src) {
    src = `/px/${name}?v=${contentHash(iconSvg(name))}`;
    srcCache.set(name, src);
  }
  return src;
}

/** 파일 아이콘 (띠 색만 바꾼다, 글 본문 첨부 카드용) */
export function fileIconDataUri(band: string, scale = 2): string {
  return svgDataUri(spriteSvg(ICONS.file, { scale, colors: { ...COLORS, C: band } }));
}

/** 아이콘 그림 줄 (시험용) */
export function iconRows(name: IconName): Sprite {
  return ICONS[name];
}
