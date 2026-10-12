// 글쓰기 글꼴 색·바탕색 팔레트와 이모티콘 (사용자 요청 2026-10-12 "글꼴 색, 글꼴 바탕색, 이모티콘 이런거 추가").
// 에디터(rich-editor.tsx)와 정화(src/server/sanitize.ts)가 같이 쓴다. 색을 더하면 이 파일만 고친다

export type PaletteColor = { name: string; value: string };

/** 글꼴 색 (흰 종이 위에서 읽히는 진한 색) */
export const TEXT_COLORS: PaletteColor[] = [
  { name: "빨강", value: "#d63c3c" },
  { name: "주황", value: "#d9711c" },
  { name: "노랑", value: "#b38600" },
  { name: "초록", value: "#3b8a35" },
  { name: "하늘", value: "#1f8bbf" },
  { name: "파랑", value: "#3554c2" },
  { name: "보라", value: "#8446c4" },
  { name: "분홍", value: "#cf4b91" },
  { name: "갈색", value: "#8a5528" },
  { name: "회색", value: "#767676" },
];

/** 글꼴 바탕색 (형광펜처럼 옅은 색, 글자 색은 그대로) */
export const HIGHLIGHT_COLORS: PaletteColor[] = [
  { name: "노랑", value: "#fff176" },
  { name: "주황", value: "#ffd08a" },
  { name: "빨강", value: "#ffb3a7" },
  { name: "분홍", value: "#f9c2dc" },
  { name: "초록", value: "#c8e6a0" },
  { name: "민트", value: "#b4ece4" },
  { name: "하늘", value: "#bcdcfb" },
  { name: "보라", value: "#d8c8f0" },
  { name: "회색", value: "#e2e2e2" },
];

/**
 * 글에 남겨도 되는 색 값: #rgb·#rrggbb 또는 rgb(0~255, 0~255, 0~255)만.
 * url()·expression()·var()·이름 색 같은 다른 CSS 값은 모두 막는다 (정화에서 쓴다)
 */
export const SAFE_COLOR_RE = /^(#[0-9a-f]{3}|#[0-9a-f]{6}|rgb\(\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*\))$/i;

/** 이모티콘 고르기 창 (분류별 자주 쓰는 것) */
export const EMOJI_GROUPS: { name: string; icon: string; items: string[] }[] = [
  {
    name: "표정",
    icon: "😀",
    items: ["😀", "😄", "😁", "😆", "😂", "🤣", "😊", "😍", "🥰", "😘", "😎", "🤩", "🥳", "😉", "🤔", "😮", "😴", "😅", "😢", "😭", "😡", "🥺", "😱", "🤗"],
  },
  {
    name: "손·하트",
    icon: "👍",
    items: ["👍", "👎", "👏", "🙌", "🙏", "💪", "👋", "✌️", "🤞", "👌", "❤️", "🧡", "💛", "💚", "💙", "💜", "🤎", "🖤", "💖", "💯", "✨", "🔥", "⭐", "🎉"],
  },
  {
    name: "동물·자연",
    icon: "🐶",
    items: ["🐶", "🐱", "🐰", "🐻", "🐼", "🐨", "🐯", "🦊", "🐷", "🐸", "🐔", "🐧", "🐟", "🐝", "🦋", "🌸", "🌻", "🌷", "🍀", "🌳", "🌙", "☀️", "🌈", "❄️"],
  },
  {
    name: "음식",
    icon: "🍎",
    items: ["🍎", "🍓", "🍑", "🍉", "🍇", "🍋", "🥕", "🌽", "🍞", "🍕", "🍔", "🍟", "🍜", "🍣", "🍙", "🍰", "🍪", "🍩", "🍫", "🍦", "☕", "🍵", "🧃", "🍺"],
  },
  {
    name: "물건·기호",
    icon: "📚",
    items: ["📚", "✏️", "📝", "💻", "📱", "📷", "🎮", "🎵", "🎨", "⚽", "🏠", "🚗", "✈️", "🎁", "💡", "📌", "⏰", "💰", "✅", "❌", "⚠️", "❓", "❗", "➡️"],
  },
];
