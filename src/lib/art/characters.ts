// Blogville 창작 캐릭터 (SVG). 외부 그림 없이 코드로 그려서 라이선스 걱정이 없다.
// 모든 캐릭터는 같은 몸(2등신, 큰 눈, 볼터치)을 쓰고 귀·꼬리·뿔 같은 특징만 다르다.
// viewBox 64×64, 발바닥이 y=59 근처. DB의 asset_key("char.cat" 등)로 고른다.

const OUTLINE = "#3b2a20";
const S = `stroke="${OUTLINE}" stroke-width="1.6" stroke-linejoin="round"`;

type Look = {
  body: string; // 몸 색
  head?: string; // 머리 색 (없으면 몸 색)
  belly?: string; // 배 색
  feet?: string; // 발 색
  arms?: string; // 팔 색
  behind?: string; // 몸 뒤에 그릴 것 (꼬리, 날개, 뒤쪽 귀)
  overHead?: string; // 머리 위에 그릴 것 (머리카락, 앞쪽 귀, 뿔)
  face?: string; // 눈 아래에 그릴 것 (무늬, 주둥이)
  extra?: string; // 맨 위에 그릴 것 (코, 수염, 소품)
  eyes?: string; // 눈 대신 그릴 것
  blush?: boolean;
};

const eyes = (color = "#2b2118") =>
  `<ellipse cx="25.5" cy="27.5" rx="2.6" ry="3.2" fill="${color}"/><ellipse cx="38.5" cy="27.5" rx="2.6" ry="3.2" fill="${color}"/>` +
  `<circle cx="26.4" cy="26.3" r="1" fill="#fff"/><circle cx="39.4" cy="26.3" r="1" fill="#fff"/>`;
const blushes = `<ellipse cx="20.5" cy="32.8" rx="3.2" ry="1.8" fill="#ff8fa3" opacity=".55"/><ellipse cx="43.5" cy="32.8" rx="3.2" ry="1.8" fill="#ff8fa3" opacity=".55"/>`;
const smile = `<path d="M29.4 32.6q1.3 1.6 2.6 0q1.3 1.6 2.6 0" fill="none" stroke="${OUTLINE}" stroke-width="1.4" stroke-linecap="round"/>`;

function draw(l: Look) {
  const head = l.head ?? l.body;
  const feet = l.feet ?? l.body;
  const arms = l.arms ?? l.body;
  return [
    `<ellipse cx="32" cy="60.5" rx="14" ry="2.6" fill="#000" opacity=".14"/>`,
    l.behind ?? "",
    `<ellipse cx="25.5" cy="57" rx="4.6" ry="2.9" fill="${feet}" ${S}/>`,
    `<ellipse cx="38.5" cy="57" rx="4.6" ry="2.9" fill="${feet}" ${S}/>`,
    `<ellipse cx="32" cy="46.5" rx="12.5" ry="10.5" fill="${l.body}" ${S}/>`,
    l.belly ? `<ellipse cx="32" cy="48.5" rx="7" ry="6.2" fill="${l.belly}"/>` : "",
    `<ellipse cx="20.2" cy="46" rx="3.2" ry="5" transform="rotate(25 20.2 46)" fill="${arms}" ${S}/>`,
    `<ellipse cx="43.8" cy="46" rx="3.2" ry="5" transform="rotate(-25 43.8 46)" fill="${arms}" ${S}/>`,
    `<circle cx="32" cy="27" r="16.5" fill="${head}" ${S}/>`,
    l.face ?? "",
    l.eyes ?? eyes(),
    l.blush === false ? "" : blushes,
    l.overHead ?? "",
    l.extra ?? smile,
  ].join("");
}

// 귀·꼬리처럼 몸 색에 외곽선이 있는 굵은 선
const thickLine = (d: string, color: string, width: number) =>
  `<path d="${d}" fill="none" stroke="${OUTLINE}" stroke-width="${width + 3.2}" stroke-linecap="round"/>` +
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;

const CHARACTERS: Record<string, Look> = {
  // 모험가: 갈색 머리, 빨간 스카프, 초록 튜닉
  "char.human": {
    body: "#4caf7a",
    head: "#ffdcbf",
    arms: "#ffdcbf",
    feet: "#8a5a35",
    overHead:
      `<path d="M15.6 27.5C14.8 15.5 22.6 9.6 32 9.6S49.2 15.5 48.4 27.5C45.5 21.2 40.6 18.6 34.8 19.6C30.4 17 23 18.8 15.6 27.5Z" fill="#7a4b2a" ${S}/>` +
      `<path d="M31 10.2c2-4 6-4.6 7.6-3.2c-2.6.4-4.4 1.8-5 3.6" fill="#7a4b2a" ${S}/>`,
    extra:
      smile +
      `<path d="M21 40.5q11 5 22 0l1.5 3.2q-12.5 5.6-25 0z" fill="#e85d4a" ${S}/>` +
      `<path d="M38.5 43.5l3.5 6.5l3-1.2l-2.6-6.4" fill="#e85d4a" ${S}/>`,
  },
  // 고양이: 주황 줄무늬, 세모 귀, 수염, 말린 꼬리
  "char.cat": {
    body: "#f6a24e",
    belly: "#fde3c4",
    behind: thickLine("M43 52c11 3 14-7 9.5-12", "#f6a24e", 4.2),
    overHead:
      `<path d="M16.5 21L18.5 6.5L28.5 13.5Z" fill="#f6a24e" ${S}/><path d="M19 17.5l.9-6.8l4.6 3.4z" fill="#ffb3c1"/>` +
      `<path d="M47.5 21L45.5 6.5L35.5 13.5Z" fill="#f6a24e" ${S}/><path d="M45 17.5l-.9-6.8l-4.6 3.4z" fill="#ffb3c1"/>` +
      `<path d="M29 12.5l1.2 4M32 11.8v4.4M35 12.5l-1.2 4" stroke="#d9781f" stroke-width="1.8" stroke-linecap="round"/>`,
    extra:
      `<path d="M30.6 30.6h2.8l-1.4 1.6z" fill="#ff8fa3" stroke="${OUTLINE}" stroke-width=".8"/>` +
      `<path d="M30 33.2q1 1.2 2 0q1 1.2 2 0" fill="none" stroke="${OUTLINE}" stroke-width="1.3" stroke-linecap="round"/>` +
      `<path d="M14 30.5l6 1M14.5 34l5.6-.6M50 30.5l-6 1M49.5 34l-5.6-.6" stroke="${OUTLINE}" stroke-width="1" stroke-linecap="round"/>`,
  },
  // 강아지: 크림색, 늘어진 갈색 귀, 눈가 얼룩, 내민 혀
  "char.dog": {
    body: "#f1d3a1",
    belly: "#fff3dd",
    behind: thickLine("M43.5 47c6-2 8.5-6.5 8-10", "#f1d3a1", 3.6),
    face: `<ellipse cx="38.8" cy="27.2" rx="5.2" ry="5.6" fill="#c98c55"/>`,
    overHead:
      `<ellipse cx="17" cy="26" rx="5" ry="10" transform="rotate(18 17 26)" fill="#a8683b" ${S}/>` +
      `<ellipse cx="47" cy="26" rx="5" ry="10" transform="rotate(-18 47 26)" fill="#a8683b" ${S}/>`,
    extra:
      `<ellipse cx="32" cy="30.8" rx="2.5" ry="1.8" fill="${OUTLINE}"/>` +
      `<path d="M29.4 33q1.3 1.3 2.6 0q1.3 1.3 2.6 0" fill="none" stroke="${OUTLINE}" stroke-width="1.3" stroke-linecap="round"/>` +
      `<path d="M31 34.4h3v1.8a1.5 1.5 0 0 1-3 0z" fill="#ff7b8a" stroke="${OUTLINE}" stroke-width=".8"/>`,
  },
  // 토끼: 하얀 털, 긴 귀, 분홍 코, 앞니
  "char.rabbit": {
    body: "#fbf7f2",
    belly: "#ffffff",
    behind: `<circle cx="44" cy="52" r="3.6" fill="#ffffff" ${S}/>`,
    overHead:
      `<ellipse cx="25" cy="7.5" rx="4.6" ry="11.5" transform="rotate(-8 25 7.5)" fill="#fbf7f2" ${S}/>` +
      `<ellipse cx="25" cy="8.5" rx="2" ry="8" transform="rotate(-8 25 8.5)" fill="#ffc2cf"/>` +
      `<ellipse cx="39" cy="7.5" rx="4.6" ry="11.5" transform="rotate(8 39 7.5)" fill="#fbf7f2" ${S}/>` +
      `<ellipse cx="39" cy="8.5" rx="2" ry="8" transform="rotate(8 39 8.5)" fill="#ffc2cf"/>`,
    extra:
      `<ellipse cx="32" cy="31" rx="1.8" ry="1.3" fill="#ff8fa3"/>` +
      `<path d="M29.6 32.6q1.2 1.4 2.4 0q1.2 1.4 2.4 0" fill="none" stroke="${OUTLINE}" stroke-width="1.3" stroke-linecap="round"/>` +
      `<rect x="30.6" y="33.3" width="2.8" height="2.6" rx=".6" fill="#fff" stroke="${OUTLINE}" stroke-width=".8"/>`,
  },
  // 여우: 주황 털, 흰 주둥이, 검은 귀 끝, 풍성한 꼬리
  "char.fox": {
    body: "#ef7a35",
    belly: "#fff5ea",
    feet: "#4a3326",
    behind:
      `<path d="M42 51c10 4 18-1 17-11c-1-4-4-6-6-5c1 7-4 12-12 12z" fill="#ef7a35" ${S}/>` +
      `<path d="M53 35c1.6 2.6 1.3 6-.6 8.6c3-.6 5.6-3.2 5.4-6.6c-.2-1.8-1.8-2.8-4.8-2z" fill="#fff5ea"/>`,
    face: `<path d="M17 30c4 8 26 8 30 0c-2 9-8 12-15 12s-13-3-15-12z" fill="#fff5ea"/>`,
    overHead:
      `<path d="M16 20L16.5 5L28 12.5Z" fill="#ef7a35" ${S}/><path d="M16.3 11L16.5 5l4.6 3z" fill="${OUTLINE}"/>` +
      `<path d="M48 20L47.5 5L36 12.5Z" fill="#ef7a35" ${S}/><path d="M47.7 11L47.5 5l-4.6 3z" fill="${OUTLINE}"/>`,
    extra:
      `<ellipse cx="32" cy="31" rx="2.2" ry="1.6" fill="${OUTLINE}"/>` +
      `<path d="M29.6 33.2q1.2 1.4 2.4 0q1.2 1.4 2.4 0" fill="none" stroke="${OUTLINE}" stroke-width="1.3" stroke-linecap="round"/>`,
  },
  // 판다: 흰 몸, 검은 귀·눈 무늬·팔다리
  "char.panda": {
    body: "#fbfbf8",
    arms: "#2f2a2a",
    feet: "#2f2a2a",
    face:
      `<ellipse cx="25" cy="27.5" rx="5" ry="5.8" transform="rotate(20 25 27.5)" fill="#2f2a2a"/>` +
      `<ellipse cx="39" cy="27.5" rx="5" ry="5.8" transform="rotate(-20 39 27.5)" fill="#2f2a2a"/>`,
    eyes:
      `<ellipse cx="25.6" cy="27.6" rx="1.9" ry="2.3" fill="#fff"/><ellipse cx="38.4" cy="27.6" rx="1.9" ry="2.3" fill="#fff"/>` +
      `<circle cx="25.8" cy="27.8" r="1.1" fill="#2b2118"/><circle cx="38.6" cy="27.8" r="1.1" fill="#2b2118"/>`,
    overHead: `<circle cx="18.5" cy="13" r="5.5" fill="#2f2a2a" ${S}/><circle cx="45.5" cy="13" r="5.5" fill="#2f2a2a" ${S}/>`,
    extra:
      `<ellipse cx="32" cy="31.4" rx="2.2" ry="1.5" fill="#2f2a2a"/>` + smile.replace("32.6", "33.4"),
  },
  // 로봇: 둥근 네모 머리, 화면 얼굴, 안테나
  "char.robot": {
    body: "#9db4c8",
    belly: "#c7d6e3",
    head: "#b8c9d9",
    arms: "#8aa2b8",
    feet: "#6f879d",
    blush: false,
    eyes:
      `<rect x="20" y="18.5" width="24" height="16" rx="5" fill="#23324a"/>` +
      `<rect x="24" y="22.5" width="4" height="5.6" rx="2" fill="#6ff3ff"/><rect x="36" y="22.5" width="4" height="5.6" rx="2" fill="#6ff3ff"/>` +
      `<path d="M28.5 30.6q3.5 2.4 7 0" fill="none" stroke="#6ff3ff" stroke-width="1.5" stroke-linecap="round"/>`,
    overHead:
      `<path d="M32 10.5V4.5" stroke="${OUTLINE}" stroke-width="1.6"/><circle cx="32" cy="3.6" r="2.6" fill="#ff5d5d" ${S}/>` +
      `<circle cx="16.6" cy="27" r="2.2" fill="#8aa2b8" ${S}/><circle cx="47.4" cy="27" r="2.2" fill="#8aa2b8" ${S}/>` +
      `<circle cx="27" cy="45" r="1" fill="#6f879d"/><circle cx="37" cy="45" r="1" fill="#6f879d"/>`,
    extra: `<ellipse cx="20" cy="36" rx="2.6" ry="1.4" fill="#ff8fa3" opacity=".45"/><ellipse cx="44" cy="36" rx="2.6" ry="1.4" fill="#ff8fa3" opacity=".45"/>`,
  },
  // 드래곤: 초록 몸, 크림색 배·뿔, 작은 날개, 등 가시
  "char.dragon": {
    body: "#6cc070",
    belly: "#f3e7b0",
    behind:
      `<path d="M22 40c-9-8-15-4-14 3c4-2 7 0 9 3c1-3 3-5 5-6z" fill="#4f9a55" ${S}/>` +
      `<path d="M42 40c9-8 15-4 14 3c-4-2-7 0-9 3c-1-3-3-5-5-6z" fill="#4f9a55" ${S}/>` +
      thickLine("M43 53c7 2 11-1 12-5", "#6cc070", 4) +
      `<path d="M54 46.5l4.5-2l-1 5z" fill="#f3e7b0" ${S}/>`,
    overHead:
      `<path d="M21 14c-3-5-2-9 1-10c0 3 1.5 5 4.5 6.5" fill="#f3e7b0" ${S}/>` +
      `<path d="M43 14c3-5 2-9-1-10c0 3-1.5 5-4.5 6.5" fill="#f3e7b0" ${S}/>` +
      `<path d="M28.5 11.2l3.5-5l3.5 5z" fill="#4f9a55" ${S}/>`,
    extra:
      `<circle cx="29.8" cy="31.2" r=".8" fill="${OUTLINE}"/><circle cx="34.2" cy="31.2" r=".8" fill="${OUTLINE}"/>` +
      `<path d="M29 33.4q3 2.2 6 0" fill="none" stroke="${OUTLINE}" stroke-width="1.3" stroke-linecap="round"/>`,
  },
  // 유니콘: 하얀 몸, 무지개 갈기, 금색 뿔
  "char.unicorn": {
    body: "#fffaff",
    feet: "#d9c2ff",
    behind: thickLine("M43 52c6 3 10 0 10.5-5", "#ff9ecb", 4),
    overHead:
      `<circle cx="18" cy="17" r="5" fill="#ff9ecb" ${S}/><circle cx="15.5" cy="25" r="4.6" fill="#b79cff" ${S}/>` +
      `<circle cx="16.5" cy="32.5" r="4" fill="#8fd3ff" ${S}/><circle cx="25" cy="12" r="4.6" fill="#ffd36e" ${S}/>` +
      `<path d="M29 11.5L32 -1L35 11.5Z" fill="#ffd36e" ${S}/>` +
      `<path d="M30.2 7.5l3.6-1.2M30.8 4.5l2.4-.8" stroke="#e0a72c" stroke-width="1.1" stroke-linecap="round"/>` +
      `<path d="M17 14l-3-6l5.5 3" fill="#fffaff" ${S}/>`,
    extra: smile,
  },
};

const FALLBACK: Look = { body: "#cfc4b8" };

/** 캐릭터 SVG 문자열. size는 픽셀 크기 (Phaser가 그림을 만들 때 해상도로 쓴다) */
export function characterSvg(assetKey: string, size = 64): string {
  const look = CHARACTERS[assetKey] ?? FALLBACK;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -8 72 72" width="${size}" height="${size}">${draw(look)}</svg>`;
}

export function characterDataUri(assetKey: string, size = 64): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(characterSvg(assetKey, size))}`;
}

/** 로그인하지 않은 방문자용 (광장 구경) */
export const VISITOR_CHARACTER = "char.visitor";
CHARACTERS[VISITOR_CHARACTER] = {
  body: "#d8d2ca",
  overHead: `<path d="M17 21c1-9 8-13 15-13s14 4 15 13c-5-4-25-4-30 0z" fill="#b9b0a5" ${S}/>`,
};
