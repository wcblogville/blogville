// 아이템 그림 정의: DB에는 asset_key만 저장하고, 실제 모양은 여기서 정한다.
// 나중에 픽셀아트 스프라이트로 바꿀 때 이 파일만 고치면 된다.

export type CharacterAsset = { emoji: string };
export type BackgroundAsset = { css: string; ground: string; accent: string };

export const CHARACTER_ASSETS: Record<string, CharacterAsset> = {
  "char.human": { emoji: "🧑" },
  "char.cat": { emoji: "🐱" },
  "char.dog": { emoji: "🐶" },
  "char.rabbit": { emoji: "🐰" },
  "char.fox": { emoji: "🦊" },
  "char.panda": { emoji: "🐼" },
  "char.robot": { emoji: "🤖" },
  "char.dragon": { emoji: "🐲" },
  "char.unicorn": { emoji: "🦄" },
};

export const BACKGROUND_ASSETS: Record<string, BackgroundAsset> = {
  "bg.meadow": {
    css: "linear-gradient(180deg, #bfe6ff 0%, #e6f7ff 55%, #9be08f 55%, #6cc46a 100%)",
    ground: "#6cc46a",
    accent: "#2f855a",
  },
  "bg.beach": {
    css: "linear-gradient(180deg, #8fd3fe 0%, #c9ecff 45%, #4fb3e8 45%, #4fb3e8 60%, #f5deb3 60%, #e9c98f 100%)",
    ground: "#e9c98f",
    accent: "#0369a1",
  },
  "bg.snow": {
    css: "linear-gradient(180deg, #cfd8e3 0%, #eef2f7 55%, #ffffff 55%, #e2e8f0 100%)",
    ground: "#e2e8f0",
    accent: "#475569",
  },
  "bg.sakura": {
    css: "linear-gradient(180deg, #ffe4ef 0%, #fff1f6 55%, #f9c5d8 55%, #f4a6c3 100%)",
    ground: "#f4a6c3",
    accent: "#be185d",
  },
  "bg.night": {
    css: "linear-gradient(180deg, #0f172a 0%, #312e81 55%, #1e293b 55%, #0f172a 100%)",
    ground: "#1e293b",
    accent: "#a5b4fc",
  },
  "bg.space": {
    css: "radial-gradient(circle at 75% 25%, #f0abfc 0 6%, transparent 7%), radial-gradient(circle at 20% 30%, #fff 0 0.6%, transparent 1%), radial-gradient(circle at 50% 15%, #fff 0 0.5%, transparent 1%), linear-gradient(180deg, #020617 0%, #1e1b4b 60%, #4c1d95 60%, #2e1065 100%)",
    ground: "#2e1065",
    accent: "#f0abfc",
  },
};

export function characterEmoji(assetKey: string): string {
  return CHARACTER_ASSETS[assetKey]?.emoji ?? "❔";
}

export function backgroundAsset(assetKey: string): BackgroundAsset {
  return BACKGROUND_ASSETS[assetKey] ?? BACKGROUND_ASSETS["bg.meadow"];
}
