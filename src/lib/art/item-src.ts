import { backgroundSvg } from "./backgrounds";
import { decoSvg } from "./deco";
import { furnitureSvg } from "./furniture";
import { growthSvg } from "./growth";
import { contentHash } from "./pixel";

/** 주소로 내려 주는 아이템 그림 종류 (캐릭터·아바타는 사람마다 꾸밈이 달라 화면 안에 그대로 그린다) */
export const ITEM_ART_TYPES = ["furniture", "growth", "deco", "background"] as const;
export type ItemArtType = (typeof ITEM_ART_TYPES)[number];

const KEY_RE = /^[a-z0-9._-]{1,64}$/;

/** 그림 한 변 px로 받을 수 있는 값 (가구·성장·장식). 배경은 크기 없이 2배 도트 한 장 */
export function itemArtSize(raw: string | null): number | null {
  const n = Number(raw ?? 96);
  return Number.isInteger(n) && n >= 16 && n <= 256 ? n : null;
}

/** 아이템 그림 SVG 글자. 모르는 이름은 각 그림 파일의 대신 그림이 나온다. 형식이 틀리면 null */
export function itemArtSvg(type: string, assetKey: string, size: number): string | null {
  if (!KEY_RE.test(assetKey)) return null;
  switch (type) {
    case "furniture":
      return furnitureSvg(assetKey, size);
    case "growth":
      return growthSvg(assetKey, size);
    case "deco":
      return decoSvg(assetKey, size);
    case "background":
      return backgroundSvg(assetKey);
    default:
      return null;
  }
}

const cache = new Map<string, string>();
/**
 * 아이템 그림 주소 `/px/item/<종류>/<이름>?s=<크기>&v=<그림 해시>` (src/app/px/item/[type]/[key]/route.ts).
 * 상점·꾸미기는 아이템이 백 개가 넘어 그림을 HTML에 data URI로 넣으면 0.5MB가 넘었다.
 * 주소로 빼면 HTML이 가벼워지고, 브라우저가 그림을 한 번 받아 오래 캐시한다 (그림이 바뀌면 해시가 바뀐다)
 */
export function itemArtSrc(type: ItemArtType, assetKey: string, size = 96): string {
  const id = `${type}/${assetKey}@${size}`;
  let src = cache.get(id);
  if (!src) {
    const svg = itemArtSvg(type, assetKey, size) ?? "";
    src = `/px/item/${type}/${encodeURIComponent(assetKey)}?s=${size}&v=${contentHash(svg)}`;
    cache.set(id, src);
  }
  return src;
}
