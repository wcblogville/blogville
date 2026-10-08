// 집 안 가구 그림 (SVG). 블로그의 "우리 집" 구역과 상점·꾸미기 미리보기가 같이 쓴다.
// 모든 가구는 80 × 80 칸 안에 바닥(아래쪽)에 붙여 그린다.

const O = "#4a3426"; // 외곽선
const S = `stroke="${O}" stroke-width="2.5" stroke-linejoin="round"`;
const SHADOW = `<ellipse cx="40" cy="76" rx="26" ry="3.5" fill="#000" opacity=".14"/>`;

const FURNITURE: Record<string, string> = {
  // 화분: 잎이 무성한 초록 화분
  "furniture.plant":
    SHADOW +
    `<path d="M40 44C30 30 22 32 18 22C30 22 36 30 40 40C42 26 48 18 58 14C56 28 48 34 42 44Z" fill="#7cc576" ${S}/>` +
    `<path d="M40 46C34 36 26 38 24 30C32 30 38 36 40 44" fill="#5fae5a" ${S}/>` +
    `<path d="M27 48H53L49 74H31Z" fill="#d9825b" ${S}/><rect x="25" y="44" width="30" height="7" rx="2" fill="#e99a72" ${S}/>`,
  // 나무 의자
  "furniture.chair":
    SHADOW +
    `<rect x="26" y="12" width="28" height="30" rx="5" fill="#c58b57" ${S}/><path d="M32 18V36M40 18V36M48 18V36" stroke="#a46d3f" stroke-width="2.5"/>` +
    `<rect x="22" y="42" width="36" height="9" rx="3" fill="#d89a63" ${S}/>` +
    `<path d="M26 51V75M54 51V75M32 51V70M48 51V70" stroke="${O}" stroke-width="4" stroke-linecap="round"/>`,
  // 둥근 탁자 + 찻잔
  "furniture.table":
    SHADOW +
    `<ellipse cx="40" cy="42" rx="32" ry="9" fill="#d89a63" ${S}/><path d="M36 51H44V72H36Z" fill="#a46d3f" ${S}/>` +
    `<ellipse cx="40" cy="73" rx="14" ry="3.5" fill="#a46d3f" ${S}/>` +
    `<path d="M30 30H42V38Q42 42 36 42Q30 42 30 38Z" fill="#fff" ${S}/><path d="M42 33Q47 33 46 37Q45 39 42 38" fill="none" stroke="${O}" stroke-width="2"/>` +
    `<path d="M34 26Q32 22 35 19M38 26Q36 22 39 19" fill="none" stroke="#c9b8a6" stroke-width="2" stroke-linecap="round"/>`,
  // 포근한 침대
  "furniture.bed":
    SHADOW +
    `<rect x="6" y="30" width="14" height="44" rx="4" fill="#c58b57" ${S}/>` +
    `<rect x="14" y="46" width="60" height="18" rx="4" fill="#fff6e8" ${S}/>` +
    `<rect x="16" y="40" width="20" height="10" rx="5" fill="#fff" ${S}/>` +
    `<path d="M34 44H72Q76 44 76 50V64H34Z" fill="#8ec5ff" ${S}/><path d="M46 44V64M58 44V64" stroke="#6aa8e8" stroke-width="2"/>` +
    `<path d="M14 64V74M72 64V74" stroke="${O}" stroke-width="4" stroke-linecap="round"/>`,
  // 책장
  "furniture.shelf":
    SHADOW +
    `<rect x="14" y="8" width="52" height="66" rx="3" fill="#b77a48" ${S}/>` +
    `<path d="M16 30H64M16 52H64" stroke="${O}" stroke-width="2.5"/>` +
    `<rect x="20" y="14" width="6" height="16" fill="#e05a4f" ${S}/><rect x="27" y="17" width="6" height="13" fill="#ffd36e" ${S}/><rect x="34" y="13" width="6" height="17" fill="#6aa8e8" ${S}/>` +
    `<rect x="48" y="20" width="12" height="10" rx="2" fill="#7cc576" ${S}/>` +
    `<rect x="20" y="38" width="7" height="14" fill="#b79cff" ${S}/><rect x="28" y="36" width="6" height="16" fill="#7cc576" ${S}/><path d="M40 52L46 37L52 39L46 52Z" fill="#ff9fb8" ${S}/>` +
    `<rect x="22" y="58" width="36" height="12" rx="2" fill="#d89a63" ${S}/><circle cx="40" cy="64" r="2" fill="${O}"/>`,
  // 스탠드 조명
  "furniture.lamp":
    SHADOW +
    `<path d="M24 10H56L62 30H18Z" fill="#ffe08a" ${S}/><path d="M28 30Q40 40 52 30" fill="#fff4c4" opacity=".7"/>` +
    `<path d="M40 30V70" stroke="${O}" stroke-width="4" stroke-linecap="round"/>` +
    `<ellipse cx="40" cy="72" rx="14" ry="4" fill="#8d6e63" ${S}/>`,
  // 동그란 러그
  "furniture.rug":
    `<ellipse cx="40" cy="64" rx="36" ry="12" fill="#ff9fb8" ${S}/><ellipse cx="40" cy="64" rx="26" ry="8" fill="#ffd36e" stroke="#e9b44c" stroke-width="2"/>` +
    `<ellipse cx="40" cy="64" rx="14" ry="4" fill="#8ec5ff" stroke="#6aa8e8" stroke-width="2"/>`,
  // 푹신한 소파
  "furniture.sofa":
    SHADOW +
    `<rect x="12" y="28" width="56" height="26" rx="8" fill="#7fb8a4" ${S}/>` +
    `<rect x="6" y="40" width="14" height="28" rx="6" fill="#6aa592" ${S}/><rect x="60" y="40" width="14" height="28" rx="6" fill="#6aa592" ${S}/>` +
    `<rect x="18" y="50" width="44" height="16" rx="4" fill="#94cbb7" ${S}/><path d="M40 50V66" stroke="#6aa592" stroke-width="2"/>` +
    `<path d="M12 68V75M68 68V75" stroke="${O}" stroke-width="4" stroke-linecap="round"/>`,
};

export function hasFurnitureArt(assetKey: string) {
  return assetKey in FURNITURE;
}

export function furnitureSvg(assetKey: string, size = 80): string {
  const body = FURNITURE[assetKey] ?? `<rect x="20" y="30" width="40" height="44" rx="6" fill="#e8dccb" ${S}/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="${size}" height="${size}">${body}</svg>`;
}

export function furnitureDataUri(assetKey: string, size = 80): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(furnitureSvg(assetKey, size))}`;
}
