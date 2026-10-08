// 아바타 꾸미기 그림 (SHOP-06): 캐릭터 몸 위에 겹치는 모자·옷·소품 SVG 조각.
// 좌표는 캐릭터 그림(src/lib/art/characters.ts)과 같다: 머리 원 (32, 27) 반지름 16.5, 몸 타원 (32, 46.5).

const O = "#3b2a20";
const S = `stroke="${O}" stroke-width="1.6" stroke-linejoin="round"`;

export type AvatarSlot = "hat" | "outfit" | "accessory";

export const AVATAR_PARTS: Record<string, { slot: AvatarSlot; svg: string }> = {
  // 모자
  "hat.straw": {
    slot: "hat",
    svg:
      `<path d="M21 14Q21 2.5 32 2.5Q43 2.5 43 14Z" fill="#f2c94c" ${S}/>` +
      `<ellipse cx="32" cy="14.5" rx="23" ry="4.6" fill="#f6d365" ${S}/>` +
      `<path d="M21.6 11.2Q32 13.6 42.4 11.2" fill="none" stroke="#e05a4f" stroke-width="3"/>`,
  },
  "hat.ribbon": {
    slot: "hat",
    svg:
      `<path d="M40 11L31 5L32 15Z" fill="#ff5d73" ${S}/><path d="M40 11L49 5L48 15Z" fill="#ff5d73" ${S}/>` +
      `<circle cx="40" cy="11" r="2.8" fill="#ff8fa3" ${S}/>`,
  },
  "hat.beanie": {
    slot: "hat",
    svg:
      `<path d="M15.6 20Q15 7 32 6.5Q49 7 48.4 20Z" fill="#6aa8e8" ${S}/>` +
      `<rect x="14.5" y="17" width="35" height="6" rx="3" fill="#4f8fd6" ${S}/>` +
      `<circle cx="32" cy="5.5" r="3.6" fill="#fff" ${S}/>`,
  },
  // 옷
  "outfit.overalls": {
    slot: "outfit",
    svg:
      `<path d="M20.5 47Q21 56.8 32 56.9Q43 56.8 43.5 47Z" fill="#5b8fd9" ${S}/>` +
      `<rect x="26" y="40" width="12" height="9" rx="2" fill="#5b8fd9" ${S}/>` +
      `<path d="M27 40.5L23 37M37 40.5L41 37" stroke="#4573b8" stroke-width="2.4" stroke-linecap="round"/>` +
      `<circle cx="28" cy="42.5" r="1" fill="#ffd36e"/><circle cx="36" cy="42.5" r="1" fill="#ffd36e"/>`,
  },
  "outfit.hoodie": {
    slot: "outfit",
    svg:
      `<ellipse cx="32" cy="46.5" rx="12.7" ry="10.7" fill="#ff8a65" ${S}/>` +
      `<path d="M25 51H39V55Q32 57 25 55Z" fill="#f4703f" stroke="${O}" stroke-width="1.2"/>` +
      `<path d="M29.5 38V44M34.5 38V44" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>`,
  },
  "outfit.dress": {
    slot: "outfit",
    svg:
      `<path d="M24 38.5H40L46 55.5Q32 59.5 18 55.5Z" fill="#ffd36e" ${S}/>` +
      `<circle cx="27" cy="48" r="1.4" fill="#ff8fa3"/><circle cx="36" cy="51" r="1.4" fill="#ff8fa3"/><circle cx="31" cy="44" r="1.4" fill="#ff8fa3"/>` +
      `<path d="M24.5 41.5H39.5" stroke="#e9b44c" stroke-width="1.6"/>`,
  },
  // 소품
  "acc.glasses": {
    slot: "accessory",
    svg:
      `<circle cx="25.5" cy="27.5" r="5" fill="#bfe8ff" fill-opacity=".25" stroke="${O}" stroke-width="1.6"/>` +
      `<circle cx="38.5" cy="27.5" r="5" fill="#bfe8ff" fill-opacity=".25" stroke="${O}" stroke-width="1.6"/>` +
      `<path d="M30.5 27.2Q32 26 33.5 27.2" fill="none" stroke="${O}" stroke-width="1.6"/>`,
  },
  "acc.scarf": {
    slot: "accessory",
    svg:
      `<path d="M19.5 39.5Q32 45.5 44.5 39.5L44.5 43.5Q32 49.5 19.5 43.5Z" fill="#e05a4f" ${S}/>` +
      `<path d="M38 44L40 53L44 52L42 43Z" fill="#e05a4f" ${S}/>` +
      `<path d="M24 41.5V45.5M30 43V47M36 43V47" stroke="#fff" stroke-width="1.6" opacity=".8"/>`,
  },
  "acc.bag": {
    slot: "accessory",
    svg:
      `<path d="M22 38L41 51" stroke="#8d5a3b" stroke-width="2.4" stroke-linecap="round"/>` +
      `<rect x="37" y="47.5" width="11" height="8.5" rx="2.2" fill="#b77a48" ${S}/>` +
      `<path d="M37 50.5H48" stroke="${O}" stroke-width="1.2"/><circle cx="42.5" cy="52.5" r="1" fill="#ffd36e"/>`,
  },
};

const ORDER: Record<AvatarSlot, number> = { outfit: 0, accessory: 1, hat: 2 };

/** 겹치는 순서: 옷 → 소품 → 모자. 모르는 키는 뺀다 */
export function orderOutfit(outfit: readonly string[]): string[] {
  return outfit.filter((k) => k in AVATAR_PARTS).sort((a, b) => ORDER[AVATAR_PARTS[a].slot] - ORDER[AVATAR_PARTS[b].slot]);
}

/** 옷(몸 위, 머리 아래)과 소품·모자(맨 위) 층으로 나눈 SVG */
export function outfitLayers(outfit: readonly string[]) {
  const ordered = orderOutfit(outfit);
  return {
    body: ordered.filter((k) => AVATAR_PARTS[k].slot === "outfit").map((k) => AVATAR_PARTS[k].svg).join(""),
    top: ordered.filter((k) => AVATAR_PARTS[k].slot !== "outfit").map((k) => AVATAR_PARTS[k].svg).join(""),
  };
}

/** 상점·꾸미기 카드용: 회색 몸 위에 그 아이템만 입힌 미리보기는 characterSvg("char.mannequin", …, [key])로 그린다 */
export const MANNEQUIN = "char.mannequin";
