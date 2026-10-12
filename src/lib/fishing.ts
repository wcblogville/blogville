// 연못 낚시터 (사용자 요청 2026-10-08, 2026-10-12 "낚시 컨텐츠가 좀 부족해서 더 풍성하게"):
// 하루(한국 날짜) 세 번 낚싯대를 던져 코인이나 동물 먹이를 받는다. 등급(흔함·희귀·전설·잡동사니), 밤·계절에만 나오는 물고기,
// 물고기마다 길이(크면 코인을 조금 더), 입질 타이밍을 맞추면 희귀한 것이 잘 나온다.
// DB를 쓰지 않는 규칙만 둔다 (화면·서버 공용). 숫자 규칙은 src/lib/game.ts FISHING_RULES, 그림은 src/lib/art/catches.ts (도트, key로 찾는다)
import { FISHING_RULES } from "./game";

export type CatchTier = "common" | "rare" | "legendary" | "junk";

export type Catch = {
  key: string;
  name: string;
  tier: CatchTier;
  /** 받는 기본 코인 (0이면 코인 없음). 물고기는 길이에 따라 최대 × 1.5 */
  coins: number;
  /** 받는 아이템 code (동물 먹이) */
  itemCode?: string;
  /** 뽑힐 무게 (그때 나올 수 있는 것끼리 비율로 나눈다) */
  weight: number;
  /** 물고기 길이 범위 (mm). 물고기가 아니면 없다 */
  sizeMm?: readonly [number, number];
  /** 나오는 한국 시각 [시작, 끝) 시. 시작 > 끝이면 자정을 넘는다 (밤) */
  hours?: readonly [number, number];
  /** 나오는 달 (계절 물고기) */
  months?: readonly number[];
  line: string;
};

export const TIER_LABEL: Record<CatchTier, string> = { common: "흔함", rare: "희귀", legendary: "전설", junk: "잡동사니" };

/** 등급 배지 색 (낚은 결과·도감, Tailwind 클래스) */
export const TIER_CLASS: Record<CatchTier, string> = { common: "bg-[#e3f1d6]!", rare: "bg-[#d4e8fb]!", legendary: "bg-[#ffe7a3]!", junk: "bg-[#efe2cf]!" };

export const CATCHES: Catch[] = [
  // ── 흔함 ──
  { key: "minnow", name: "송사리", tier: "common", coins: 3, weight: 20, sizeMm: [30, 60], line: "작고 귀여운 송사리를 낚았어요!" },
  { key: "chub", name: "피라미", tier: "common", coins: 5, weight: 16, sizeMm: [80, 150], line: "날쌘 피라미를 낚았어요!" },
  { key: "crucian", name: "붕어", tier: "common", coins: 8, weight: 18, sizeMm: [120, 300], line: "통통한 붕어를 낚았어요!" },
  { key: "smelt", name: "빙어", tier: "common", coins: 8, weight: 12, sizeMm: [70, 140], months: [12, 1, 2], line: "겨울에만 오는 맑은 빙어를 낚았어요!" },
  // ── 희귀 ──
  { key: "carp", name: "잉어", tier: "rare", coins: 20, weight: 7, sizeMm: [300, 700], line: "커다란 잉어를 낚았어요!" },
  { key: "catfish", name: "메기", tier: "rare", coins: 20, weight: 6, sizeMm: [300, 800], hours: [19, 5], line: "밤에 나오는 수염 난 메기를 낚았어요!" },
  { key: "mandarin", name: "쏘가리", tier: "rare", coins: 30, weight: 4, sizeMm: [200, 500], line: "알록달록 쏘가리를 낚았어요! 귀한 물고기예요." },
  { key: "cherry", name: "산천어", tier: "rare", coins: 25, weight: 6, sizeMm: [200, 400], months: [3, 4, 5], line: "봄 시냇물의 산천어를 낚았어요!" },
  { key: "sweetfish", name: "은어", tier: "rare", coins: 25, weight: 6, sizeMm: [150, 250], months: [6, 7, 8], line: "여름 향기 나는 은어를 낚았어요!" },
  { key: "perch", name: "꺽지", tier: "rare", coins: 25, weight: 6, sizeMm: [120, 220], months: [9, 10, 11], line: "가을 꺽지를 낚았어요! 아가미의 파란 점이 예뻐요." },
  // ── 전설 ──
  { key: "golden", name: "황금 잉어", tier: "legendary", coins: 70, weight: 2, sizeMm: [500, 900], line: "반짝반짝 황금 잉어! 오늘 운이 좋아요!" },
  { key: "moon", name: "달빛 잉어", tier: "legendary", coins: 100, weight: 1, sizeMm: [600, 1000], hours: [20, 4], line: "달빛을 머금은 잉어가 올라왔어요! 전설의 물고기예요!" },
  { key: "chest", name: "작은 보물 상자", tier: "legendary", coins: 80, weight: 1, line: "연못 바닥에서 작은 보물 상자를 건졌어요! 코인이 가득해요!" },
  // ── 잡동사니 ──
  { key: "feed", name: "동물 먹이 꾸러미", tier: "junk", coins: 0, itemCode: "growth_feed", weight: 12, line: "물에 떠 있던 동물 먹이를 건졌어요! 농장에서 써 보세요." },
  { key: "boot", name: "낡은 장화", tier: "junk", coins: 1, weight: 8, line: "앗, 낡은 장화예요. 그래도 코인 1개!" },
];

export function catchByKey(key: string): Catch | undefined {
  return CATCHES.find((c) => c.key === key);
}

export type FishingClock = { hour: number; month: number };

/** 지금(한국 시각) 나올 수 있는지: 밤 물고기는 그 시간에만, 계절 물고기는 그 달에만 */
export function isAvailable(c: Catch, at: FishingClock): boolean {
  if (c.months && !c.months.includes(at.month)) return false;
  if (c.hours) {
    const [from, to] = c.hours;
    const inside = from < to ? at.hour >= from && at.hour < to : at.hour >= from || at.hour < to;
    if (!inside) return false;
  }
  return true;
}

/** 언제 나오는지 (도감 안내). 늘 나오면 null */
export function availabilityText(c: Catch): string | null {
  const parts: string[] = [];
  if (c.months) {
    const season = c.months.includes(1) ? "겨울" : c.months.includes(4) ? "봄" : c.months.includes(7) ? "여름" : "가을";
    parts.push(`${season}(${c.months.join("·")}월)`);
  }
  if (c.hours) parts.push(`밤 ${c.hours[0]}시~${c.hours[1]}시`);
  return parts.length ? `${parts.join(", ")}에만` : null;
}

/** 지금 나올 수 있는 것과 뽑힐 무게. good = 입질 타이밍을 맞춤 (희귀·전설이 잘 나오고 잡동사니가 덜 나온다). 무게는 정수 */
export function catchPool(at: FishingClock, good: boolean): { c: Catch; w: number }[] {
  return CATCHES.filter((c) => isAvailable(c, at)).map((c) => ({ c, w: Math.round(c.weight * 2 * (good ? FISHING_RULES.goodTimingBoost[c.tier] : 1)) }));
}

export function poolTotal(pool: { w: number }[]): number {
  return pool.reduce((n, p) => n + p.w, 0);
}

/** r은 0 이상 poolTotal(pool) 미만 정수. 무게대로 하나를 고른다 */
export function pickCatch(r: number, pool: { c: Catch; w: number }[]): Catch {
  let acc = 0;
  for (const p of pool) {
    acc += p.w;
    if (r < acc) return p.c;
  }
  return pool[pool.length - 1].c;
}

/** 길이 (mm). u1, u2는 0 이상 1 미만. 타이밍을 맞추면(u2를 주면) 둘 중 큰 쪽 → 큰 물고기가 잘 나온다. 물고기가 아니면 null */
export function rollSize(c: Catch, u1: number, u2?: number): number | null {
  if (!c.sizeMm) return null;
  const [min, max] = c.sizeMm;
  const u = u2 === undefined ? u1 : Math.max(u1, u2);
  return Math.min(max, min + Math.floor(u * (max - min + 1)));
}

/** 받는 코인: 기본 + 길이에 비례한 덤 (가장 클 때 기본 × sizeBonusRatio) */
export function catchCoins(c: Catch, sizeMm: number | null): number {
  if (!c.sizeMm || sizeMm === null || c.coins === 0) return c.coins;
  const [min, max] = c.sizeMm;
  const ratio = Math.max(0, Math.min(1, (sizeMm - min) / (max - min)));
  return c.coins + Math.floor(c.coins * FISHING_RULES.sizeBonusRatio * ratio);
}

/** 길이 표시: 123mm → 12.3cm */
export function formatSize(mm: number): string {
  return `${(mm / 10).toFixed(1)}cm`;
}

/** 한 번 던질 때 평균 코인 (시험·문서용). 길이는 고르게(타이밍을 맞추면 둘 중 큰 쪽) 나온다고 보고 계산한다 */
export function expectedCoinsPerCast(at: FishingClock, good: boolean): number {
  const pool = catchPool(at, good);
  const total = poolTotal(pool);
  // 고른 u의 평균 1/2, 둘 중 큰 쪽의 평균 2/3
  const meanRatio = good ? 2 / 3 : 1 / 2;
  return pool.reduce((sum, { c, w }) => {
    const bonus = c.sizeMm && c.coins > 0 ? c.coins * FISHING_RULES.sizeBonusRatio * meanRatio : 0;
    return sum + (w / total) * (c.coins + bonus);
  }, 0);
}

export type CastTiming = "good" | "early" | "late";

/** 서버 시각 기준 입질 뒤 몇 ms에 당겼는지로 타이밍을 정한다 */
export function judgeTiming(elapsedMs: number): CastTiming {
  if (elapsedMs < -FISHING_RULES.earlyGraceMs) return "early";
  if (elapsedMs > FISHING_RULES.hitWindowMs) return "late";
  return "good";
}

export const TIMING_TEXT: Record<CastTiming, string> = {
  good: "딱 맞았어요! 귀한 물고기가 잘 나와요.",
  early: "조금 일찍 당겼어요.",
  late: "조금 늦게 당겼어요.",
};
