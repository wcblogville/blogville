// 광장 장식 그림 (SVG). 광장 꾸미기(사용자 요청 2026-10-09)와 상점·꾸미기 미리보기가 같이 쓴다.
// 장식마다 크기가 달라 viewBox를 따로 두고, 바닥(아랫변 가운데)이 광장의 꾸미기 자리에 닿게 그린다.

const O = "#4a3426"; // 외곽선
const S = `stroke="${O}" stroke-width="2.5" stroke-linejoin="round"`;
const shadow = (cx: number, cy: number, rx: number) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="4" fill="#000" opacity=".15"/>`;

type DecoArt = { width: number; height: number; body: string };

const flower = (x: number, y: number, color: string) =>
  `<circle cx="${x - 3}" cy="${y}" r="3.2" fill="${color}"/><circle cx="${x + 3}" cy="${y}" r="3.2" fill="${color}"/>` +
  `<circle cx="${x}" cy="${y - 3}" r="3.2" fill="${color}"/><circle cx="${x}" cy="${y + 3}" r="3.2" fill="${color}"/><circle cx="${x}" cy="${y}" r="2" fill="#ffb300"/>`;

const blade = (angle: number) => `<g transform="rotate(${angle} 60 46)"><path d="M57 46V6H63V46Z" fill="#8d6040" ${S}/><path d="M63 8H76V40H63Z" fill="#fff6e8" ${S}/><path d="M63 18H76M63 29H76" stroke="#c9b8a6" stroke-width="2"/></g>`;

const DECO: Record<string, DecoArt> = {
  // 나무 벤치
  "deco.bench": {
    width: 100,
    height: 64,
    body:
      shadow(50, 59, 42) +
      `<rect x="10" y="8" width="80" height="10" rx="3" fill="#c58b57" ${S}/><rect x="10" y="21" width="80" height="10" rx="3" fill="#c58b57" ${S}/>` +
      `<path d="M20 31V38M80 31V38" stroke="${O}" stroke-width="4"/>` +
      `<rect x="6" y="37" width="88" height="10" rx="3" fill="#d89a63" ${S}/>` +
      `<path d="M14 47V58M86 47V58" stroke="${O}" stroke-width="5" stroke-linecap="round"/>`,
  },
  // 꽃밭: 나무 화단에 핀 꽃
  "deco.flowerbed": {
    width: 110,
    height: 60,
    body:
      shadow(55, 55, 48) +
      `<ellipse cx="22" cy="28" rx="9" ry="6" fill="#5fae5a"/><ellipse cx="44" cy="25" rx="9" ry="6" fill="#4f9e4a"/><ellipse cx="66" cy="27" rx="9" ry="6" fill="#5fae5a"/><ellipse cx="88" cy="25" rx="9" ry="6" fill="#4f9e4a"/>` +
      flower(18, 20, "#ff7aa2") + flower(34, 14, "#ffd36e") + flower(50, 19, "#ffffff") + flower(64, 13, "#b79cff") + flower(78, 20, "#ff7aa2") + flower(92, 15, "#ffd36e") +
      `<rect x="8" y="30" width="94" height="22" rx="4" fill="#b77a48" ${S}/><path d="M10 40H100" stroke="#a46d3f" stroke-width="2"/>`,
  },
  // 이정표
  "deco.signpost": {
    width: 70,
    height: 100,
    body:
      shadow(35, 95, 20) +
      `<rect x="31" y="12" width="8" height="82" rx="2" fill="#a46d3f" ${S}/>` +
      `<path d="M10 18H54L62 26L54 34H10Z" fill="#e2b77f" ${S}/><path d="M60 42H16L8 50L16 58H60Z" fill="#d89a63" ${S}/>` +
      `<path d="M18 26H46M22 50H52" stroke="#a46d3f" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="6 4"/>` +
      `<path d="M24 94Q27 86 30 94M40 94Q43 86 46 94" fill="#5fae5a" stroke="#4f9e4a" stroke-width="2"/>`,
  },
  // 눈사람
  "deco.snowman": {
    width: 76,
    height: 96,
    body:
      shadow(38, 91, 24) +
      `<path d="M18 62L5 52M58 62L71 50" stroke="#8d6040" stroke-width="3.5" stroke-linecap="round"/>` +
      `<circle cx="38" cy="68" r="22" fill="#fff" ${S}/><circle cx="38" cy="36" r="15" fill="#fff" ${S}/>` +
      `<circle cx="33" cy="33" r="2.2" fill="${O}"/><circle cx="43" cy="33" r="2.2" fill="${O}"/><path d="M38 37L50 40L38 42Z" fill="#f08a3c" stroke="${O}" stroke-width="1.5" stroke-linejoin="round"/>` +
      `<path d="M24 47Q38 53 52 47V52Q38 59 24 52Z" fill="#e0584f" ${S}/><path d="M46 52L50 64L44 63Z" fill="#e0584f" ${S}/>` +
      `<circle cx="38" cy="64" r="2.4" fill="${O}"/><circle cx="38" cy="74" r="2.4" fill="${O}"/>` +
      `<rect x="27" y="12" width="22" height="12" rx="2" fill="#4a5568" ${S}/><rect x="22" y="22" width="32" height="5" rx="2" fill="#4a5568" ${S}/>`,
  },
  // 캠핑 텐트
  "deco.tent": {
    width: 120,
    height: 88,
    body:
      shadow(60, 83, 54) +
      `<path d="M8 80L2 85M112 80L118 85" stroke="${O}" stroke-width="2"/>` +
      `<path d="M60 10L112 80H8Z" fill="#f08a3c" ${S}/><path d="M60 10L84 80H36Z" fill="#ffd36e" ${S}/><path d="M60 34L73 80H47Z" fill="#7a5236" ${S}/>` +
      `<path d="M60 10V2" stroke="${O}" stroke-width="3"/><path d="M60 2L73 6L60 10Z" fill="#e0584f" ${S}/>`,
  },
  // 그네
  "deco.swing": {
    width: 110,
    height: 100,
    body:
      shadow(55, 95, 48) +
      `<path d="M14 94L30 12M46 94L30 12M64 94L80 12M96 94L80 12" stroke="${O}" stroke-width="9" stroke-linecap="round"/>` +
      `<path d="M14 94L30 12M46 94L30 12M64 94L80 12M96 94L80 12" stroke="#c58b57" stroke-width="5" stroke-linecap="round"/>` +
      `<path d="M24 12H86" stroke="${O}" stroke-width="10" stroke-linecap="round"/><path d="M24 12H86" stroke="#a46d3f" stroke-width="6" stroke-linecap="round"/>` +
      `<path d="M44 15V66M66 15V66" stroke="${O}" stroke-width="2"/><rect x="38" y="64" width="34" height="7" rx="2" fill="#e0584f" ${S}/>`,
  },
  // 곰 동상: 받침대 위에 하트를 안은 곰
  "deco.statue": {
    width: 90,
    height: 120,
    body:
      shadow(45, 115, 38) +
      `<rect x="14" y="84" width="62" height="30" rx="3" fill="#cfc6bb" ${S}/><rect x="10" y="78" width="70" height="10" rx="3" fill="#ddd5cb" ${S}/>` +
      `<rect x="33" y="93" width="24" height="10" rx="2" fill="#f2c14e" ${S}/>` +
      `<circle cx="32" cy="18" r="7" fill="#c4bdb4" ${S}/><circle cx="58" cy="18" r="7" fill="#c4bdb4" ${S}/>` +
      `<ellipse cx="45" cy="60" rx="21" ry="20" fill="#b9b2a9" ${S}/><circle cx="45" cy="32" r="17" fill="#c4bdb4" ${S}/>` +
      `<ellipse cx="45" cy="38" rx="8" ry="6" fill="#d6d0c8" stroke="${O}" stroke-width="1.5"/><ellipse cx="45" cy="36" rx="3" ry="2.2" fill="${O}"/>` +
      `<circle cx="38" cy="28" r="2" fill="${O}"/><circle cx="52" cy="28" r="2" fill="${O}"/>` +
      `<path d="M45 70C34 62 36 52 45 57C54 52 56 62 45 70Z" fill="#e0584f" ${S}/>` +
      `<ellipse cx="29" cy="60" rx="6" ry="9" fill="#c4bdb4" ${S}/><ellipse cx="61" cy="60" rx="6" ry="9" fill="#c4bdb4" ${S}/>`,
  },
  // 풍차
  "deco.windmill": {
    width: 120,
    height: 160,
    body:
      shadow(60, 155, 40) +
      `<path d="M42 152L50 52H70L78 152Z" fill="#f4ead6" ${S}/><path d="M47 100H73M45 126H75" stroke="#d8c8a8" stroke-width="2.5"/>` +
      `<circle cx="60" cy="86" r="6" fill="#bfe8ff" ${S}/><path d="M53 152V134Q60 126 67 134V152Z" fill="#a46d3f" ${S}/>` +
      `<path d="M45 54L60 30L75 54Z" fill="#e0584f" ${S}/>` +
      blade(20) + blade(110) + blade(200) + blade(290) +
      `<circle cx="60" cy="46" r="6" fill="#8d6040" ${S}/>`,
  },
};

export function hasDecoArt(assetKey: string) {
  return assetKey in DECO;
}

/** 광장에 놓을 때의 크기 (px) */
export function decoSize(assetKey: string): { width: number; height: number } {
  const art = DECO[assetKey];
  return art ? { width: art.width, height: art.height } : { width: 80, height: 80 };
}

export function decoSvg(assetKey: string, size?: number): string {
  const art = DECO[assetKey] ?? { width: 80, height: 80, body: `<rect x="20" y="30" width="40" height="44" rx="6" fill="#e8dccb" ${S}/>` };
  // size: 미리보기(상점)용 긴 변 길이. 없으면 광장에 놓을 원래 크기
  const scale = size ? size / Math.max(art.width, art.height) : 1;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${art.width} ${art.height}" width="${Math.round(art.width * scale)}" height="${Math.round(art.height * scale)}">${art.body}</svg>`;
}

export function decoDataUri(assetKey: string, size?: number): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(decoSvg(assetKey, size))}`;
}

/** 광장이 미리 불러 둘 장식 그림 (꾸미기 모드에서 바로 놓을 수 있게 전부) */
export const DECO_ASSETS = Object.keys(DECO);
