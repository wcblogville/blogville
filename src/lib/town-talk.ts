// 마을 이웃 말풍선 (사용자 요청 2026-10-12 "즐겨찾기해서 마을에 추가한 이웃들은 npc처럼 마을 돌아다니게 해줘 그리고 클릭하거나
// 가까이가서 스페이스바 누르면 본인이 블로그에서 썼던 글에서 랜덤으로 한 문장 말풍선처럼 보이게 하기 (자신이 남에게 보이게
// 설정해둔 문장이 있다면 그거 보이게 하자)"): 이웃이 내 정보에서 적은 "마을 한마디"(profiles.greeting)가 있으면 그것,
// 없으면 그 이웃의 최근 공개 글에서 고른 문장 중 하나. 서버가 후보를 몇 개 골라 TownData에 넣고, 마을이 말 걸 때마다 무작위로 고른다.
// 브라우저·서버 공용 순수 함수 (말풍선은 Phaser 글자로 그려 HTML로 해석되지 않는다).

/** 마을 한마디 최대 길이 (DB CHECK profiles_greeting_check와 같다) */
export const GREETING_MAX = 60;
/** 글에서 고르는 문장 길이 (글자) */
export const TALK_SENTENCE = { min: 5, max: 80 } as const;
/** 이웃마다 넘기는 문장 후보 수 */
export const TALK_LINES = 12;

const chars = (s: string) => [...s].length;

/** 마을 한마디 다듬기: 앞뒤 공백·줄바꿈을 지우고 공백을 한 칸으로. 비면 null. 길면 "long" */
export function normalizeGreeting(raw: unknown): string | null | "long" {
  const text = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if (!text) return null;
  return chars(text) > GREETING_MAX ? "long" : text;
}

/** 글 본문(글자만)을 문장으로 나눠 말풍선에 알맞은 길이(5~80자)만 남긴다. 주소(http)가 든 문장은 뺀다 */
export function sentencesOf(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?。！？…~])\s+|\s*[\n\r]+\s*/)
    .map((s) => s.trim())
    .filter((s) => chars(s) >= TALK_SENTENCE.min && chars(s) <= TALK_SENTENCE.max && !/https?:\/\//i.test(s));
}

/** 이웃 말풍선 후보: 한마디가 있으면 그것 하나, 없으면 글(최근 것부터)의 문장을 겹치지 않게 TALK_LINES개까지 */
export function talkLines(greeting: string | null | undefined, postTexts: readonly string[]): string[] {
  if (greeting?.trim()) return [greeting.trim()];
  const out: string[] = [];
  for (const t of postTexts) {
    for (const s of sentencesOf(t)) {
      if (!out.includes(s)) out.push(s);
      if (out.length >= TALK_LINES) return out;
    }
  }
  return out;
}
