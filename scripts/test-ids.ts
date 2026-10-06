// 주소·요청의 숫자 ID 검사 테스트 (#21)
// 실행: npm run test:ids
import { parseId } from "../src/lib/ids";

let failed = 0;
function expect(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "✅" : "❌"} ${name}: ${JSON.stringify(got)}${ok ? "" : ` (기대: ${JSON.stringify(want)})`}`);
}

expect("\"1\" → 1", parseId("1"), 1);
expect("\"2147483647\"(DB 최댓값) → 그대로", parseId("2147483647"), 2147483647);
expect("\"2147483648\"(범위 밖) → null", parseId("2147483648"), null);
expect("\"99999999999999999999\" → null", parseId("99999999999999999999"), null);
expect("\"0\" → null", parseId("0"), null);
expect("\"-1\" → null", parseId("-1"), null);
expect("\"1.5\" → null", parseId("1.5"), null);
expect("\"1e3\" → null", parseId("1e3"), null);
expect("\"Infinity\" → null", parseId("Infinity"), null);
expect("\"007\"(앞자리 0) → null", parseId("007"), null);
expect("\" 3\"(공백) → null", parseId(" 3"), null);
expect("빈 문자열 → null", parseId(""), null);
expect("없음(undefined) → null", parseId(undefined), null);
expect("배열 [\"3\", \"4\"] → 첫 값 3", parseId(["3", "4"]), 3);
expect("숫자 42 → 42", parseId(42), 42);
expect("숫자 1.5 → null", parseId(1.5), null);
expect("숫자 2147483648 → null", parseId(2147483648), null);
expect("숫자 NaN → null", parseId(NaN), null);
expect("객체 → null", parseId({ id: 1 }), null);

if (failed) process.exit(1);
