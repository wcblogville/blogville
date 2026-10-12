// 아바타 꾸미기 그림 (SHOP-06): 도트 캐릭터(16×24, src/lib/art/characters.ts) 위에 겹치는 모자·옷·소품.
// 모든 캐릭터가 같은 자리를 쓴다: 머리 0~12줄(눈 7~9줄, 4·5칸과 10·11칸), 몸 13~21줄(팔 1~3칸·12~14칸).
// 한 글자 = 한 픽셀, "." = 투명(아래 캐릭터가 보인다). 글자 뜻은 pixel.ts PALETTE + 아래 AVATAR_COLORS.
// 머리 모양·머리 색(미용실, 2026-10-11)도 같은 목록에 넣는다: 머리 모양은 hair.ts의 글자 줄, 머리 색은 그림 없이 색만 바꾼다.
// 얼굴형(미용실, 2026-10-12)은 faces.ts의 머리(0~12줄) 글자 줄: 캐릭터 그림의 머리를 바꾼다 (characters.ts lookGrid).
import { FACE_SHAPES } from "./faces";
import { HAIR_COLORS, HAIR_STYLES } from "./hair";
import { spriteRects, type Sprite } from "./pixel";

/** 부위: 모자·옷·소품 (SHOP-06) + 미용실의 머리 모양(hair)·머리 색(hair_color)·얼굴형(face_shape, 2026-10-12) */
export type AvatarSlot = "hat" | "outfit" | "accessory" | "hair" | "hair_color" | "face_shape";
export const AVATAR_SLOTS: readonly AvatarSlot[] = ["hair", "hair_color", "face_shape", "hat", "outfit", "accessory"];
/** 캐릭터 그림 자체를 바꾸는 부위 (사람 주민만, 그림 조각 SVG가 없다) */
export const LOOK_SLOTS: readonly AvatarSlot[] = ["hair", "hair_color", "face_shape"];

/**
 * 아바타 아이템만 쓰는 색. 주황 후드티 O·r·s, 보라 로브 C·W·J (아래에 옷가게 더하기 색).
 * 캐릭터 글자(f 피부, 7·8·9 털)는 쓰지 않는다: 손·얼굴처럼 캐릭터마다 다른 칸은 "."로 비워 아래가 보이게 한다
 */
export const AVATAR_COLORS = {
  O: "#ffc0a0",
  r: "#ff8a65",
  s: "#d0584e",
  C: "#c3aefc",
  W: "#8f6fe0",
  J: "#5f45a8",
  // 옷가게 더하기 (2026-10-11): 까만 천 D·S, 분홍 드레스 +·=·%, 우주복 @·~
  D: "#3b3550",
  S: "#5c5476",
  "+": "#ffe3ef",
  "=": "#ffb3d1",
  "%": "#e57fae",
  "@": "#f4f7fb",
  "~": "#b9c4d6",
};

type Part = { slot: AvatarSlot; rows: Sprite; /** 얼굴 위에 쓰는 것 (안경): 뒷모습에서는 그리지 않는다 */ face?: boolean };

const PARTS: Record<string, Part> = {
  // 모자: 밀짚모자 (빨간 띠, 넓은 챙)
  "hat.straw": {
    slot: "hat",
    rows: [
      "....########....",
      "...#ZZZzzzzz#...",
      "...#Zzzzzzzu#...",
      "...#NNNNNNNQ#...",
      ".##############.",
      "#ZZzzzzzzzzzzzu#",
      ".##############.",
    ],
  },
  // 리본 머리핀 (오른쪽 위)
  "hat.ribbon": {
    slot: "hat",
    rows: [
      "................",
      "........##...##.",
      "........#V#.#V#.",
      "........#VVRVR#.",
      "........#V#R#R#.",
      "........##.#.##.",
    ],
  },
  // 털모자 (방울, 골지 띠)
  "hat.beanie": {
    slot: "hat",
    rows: [
      "......#ww#......",
      "....###ww###....",
      "..#iiiivvvvvv#..",
      ".#iiivvvvvvvvt#.",
      ".#ivvvvvvvvvvt#.",
      "#tTtTtTtTtTtTtT#",
      ".##############.",
    ],
  },
  // 옷: 멜빵바지 (금색 단추)
  "outfit.overalls": {
    slot: "outfit",
    rows: [
      ...Array<string>(13).fill("................"),
      "....t......t....",
      "....tzTTTTzt....",
      "....TTTTTTTt....",
      "....TTTqTTTt....",
      "..##TTTTTTTt##..",
      "...#TTTTTTtt#...",
      "...#TTT##Ttt#...",
      "...#TTT##Ttt#...",
    ],
  },
  // 후드티 (끈 두 줄, 주머니)
  "outfit.hoodie": {
    slot: "outfit",
    rows: [
      ...Array<string>(13).fill("................"),
      "..#Orrwrrwrrs#..",
      ".#O#Orwrrwrs#s#.",
      ".#O#rrrrrrrs#s#.",
      "....rssssssr....",
      "..##rrrrrrrs##..",
    ],
  },
  // 노란 원피스 (분홍 물방울)
  "outfit.dress": {
    slot: "outfit",
    rows: [
      ...Array<string>(13).fill("................"),
      "..#zZZwwZZzzu#..",
      "....zZZZZzzu....",
      "....zZVZZzzu....",
      "....zzzzzzzu....",
      "..#zZVzzzzzzu#..",
      ".#zZZzzzzVzzzu#.",
      ".#zVzzzzzzzVzu#.",
      ".##############.",
    ],
  },
  // 소품: 동그란 안경
  "acc.glasses": {
    slot: "accessory",
    face: true,
    rows: [
      ...Array<string>(6).fill("................"),
      "...####..####...",
      "...#..####..#...",
      "...#..#..#..#...",
      "...####..####...",
    ],
  },
  // 빨간 목도리 (흰 줄무늬, 늘어진 끝)
  "acc.scarf": {
    slot: "accessory",
    rows: [
      ...Array<string>(13).fill("................"),
      "..#KKwKKwKKwN#..",
      ".........#KN#...",
      ".........#KN#...",
      ".........#wQ#...",
      ".........####...",
    ],
  },
  // 가방 (어깨끈 + 금색 잠금쇠)
  "acc.bag": {
    slot: "accessory",
    rows: [
      ...Array<string>(13).fill("................"),
      "....n...........",
      ".....n..........",
      "......n.........",
      ".......n.######.",
      "........n#BBBb#.",
      ".........#zBbb#.",
      ".........#bbbn#.",
      ".........######.",
    ],
  },
  // ===== 옷가게 (2026-10-11): 새 옷과 모자 =====
  // 깔끔한 정장 (남색 재킷, 빨간 넥타이)
  "outfit.suit": {
    slot: "outfit",
    rows: [
      ...Array<string>(13).fill("................"),
      "..#ttwwNNwwtt#..",
      ".#t#twwNNwwt#t#.",
      ".#t#ttwNNwtt#t#.",
      "...#tttNQttt#...",
      "..##ttttzttt##..",
    ],
  },
  // 색동 한복 (노란 저고리, 빨간 고름과 치마)
  "outfit.hanbok": {
    slot: "outfit",
    rows: [
      ...Array<string>(13).fill("................"),
      "..#ZZwwRRwwZz#..",
      ".#K#ZZZRRZZz#K#.",
      ".#z#ZZZRRZZz#z#.",
      ".#i#zzzzRzzz#i#.",
      "..#NNNNNNNNNQ#..",
      ".#NNNNNNNNNNNQ#.",
      ".#NKNNNNNNNNQQ#.",
      "#NNNNNNNNNNNNQQ#",
      "################",
    ],
  },
  // 마법사 로브 (보라, 금색 별, 밧줄 허리띠)
  "outfit.wizard": {
    slot: "outfit",
    rows: [
      ...Array<string>(13).fill("................"),
      "..#CWWWwwWWWJ#..",
      ".#C#CWWzWWWJ#J#.",
      ".#W#CWWWWWWJ#J#.",
      ".#W#WWWWWzWJ#J#.",
      "..##uuuuuuuu##..",
      "..#CWWWWWWWWJ#..",
      "..#CWzWWWWWWJ#..",
      ".#CWWWWWWWzWWJ#.",
      ".##############.",
    ],
  },
  // 기사 갑옷 (은색 갑옷, 파란 겉옷과 금색 문장)
  "outfit.knight": {
    slot: "outfit",
    rows: [
      ...Array<string>(13).fill("................"),
      "..#YYyTTTTyYx#..",
      ".#Y#YyTzzTyx#x#.",
      ".#y#YyTzzTyx#x#.",
      ".#x#yyTTTTxx#X#.",
      "..##XXXzzXXX##..",
      "...#yyyyyyyy#...",
      "...#yyy##yxx#...",
      "...#yxx##yxx#...",
      "..#XXXX##XXXX#..",
    ],
  },
  // 요리사 옷 (흰 두 줄 단추, 빨간 스카프)
  "outfit.chef": {
    slot: "outfit",
    rows: [
      ...Array<string>(13).fill("................"),
      "..#wwwNNNNwwy#..",
      ".#w#wwwNNwwy#y#.",
      ".#w#wxwwwxwy#y#.",
      "...#wwwwwwwy#...",
      "..##wxwwwxwy##..",
    ],
  },
  // 줄무늬 잠옷 (하늘색 줄무늬, 분홍 슬리퍼)
  "outfit.pajama": {
    slot: "outfit",
    rows: [
      ...Array<string>(13).fill("................"),
      "..#iwiiwwiiwv#..",
      ".#i#wiiwwiiw#v#.",
      ".#w#wiiwwiiw#w#.",
      "...#iiiwwiii#...",
      "..##vvvvvvvv##..",
      "...#iwiiwiiw#...",
      "...#iwi##wiw#...",
      "...#iwi##wiw#...",
      "..#VVVV##VVVV#..",
    ],
  },
  // 마법사 모자 (보라 고깔, 금색 별)
  "hat.wizard": {
    slot: "hat",
    rows: [
      ".......##.......",
      "......#WJ#......",
      ".....#CWzJ#.....",
      "....#CWWWWJ#....",
      ".##############.",
      "#CWWWWWWWWWWWWJ#",
      ".##############.",
    ],
  },
  // 금관 (빨간 보석)
  "hat.crown": {
    slot: "hat",
    rows: [
      "..#...#..#...#..",
      "..#Z#.#ZZ#.#u#..",
      "..#ZZ##zz##zu#..",
      "..#ZzzzNNzzzu#..",
      "..############..",
    ],
  },
  // 요리사 모자 (높고 하얀 모자)
  "hat.chef": {
    slot: "hat",
    rows: [
      "....########....",
      "...#wwwwwwwy#...",
      "..#wwwwwwwwwy#..",
      "..#wwwwwwwwyy#..",
      "...#wwwwwwwy#...",
      "..#ywwwwwwwyy#..",
      "..############..",
    ],
  },
  // ===== 옷가게 더하기 (사용자 요청 2026-10-11 "돈 사용할 사용처 많아지게") =====
  // 빨간 줄무늬 티셔츠 (반팔)
  "outfit.tshirt": {
    slot: "outfit",
    rows: [
      ...Array<string>(13).fill("................"),
      "..#NNNNggNNNQ#..",
      ".#N#wwwwwwwy#Q#.",
      ".#f#NNNNNNNQ#f#.",
      ".#f#wwwwwwwy#f#.",
    ],
  },
  // 노란 비옷과 장화
  "outfit.raincoat": {
    slot: "outfit",
    rows: [
      ...Array<string>(13).fill("................"),
      "..#ZZzwggwzzu#..",
      ".#Z#zzzuuzzu#u#.",
      ".#z#zzzzzzzu#u#.",
      ".#z#zzzuzzzu#u#.",
      "..#zzzzzzzzzu#..",
      "..#zZzzuzzzzu#..",
      "..############..",
      "................",
      "..#zzzu##zzzu#..",
    ],
  },
  // 초록 니트 스웨터 (분홍 하트)
  "outfit.sweater": {
    slot: "outfit",
    rows: [
      ...Array<string>(13).fill("................"),
      "..#mlLLggLLlm#..",
      ".#l#lllllllm#m#.",
      ".#l#lVlllVlm#m#.",
      ".#l#mlmlmlmm#m#.",
      "..##lmlmlmlm##..",
    ],
  },
  // 파란 체육복 (흰 줄, 흰 운동화)
  "outfit.tracksuit": {
    slot: "outfit",
    rows: [
      ...Array<string>(13).fill("................"),
      "..#ivvwggwvvt#..",
      ".#w#ivvzzvvt#w#.",
      ".#w#vvvzzvvt#w#.",
      ".#v#vvvzzvvt#t#.",
      "..##tttttttt##..",
      "...#wvvvvvvw#...",
      "...#wvv##vvw#...",
      "...#wvv##vvw#...",
      "..#wwww##wwww#..",
    ],
  },
  // 세일러복 (남색 깃, 빨간 스카프, 주름치마)
  "outfit.sailor": {
    slot: "outfit",
    rows: [
      ...Array<string>(13).fill("................"),
      "..#tttwggwttt#..",
      ".#w#ttwNNwtt#w#.",
      ".#f#wwwNNwwy#f#.",
      ".#f#wwwwwwwy#f#.",
      "..#tTtTtTtTtq#..",
      ".#tTtTtTtTtTtq#.",
      ".##############.",
      "....#ff##ff#....",
      "...#qqq##qqq#...",
    ],
  },
  // 의사 가운 (청진기, 하늘색 셔츠)
  "outfit.doctor": {
    slot: "outfit",
    rows: [
      ...Array<string>(13).fill("................"),
      "..#wwiiggiiwy#..",
      ".#w#wwiiiiwy#y#.",
      ".#w#wxiiiixy#y#.",
      ".#f#wwxxxxwy#f#.",
      "..##wwwiiwwy##..",
      "...#wwtttwwy#...",
      "...#wwt##twy#...",
      "...#wyt##tyy#...",
    ],
  },
  // 해적 옷 (검은 조끼, 빨간 허리띠, 줄무늬 바지, 장화)
  "outfit.pirate": {
    slot: "outfit",
    rows: [
      ...Array<string>(13).fill("................"),
      "..#DDwwggwwDD#..",
      ".#w#DwwwwwwD#w#.",
      ".#w#DwwzwwwD#w#.",
      ".#f#DwwwwwwD#f#.",
      "..##NNNNNNKN##..",
      "...#wtwtwtwt#...",
      "...#wtw##twt#...",
      "...#wtw##twt#...",
      "..#bbbn##bbbn#..",
    ],
  },
  // 닌자 옷 (까만 옷, 빨간 띠)
  "outfit.ninja": {
    slot: "outfit",
    rows: [
      ...Array<string>(13).fill("................"),
      "..#SDDDggDDDD#..",
      ".#S#SDDDDDDD#D#.",
      ".#D#SDDSDDDD#D#.",
      ".#D#DDDDDDDD#D#.",
      "..##NNNNNNNQ##..",
      "...#SDDDDDDD#...",
      "...#SDD##DDD#...",
      "...#DDD##DDD#...",
      "..#DDDD##DDDD#..",
    ],
  },
  // 우주복 (하얀 옷, 가슴 조작판)
  "outfit.astronaut": {
    slot: "outfit",
    rows: [
      ...Array<string>(13).fill("................"),
      "..#@@@@gg@@@~#..",
      ".#@#@@@@@@@~#~#.",
      ".#@#@vvKz@@~#~#.",
      ".#~#@vvNi@@~#~#.",
      "..##xxxxxxxx##..",
      "...#@@@@@@@~#...",
      "...#@@@##@@~#...",
      "...#@@@##@@~#...",
      "..#xxxx##xxxx#..",
    ],
  },
  // 왕자 옷 (파란 재킷, 금빛 견장과 단추, 흰 바지)
  "outfit.prince": {
    slot: "outfit",
    rows: [
      ...Array<string>(13).fill("................"),
      "..#zzTTggTTzz#..",
      ".#z#TTwzzwTt#z#.",
      ".#T#TTzTTzTt#t#.",
      ".#f#TTzTTzTt#f#.",
      "..##uuuzzuuu##..",
      "...#wwwwwwwy#...",
      "...#wwy##wwy#...",
      "...#wwy##wwy#...",
      "..#DDDD##DDDD#..",
    ],
  },
  // 공주 드레스 (분홍 드레스, 금빛 장식)
  "outfit.princess": {
    slot: "outfit",
    rows: [
      ...Array<string>(13).fill("................"),
      "..#%=+=gg=+=%#..",
      ".#+#==+zz+=%#%#.",
      ".#f#==+==+=%#f#.",
      ".#f#%=====%%#f#.",
      "..#==+===+==%#..",
      ".#=+==+==+==+%#.",
      "#=+==+==+==+=%%#",
      "#=+==+==+==+=%%#",
      "################",
    ],
  },
  // 황금 예복 (금빛 옷, 털 깃, 빨간 망토)
  "outfit.royal": {
    slot: "outfit",
    rows: [
      ...Array<string>(13).fill("................"),
      "..#wDwwggwwDw#..",
      ".#N#zZzuuzZu#Q#.",
      ".#N#zZziizZu#Q#.",
      ".#f#zzzuuzzu#f#.",
      ".N#zZzzzzzzzu#Q.",
      ".N#zZzzizzzzu#Q.",
      "NN#zZzzzzzzzu#QQ",
      "NN#zzzzzzzzzu#QQ",
      "################",
    ],
  },
  // ===== 옷가게 더하기 (사용자 요청 2026-10-12 "옷이랑 머리 더 만들어줘") =====
  // 크림색 가디건 (흰 셔츠, 나무 단추)
  "outfit.cardigan": {
    slot: "outfit",
    rows: [
      ...Array<string>(13).fill("................"),
      "..#ccwwggwwcd#..",
      ".#c#cdwwwwcd#d#.",
      ".#c#cbwwwwbd#d#.",
      "...#ccdwwcdd#...",
      "..##cbccccbd##..",
    ],
  },
  // 청재킷과 청바지 (흰 티, 금색 단추, 흰 운동화)
  "outfit.denim": {
    slot: "outfit",
    rows: [
      ...Array<string>(13).fill("................"),
      "..#ivwwggwwvt#..",
      ".#i#ivwwwwvt#t#.",
      ".#v#vzwwwwzt#t#.",
      "...#ivvwwvvt#...",
      "..##tvvvvvvt##..",
      "...#ivvvvvvt#...",
      "...#ivv##vvt#...",
      "...#ivv##ivt#...",
      "..#wwww##wwww#..",
    ],
  },
  // 교복 (회색 재킷, 초록 넥타이, 금색 학교 문장, 체크 바지)
  "outfit.school": {
    slot: "outfit",
    rows: [
      ...Array<string>(13).fill("................"),
      "..#yywwmmwwyx#..",
      ".#y#yywmmwyx#x#.",
      ".#y#yzwmmwyx#x#.",
      "...#yyywwyyx#...",
      "..##yyyxxyyx##..",
      "...#tNttNttq#...",
      "...#NtN##NtN#...",
      "...#tNt##tNt#...",
      "..#DDDD##DDDD#..",
    ],
  },
  // 하와이안 셔츠 (꽃무늬, 모래색 반바지, 샌들)
  "outfit.hawaiian": {
    slot: "outfit",
    rows: [
      ...Array<string>(13).fill("................"),
      "..#iiVwggwViv#..",
      ".#i#iRiiiiZv#v#.",
      ".#f#iiiRiiiv#f#.",
      ".#f#iZiiiRiv#f#.",
      "..##iiiiiiiv##..",
      "...#aaaaaaaA#...",
      "...#aaA##aaA#...",
      "...#fff##fff#...",
      "..#nbbn##nbbn#..",
    ],
  },
  // 카페 앞치마 (흰 셔츠 위 초록 앞치마)
  "outfit.apron": {
    slot: "outfit",
    rows: [
      ...Array<string>(13).fill("................"),
      "..#wlwwggwwly#..",
      ".#w#wllllllw#y#.",
      ".#w#wllmlllw#y#.",
      "...#wlmmmllw#...",
      "..##llllllll##..",
      "...#llllllmm#...",
    ],
  },
  // 도령 한복 (하늘색 저고리, 남색 고름, 흰 바지와 대님)
  "outfit.dopo": {
    slot: "outfit",
    rows: [
      ...Array<string>(13).fill("................"),
      "..#iiwwggwwiv#..",
      ".#i#iiwttwiv#v#.",
      ".#i#iiiitiiv#v#.",
      ".#v#iiiitiiv#v#.",
      "..##iiiiiiiv##..",
      "...#wwwwwwwy#...",
      "...#wwy##wwy#...",
      "...#qqq##qqq#...",
      "..#DDDD##DDDD#..",
    ],
  },
  // 꿀벌 옷 (노랑·검정 줄무늬, 등에 날개)
  "outfit.bee": {
    slot: "outfit",
    rows: [
      ...Array<string>(13).fill("................"),
      "..#Zzzzggzzzu#..",
      ".#D#DDDDDDDD#D#.",
      ".#z#zzzzzzzu#u#.",
      "...#DDDDDDDD#...",
      "..##zzzzzzzu##..",
      "...#DDDDDDDD#...",
      "...#DDD##DDD#...",
      "...#DDD##DDD#...",
      "..#DDDD##DDDD#..",
    ],
  },
  // 공룡 옷 (초록 옷, 크림색 배, 등에 노란 가시와 꼬리)
  "outfit.dino": {
    slot: "outfit",
    rows: [
      ...Array<string>(13).fill("................"),
      "..#lllLggLllm#..",
      ".#l#lcccccLm#m#.",
      ".#l#lcccccLm#m#.",
      "...#lllccllm#...",
      "..##lllccllm##..",
      "...#llllllmm#...",
      "...#lll##llm#...",
      "...#lll##llm#...",
      "..#mmmm##mmmm#..",
    ],
  },
  // 소방관 옷 (빨간 방화복, 빛나는 노랑 띠, 까만 장화)
  "outfit.firefighter": {
    slot: "outfit",
    rows: [
      ...Array<string>(13).fill("................"),
      "..#KNNNggNNNQ#..",
      ".#K#NNzNNzNQ#Q#.",
      ".#Z#ZZZZZZZZ#Z#.",
      "...#NNzNNzNQ#...",
      "..##ZZZZZZZZ##..",
      "...#NNNNNNNQ#...",
      "...#NNQ##NNQ#...",
      "...#ZZZ##ZZZ#...",
      "..#DDDD##DDDD#..",
    ],
  },
  // 드라큘라 망토 (까만 연미복, 빨간 나비넥타이, 안이 빨간 망토)
  "outfit.vampire": {
    slot: "outfit",
    rows: [
      ...Array<string>(13).fill("................"),
      ".N#DDwwggwwDD#N.",
      "N#D#DwwNNwwD#D#N",
      "N#D#DDwwwwDD#D#N",
      "N..#DDDwwDDD#..N",
      "NN##DDDDDDDD##NN",
      "NQ.#DDDDDDDS#.QN",
      "NQ.#DDS##DDS#.QN",
      "NQ.#DDS##DDS#.QN",
      "QQ#DDDD##DDDD#QQ",
    ],
  },
  // 모자: 파란 야구 모자
  "hat.cap": {
    slot: "hat",
    rows: [
      ".....######.....",
      "...##iiivvv##...",
      "..#iivvvvvvvt#..",
      ".#ivvvvzzvvvtt#.",
      ".#vvvvvzzvvvtt#.",
      "#iiivvvvvvvvvvt#",
      ".##############.",
    ],
  },
  // 꽃 화관
  "hat.flower": {
    slot: "hat",
    rows: [
      "................",
      "................",
      "..#V#..#z#..#U#.",
      ".#VwV##zwz##UwU#",
      ".#lVlmmlzlmmlUl#",
      "..#l#..#l#..#l#.",
    ],
  },
  // 빨간 베레모
  "hat.beret": {
    slot: "hat",
    rows: [
      ".......#........",
      ".....######.....",
      "...##KKNNNNN##..",
      "..#KNNNNNNNNNQ#.",
      ".#NNNNNNNNNNNQQ#",
      ".#QQQQQQQQQQQQ#.",
      "..############..",
    ],
  },
  // 고양이 귀 머리띠
  "hat.catears": {
    slot: "hat",
    rows: [
      "..##........##..",
      "..#D#......#D#..",
      ".#DVD#....#DVD#.",
      ".#DDDDDDDDDDDD#.",
      "..############..",
    ],
  },
  // 산타 모자 (흰 방울)
  "hat.santa": {
    slot: "hat",
    rows: [
      "......#####.....",
      "....##KNNNN##ww.",
      "...#KNNNNNNNN#ww",
      "..#KNNNNNNNNNQ#.",
      ".#wwwwwwwwwwwy#.",
      "#Ywwwwwwwwwwwwy#",
      ".##############.",
    ],
  },
  // 실크햇 (빨간 띠)
  "hat.tophat": {
    slot: "hat",
    rows: [
      "...##########...",
      "...#SDDDDDDD#...",
      "...#SDDDDDDD#...",
      "...#NNNNNNNQ#...",
      ".##############.",
      "#SDDDDDDDDDDDDD#",
      ".##############.",
    ],
  },
  // 해적 모자 (해골 무늬, 금빛 테)
  "hat.pirate": {
    slot: "hat",
    rows: [
      "................",
      "...##########...",
      "..#DDDDDDDDDD#..",
      ".#DDDDDwwDDDDD#.",
      "#DDDDDwDwDDDDDD#",
      "#zzzzzzzzzzzzzz#",
      ".##############.",
    ],
  },
  // 보석 티아라
  "hat.tiara": {
    slot: "hat",
    rows: [
      "................",
      ".......##.......",
      "...#..#ZZ#..#...",
      "..#Z##zVVz##Z#..",
      "..#zZziziziZz#..",
      "..############..",
    ],
  },
  // 소품: 까만 선글라스
  "acc.sunglasses": {
    slot: "accessory",
    face: true,
    rows: [
      ...Array<string>(6).fill("................"),
      "..#####..#####..",
      "..#DDD####DDD#..",
      "..#SDD#..#SDD#..",
      "...###....###...",
    ],
  },
  // 빨간 나비넥타이
  "acc.bowtie": {
    slot: "accessory",
    rows: [
      ...Array<string>(13).fill("................"),
      "....##.##.##....",
      "....#NNQQNN#....",
      "....##.##.##....",
    ],
  },
  // 헤드폰
  "acc.headphones": {
    slot: "accessory",
    rows: [
      "....########....",
      "..##xxxxxxxx##..",
      ".#x##......##x#.",
      ".#x#........#x#.",
      ".#x#........#x#.",
      ".#x#........#x#.",
      "###..........###",
      "#N#..........#N#",
      "#K#..........#K#",
      "#N#..........#N#",
      "###..........###",
    ],
  },
  // 진주 목걸이
  "acc.necklace": {
    slot: "accessory",
    rows: [
      ...Array<string>(13).fill("................"),
      "....w......w....",
      ".....wwiiww.....",
      ".......ii.......",
    ],
  },
  // 외눈 안경 (금빛 줄)
  "acc.monocle": {
    slot: "accessory",
    face: true,
    rows: [
      ...Array<string>(6).fill("................"),
      ".........####...",
      ".........#..#...",
      ".........#..#...",
      ".........####z..",
      "............z...",
      "...........z....",
    ],
  },
  // 무도회 가면
  "acc.mask": {
    slot: "accessory",
    face: true,
    rows: [
      "................",
      "................",
      "................",
      "................",
      "............#V#.",
      "............#U#.",
      "..##UUUUUUUU##..",
      ".#UU..UUUU..UU#.",
      ".#WU..UzzU..UW#.",
      "..#WWWW##WWWW#..",
    ],
  },
  // 금메달 (빨간 끈)
  "acc.medal": {
    slot: "accessory",
    rows: [
      ...Array<string>(13).fill("................"),
      "....N......N....",
      ".....N....N.....",
      "......#zz#......",
      "......#Zu#......",
    ],
  },
};

// 머리 모양 (미용실): 글자 줄은 hair.ts. 머리 색은 그림이 없다 (color만, characters.ts가 머리카락 칸을 칠한다)
for (const [key, rows] of Object.entries(HAIR_STYLES)) PARTS[key] = { slot: "hair", rows };
for (const key of Object.keys(HAIR_COLORS)) PARTS[key] = { slot: "hair_color", rows: [] };
// 얼굴형 (미용실, 2026-10-12): 머리 0~12줄 전체. 얼굴 위를 덮는 그림이라 face
for (const [key, rows] of Object.entries(FACE_SHAPES)) PARTS[key] = { slot: "face_shape", rows, face: true };

/**
 * 뒷모습 (사용자 요청 2026-10-12 "정장같은 옷 입었을때 위로 올라가면 옷이 뒷모습이 보여야하는데 계속 앞모습만 보인다"):
 * 위로 걸을 때(뒷모습) 옷·모자·소품의 앞에만 있는 무늬를 지운다. 그림을 새로 그리지 않고 앞모습 글자 줄에서 만든다.
 * - details: 앞에만 있는 글자 (단추·넥타이·셔츠 깃·드러난 목·주머니·문장·보석·해골). 옷은 몸통(13~17줄, 3~12칸) 안에서만,
 *   모자·소품은 그림 전체에서 같은 줄의 가장 가까운 옷감 글자로 덮는다 (팔·바지 줄무늬처럼 뒤에도 있는 것은 그대로)
 * - hide: 앞에만 다는 소품(나비넥타이·목걸이·메달)은 뒤에서 보이지 않는다
 * - keepRows: 앞으로 늘어진 부분(목도리 끝)은 빼고 위의 n줄만
 * - cape: 등을 덮는 망토 [천, 그늘] (13~20줄 몸통을 덮는다)
 * - over: 등에만 있는 것 (꿀벌 날개, 공룡 가시·꼬리). 앞 무늬를 지운 뒤 그 위에 겹친다 (2026-10-12)
 */
type Back = { details?: string; hide?: boolean; keepRows?: number; cape?: readonly [string, string]; over?: Sprite };

const BLANK_TOP = Array<string>(13).fill("................");
/** 꿀벌 옷 등: 투명한 날개 두 장 */
const BEE_WINGS: Sprite = [
  ...BLANK_TOP,
  "...#I#....#I#...",
  "..#IiI#..#IiI#..",
  "..#IiI#..#IiI#..",
  "...###....###...",
];
/** 공룡 옷 등: 등뼈를 따라 난 노란 가시와 다리 사이로 내려온 꼬리 */
const DINO_SPIKES: Sprite = [
  ...BLANK_TOP,
  ".......##.......",
  "......#zu#......",
  ".......##.......",
  "......#zu#......",
  ".......##.......",
  "......#lm#......",
  "......#lm#......",
  ".......##.......",
];
const BACK: Record<string, Back> = {
  "outfit.overalls": { details: "zq" },
  "outfit.hoodie": { details: "w" },
  "outfit.dress": { details: "w" },
  "outfit.suit": { details: "wNQz" },
  "outfit.hanbok": { details: "wR" },
  "outfit.wizard": { details: "wz" },
  "outfit.knight": { details: "z" },
  "outfit.chef": { details: "Nx" },
  "outfit.tshirt": { details: "g" },
  "outfit.raincoat": { details: "wg" },
  "outfit.sweater": { details: "gV" },
  "outfit.tracksuit": { details: "gwz" },
  "outfit.sailor": { details: "gN" },
  "outfit.doctor": { details: "gix" },
  "outfit.pirate": { details: "gwzK" },
  "outfit.ninja": { details: "g" },
  "outfit.astronaut": { details: "gvKzNi" },
  "outfit.prince": { details: "gwz" },
  "outfit.princess": { details: "gz" },
  "outfit.royal": { cape: ["N", "Q"] },
  // 옷가게 더하기 (2026-10-12)
  "outfit.cardigan": { details: "wgb" },
  "outfit.denim": { details: "wgz" },
  "outfit.school": { details: "wmz" },
  "outfit.hawaiian": { details: "g" },
  "outfit.apron": { details: "lmg", keepRows: 18 },
  "outfit.dopo": { details: "wgt" },
  "outfit.bee": { details: "g", over: BEE_WINGS },
  "outfit.dino": { details: "cgL", over: DINO_SPIKES },
  "outfit.firefighter": { details: "gz" },
  "outfit.vampire": { cape: ["D", "S"] },
  "hat.crown": { details: "N" },
  "hat.tiara": { details: "Vi" },
  "hat.cap": { details: "z" },
  "hat.pirate": { details: "w" },
  "hat.wizard": { details: "z" },
  "hat.catears": { details: "V" },
  "acc.scarf": { keepRows: 14 },
  "acc.bowtie": { hide: true },
  "acc.necklace": { hide: true },
  "acc.medal": { hide: true },
};
/** 옷의 앞 무늬를 지우는 몸통 자리 */
export const TORSO = { rows: [13, 17], cols: [3, 12] } as const;

/**
 * 앞에만 있는 글자(details)를 같은 줄의 가장 가까운 다른 글자(외곽선·투명·details가 아닌 것)로 덮는다.
 * area가 있으면 그 줄·칸 안에서만 (캐릭터 몸의 셔츠 깃도 같은 방법, characters.ts)
 */
export function stripFront(rows: Sprite, details: string, area?: { rows: readonly [number, number]; cols: readonly [number, number] }): string[] {
  const [r0, r1] = area?.rows ?? [0, rows.length - 1];
  const [c0, c1] = area?.cols ?? [0, 15];
  const cloth = (ch: string | undefined) => ch !== undefined && ch !== "." && ch !== "#" && !details.includes(ch);
  return rows.map((row, y) => {
    if (y < r0 || y > r1) return row;
    const out = [...row];
    for (let x = Math.max(0, c0); x <= Math.min(row.length - 1, c1); x++) {
      if (!details.includes(row[x])) continue;
      for (let d = 1; d <= c1 - c0; d++) {
        const pick = [x - d, x + d].find((k) => k >= c0 && k <= c1 && cloth(row[k]));
        if (pick !== undefined) {
          out[x] = row[pick];
          break;
        }
      }
    }
    return out.join("");
  });
}

/** 그 아이템을 보는 쪽의 글자 줄 (뒷모습이면 앞 무늬를 지운 것, 앞에만 다는 소품은 빈 줄) */
export function partRows(key: string, view: "front" | "back"): Sprite {
  const part = PARTS[key];
  if (!part) return [];
  const back = BACK[key];
  if (view === "front" || !back) return part.rows;
  if (back.hide) return [];
  let rows = fixRows(part.rows);
  if (back.keepRows) rows = rows.slice(0, back.keepRows);
  if (back.details) rows = stripFront(rows, back.details, part.slot === "outfit" ? TORSO : undefined);
  if (back.over) rows = overlay(rows, back.over);
  if (back.cape) {
    const [cloth, shade] = back.cape;
    rows = rows.map((row, y) =>
      y < 13 || y > 20 ? row : [...row].map((ch, x) => (x < 3 || x > 12 || ch === "#" || ch === "." ? ch : x === 12 ? shade : cloth)).join(""),
    );
  }
  return rows;
}

/** 글자 줄 두 장을 겹친다 (위 그림의 "."은 아래가 보인다) */
function overlay(below: Sprite, above: Sprite): string[] {
  const n = Math.max(below.length, above.length);
  return Array.from({ length: n }, (_, y) => {
    const a = (below[y] ?? "").padEnd(16, ".");
    const b = (above[y] ?? "").padEnd(16, ".");
    return [...a].map((c, x) => (b[x] !== "." ? b[x] : c)).join("");
  });
}

/** 뒷모습이 앞모습과 다른 아이템 (시험용) */
export const BACK_PARTS = () => Object.keys(BACK);

export type AvatarPart = Part & { svg: string };
export const AVATAR_PARTS: Record<string, AvatarPart> = Object.fromEntries(
  Object.entries(PARTS).map(([key, part]) => [key, { ...part, svg: LOOK_SLOTS.includes(part.slot) ? "" : spriteRects(fixRows(part.rows), AVATAR_COLORS) }]),
);

/** 줄 길이를 16칸으로 맞춘다 (짧으면 오른쪽을 투명으로 채운다) */
export function fixRows(rows: Sprite) {
  return rows.map((r) => r.padEnd(16, ".").slice(0, 16));
}

// 얼굴형 → 머리 색 → 머리 모양 → 옷 → 소품 → 모자
const ORDER: Record<AvatarSlot, number> = { face_shape: -3, hair_color: -2, hair: -1, outfit: 0, accessory: 1, hat: 2 };

/** 겹치는 순서: (얼굴형 → 머리 색 →) 머리 → 옷 → 소품 → 모자. 모르는 키는 뺀다 */
export function orderOutfit(outfit: readonly string[]): string[] {
  return outfit.filter((k) => k in AVATAR_PARTS).sort((a, b) => ORDER[AVATAR_PARTS[a].slot] - ORDER[AVATAR_PARTS[b].slot]);
}

/** 옷(몸 위)과 소품·모자(맨 위) 층으로 나눈 SVG 조각 (<rect> 목록). 머리는 캐릭터 그림을 바꾸므로 여기에 없다 (characters.ts lookGrid) */
export function outfitLayers(outfit: readonly string[]) {
  const ordered = orderOutfit(outfit);
  return {
    body: ordered.filter((k) => AVATAR_PARTS[k].slot === "outfit").map((k) => AVATAR_PARTS[k].svg).join(""),
    top: ordered.filter((k) => AVATAR_PARTS[k].slot === "accessory" || AVATAR_PARTS[k].slot === "hat").map((k) => AVATAR_PARTS[k].svg).join(""),
  };
}

/** 상점·꾸미기 카드용: 회색 몸 위에 그 아이템만 입힌 미리보기는 characterSvg("char.mannequin", …, [key])로 그린다 */
export const MANNEQUIN = "char.mannequin";

/** 아이템 카드 미리보기 모습. 머리는 마네킹(머리카락 없음)에 보이지 않아 사람 주민에게 입힌다 (머리 색은 긴 머리로, 얼굴형은 올백으로 얼굴이 잘 보이게) */
export function previewLook(assetKey: string): { asset: string; outfit: string[] } {
  const slot = AVATAR_PARTS[assetKey]?.slot;
  if (slot === "face_shape") return { asset: "char.boy", outfit: ["hair.slick", assetKey] };
  if (slot === "hair") return { asset: "char.boy", outfit: [assetKey] };
  if (slot === "hair_color") return { asset: "char.girl", outfit: ["hair.long", assetKey] };
  return { asset: MANNEQUIN, outfit: [assetKey] };
}
