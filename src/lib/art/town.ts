// 광장 건물·소품 그림 (SVG). Phaser가 이 SVG를 이미지로 바꿔 광장에 놓는다.
// 크기는 화면에 보일 크기의 2배로 그려서(SCALE) 선명하게 만든다.

const O = "#4a3426"; // 외곽선
const S = `stroke="${O}" stroke-width="3" stroke-linejoin="round"`;
const FONT = `font-family="'Apple SD Gothic Neo','Noto Sans KR',sans-serif" font-weight="800"`;

function wrap(w: number, h: number, body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 2}" height="${h * 2}">${body}</svg>`;
}

function darken(hex: string, amount = 0.25) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.round(v * (1 - amount)));
  return `#${[f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// ===== 집 (단계별 성장, TOWN-11) =====
// 레벨 10마다 한 단계씩 커진다: Lv.1~9 → 1단계 … Lv.90 이상 → 10단계 (사용자 결정 2026-10-09).
// 같은 150 × 140 집 그림에 단계마다 하나씩 더하고(창문 → 다락 → 꽃밭 → 울타리 → 2층 → 발코니 → 탑 → 정원 → 금장식),
// 광장에는 단계가 높을수록 조금씩 크게 놓는다.
const HOUSE_STAGE_NAMES = [
  "작은 오두막",
  "창문 많은 집",
  "다락 있는 집",
  "꽃밭 있는 집",
  "울타리 있는 집",
  "2층 집",
  "발코니 있는 집",
  "탑 있는 집",
  "정원 있는 저택",
  "마을 최고 저택",
] as const;
export type HouseStage = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export const MAX_HOUSE_STAGE: HouseStage = 10;
/** 한 단계가 오르는 레벨 간격 */
export const HOUSE_STAGE_LEVELS = 10;

/** 그림 틀(viewBox): 울타리(5단계)부터 옆으로, 2층(6단계)·탑(8단계)부터 위로 넓어진다 */
function houseFrame(stage: HouseStage) {
  const x = stage >= 5 ? -16 : 0;
  const y = stage >= 8 ? -48 : stage >= 6 ? -38 : 0;
  return { x, y, w: 150 - 2 * x, h: 140 - y };
}

/** 단계별 이름과 광장에 놓을 크기 (단계마다 6%씩 커진다) */
export const HOUSE_STAGES = Object.fromEntries(
  HOUSE_STAGE_NAMES.map((name, i) => {
    const stage = (i + 1) as HouseStage;
    const f = houseFrame(stage);
    const scale = 1 + 0.06 * i;
    return [stage, { name, width: Math.round(f.w * scale), height: Math.round(f.h * scale) }];
  }),
) as Record<HouseStage, { name: string; width: number; height: number }>;

/** 집 주인의 레벨로 정하는 집 단계: 10레벨마다 1단계 (Lv.1~9 → 1, Lv.10~19 → 2, …, Lv.90 이상 → 10) */
export function houseStage(level: number): HouseStage {
  return Math.min(MAX_HOUSE_STAGE, Math.max(1, Math.floor(level / HOUSE_STAGE_LEVELS) + 1)) as HouseStage;
}

/** 지붕 색 코드값(blogs.roof_color, src/lib/blog.ts ROOF_COLORS) → 실제 색 */
export const ROOF_HEX = {
  red: "#e0584f",
  orange: "#f08a3c",
  yellow: "#f2c14e",
  green: "#5fb36a",
  sky: "#6cc3e8",
  blue: "#4a7fd6",
  purple: "#9a76d6",
  brown: "#a0704e",
  pink: "#f08fb3",
  mint: "#4fc3a8",
} as const;

const sparkle = (x: number, y: number, r: number) =>
  `<path d="M${x} ${y - r}L${x + r * 0.25} ${y - r * 0.25}L${x + r} ${y}L${x + r * 0.25} ${y + r * 0.25}L${x} ${y + r}L${x - r * 0.25} ${y + r * 0.25}L${x - r} ${y}L${x - r * 0.25} ${y - r * 0.25}Z" fill="#ffe08a" stroke="${O}" stroke-width="1"/>`;

export function houseSvg(stage: HouseStage, roof: string): string {
  const { width: w, height: h } = HOUSE_STAGES[stage];
  const f = houseFrame(stage);
  const roofDark = darken(roof, 0.28);
  // 2층(6단계)부터는 지붕·굴뚝·다락을 위로 올리고 그 사이에 2층 벽을 넣는다
  const up = stage >= 6 ? 38 : 0;
  const lift = (svg: string) => (up ? `<g transform="translate(0 -${up})">${svg}</g>` : svg);
  let body =
    stage >= 9
      ? // 9단계: 집 둘레 잔디 정원
        `<ellipse cx="75" cy="133" rx="90" ry="8" fill="#8fd16f" stroke="#5f9e4a" stroke-width="2"/>`
      : `<ellipse cx="75" cy="133" rx="${stage >= 5 ? 84 : 62}" ry="6" fill="#000" opacity=".15"/>`;
  // 8단계: 왼쪽 둥근 탑 (집보다 먼저 그려 뒤에 선다)
  if (stage >= 8) {
    body +=
      `<rect x="-4" y="8" width="28" height="122" rx="3" fill="#efd3a6" ${S}/>` +
      `<path d="M-2 44H22M-2 84H22" stroke="#d9b98a" stroke-width="2"/>` +
      `<path d="M4 36V26Q4 20 10 20Q16 20 16 26V36Z" fill="#bfe8ff" ${S}/>` +
      `<path d="M4 74V64Q4 58 10 58Q16 58 16 64V74Z" fill="#bfe8ff" ${S}/>` +
      `<path d="M-9 12L10 -44L29 12Z" fill="${roof}" ${S}/>` +
      `<path d="M-5 4H25M1 -14H19" stroke="${roofDark}" stroke-width="3" stroke-linecap="round"/>`;
  }
  // 굴뚝
  body += lift(`<rect x="98" y="22" width="16" height="30" fill="#b9a28a" ${S}/><rect x="95" y="18" width="22" height="8" rx="2" fill="#9c8670" ${S}/>`);
  // 1층 벽 + 나무 판자
  body += `<rect x="24" y="62" width="102" height="68" rx="4" fill="#f4dcb5" ${S}/>` + `<path d="M26 80H124M26 98H124M26 116H124" stroke="#d9b98a" stroke-width="2"/>`;
  // 6단계: 2층 벽과 창문 셋 (7단계는 가운데가 발코니 문)
  if (stage >= 6) {
    const win = (x: number) => `<rect x="${x}" y="40" width="18" height="16" rx="3" fill="#bfe8ff" ${S}/><path d="M${x + 9} 40V56" stroke="${O}" stroke-width="2"/>`;
    body += `<rect x="30" y="28" width="90" height="36" rx="3" fill="#f9e6c4" ${S}/>` + win(38) + win(94);
    body += stage >= 7 ? `<path d="M66 62V46Q66 40 75 40Q84 40 84 46V62Z" fill="#9b6a43" ${S}/>` : win(66);
  }
  // 지붕 + 기와 줄 (10단계는 금빛 테두리)
  body += lift(
    `<path d="M12 68L75 18L138 68Q140 74 133 74H17Q10 74 12 68Z" fill="${roof}" ${S}/>` +
      `<path d="M40 52H110M28 63H122M56 39H94" stroke="${roofDark}" stroke-width="3" stroke-linecap="round"/>` +
      (stage >= 10 ? `<path d="M21 66L75 23L129 66" fill="none" stroke="#ffd36e" stroke-width="3" stroke-linecap="round"/>` : ""),
  );
  // 7단계: 2층 발코니 난간
  if (stage >= 7) {
    body +=
      `<rect x="54" y="62" width="42" height="5" rx="1" fill="#c9b8a6" ${S}/>` +
      `<path d="M60 52V62M67 52V62M75 52V62M83 52V62M90 52V62" stroke="${O}" stroke-width="2"/>` +
      `<rect x="56" y="50" width="38" height="4" rx="1" fill="#fff4dc" ${S}/>`;
  }
  // 문 (10단계는 금빛 아치)
  body +=
    `<path d="M62 130V100Q62 88 75 88Q88 88 88 100V130Z" fill="#9b6a43" ${S}/>` +
    (stage >= 10 ? `<path d="M59 102Q59 84 75 84Q91 84 91 102" fill="none" stroke="#ffd36e" stroke-width="3" stroke-linecap="round"/>` : "") +
    `<path d="M75 90V130" stroke="#7d5232" stroke-width="2"/><circle cx="82" cy="111" r="2.2" fill="#ffd36e" stroke="${O}" stroke-width="1"/>` +
    `<rect x="56" y="128" width="38" height="6" rx="2" fill="#c9b8a6" ${S}/>`;
  // 창문 + 꽃 상자
  body +=
    `<rect x="33" y="84" width="20" height="18" rx="3" fill="#bfe8ff" ${S}/><path d="M43 84V102M33 93H53" stroke="${O}" stroke-width="2"/>` +
    `<rect x="31" y="102" width="24" height="6" rx="2" fill="#8d6e63" ${S}/>` +
    `<circle cx="36" cy="100" r="3" fill="#ff7aa2"/><circle cx="43" cy="99" r="3" fill="#ffd36e"/><circle cx="50" cy="100" r="3" fill="#ff7aa2"/>`;
  // 2단계: 문 오른쪽에 창문 하나 더
  if (stage >= 2) {
    body +=
      `<rect x="97" y="84" width="20" height="18" rx="3" fill="#bfe8ff" ${S}/><path d="M107 84V102M97 93H117" stroke="${O}" stroke-width="2"/>` +
      `<rect x="95" y="102" width="24" height="6" rx="2" fill="#8d6e63" ${S}/>` +
      `<circle cx="100" cy="100" r="3" fill="#b79cff"/><circle cx="107" cy="99" r="3" fill="#ff7aa2"/><circle cx="114" cy="100" r="3" fill="#b79cff"/>`;
  } else {
    // 1단계: 문 옆 작은 등
    body += `<rect x="98" y="96" width="8" height="10" rx="2" fill="#ffe08a" ${S}/>`;
  }
  // 3단계: 지붕 쪽 둥근 다락 창과 깃발 (10단계는 깃발 대신 왕관)
  if (stage >= 3) {
    body += lift(
      `<circle cx="75" cy="46" r="10" fill="#bfe8ff" ${S}/><path d="M75 36V56M65 46H85" stroke="${O}" stroke-width="2"/>` +
        (stage >= 10
          ? `<path d="M63 16L65 2L70 9L75 -1L80 9L85 2L87 16Z" fill="#ffd36e" ${S}/>`
          : `<path d="M75 18V4" stroke="${O}" stroke-width="2.5"/><path d="M75 4L92 9L75 14Z" fill="#ffd36e" stroke="${O}" stroke-width="1.5"/>`),
    );
  }
  // 9단계: 앞마당 산울타리
  if (stage >= 9) {
    body +=
      `<rect x="25" y="117" width="31" height="15" rx="7" fill="#5fae5a" ${S}/>` +
      `<rect x="94" y="117" width="31" height="15" rx="7" fill="#5fae5a" ${S}/>` +
      `<circle cx="34" cy="122" r="2.5" fill="#fff"/><circle cx="46" cy="125" r="2.5" fill="#ffd36e"/><circle cx="104" cy="125" r="2.5" fill="#ffd36e"/><circle cx="116" cy="122" r="2.5" fill="#fff"/>`;
  }
  // 4단계: 양쪽 꽃덤불
  if (stage >= 4) {
    const bush = (cx: number) =>
      `<ellipse cx="${cx}" cy="124" rx="11" ry="10" fill="#6fbf73" ${S}/>` +
      `<circle cx="${cx - 4}" cy="120" r="2.5" fill="#ff7aa2"/><circle cx="${cx + 4}" cy="123" r="2.5" fill="#ffd36e"/><circle cx="${cx - 1}" cy="128" r="2.5" fill="#ff7aa2"/>`;
    body += bush(14) + bush(136);
  }
  // 5단계: 양옆 나무 울타리
  if (stage >= 5) {
    const fence = (xs: number[], x1: number, x2: number) =>
      `<path d="M${x1} 119H${x2}M${x1} 128H${x2}" stroke="${O}" stroke-width="5" stroke-linecap="round"/><path d="M${x1} 119H${x2}M${x1} 128H${x2}" stroke="#fff4dc" stroke-width="2.5" stroke-linecap="round"/>` +
      xs.map((x) => `<path d="M${x} 134V115L${x + 2.5} 111L${x + 5} 115V134Z" fill="#fff4dc" stroke="${O}" stroke-width="1.8" stroke-linejoin="round"/>`).join("");
    body += fence([-13, -4, 5], -14, 9) + fence([140, 149, 158], 141, 164);
  }
  // 10단계: 반짝이
  if (stage >= 10) body += sparkle(150, -20, 7) + sparkle(-12, -8, 5) + sparkle(40, -36, 5) + sparkle(160, 60, 5);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f.x} ${f.y} ${f.w} ${f.h}" width="${w * 2}" height="${h * 2}">${body}</svg>`;
}

// ===== 빈 집터: 즐겨찾기한 이웃이 없는 자리 =====
export const LOT_SIZE = { width: 150, height: 110 };
export function lotSvg(): string {
  const post = (x: number, y: number) => `<rect x="${x - 3}" y="${y - 16}" width="6" height="18" rx="2" fill="#c9a37a" stroke="${O}" stroke-width="1.8"/>`;
  let fence = "";
  for (const x of [18, 44, 70, 80, 106, 132]) fence += post(x, 96);
  for (const y of [50, 73]) fence += post(18, y) + post(132, y);
  const body =
    `<ellipse cx="75" cy="102" rx="64" ry="5" fill="#000" opacity=".12"/>` +
    `<path d="M18 44H132V96H18Z" fill="#d8bf8f" stroke="#b89a6a" stroke-width="2" stroke-dasharray="6 5"/>` +
    `<path d="M30 60h16M60 70h10M96 58h20M40 84h14M92 82h22" stroke="#c4a674" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M18 80H70M80 80H132" stroke="#e2c79a" stroke-width="3"/>` + fence +
    // 팻말
    `<rect x="70" y="20" width="6" height="40" fill="#8d6040" ${S}/>` +
    `<rect x="44" y="10" width="58" height="24" rx="5" fill="#fff4dc" ${S}/>` +
    `<text x="73" y="27" text-anchor="middle" font-size="11" fill="#6b4f3a" ${FONT}>빈 집터</text>`;
  return wrap(LOT_SIZE.width, LOT_SIZE.height, body);
}

// ===== 우체통: 집 앞에서 소식 받기 =====
export const MAILBOX_SIZE = { width: 34, height: 58 };
export function mailboxSvg(color = "#e05a4f"): string {
  const body =
    `<ellipse cx="17" cy="55" rx="10" ry="3" fill="#000" opacity=".15"/>` +
    `<rect x="14" y="28" width="6" height="28" fill="#8d6040" ${S}/>` +
    `<path d="M3 30V14Q3 4 17 4Q31 4 31 14V30Z" fill="${color}" ${S}/>` +
    `<rect x="9" y="15" width="16" height="4" rx="2" fill="#4a3426"/>` +
    `<path d="M31 10V-2" stroke="${O}" stroke-width="2"/><path d="M31 -2h8v7h-8" fill="#ffd36e" stroke="${O}" stroke-width="1.5"/>`;
  return wrap(MAILBOX_SIZE.width, MAILBOX_SIZE.height, `<g transform="translate(0 2)">${body}</g>`);
}

// ===== 표지판(정류장): 집 11채로 텔레포트 =====
export const SIGNPOST_SIZE = { width: 110, height: 130 };
export function signpostSvg(): string {
  const body =
    `<ellipse cx="55" cy="126" rx="34" ry="5" fill="#000" opacity=".15"/>` +
    `<rect x="50" y="20" width="10" height="106" rx="3" fill="#8d6040" ${S}/>` +
    `<path d="M14 24H86L100 36L86 48H14Z" fill="#7ec8e3" ${S}/>` +
    `<text x="54" y="41" text-anchor="middle" font-size="14" fill="#1d3b4f" ${FONT}>🚏 정류장</text>` +
    `<path d="M96 60H24L10 72L24 84H96Z" fill="#ffd36e" ${S}/>` +
    `<text x="56" y="77" text-anchor="middle" font-size="12" fill="#5a3d1e" ${FONT}>이웃집 가기</text>` +
    `<rect x="36" y="118" width="38" height="8" rx="3" fill="#c9b8a6" ${S}/>`;
  return wrap(SIGNPOST_SIZE.width, SIGNPOST_SIZE.height, body);
}

// ===== 마을 게시판 (마을 소식 + 출석 도장) =====
export const BOARD_SIZE = { width: 250, height: 170 };
export function boardSvg(): string {
  const { width: w, height: h } = BOARD_SIZE;
  let notes = "";
  const papers = [
    { x: 30, y: 52, r: -6, c: "#fffdf5" },
    { x: 64, y: 48, r: 4, c: "#fff3b0" },
    { x: 38, y: 92, r: 3, c: "#d6f5ff" },
    { x: 74, y: 90, r: -4, c: "#ffe1ec" },
  ];
  for (const p of papers) {
    notes +=
      `<g transform="rotate(${p.r} ${p.x + 15} ${p.y + 18})"><rect x="${p.x}" y="${p.y}" width="30" height="34" fill="${p.c}" stroke="#c9b79c" stroke-width="1.5"/>` +
      `<path d="M${p.x + 5} ${p.y + 12}H${p.x + 25}M${p.x + 5} ${p.y + 18}H${p.x + 22}M${p.x + 5} ${p.y + 24}H${p.x + 24}" stroke="#a89880" stroke-width="2" stroke-linecap="round"/>` +
      `<circle cx="${p.x + 15}" cy="${p.y + 3}" r="3" fill="#e5484d" stroke="${O}" stroke-width="1"/></g>`;
  }
  // 출석 도장 판: 7칸 중 몇 칸에 도장
  let stamps = "";
  for (let i = 0; i < 7; i++) {
    const cx = 148 + (i % 4) * 19 + (i >= 4 ? 9 : 0);
    const cy = 82 + Math.floor(i / 4) * 22;
    stamps += `<circle cx="${cx}" cy="${cy}" r="8" fill="#fff" stroke="#c9b79c" stroke-width="1.5"/>`;
    if (i < 4) stamps += `<path d="M${cx} ${cy - 5}l1.5 3.4 3.7.3-2.8 2.4.9 3.6-3.3-2-3.3 2 .9-3.6-2.8-2.4 3.7-.3z" fill="#e5484d"/>`;
  }
  const body =
    `<ellipse cx="125" cy="163" rx="100" ry="6" fill="#000" opacity=".15"/>` +
    // 기둥
    `<rect x="22" y="40" width="12" height="124" rx="3" fill="#8d6040" ${S}/><rect x="216" y="40" width="12" height="124" rx="3" fill="#8d6040" ${S}/>` +
    // 작은 지붕
    `<path d="M6 34L125 6L244 34Q246 42 238 42H12Q4 42 6 34Z" fill="#a0522d" ${S}/><path d="M50 26H200" stroke="#7a3d20" stroke-width="3" stroke-linecap="round"/>` +
    // 판
    `<rect x="16" y="38" width="218" height="104" rx="6" fill="#b07a4f" ${S}/>` +
    `<rect x="24" y="44" width="98" height="92" rx="3" fill="#d9b382"/>` +
    `<rect x="128" y="44" width="98" height="92" rx="3" fill="#e9d5b0"/>` +
    notes +
    // 출석 도장 판 머리
    `<rect x="140" y="52" width="74" height="16" rx="4" fill="#4caf50" stroke="${O}" stroke-width="1.5"/>` +
    `<text x="177" y="64" text-anchor="middle" font-size="11" fill="#fff" ${FONT}>출석 도장</text>` +
    stamps +
    // 아래 명패
    `<rect x="70" y="146" width="110" height="18" rx="5" fill="#f5e6c8" ${S}/>` +
    `<text x="125" y="159" text-anchor="middle" font-size="11" fill="${O}" ${FONT}>마을 게시판</text>`;
  return wrap(w, h, body);
}

// ===== 상점 =====
export const SHOP_SIZE = { width: 210, height: 180 };
export function shopSvg(): string {
  const { width: w, height: h } = SHOP_SIZE;
  let awning = "";
  for (let i = 0; i < 9; i++) {
    const x = 14 + i * 20;
    awning += `<path d="M${x} 60H${x + 20}V82Q${x + 10} 92 ${x} 82Z" fill="${i % 2 ? "#fff" : "#e5484d"}" stroke="${O}" stroke-width="2"/>`;
  }
  const body =
    `<ellipse cx="105" cy="173" rx="90" ry="6" fill="#000" opacity=".15"/>` +
    // 건물
    `<rect x="20" y="40" width="170" height="130" rx="5" fill="#fff4dc" ${S}/>` +
    `<path d="M14 44L105 14L196 44Z" fill="#c0392b" ${S}/>` +
    // 간판
    `<rect x="62" y="24" width="86" height="28" rx="8" fill="#ffd36e" ${S}/>` +
    `<circle cx="80" cy="38" r="8" fill="#ffb31a" stroke="${O}" stroke-width="2"/><text x="80" y="42" text-anchor="middle" font-size="10" fill="${O}" ${FONT}>₩</text>` +
    `<text x="116" y="43" text-anchor="middle" font-size="15" fill="${O}" ${FONT}>상점</text>` +
    // 줄무늬 차양
    `<rect x="12" y="56" width="186" height="8" rx="3" fill="#a5282b" ${S}/>` + awning +
    // 진열창 + 진열품
    `<rect x="30" y="98" width="72" height="50" rx="4" fill="#cdeefe" ${S}/>` +
    `<path d="M30 132H102" stroke="#9cc9de" stroke-width="2"/>` +
    `<circle cx="46" cy="124" r="7" fill="#f6a24e" stroke="${O}" stroke-width="1.5"/><circle cx="66" cy="122" r="9" fill="#b79cff" stroke="${O}" stroke-width="1.5"/>` +
    `<rect x="80" y="115" width="14" height="16" rx="3" fill="#6cc070" stroke="${O}" stroke-width="1.5"/>` +
    `<path d="M38 104l10 10M58 102l14 14" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>` +
    // 문
    `<rect x="120" y="96" width="50" height="74" rx="4" fill="#8d5a3b" ${S}/>` +
    `<rect x="128" y="104" width="34" height="28" rx="3" fill="#cdeefe" stroke="${O}" stroke-width="2"/>` +
    `<circle cx="163" cy="140" r="2.5" fill="#ffd36e" stroke="${O}" stroke-width="1"/>` +
    `<rect x="127" y="110" width="36" height="10" rx="2" fill="#fff" stroke="${O}" stroke-width="1"/>` +
    `<text x="145" y="118" text-anchor="middle" font-size="7" fill="#2f855a" ${FONT}>OPEN</text>` +
    // 바깥 나무 상자·통·화분
    `<rect x="4" y="146" width="26" height="24" rx="2" fill="#c08a52" ${S}/><path d="M4 158H30M17 146V170" stroke="#9c6b3f" stroke-width="2"/>` +
    `<ellipse cx="190" cy="156" rx="11" ry="15" fill="#a9733f" ${S}/><path d="M179 150H201M179 162H201" stroke="#6d4c2f" stroke-width="2"/>` +
    `<rect x="104" y="156" width="12" height="12" rx="2" fill="#d9774f" ${S}/><circle cx="110" cy="150" r="7" fill="#57bb5a" stroke="${O}" stroke-width="2"/>`;
  return wrap(w, h, body);
}

// ===== 분수 =====
export const FOUNTAIN_SIZE = { width: 180, height: 150 };
export function fountainSvg(): string {
  const body =
    `<ellipse cx="90" cy="120" rx="82" ry="26" fill="#000" opacity=".12"/>` +
    `<ellipse cx="90" cy="110" rx="80" ry="30" fill="#b9c3cc" ${S}/>` +
    `<ellipse cx="90" cy="104" rx="66" ry="22" fill="#5ec4ef"/>` +
    `<ellipse cx="70" cy="100" rx="18" ry="4" fill="#fff" opacity=".5"/><ellipse cx="115" cy="110" rx="12" ry="3" fill="#fff" opacity=".4"/>` +
    `<rect x="82" y="52" width="16" height="52" rx="4" fill="#c7d0d8" ${S}/>` +
    `<ellipse cx="90" cy="54" rx="30" ry="9" fill="#c7d0d8" ${S}/><ellipse cx="90" cy="52" rx="22" ry="6" fill="#5ec4ef"/>` +
    `<path d="M90 50Q90 18 90 14M90 22Q68 26 62 56M90 22Q112 26 118 56" fill="none" stroke="#9de2ff" stroke-width="4" stroke-linecap="round"/>` +
    `<circle cx="90" cy="12" r="5" fill="#d5f3ff"/><circle cx="60" cy="60" r="3" fill="#d5f3ff"/><circle cx="120" cy="60" r="3" fill="#d5f3ff"/>`;
  return wrap(FOUNTAIN_SIZE.width, FOUNTAIN_SIZE.height, body);
}

// ===== 나무·소품 =====
export const TREE_SIZE = { width: 80, height: 100 };
export function treeSvg(kind: "round" | "pine" | "bush" | "blossom"): string {
  const trunk = `<rect x="34" y="62" width="12" height="30" rx="3" fill="#8d6040" ${S}/>`;
  const shadow = `<ellipse cx="40" cy="94" rx="26" ry="5" fill="#000" opacity=".15"/>`;
  const body = {
    round:
      shadow + trunk +
      `<circle cx="40" cy="40" r="28" fill="#4caf50" ${S}/><circle cx="30" cy="34" r="10" fill="#66c26a"/><circle cx="50" cy="48" r="7" fill="#43a047"/>`,
    pine:
      shadow + trunk +
      `<path d="M40 4L66 44H54L72 72H8L26 44H14Z" fill="#2e8b57" ${S}/><path d="M40 14L52 34" stroke="#3fa86b" stroke-width="4" stroke-linecap="round"/>`,
    bush:
      `<ellipse cx="40" cy="92" rx="30" ry="5" fill="#000" opacity=".15"/>` +
      `<path d="M10 90Q4 66 22 62Q26 46 42 50Q58 44 62 60Q78 64 70 90Z" fill="#5cb85c" ${S}/>` +
      `<circle cx="28" cy="70" r="3.5" fill="#e5484d"/><circle cx="48" cy="64" r="3.5" fill="#e5484d"/><circle cx="56" cy="78" r="3.5" fill="#e5484d"/>`,
    blossom:
      shadow + trunk +
      `<circle cx="40" cy="40" r="27" fill="#ffb7d0" ${S}/><circle cx="28" cy="32" r="9" fill="#ffd1e1"/><circle cx="52" cy="46" r="8" fill="#ff9ec3"/>`,
  }[kind];
  return wrap(TREE_SIZE.width, TREE_SIZE.height, body);
}

export const LAMP_SIZE = { width: 40, height: 110 };
export function lampSvg(): string {
  return wrap(
    LAMP_SIZE.width,
    LAMP_SIZE.height,
    `<ellipse cx="20" cy="106" rx="12" ry="3" fill="#000" opacity=".15"/>` +
      `<rect x="16" y="30" width="8" height="76" rx="3" fill="#4a5568" ${S}/><rect x="10" y="100" width="20" height="6" rx="2" fill="#4a5568" ${S}/>` +
      `<path d="M8 30L12 10H28L32 30Z" fill="#ffe08a" ${S}/><path d="M6 10H34L30 4H10Z" fill="#4a5568" ${S}/>`,
  );
}

// ===== 동물 농장: 울타리, 헛간, 간판, 울타리 안 동물 =====
export const FARM_SIZE = { width: 260, height: 170 };
export function farmSvg(): string {
  const { width: w, height: h } = FARM_SIZE;
  // 울타리 기둥 + 가로대 두 줄. 가운데 아래(문 자리)는 비운다
  const post = (x: number, y: number) => `<rect x="${x - 3.5}" y="${y - 20}" width="7" height="22" rx="2" fill="#c08a52" stroke="${O}" stroke-width="2"/>`;
  const rails = (x1: number, x2: number, y: number) =>
    `<rect x="${x1}" y="${y - 15}" width="${x2 - x1}" height="5" rx="2" fill="#d9a066" stroke="${O}" stroke-width="1.5"/>` +
    `<rect x="${x1}" y="${y - 7}" width="${x2 - x1}" height="5" rx="2" fill="#d9a066" stroke="${O}" stroke-width="1.5"/>`;
  let fence = rails(96, 248, 72);
  for (let x = 100; x <= 245; x += 24) fence += post(x, 72);
  let front = rails(12, 112, 160) + rails(148, 248, 160);
  for (const x of [16, 40, 64, 88, 112, 148, 172, 196, 220, 244]) front += post(x, 160);
  const side = (x: number) => rails(x - 2, x + 2, 120) + post(x, 96) + post(x, 120) + post(x, 144);
  const body =
    `<ellipse cx="130" cy="163" rx="124" ry="7" fill="#000" opacity=".15"/>` +
    // 울타리 안 땅 (풀 + 흙길)
    `<rect x="12" y="56" width="236" height="100" rx="10" fill="#b9dc86" ${S}/>` +
    `<path d="M120 156Q126 120 150 100T210 76" fill="none" stroke="#d9c08f" stroke-width="16" stroke-linecap="round"/>` +
    `<circle cx="60" cy="130" r="2" fill="#fff"/><circle cx="196" cy="128" r="2" fill="#ffd36e"/><circle cx="172" cy="140" r="2" fill="#ff9ecb"/>` +
    // 헛간 (왼쪽 뒤)
    `<rect x="18" y="38" width="76" height="66" rx="3" fill="#d9534f" ${S}/>` +
    `<path d="M12 42L56 8L100 42Z" fill="#8f3b2d" ${S}/>` +
    `<path d="M46 26h20v10h-20z" fill="#fff4dc" stroke="${O}" stroke-width="2"/>` +
    `<rect x="38" y="64" width="36" height="40" fill="#fff4dc" ${S}/><path d="M38 64L74 104M74 64L38 104" stroke="${O}" stroke-width="2.5"/>` +
    fence + side(12) + side(248) +
    // 건초 더미, 여물통
    `<rect x="104" y="80" width="30" height="20" rx="5" fill="#f0c75e" ${S}/><path d="M108 86h22M108 93h22" stroke="#c99a2e" stroke-width="2"/>` +
    `<path d="M196 112h36l-4 14h-28z" fill="#a9733f" ${S}/><path d="M199 116h30" stroke="#6cb4ee" stroke-width="3"/>` +
    front +
    // 울타리 안 동물 (병아리, 아기 돼지)
    `<circle cx="66" cy="128" r="7" fill="#ffd84d" stroke="${O}" stroke-width="1.5"/><path d="M71 128l4 1.5l-4 1.5z" fill="#f08a24"/><circle cx="68" cy="126" r="1" fill="${O}"/>` +
    `<ellipse cx="214" cy="136" rx="11" ry="8" fill="#ffc7d6" stroke="${O}" stroke-width="1.5"/><ellipse cx="223" cy="136" rx="3.5" ry="2.6" fill="#ff9fb8" stroke="${O}" stroke-width="1.2"/><circle cx="217" cy="132" r="1" fill="${O}"/>` +
    // 간판
    `<rect x="166" y="100" width="6" height="40" fill="#8d6040" ${S}/>` +
    `<rect x="128" y="74" width="82" height="34" rx="6" fill="#f5e6c8" ${S}/>` +
    `<text x="169" y="96" text-anchor="middle" font-size="14" fill="#2f7d32" ${FONT}>동물 농장</text>`;
  return wrap(w, h, body);
}

export function toDataUri(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// 연못 낚시터 (사용자 요청 2026-10-08): 작은 연못 위 나무 잔교, 낚시 오두막과 간판
export const FISHING_SIZE = { width: 250, height: 170 };
export function fishingSvg(): string {
  const { width: w, height: h } = FISHING_SIZE;
  let planks = "";
  for (let x = 92; x < 214; x += 14) planks += `<rect x="${x}" y="104" width="13" height="26" rx="2" fill="#d9a066" stroke="${O}" stroke-width="1.5"/>`;
  const body =
    `<ellipse cx="125" cy="163" rx="118" ry="7" fill="#000" opacity=".15"/>` +
    // 연못
    `<ellipse cx="150" cy="122" rx="96" ry="40" fill="#6fb868"/>` +
    `<ellipse cx="150" cy="122" rx="88" ry="34" fill="#7ec8e3" ${S}/>` +
    `<path d="M92 118q8 -4 16 0M180 136q8 -4 16 0M150 140q6 -3 12 0" fill="none" stroke="#e6f6fb" stroke-width="2" stroke-linecap="round"/>` +
    `<circle cx="214" cy="112" r="7" fill="#5cae55"/><circle cx="216" cy="110" r="2.5" fill="#ff9ecb"/>` +
    // 잔교 (기둥 + 판자)
    `<path d="M100 130v14M150 130v14M200 130v14" stroke="#8d6040" stroke-width="5" stroke-linecap="round"/>` +
    planks +
    // 오두막 (왼쪽)
    `<rect x="14" y="66" width="74" height="66" rx="3" fill="#7fb8d9" ${S}/>` +
    `<path d="M6 70L51 34L96 70Z" fill="#3f6f9a" ${S}/>` +
    `<rect x="40" y="94" width="24" height="38" rx="3" fill="#a46d3f" ${S}/><circle cx="58" cy="114" r="2" fill="${O}"/>` +
    `<rect x="20" y="80" width="16" height="14" rx="2" fill="#fff4dc" stroke="${O}" stroke-width="2"/>` +
    // 낚싯대와 찌
    `<path d="M196 104L236 40" stroke="#8d6040" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M236 40Q242 90 228 124" fill="none" stroke="${O}" stroke-width="1.2"/>` +
    `<circle cx="228" cy="126" r="4" fill="#e05a4f" stroke="${O}" stroke-width="1.2"/>` +
    // 물고기 그릇
    `<path d="M168 92h26l-3 12h-20z" fill="#e8dccb" ${S}/><path d="M174 92q6 -8 12 0" fill="#ffb26b" stroke="${O}" stroke-width="1.2"/>` +
    // 간판
    `<rect x="110" y="64" width="6" height="40" fill="#8d6040" ${S}/>` +
    `<rect x="74" y="38" width="80" height="32" rx="6" fill="#f5e6c8" ${S}/>` +
    `<text x="114" y="59" text-anchor="middle" font-size="14" fill="#2f6f9a" ${FONT}>낚시터</text>`;
  return wrap(w, h, body);
}
