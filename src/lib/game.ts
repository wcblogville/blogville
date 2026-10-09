// 게임 규칙: docs/01-requirements.md 4.5, docs/02-erd.md 3.4
// DB를 쓰지 않는 순수 계산만 둔다 (화면과 서버 어디서나 import 가능)

/**
 * 레벨 n이 되기 위한 누적 경험치: 10 × n × (n − 1).
 * 처음 곡선(50 ×)의 1/5로 낮춰 레벨이 빨리 오른다: 매일 최대로 하면 Lv.10 약 4일, Lv.90 약 1년 (사용자 결정 2026-10-09)
 */
export function expForLevel(level: number): number {
  return 10 * level * (level - 1);
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

/** 고정 규칙 보상 사유. 출석은 일차별 보상표(attendance_rewards)를 쓰므로 여기 없다 (GAME-04) */
export type RewardReason = "signup" | "post" | "comment" | "like_received" | "farm_care";

/** 활동 보상 규칙. dailyLimit: 하루에 보상받을 수 있는 최대 횟수 */
export const REWARD_RULES: Record<RewardReason, { exp: number; coins: number; dailyLimit: number }> = {
  signup: { exp: 0, coins: 100, dailyLimit: 1 },
  post: { exp: 30, coins: 30, dailyLimit: 3 },
  comment: { exp: 5, coins: 5, dailyLimit: 10 },
  like_received: { exp: 2, coins: 2, dailyLimit: 20 },
  farm_care: { exp: 2, coins: 0, dailyLimit: 15 }, // 동물 돌보기 (5마리 × 3가지)
};

/** 글 작성 보상을 받으려면 본문이 이 글자 수 이상이어야 한다 */
export const POST_REWARD_MIN_LENGTH = 100;

/** YYYY-MM-DD의 하루 전 날짜 */
export function previousDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** 출석 주기 길이: 1~7일차를 돌고 8일째는 다시 1일차 (GAME-04 / FR-020) */
export const ATTENDANCE_CYCLE_DAYS = 7;

/**
 * 오늘 출석의 일차 (GAME-04 / FR-022).
 * last = 오늘 이전 가장 최근 출석. 없거나 어제가 아니면 1, 어제가 7일차면 1, 아니면 어제 + 1.
 */
export function nextCycleDay(last: { date: string; cycleDay: number } | null | undefined, today: string): number {
  if (!last || last.date !== previousDay(today)) return 1;
  return last.cycleDay >= ATTENDANCE_CYCLE_DAYS ? 1 : last.cycleDay + 1;
}

/** 누적 경험치가 beforeExp → afterExp로 늘 때 새로 도달한 레벨 목록 (GAME-06 / FR-037). 99를 넘지 않는다 */
export function levelsGained(beforeExp: number, afterExp: number): number[] {
  const from = levelFromExp(beforeExp);
  const to = levelFromExp(afterExp);
  const levels: number[] = [];
  for (let l = from + 1; l <= to; l++) levels.push(l);
  return levels;
}

/** 서비스 기준 시간대의 오늘 날짜 (YYYY-MM-DD) */
export function todayKST(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
}
