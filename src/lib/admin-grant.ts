// 관리자 테스트 지급 (AUTH-10): 입력 검사와 빠른 버튼 계산. DB를 쓰지 않는 순수 함수만 둔다
import { expForLevel, MAX_LEVEL } from "./game";

/** 한 번에 줄 수 있는 코인 최대 */
export const GRANT_COINS_MAX = 1_000_000;
/** 한 번에 줄 수 있는 경험치 최대: 0에서 Lv.99까지 가는 경험치(97,020)를 넉넉히 넘는 값 */
export const GRANT_EXP_MAX = 100_000;
/** [+10,000 코인] 버튼 */
export const QUICK_COINS = 10_000;

export type GrantPreset = "coins" | "max_level";
export type GrantInput = { username: string; coins: number; exp: number; preset: GrantPreset | null };

/** 빈 칸은 0. 정수가 아니거나 범위 밖이면 null */
function parseAmount(raw: FormDataEntryValue | null, max: number): number | null {
  const text = typeof raw === "string" ? raw.trim().replaceAll(",", "") : "";
  if (text === "") return 0;
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n <= max ? n : null;
}

/** 폼 입력 → 지급 내용. 잘못된 입력은 화면에 보일 문구 */
export function parseGrantInput(form: { get(name: string): FormDataEntryValue | null }): GrantInput | { error: string } {
  const username = String(form.get("username") ?? "").trim().toLowerCase().replace(/^@/, "");
  const presetRaw = form.get("preset");
  const preset: GrantPreset | null = presetRaw === "coins" || presetRaw === "max_level" ? presetRaw : null;
  if (preset === "coins") return { username, coins: QUICK_COINS, exp: 0, preset };
  if (preset === "max_level") return { username, coins: 0, exp: 0, preset }; // 경험치는 잠근 뒤 지금 경험치로 계산
  const coins = parseAmount(form.get("coins"), GRANT_COINS_MAX);
  if (coins === null) return { error: `코인은 0~${GRANT_COINS_MAX.toLocaleString()} 사이의 정수로 적어 주세요` };
  const exp = parseAmount(form.get("exp"), GRANT_EXP_MAX);
  if (exp === null) return { error: `경험치는 0~${GRANT_EXP_MAX.toLocaleString()} 사이의 정수로 적어 주세요` };
  if (coins === 0 && exp === 0) return { error: "코인이나 경험치를 1 이상 적어 주세요" };
  return { username, coins, exp, preset: null };
}

/** 지금 경험치에서 최고 레벨(Lv.99)까지 모자란 경험치 */
export function expToMaxLevel(currentExp: number): number {
  return Math.max(0, expForLevel(MAX_LEVEL) - currentExp);
}
