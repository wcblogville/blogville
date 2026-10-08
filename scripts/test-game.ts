// 게임 규칙 계산 테스트: 레벨(GAME-02), 출석 일차(GAME-04), 레벨업(GAME-06), 동물 농장(TOWN-09)
// 실행: npm run test:game
import { animalStage, levelEggLevels, pickWeighted, subject } from "../src/lib/farm";
import { levelFromExp, levelProgress, levelsGained, MAX_LEVEL, nextCycleDay, todayKST } from "../src/lib/game";

let failed = 0;
function expect(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "✅" : "❌"} ${name}: ${JSON.stringify(got)}${ok ? "" : ` (기대: ${JSON.stringify(want)})`}`);
}

// GAME-02 레벨
expect("경험치 99 → Lv.1", levelFromExp(99), 1);
expect("경험치 100 → Lv.2", levelFromExp(100), 2);
expect("경험치 150 진행 막대", [levelProgress(150).current, levelProgress(150).needed], [50, 200]);
expect("경험치 485,099 → Lv.98", levelFromExp(485_099), 98);
expect("경험치 485,100 → Lv.99", levelFromExp(485_100), MAX_LEVEL);
expect("경험치 1,000만 → Lv.99에서 멈춤", levelFromExp(10_000_000), 99);
expect("최고 레벨 진행 막대 가득(MAX)", [levelProgress(600_000).isMax, levelProgress(600_000).ratio], [true, 1]);

// 한국 날짜 0시 경계 (FR-008)
expect("UTC 14:59 → 그날", todayKST(new Date("2026-10-01T14:59:00Z")), "2026-10-01");
expect("UTC 15:01 → 다음 날", todayKST(new Date("2026-10-01T15:01:00Z")), "2026-10-02");

// GAME-04 출석 일차
expect("기록 없음 → 1일차", nextCycleDay(null, "2026-10-01"), 1);
expect("어제 3일차 → 4일차", nextCycleDay({ date: "2026-09-30", cycleDay: 3 }, "2026-10-01"), 4);
expect("어제 7일차 → 1일차", nextCycleDay({ date: "2026-09-30", cycleDay: 7 }, "2026-10-01"), 1);
expect("그저께가 마지막 → 1일차", nextCycleDay({ date: "2026-09-29", cycleDay: 5 }, "2026-10-01"), 1);
expect("해 바뀜 12/31 → 1/1 이어짐", nextCycleDay({ date: "2025-12-31", cycleDay: 2 }, "2026-01-01"), 3);
{
  // SC-005: 10/1~10/11, 10/10 빠짐 → 1~7, 1, 2, (없음), 1
  const got: (number | null)[] = [];
  let last: { date: string; cycleDay: number } | null = null;
  for (let d = 1; d <= 11; d++) {
    const date = `2026-10-${String(d).padStart(2, "0")}`;
    if (d === 10) { got.push(null); continue; }
    const cycleDay = nextCycleDay(last, date);
    got.push(cycleDay);
    last = { date, cycleDay };
  }
  expect("10/1~10/11 (10/10 빠짐)", got, [1, 2, 3, 4, 5, 6, 7, 1, 2, null, 1]);
}

// GAME-06 레벨업 목록
expect("99 → 100: [2]", levelsGained(99, 100), [2]);
expect("290 → 300: [3]", levelsGained(290, 300), [3]);
expect("90 → 340: [2, 3]", levelsGained(90, 340), [2, 3]);
expect("485,090 → 485,100: [99]", levelsGained(485_090, 485_100), [99]);
expect("600,000 → 600,010: []", levelsGained(600_000, 600_010), []);

// TOWN-09 동물 농장
expect("성장 0/90 → 아기", animalStage(0, 90), "baby");
expect("성장 29/90 → 아기", animalStage(29, 90), "baby");
expect("성장 30/90 → 청소년", animalStage(30, 90), "teen");
expect("성장 89/90 → 청소년", animalStage(89, 90), "teen");
expect("성장 90/90 → 어른", animalStage(90, 90), "adult");
expect("Lv.4 → 레벨 보상 알 없음", levelEggLevels(4), []);
expect("Lv.12 → 5, 10레벨 알", levelEggLevels(12), [5, 10]);
const sp = [{ code: "a", hatchWeight: 40 }, { code: "b", hatchWeight: 10 }];
expect("비중 고르기: 0 → 첫째", pickWeighted(sp, 0).code, "a");
expect("비중 고르기: 0.79 → 첫째 (40/50 경계 전)", pickWeighted(sp, 0.79).code, "a");
expect("비중 고르기: 0.8 → 둘째", pickWeighted(sp, 0.8).code, "b");
expect("비중 고르기: 0.999 → 둘째", pickWeighted(sp, 0.999).code, "b");
expect("조사: 토끼가", subject("토끼"), "토끼가");
expect("조사: 아기 돼지가", subject("아기 돼지"), "아기 돼지가");
expect("조사: 곰이", subject("곰"), "곰이");

if (failed) process.exit(1);
