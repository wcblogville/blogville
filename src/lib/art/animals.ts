// 동물 농장 동물 그림 (SVG). 캐릭터처럼 코드로 그린다.
// viewBox 64×64, 발바닥이 y=58 근처. 단계(아기·청소년·어른)에 따라 크기가 커지고, 어른은 리본을 단다.
import type { AnimalStage } from "@/lib/farm";

const O = "#3b2a20";
const S = `stroke="${O}" stroke-width="1.6" stroke-linejoin="round"`;
const eyes = `<circle cx="26" cy="30" r="2.4" fill="${O}"/><circle cx="38" cy="30" r="2.4" fill="${O}"/><circle cx="26.8" cy="29.2" r=".8" fill="#fff"/><circle cx="38.8" cy="29.2" r=".8" fill="#fff"/>`;
const blush = `<ellipse cx="21.5" cy="35" rx="3" ry="1.7" fill="#ff8fa3" opacity=".55"/><ellipse cx="42.5" cy="35" rx="3" ry="1.7" fill="#ff8fa3" opacity=".55"/>`;
const shadow = `<ellipse cx="32" cy="59" rx="15" ry="2.6" fill="#000" opacity=".14"/>`;

const ANIMALS: Record<string, string> = {
  // 병아리: 노란 동그라미, 주황 부리·발
  "animal.chick":
    `<path d="M26 56l-2 3M26 56l1 3M38 56l-1 3M38 56l2 3" stroke="#f08a24" stroke-width="2" stroke-linecap="round"/>` +
    `<ellipse cx="32" cy="38" rx="17" ry="18" fill="#ffd84d" ${S}/>` +
    `<path d="M15.5 40q-5-2-4-7q4 1 5 4" fill="#ffd84d" ${S}/><path d="M48.5 40q5-2 4-7q-4 1-5 4" fill="#ffd84d" ${S}/>` +
    `<path d="M30 17q2-6 5-3q-3 0-3 4" fill="#ffd84d" ${S}/>` +
    eyes + blush + `<path d="M29 34l3 3l3-3z" fill="#f08a24" ${S}/>`,
  // 토끼: 흰 몸, 긴 귀, 분홍 귀 안쪽
  "animal.bunny":
    `<ellipse cx="25" cy="13" rx="4.5" ry="12" fill="#fff" ${S}/><ellipse cx="25" cy="14" rx="2" ry="8" fill="#ffc1d6"/>` +
    `<ellipse cx="39" cy="13" rx="4.5" ry="12" fill="#fff" ${S}/><ellipse cx="39" cy="14" rx="2" ry="8" fill="#ffc1d6"/>` +
    `<ellipse cx="25" cy="55" rx="5" ry="3" fill="#fff" ${S}/><ellipse cx="39" cy="55" rx="5" ry="3" fill="#fff" ${S}/>` +
    `<ellipse cx="32" cy="38" rx="16" ry="16" fill="#fff" ${S}/>` +
    eyes + blush + `<path d="M30.5 34.5h3l-1.5 1.5z" fill="#ff8fa3"/><path d="M32 36v1.5M32 37.5q-2 1.5-3 0M32 37.5q2 1.5 3 0" fill="none" stroke="${O}" stroke-width="1.2" stroke-linecap="round"/>`,
  // 아기 돼지: 분홍, 납작 코, 세모 귀
  "animal.piglet":
    `<path d="M19 22l-2-9l9 5z" fill="#ffb3c7" ${S}/><path d="M45 22l2-9l-9 5z" fill="#ffb3c7" ${S}/>` +
    `<rect x="21" y="50" width="7" height="7" rx="3" fill="#ffb3c7" ${S}/><rect x="36" y="50" width="7" height="7" rx="3" fill="#ffb3c7" ${S}/>` +
    `<ellipse cx="32" cy="37" rx="18" ry="16" fill="#ffc7d6" ${S}/>` +
    eyes + blush + `<ellipse cx="32" cy="38" rx="6" ry="4" fill="#ff9fb8" ${S}/><circle cx="30" cy="38" r="1.1" fill="${O}"/><circle cx="34" cy="38" r="1.1" fill="${O}"/>`,
  // 송아지: 흰 바탕 검은 무늬, 작은 뿔, 코
  "animal.calf":
    `<path d="M21 21q-3-6 1-8q1 4 3 6" fill="#f3e2c0" ${S}/><path d="M43 21q3-6-1-8q-1 4-3 6" fill="#f3e2c0" ${S}/>` +
    `<ellipse cx="14" cy="27" rx="5" ry="3" transform="rotate(-20 14 27)" fill="#fff" ${S}/><ellipse cx="50" cy="27" rx="5" ry="3" transform="rotate(20 50 27)" fill="#fff" ${S}/>` +
    `<rect x="21" y="50" width="7" height="7" rx="2" fill="#4a3a33" ${S}/><rect x="36" y="50" width="7" height="7" rx="2" fill="#4a3a33" ${S}/>` +
    `<ellipse cx="32" cy="36" rx="17" ry="17" fill="#fff" ${S}/>` +
    `<path d="M18 30q4-8 10-6q-2 6-10 6z" fill="#4a3a33"/><path d="M42 45q6-1 6 3q-4 3-7 0z" fill="#4a3a33"/>` +
    eyes + `<ellipse cx="32" cy="41" rx="8" ry="5.5" fill="#ffc7a8" ${S}/><circle cx="29.5" cy="41" r="1.1" fill="${O}"/><circle cx="34.5" cy="41" r="1.1" fill="${O}"/>`,
};

// 어른이 되면 다는 리본
const RIBBON = `<path d="M32 22l-6-4v8zM32 22l6-4v8z" fill="#ff5c8a" ${S}/><circle cx="32" cy="22" r="2" fill="#ff5c8a" ${S}/>`;
const STAGE_SCALE: Record<AnimalStage, number> = { baby: 0.62, teen: 0.82, adult: 1 };

function wrap(body: string, size: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">${body}</svg>`;
}

/** 동물 SVG. 단계가 낮을수록 작게 (발바닥 기준으로 줄인다) */
export function animalSvg(assetKey: string, stage: AnimalStage, size = 64): string {
  const body = (ANIMALS[assetKey] ?? ANIMALS["animal.chick"]) + (stage === "adult" ? RIBBON : "");
  const k = STAGE_SCALE[stage];
  return wrap(`${shadow}<g transform="translate(${32 - 32 * k} ${58 - 58 * k}) scale(${k})">${body}</g>`, size);
}

/** 아직 부화하지 않은 알 */
export function eggSvg(size = 64): string {
  return wrap(
    shadow +
      `<path d="M32 12c10 0 17 16 17 28s-8 18-17 18s-17-6-17-18s7-28 17-28z" fill="#fff6e3" ${S}/>` +
      `<circle cx="25" cy="34" r="3" fill="#ffd36e"/><circle cx="38" cy="26" r="2.4" fill="#9fd8ff"/><circle cx="37" cy="45" r="3.4" fill="#ffb3c7"/><circle cx="26" cy="49" r="2" fill="#b7e4a5"/>`,
    size,
  );
}

export function toAnimalDataUri(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
