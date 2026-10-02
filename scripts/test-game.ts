// 게임 규칙 계산 테스트: 레벨(GAME-02), 연속 출석(GAME-04)
// 실행: npm run test:game
import { currentStreak, levelFromExp, levelProgress, MAX_LEVEL } from "../src/lib/game";

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

// GAME-04 연속 출석
expect("기록 없음 → 0", currentStreak(null, "2026-10-01"), 0);
expect("오늘 출석 → 그 연속 일수", currentStreak({ date: "2026-10-01", streak: 5 }, "2026-10-01"), 5);
expect("어제 출석(달 바뀜) → 이어짐", currentStreak({ date: "2026-09-30", streak: 6 }, "2026-10-01"), 6);
expect("그저께가 마지막 → 끊김", currentStreak({ date: "2026-09-29", streak: 6 }, "2026-10-01"), 0);
expect("해 바뀜 12/31 → 1/1 이어짐", currentStreak({ date: "2025-12-31", streak: 3 }, "2026-01-01"), 3);

if (failed) process.exit(1);
