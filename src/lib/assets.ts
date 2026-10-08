// 아이템 그림: DB에는 asset_key만 저장하고, 실제 모양은 src/lib/art/ 의 SVG로 그린다.
// 그림을 바꿀 때는 art/ 파일만 고치면 된다.
export { characterDataUri, characterSvg, lookKey, VISITOR_CHARACTER } from "./art/characters";
export { AVATAR_PARTS, MANNEQUIN, orderOutfit } from "./art/avatar";
export { furnitureDataUri, furnitureSvg } from "./art/furniture";
export { growthDataUri, growthSvg } from "./art/growth";
export { backgroundAccent, backgroundDataUri, backgroundSvg } from "./art/backgrounds";
