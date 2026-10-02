// 미니룸 배경 (SVG 장면). 높이 180, 땅은 y≈128부터. 캐릭터는 그 위에 선다.
// 너비 W를 받아서 그린다: 상점·꾸미기 칸은 좁게(320), 블로그 상단처럼 넓은 곳은 넓게(760).
// 넓게 그릴 때도 확대하지 않고 구름·나무·꽃을 더 많이 놓아서 같은 크기로 보이게 한다.
// DB의 asset_key("bg.meadow" 등)로 고른다. accent는 광장 집 지붕 색으로도 쓴다.

type Scene = { accent: string; draw: (W: number) => string };

// 같은 장면이 매번 똑같이 그려지도록 고정 시드 난수
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const cloud = (x: number, y: number, s = 1, fill = "#fff") =>
  `<g transform="translate(${x} ${y}) scale(${s})" fill="${fill}"><ellipse cx="0" cy="0" rx="18" ry="9"/><ellipse cx="14" cy="-5" rx="13" ry="10"/><ellipse cx="28" cy="1" rx="14" ry="8"/></g>`;

/** 너비에 비례한 개수만큼 점(꽃, 눈, 별)을 뿌린다 */
function dots(seed: number, perWidth: number, W: number, y: [number, number], colors: string[], r: [number, number]) {
  const rand = rng(seed);
  const n = Math.round((perWidth * W) / 320);
  let out = "";
  for (let i = 0; i < n; i++) {
    const x = rand() * W;
    const yy = y[0] + rand() * (y[1] - y[0]);
    const c = colors[Math.floor(rand() * colors.length)];
    out += `<circle cx="${x.toFixed(1)}" cy="${yy.toFixed(1)}" r="${(r[0] + rand() * (r[1] - r[0])).toFixed(1)}" fill="${c}"/>`;
  }
  return out;
}

/** 너비 전체에 걸친 완만한 언덕 */
function hills(W: number, base: number, amp: number, seed: number, fill: string) {
  const rand = rng(seed);
  let d = `M0 ${base}`;
  const step = 160;
  for (let x = 0; x < W; x += step) {
    const cx = x + step / 2;
    const cy = base - amp + rand() * amp * 1.4;
    d += `Q${cx} ${cy.toFixed(1)} ${Math.min(x + step, W)} ${base}`;
  }
  return `<path d="${d}V180H0Z" fill="${fill}"/>`;
}

/** 일정 간격으로 무언가를 놓는다 (가운데 캐릭터 자리는 비운다) */
function spread(W: number, gap: number, seed: number, fn: (x: number, i: number, r: () => number) => string) {
  const rand = rng(seed);
  let out = "";
  let i = 0;
  for (let x = gap * 0.45; x < W; x += gap * (0.75 + rand() * 0.5)) {
    if (Math.abs(x - W / 2) < 46) continue;
    out += fn(x, i++, rand);
  }
  return out;
}

const SCENES: Record<string, Scene> = {
  // 초원: 해, 구름, 언덕, 들꽃, 나무
  "bg.meadow": {
    accent: "#2f855a",
    draw: (W) =>
      `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd3ff"/><stop offset="1" stop-color="#e6f7ff"/></linearGradient></defs>` +
      `<rect width="${W}" height="180" fill="url(#sky)"/>` +
      `<circle cx="${W - 50}" cy="38" r="18" fill="#ffe27a"/><circle cx="${W - 50}" cy="38" r="26" fill="#ffe27a" opacity=".25"/>` +
      spread(W, 150, 3, (x, i, r) => cloud(x - 20, 24 + r() * 22, 0.7 + r() * 0.35)) +
      hills(W, 116, 22, 5, "#9ee08f") +
      hills(W, 132, 14, 9, "#6cc46a") +
      spread(W, 170, 13, (x, i, r) => {
        const s = 0.8 + r() * 0.3;
        return `<g transform="translate(${x.toFixed(1)} ${(110 + r() * 8).toFixed(1)}) scale(${s.toFixed(2)})"><rect x="-3" y="4" width="6" height="22" fill="#8d6e63"/><circle cx="0" cy="-2" r="15" fill="#4caf50"/><circle cx="-8" cy="4" r="9" fill="#43a047"/><circle cx="9" cy="3" r="10" fill="#57bb5a"/></g>`;
      }) +
      dots(7, 34, W, [138, 176], ["#fff", "#ffe066", "#ff9ecb", "#c5a3ff"], [1.3, 2.4]),
  },
  // 바닷가: 해, 파도, 모래, 야자수, 조개
  "bg.beach": {
    accent: "#0369a1",
    draw: (W) =>
      `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd0ff"/><stop offset="1" stop-color="#d9f3ff"/></linearGradient>` +
      `<linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3fb3e8"/><stop offset="1" stop-color="#7fd6f2"/></linearGradient></defs>` +
      `<rect width="${W}" height="180" fill="url(#sky)"/>` +
      `<circle cx="60" cy="40" r="17" fill="#ffd166"/>` +
      spread(W, 180, 17, (x, i, r) => (x < 100 ? "" : cloud(x, 26 + r() * 16, 0.8))) +
      `<rect y="84" width="${W}" height="50" fill="url(#sea)"/>` +
      spread(W, 60, 19, (x, i, r) => `<path d="M${x.toFixed(1)} ${(94 + r() * 26).toFixed(1)}q10-3 20 0t20 0" fill="none" stroke="#fff" stroke-width="2" opacity=".6"/>`) +
      hills(W, 126, 6, 21, "#f5deb3") +
      `<path d="M0 129H${W}" stroke="#fff" stroke-width="3" opacity=".7"/>` +
      spread(W, 260, 23, (x) =>
        `<g transform="translate(${x.toFixed(1)} 132)"><path d="M0 0Q-4-30 4-58" fill="none" stroke="#9c6b3f" stroke-width="6" stroke-linecap="round"/>` +
        `<path d="M4-58q-20-6-32 6q16-2 32-6zM4-58q20-8 32 2q-16-4-32-2zM4-58q-6-20-24-24q10 10 24 24zM4-58q12-18 30-18q-14 6-30 18z" fill="#3fa34d"/></g>`) +
      spread(W, 110, 25, (x, i) => `<path d="M${x.toFixed(1)} ${150 + (i % 3) * 7}q5-8 10 0z" fill="${i % 2 ? "#ffb4a2" : "#ffd6e0"}"/>`) +
      dots(11, 22, W, [134, 178], ["#e9c98f", "#fff1d6"], [0.8, 1.6]),
  },
  // 눈 마을: 흐린 하늘, 눈송이, 눈 덮인 전나무, 오두막
  "bg.snow": {
    accent: "#475569",
    draw: (W) =>
      `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9c8dc"/><stop offset="1" stop-color="#eef3f9"/></linearGradient></defs>` +
      `<rect width="${W}" height="180" fill="url(#sky)"/>` +
      hills(W, 110, 16, 27, "#e5ecf5") +
      spread(W, 70, 29, (x, i, r) => {
        const s = 0.7 + r() * 0.4;
        return `<g transform="translate(${x.toFixed(1)} ${(100 + r() * 12).toFixed(1)}) scale(${s.toFixed(2)})"><rect x="-3" y="20" width="6" height="10" fill="#7b5e48"/>` +
          `<path d="M0-26L16 2H-16Z" fill="#2e7d5b"/><path d="M0-12L20 22H-20Z" fill="#2e7d5b"/>` +
          `<path d="M0-26L7-14Q0-10-7-14Z" fill="#fff"/><path d="M-12 2Q0 8 12 2L16 8Q0 14-16 8Z" fill="#fff" opacity=".9"/></g>`;
      }) +
      `<g transform="translate(${W / 2 + 90} 98)"><rect x="-22" y="0" width="44" height="30" fill="#a1785a"/><path d="M-28 2L0-20L28 2Z" fill="#fff"/>` +
      `<rect x="-6" y="12" width="12" height="18" fill="#6d4c41"/><rect x="10" y="6" width="9" height="8" fill="#ffe08a"/></g>` +
      hills(W, 130, 8, 31, "#ffffff") +
      dots(23, 60, W, [0, 180], ["#ffffff"], [0.8, 2.1]),
  },
  // 벚꽃길: 분홍 하늘, 벚나무, 흩날리는 꽃잎, 길
  "bg.sakura": {
    accent: "#be185d",
    draw: (W) =>
      `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd6e7"/><stop offset="1" stop-color="#fff4f8"/></linearGradient></defs>` +
      `<rect width="${W}" height="180" fill="url(#sky)"/>` +
      hills(W, 120, 12, 33, "#c9e7b8") +
      `<path d="M${W / 2 - 40} 180Q${W / 2 - 10} 140 ${W / 2} 120Q${W / 2 + 10} 140 ${W / 2 + 40} 180Z" fill="#f3e2c7"/>` +
      spread(W, 120, 35, (x, i, r) => {
        const s = 0.75 + r() * 0.3;
        return `<g transform="translate(${x.toFixed(1)} 96) scale(${s.toFixed(2)})"><path d="M0 40Q-2 10 6-10M2 10Q-12 0-20-10M4 0Q16-8 22-20" fill="none" stroke="#7b4a3a" stroke-width="5" stroke-linecap="round"/>` +
          `<circle cx="-14" cy="-14" r="16" fill="#ffb7d0"/><circle cx="8" cy="-24" r="18" fill="#ff9ec3"/><circle cx="24" cy="-12" r="14" fill="#ffc6da"/><circle cx="-2" cy="-6" r="12" fill="#ffd1e1"/></g>`;
      }) +
      dots(31, 40, W, [0, 180], ["#ff9ec3", "#ffc6da", "#ffffff"], [1.2, 2.3]),
  },
  // 밤의 도시: 달, 별, 불 켜진 건물들
  "bg.night": {
    accent: "#a5b4fc",
    draw: (W) => {
      const rand = rng(43);
      let city = "";
      let x = 0;
      while (x < W) {
        const w = 22 + rand() * 26;
        const h = 40 + rand() * 60;
        city += `<rect x="${x.toFixed(1)}" y="${(128 - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${rand() > 0.5 ? "#1e2a4a" : "#26355c"}"/>`;
        for (let wy = 128 - h + 6; wy < 122; wy += 9)
          for (let wx = x + 4; wx < x + w - 5; wx += 7)
            if (rand() > 0.45) city += `<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="3.4" height="4.4" fill="#ffe08a" opacity="${(0.6 + rand() * 0.4).toFixed(2)}"/>`;
        x += w + 2;
      }
      return (
        `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f172a"/><stop offset="1" stop-color="#3b2f7a"/></linearGradient></defs>` +
        `<rect width="${W}" height="180" fill="url(#sky)"/>` +
        dots(41, 36, W, [0, 80], ["#ffffff", "#c7d2fe"], [0.5, 1.3]) +
        `<circle cx="${W - 62}" cy="36" r="15" fill="#fef3c7"/><circle cx="${W - 56}" cy="31" r="13" fill="#2a2563"/>` +
        city +
        `<rect y="128" width="${W}" height="52" fill="#141c33"/><path d="M0 150H${W}" stroke="#ffe08a" stroke-width="2" stroke-dasharray="14 10" opacity=".5"/>`
      );
    },
  },
  // 우주: 별, 고리 행성, 작은 달, 혜성
  "bg.space": {
    accent: "#f0abfc",
    draw: (W) =>
      `<defs><radialGradient id="sky" cx=".7" cy=".2" r="1"><stop offset="0" stop-color="#4c1d95"/><stop offset=".6" stop-color="#1e1b4b"/><stop offset="1" stop-color="#020617"/></radialGradient></defs>` +
      `<rect width="${W}" height="180" fill="url(#sky)"/>` +
      dots(53, 70, W, [0, 180], ["#ffffff", "#c4b5fd", "#fde68a"], [0.4, 1.4]) +
      `<g transform="translate(${W - 70} 50)"><circle r="22" fill="#f0abfc"/><path d="M-22-4q22 8 44 0" fill="none" stroke="#c084fc" stroke-width="3" opacity=".6"/>` +
      `<ellipse rx="36" ry="9" fill="none" stroke="#fde68a" stroke-width="3" transform="rotate(-18)"/></g>` +
      `<circle cx="60" cy="44" r="10" fill="#cbd5e1"/><circle cx="57" cy="41" r="2.5" fill="#94a3b8"/><circle cx="63" cy="48" r="1.8" fill="#94a3b8"/>` +
      `<path d="M${W * 0.38} 30l40 14" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".6"/><circle cx="${W * 0.38 + 40}" cy="44" r="3" fill="#fff"/>` +
      hills(W, 132, 8, 55, "#6b5b95") +
      spread(W, 130, 57, (x, i) => `<ellipse cx="${x.toFixed(1)}" cy="${152 + (i % 2) * 8}" rx="${14 + (i % 3) * 3}" ry="4" fill="#5b4b84"/>`),
  },
};

/** 배경 장면 SVG. width: 그릴 너비 (좁은 칸 320, 넓은 배너 760) */
export function backgroundSvg(assetKey: string, width = 320): string {
  const scene = SCENES[assetKey] ?? SCENES["bg.meadow"];
  // 같은 페이지에 여러 장면이 있어도 그라데이션 id가 겹치지 않게
  const uid = `${assetKey.replace(/\W/g, "")}${width}`;
  const svg = scene.draw(width).replace(/id="(\w+)"/g, `id="$1-${uid}"`).replace(/url\(#(\w+)\)/g, `url(#$1-${uid})`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 180" preserveAspectRatio="xMidYMax slice">${svg}</svg>`;
}

export function backgroundDataUri(assetKey: string, width = 320): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(backgroundSvg(assetKey, width))}`;
}

export function backgroundAccent(assetKey: string): string {
  return (SCENES[assetKey] ?? { accent: "#2f855a" }).accent;
}
