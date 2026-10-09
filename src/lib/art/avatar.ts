// 아바타 꾸미기 그림 (SHOP-06): 도트 캐릭터(16×24, src/lib/art/characters.ts) 위에 겹치는 모자·옷·소품.
// 모든 캐릭터가 같은 자리를 쓴다: 머리 0~12줄(눈 7~9줄, 4·5칸과 10·11칸), 몸 13~21줄(팔 1~3칸·12~14칸).
// 한 글자 = 한 픽셀, "." = 투명(아래 캐릭터가 보인다). 글자 뜻은 pixel.ts PALETTE + 아래 AVATAR_COLORS.
import { spriteRects, type Sprite } from "./pixel";

export type AvatarSlot = "hat" | "outfit" | "accessory";

/** 아바타 아이템만 쓰는 색 (주황 후드티 O·r·s) */
const AVATAR_COLORS = { O: "#ffc0a0", r: "#ff8a65", s: "#d0584e" };

const PARTS: Record<string, { slot: AvatarSlot; rows: Sprite }> = {
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
};

export const AVATAR_PARTS: Record<string, { slot: AvatarSlot; rows: Sprite; svg: string }> = Object.fromEntries(
  Object.entries(PARTS).map(([key, part]) => [key, { ...part, svg: spriteRects(fixRows(part.rows), AVATAR_COLORS) }]),
);

/** 줄 길이를 16칸으로 맞춘다 (짧으면 오른쪽을 투명으로 채운다) */
function fixRows(rows: Sprite) {
  return rows.map((r) => r.padEnd(16, ".").slice(0, 16));
}

const ORDER: Record<AvatarSlot, number> = { outfit: 0, accessory: 1, hat: 2 };

/** 겹치는 순서: 옷 → 소품 → 모자. 모르는 키는 뺀다 */
export function orderOutfit(outfit: readonly string[]): string[] {
  return outfit.filter((k) => k in AVATAR_PARTS).sort((a, b) => ORDER[AVATAR_PARTS[a].slot] - ORDER[AVATAR_PARTS[b].slot]);
}

/** 옷(몸 위)과 소품·모자(맨 위) 층으로 나눈 SVG 조각 (<rect> 목록) */
export function outfitLayers(outfit: readonly string[]) {
  const ordered = orderOutfit(outfit);
  return {
    body: ordered.filter((k) => AVATAR_PARTS[k].slot === "outfit").map((k) => AVATAR_PARTS[k].svg).join(""),
    top: ordered.filter((k) => AVATAR_PARTS[k].slot !== "outfit").map((k) => AVATAR_PARTS[k].svg).join(""),
  };
}

/** 상점·꾸미기 카드용: 회색 몸 위에 그 아이템만 입힌 미리보기는 characterSvg("char.mannequin", …, [key])로 그린다 */
export const MANNEQUIN = "char.mannequin";
