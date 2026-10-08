// 연못 낚시터 (사용자 요청 2026-10-08): 하루(한국 날짜) 한 번 낚싯대를 던져 코인이나 동물 먹이를 받는다.
// DB를 쓰지 않는 규칙만 둔다 (화면·서버 공용)

export type Catch = {
  key: string;
  name: string;
  emoji: string;
  /** 받는 코인 (0이면 코인 없음) */
  coins: number;
  /** 받는 아이템 code (동물 먹이) */
  itemCode?: string;
  /** 뽑힐 무게 (합 100) */
  weight: number;
  line: string;
};

export const CATCHES: Catch[] = [
  { key: "minnow", name: "송사리", emoji: "🐟", coins: 5, weight: 25, line: "작고 귀여운 송사리를 낚았어요!" },
  { key: "crucian", name: "붕어", emoji: "🐟", coins: 15, weight: 30, line: "통통한 붕어를 낚았어요!" },
  { key: "carp", name: "잉어", emoji: "🐠", coins: 30, weight: 15, line: "커다란 잉어를 낚았어요!" },
  { key: "golden", name: "황금 잉어", emoji: "✨", coins: 100, weight: 3, line: "반짝반짝 황금 잉어! 오늘 운이 좋아요!" },
  { key: "feed", name: "동물 먹이 꾸러미", emoji: "🌱", coins: 0, itemCode: "growth_feed", weight: 15, line: "물에 떠 있던 동물 먹이를 건졌어요! 농장에서 써 보세요." },
  { key: "boot", name: "낡은 장화", emoji: "👢", coins: 1, weight: 12, line: "앗, 낡은 장화예요. 그래도 코인 1개!" },
];

/** r은 0 이상 100 미만 정수. 무게대로 하나를 고른다 */
export function pickCatch(r: number): Catch {
  let acc = 0;
  for (const c of CATCHES) {
    acc += c.weight;
    if (r < acc) return c;
  }
  return CATCHES[0];
}

export function catchByKey(key: string): Catch | undefined {
  return CATCHES.find((c) => c.key === key);
}
