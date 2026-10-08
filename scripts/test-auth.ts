// 회원/인증 규칙 테스트 (AUTH-01, AUTH-07 / FR-002, FR-009, FR-010)
// 실행: npm run test:auth
import { isReservedName, isValidNicknameLength, isValidUsername, normalizeName, RESERVED_NAMES, USERNAME_RE } from "../src/lib/names";

let failed = 0;
function expect(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "✅" : "❌"} ${name}: ${JSON.stringify(got)}${ok ? "" : ` (기대: ${JSON.stringify(want)})`}`);
}

// FR-002 아이디 정규화·형식
const username = (raw: string) => {
  const n = normalizeName(raw);
  return isValidUsername(n) ? n : null;
};
expect('" Tester_1 " → tester_1', username(" Tester_1 "), "tester_1");
expect("TESTER → tester", username("TESTER"), "tester");
expect("한글 거부", username("테스터1234"), null);
expect("특수문자 거부", username("test-1"), null);
expect("가운데 공백 거부", username("te st"), null);
expect("3자 거부", username("abc"), null);
expect("4자 통과", username("abcd"), "abcd");
expect("20자 통과", username("a".repeat(20)), "a".repeat(20));
expect("21자 거부", username("a".repeat(21)), null);
expect("빈 값 거부", username("   "), null);
expect("USERNAME_RE는 DB CHECK와 같은 식", USERNAME_RE.source, "^[a-z0-9_]{4,20}$");

// FR-010 예약어 16개 (blog FR-009)
expect("예약어 16개", RESERVED_NAMES.size, 16);
for (const name of ["admin", "Admin", " ADMIN ", "settings", "notice", "onboarding", "api", "town", "wallet", "files", "tags", "attendance"]) {
  expect(`${JSON.stringify(name)}는 예약어`, isReservedName(name), true);
}
expect("tester1은 예약어 아님", isReservedName("tester1"), false);
expect("admin1은 예약어 아님", isReservedName("admin1"), false);

// FR-009 닉네임 길이 2~20
expect("닉네임 1자 거부", isValidNicknameLength("가"), false);
expect("닉네임 2자 통과", isValidNicknameLength("가나"), true);
expect("닉네임 20자 통과", isValidNicknameLength("가".repeat(20)), true);
expect("닉네임 21자 거부", isValidNicknameLength("가".repeat(21)), false);
expect("닉네임 앞뒤 공백은 세지 않음", isValidNicknameLength("  가  "), false);
expect("아이디 4~20자는 닉네임으로 늘 통과", [4, 20].map((n) => isValidNicknameLength("a".repeat(n))), [true, true]);

if (failed) process.exit(1);
