// 성장 아이템 그림 (SHOP-01 2026-10-07): 동물 농장에서 쓰는 먹이·촉진제. 80 × 80 칸
const O = "#4a3426";
const S = `stroke="${O}" stroke-width="2.5" stroke-linejoin="round"`;

const GROWTH: Record<string, string> = {
  // 동물 먹이: 곡식 자루
  "growth.feed":
    `<path d="M22 30Q18 72 40 72Q62 72 58 30Z" fill="#e8c98a" ${S}/><path d="M24 30Q40 22 56 30Q40 36 24 30Z" fill="#d9b06a" ${S}/>` +
    `<path d="M33 22Q36 14 40 20Q44 14 47 22" fill="none" stroke="#7cc576" stroke-width="3" stroke-linecap="round"/>` +
    `<ellipse cx="40" cy="52" rx="9" ry="7" fill="#fff4dc" stroke="${O}" stroke-width="1.6"/><path d="M36 52H44M40 48V56" stroke="#d9825b" stroke-width="2"/>`,
  // 고급 먹이: 당근과 사과가 담긴 그릇
  "growth.premium":
    `<path d="M40 30L48 14" stroke="#7cc576" stroke-width="4" stroke-linecap="round"/><path d="M33 46L46 22L52 26L40 50Z" fill="#ff9f43" ${S}/>` +
    `<circle cx="30" cy="42" r="9" fill="#ff5d73" ${S}/><path d="M30 33Q31 29 34 28" fill="none" stroke="${O}" stroke-width="2"/>` +
    `<path d="M12 46H68Q66 70 40 70Q14 70 12 46Z" fill="#8ec5ff" ${S}/><path d="M18 54H62" stroke="#6aa8e8" stroke-width="2"/>`,
  // 성장 촉진제: 반짝이는 물약
  "growth.booster":
    `<rect x="33" y="10" width="14" height="10" rx="2" fill="#c58b57" ${S}/><path d="M35 20V30Q20 38 22 54Q24 72 40 72Q56 72 58 54Q60 38 45 30V20Z" fill="#b79cff" ${S}/>` +
    `<path d="M25 50Q40 44 55 50Q55 68 40 68Q25 68 25 50Z" fill="#8c6cf2"/>` +
    `<path d="M60 18L62 24L68 26L62 28L60 34L58 28L52 26L58 24Z" fill="#ffd36e" ${S}/><circle cx="34" cy="56" r="3" fill="#fff" opacity=".7"/>`,
};

export function growthSvg(assetKey: string, size = 80): string {
  const body = GROWTH[assetKey] ?? `<circle cx="40" cy="44" r="24" fill="#e8dccb" ${S}/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="${size}" height="${size}">${body}</svg>`;
}

export function growthDataUri(assetKey: string, size = 80): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(growthSvg(assetKey, size))}`;
}
