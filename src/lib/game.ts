// 게임 규칙: docs/01-requirements.md 4.5, docs/02-erd.md 3.4
// DB를 쓰지 않는 순수 계산만 둔다 (화면과 서버 어디서나 import 가능)

/** 레벨 n이 되기 위한 누적 경험치: 50 × n × (n − 1) */
export function expForLevel(level: number): number {
  return 50 * level * (level - 1);
}

/** 최고 레벨 (GAME-02 결정). 경험치는 계속 쌓이지만 레벨은 여기서 멈춘다 */
export const MAX_LEVEL = 99;

export function levelFromExp(exp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && exp >= expForLevel(level + 1)) level++;
  return level;
}

/** 현재 레벨 안에서의 진행도 (경험치 막대용). 최고 레벨이면 막대가 가득 찬다 */
export function levelProgress(exp: number) {
  const level = levelFromExp(exp);
  const base = expForLevel(level);
  if (level >= MAX_LEVEL) return { level, current: exp - base, needed: 0, ratio: 1, isMax: true };
  const next = expForLevel(level + 1);
  return { level, current: exp - base, needed: next - base, ratio: (exp - base) / (next - base), isMax: false };
}

export type RewardReason = "signup" | "attendance" | "attendance_streak" | "post" | "comment" | "like_received" | "farm_care";

/** 활동 보상 규칙. dailyLimit: 하루에 보상받을 수 있는 최대 횟수 */
export const REWARD_RULES: Record<RewardReason, { exp: number; coins: number; dailyLimit: number }> = {
  signup: { exp: 0, coins: 100, dailyLimit: 1 },
  attendance: { exp: 10, coins: 20, dailyLimit: 1 },
  attendance_streak: { exp: 0, coins: 50, dailyLimit: 1 },
  post: { exp: 30, coins: 30, dailyLimit: 3 },
  comment: { exp: 5, coins: 5, dailyLimit: 10 },
  like_received: { exp: 2, coins: 2, dailyLimit: 20 },
  farm_care: { exp: 2, coins: 0, dailyLimit: 15 }, // 동물 돌보기 (5마리 × 3가지)
};

/** 글 작성 보상을 받으려면 본문이 이 글자 수 이상이어야 한다 */
export const POST_REWARD_MIN_LENGTH = 100;

/** 연속 출석 보너스를 주는 주기 (7일마다) */
export const ATTENDANCE_STREAK_BONUS_EVERY = 7;

/** YYYY-MM-DD의 하루 전 날짜 */
export function previousDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * 지금 이어지고 있는 연속 출석 일수.
 * 마지막 출석이 오늘이나 어제면 그 기록의 연속 일수, 그보다 오래됐으면 끊긴 것(0)이다. (GAME-04)
 */
export function currentStreak(last: { date: string; streak: number } | null | undefined, today: string): number {
  if (!last) return 0;
  return last.date === today || last.date === previousDay(today) ? last.streak : 0;
}

/** 서비스 기준 시간대의 오늘 날짜 (YYYY-MM-DD) */
export function todayKST(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
}
