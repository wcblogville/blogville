/**
 * 휴대폰 화면 조건. 폭이 640px보다 좁거나, 손가락으로 쓰는 화면이면서 높이가 640px보다 낮을 때(휴대폰 가로).
 * 휴대폰에서는 광장(게임)을 띄우지 않고 간단 메뉴를 보여준다.
 * CSS의 `phone:` 변형(src/app/globals.css)과 같은 조건이어야 한다.
 */
export const PHONE_MEDIA = "(max-width: 639.98px), (pointer: coarse) and (max-height: 639.98px)";
