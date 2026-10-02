// 게임 규칙: docs/01-requirements.md 4.5, docs/02-erd.md 3.4
// DB를 쓰지 않는 순수 계산만 둔다 (화면과 서버 어디서나 import 가능)

/** 레벨 n이 되기 위한 누적 경험치: 50 × n × (n − 1) */
export function expForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export function levelFromExp(exp: number): number {
  let level = 1;
  while (exp >= expForLevel(level + 1)) level++;
  return level;
}

/** 현재 레벨 안에서의 진행도 (경험치 막대용) */
export function levelProgress(exp: number) {
  const level = levelFromExp(exp);
  const base = expForLevel(level);
  const next = expForLevel(level + 1);
  return { level, current: exp - base, needed: next - base, ratio: (exp - base) / (next - base) };
}

export type RewardReason = "signup" | "attendance" | "attendance_streak" | "post" | "comment" | "like_received";

/** 활동 보상 규칙. dailyLimit: 하루에 보상받을 수 있는 최대 횟수 */
export const REWARD_RULES: Record<RewardReason, { exp: number; coins: number; dailyLimit: number }> = {
  signup: { exp: 0, coins: 100, dailyLimit: 1 },
  attendance: { exp: 10, coins: 20, dailyLimit: 1 },
  attendance_streak: { exp: 0, coins: 50, dailyLimit: 1 },
  post: { exp: 30, coins: 30, dailyLimit: 3 },
  comment: { exp: 5, coins: 5, dailyLimit: 10 },
  like_received: { exp: 2, coins: 2, dailyLimit: 20 },
};

/** 글 작성 보상을 받으려면 본문이 이 글자 수 이상이어야 한다 */
export const POST_REWARD_MIN_LENGTH = 100;

/** 연속 출석 보너스를 주는 주기 (7일마다) */
export const ATTENDANCE_STREAK_BONUS_EVERY = 7;

/** 서비스 기준 시간대의 오늘 날짜 (YYYY-MM-DD) */
export function todayKST(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
}
