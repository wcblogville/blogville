// 게임 규칙 계산 테스트: 레벨(GAME-02), 출석 일차(GAME-04), 레벨업(GAME-06), 동물 농장(TOWN-09), 집 단계·지붕 색(TOWN-07·11)
// 실행: npm run test:game
import { houseStage } from "../src/lib/art/town";
import { ROOF_COLORS } from "../src/lib/blog";
import { animalStage, levelEggLevels, pickWeighted, subject } from "../src/lib/farm";
import { expForLevel, levelFromExp, levelProgress, levelsGained, MAX_LEVEL, nextCycleDay, todayKST } from "../src/lib/game";
import { currentRoof, furnitureSlots, houseInfo, roofOrder, unlockedRoofs } from "../src/lib/house";

let failed = 0;
function expect(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "✅" : "❌"} ${name}: ${JSON.stringify(got)}${ok ? "" : ` (기대: ${JSON.stringify(want)})`}`);
}

// GAME-02 레벨: 레벨 n까지 10 × n × (n − 1) (처음 곡선의 1/5, 2026-10-09)
expect("Lv.2·3·4·10 필요 경험치", [2, 3, 4, 10].map(expForLevel), [20, 60, 120, 900]);
expect("경험치 19 → Lv.1", levelFromExp(19), 1);
expect("경험치 20 → Lv.2", levelFromExp(20), 2);
expect("경험치 30 진행 막대", [levelProgress(30).current, levelProgress(30).needed], [10, 40]);
expect("경험치 97,019 → Lv.98", levelFromExp(97_019), 98);
expect("경험치 97,020 → Lv.99", levelFromExp(97_020), MAX_LEVEL);
expect("경험치 1,000만 → Lv.99에서 멈춤", levelFromExp(10_000_000), 99);
expect("최고 레벨 진행 막대 가득(MAX)", [levelProgress(600_000).isMax, levelProgress(600_000).ratio], [true, 1]);

// TOWN-11 집 단계: 10레벨마다 한 단계, 10단계까지 (2026-10-09)
expect("Lv.1·9·10·19·20·89·90·99 → 집 단계", [1, 9, 10, 19, 20, 89, 90, 99].map(houseStage), [1, 1, 2, 2, 3, 9, 10, 10]);
expect("가구 칸: 1단계 4, 2단계 6, 3단계부터 8", ([1, 2, 3, 10] as const).map(furnitureSlots), [4, 6, 8, 8]);
expect("Lv.15 집: 2단계, 다음은 Lv.20", [houseInfo(15).stage, houseInfo(15).nextLevel], [2, 20]);
expect("Lv.95 집: 10단계, 다음 없음", [houseInfo(95).stage, houseInfo(95).nextLevel], [10, null]);

// TOWN-07 지붕 색: 블로그마다 정해진 순서(10색 모두 한 번씩), 단계 수만큼 열림, 안 골랐으면 첫 색
expect("지붕 색 순서는 10색을 한 번씩", [...roofOrder(7)].sort(), [...ROOF_COLORS].sort());
expect("같은 블로그는 늘 같은 순서", roofOrder(7), roofOrder(7));
expect("블로그마다 첫 색이 고루 나뉨 (1~200번에 8색 이상)", new Set(Array.from({ length: 200 }, (_, i) => roofOrder(i + 1)[0])).size >= 8, true);
expect("1단계 1색, 3단계 3색", [unlockedRoofs(7, 1).length, unlockedRoofs(7, 3).length], [1, 3]);
expect("안 골랐으면 첫 색", currentRoof(7, null), roofOrder(7)[0]);
expect("고른 색", currentRoof(7, "mint"), "mint");
expect("이상한 값은 첫 색", currentRoof(7, "gold"), roofOrder(7)[0]);

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
expect("19 → 20: [2]", levelsGained(19, 20), [2]);
expect("58 → 60: [3]", levelsGained(58, 60), [3]);
expect("18 → 70: [2, 3]", levelsGained(18, 70), [2, 3]);
expect("97,010 → 97,020: [99]", levelsGained(97_010, 97_020), [99]);
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
