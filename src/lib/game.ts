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

/**
 * 연못 낚시 규칙 숫자 (TOWN-14, 2026-10-12 "낚시 컨텐츠 더 풍성하게"). 무엇을 낚는지·코인은 src/lib/fishing.ts CATCHES.
 * 한 번 던져 평균 코인 약 11~14 (타이밍을 맞추면 약 16~21, 밤·계절에 따라 다르다), 하루 3번이면 약 32~63
 * — 글 보상(하루 최대 90)보다 작게 둔다 (scripts/test-shop.ts가 모든 시각·달을 계산해 확인)
 */
export const FISHING_RULES = {
  /** 하루(한국 날짜)에 던질 수 있는 횟수. DB CHECK(cast_no 1~3)와 같아야 한다 */
  castsPerDay: 3,
  /** 던진 뒤 입질(찌가 쑥 잠김)까지 걸리는 시간 (ms, 서버가 무작위로 정한다) */
  biteDelayMs: [1500, 4000] as const,
  /** 입질 뒤 이 안에 당기면 "딱 맞았어요" (ms). 네트워크 왕복을 감안해 넉넉하게 */
  hitWindowMs: 1600,
  /** 입질 전에 당겨도 이만큼은 봐준다 (ms, 버튼을 누른 순간과 서버 시각의 차이) */
  earlyGraceMs: 200,
  /** 던진 낚싯대 표가 유효한 시간 (ms). 지나면 다시 던진다 */
  castTtlMs: 60_000,
  /** 타이밍을 맞추면 등급별 뽑힐 무게를 이만큼 곱한다 (평범 1배) */
  goodTimingBoost: { common: 1, rare: 1.5, legendary: 2, junk: 0.5 } as const,
  /** 길이가 가장 클 때 더 받는 코인 비율 (기본 코인 × 0.5까지, 길이에 비례) */
  sizeBonusRatio: 0.5,
} as const;

/** 한국 시각의 시(0~23)와 달(1~12): 밤 물고기·계절 물고기 */
export function kstClock(now = new Date()): { hour: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "numeric", month: "numeric", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { hour: get("hour") % 24, month: get("month") };
}

/** 이 날짜가 속한 주의 월요일 (YYYY-MM-DD, 이번 주 낚시 랭킹) */
export function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
