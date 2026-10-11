// 아바타 꾸미기 그림 (SHOP-06): 도트 캐릭터(16×24, src/lib/art/characters.ts) 위에 겹치는 모자·옷·소품.
// 모든 캐릭터가 같은 자리를 쓴다: 머리 0~12줄(눈 7~9줄, 4·5칸과 10·11칸), 몸 13~21줄(팔 1~3칸·12~14칸).
// 한 글자 = 한 픽셀, "." = 투명(아래 캐릭터가 보인다). 글자 뜻은 pixel.ts PALETTE + 아래 AVATAR_COLORS.
// 머리 모양·머리 색(미용실, 2026-10-11)도 같은 목록에 넣는다: 머리 모양은 hair.ts의 글자 줄, 머리 색은 그림 없이 색만 바꾼다.
import { HAIR_COLORS, HAIR_STYLES } from "./hair";
import { spriteRects, type Sprite } from "./pixel";

/** 부위: 모자·옷·소품 (SHOP-06) + 미용실의 머리 모양(hair)·머리 색(hair_color) */
export type AvatarSlot = "hat" | "outfit" | "accessory" | "hair" | "hair_color";
export const AVATAR_SLOTS: readonly AvatarSlot[] = ["hair", "hair_color", "hat", "outfit", "accessory"];

/**
 * 아바타 아이템만 쓰는 색. 주황 후드티 O·r·s, 보라 로브 C·W·J.
 * 캐릭터 글자(f 피부, 7·8·9 털)는 쓰지 않는다: 손·얼굴처럼 캐릭터마다 다른 칸은 "."로 비워 아래가 보이게 한다
 */
export const AVATAR_COLORS = { O: "#ffc0a0", r: "#ff8a65", s: "#d0584e", C: "#c3aefc", W: "#8f6fe0", J: "#5f45a8" };

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
};

// 머리 모양 (미용실): 글자 줄은 hair.ts. 머리 색은 그림이 없다 (color만, characters.ts가 머리카락 칸을 칠한다)
for (const [key, rows] of Object.entries(HAIR_STYLES)) PARTS[key] = { slot: "hair", rows };
for (const key of Object.keys(HAIR_COLORS)) PARTS[key] = { slot: "hair_color", rows: [] };

export type AvatarPart = Part & { svg: string };
export const AVATAR_PARTS: Record<string, AvatarPart> = Object.fromEntries(
  Object.entries(PARTS).map(([key, part]) => [key, { ...part, svg: part.slot === "hair" || part.slot === "hair_color" ? "" : spriteRects(fixRows(part.rows), AVATAR_COLORS) }]),
);

/** 줄 길이를 16칸으로 맞춘다 (짧으면 오른쪽을 투명으로 채운다) */
export function fixRows(rows: Sprite) {
  return rows.map((r) => r.padEnd(16, ".").slice(0, 16));
}

// 머리 색 → 머리 모양 → 옷 → 소품 → 모자
const ORDER: Record<AvatarSlot, number> = { hair_color: -2, hair: -1, outfit: 0, accessory: 1, hat: 2 };

/** 겹치는 순서: (머리 색 →) 머리 → 옷 → 소품 → 모자. 모르는 키는 뺀다 */
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

/** 아이템 카드 미리보기 모습. 머리는 마네킹(머리카락 없음)에 보이지 않아 사람 주민에게 입힌다 (머리 색은 긴 머리로) */
export function previewLook(assetKey: string): { asset: string; outfit: string[] } {
  const slot = AVATAR_PARTS[assetKey]?.slot;
  if (slot === "hair") return { asset: "char.boy", outfit: [assetKey] };
  if (slot === "hair_color") return { asset: "char.girl", outfit: ["hair.long", assetKey] };
  return { asset: MANNEQUIN, outfit: [assetKey] };
}
