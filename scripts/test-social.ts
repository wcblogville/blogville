// 교류 순수 규칙 테스트 (SOC-01·02·04 / FR-007, FR-008, FR-013, FR-024, FR-042, quickstart 2절)
// 실행: npm run test:social
import { canDeleteComment, checkComment, favoriteWindowStart, normalizeComment } from "../src/lib/social";

let failed = 0;
function expect(name: string, got: () => unknown, want: unknown) {
  let value: unknown;
  try {
    value = got();
  } catch (err) {
    value = `throw: ${err instanceof Error ? err.message : String(err)}`;
  }
  const ok = JSON.stringify(value) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "✅" : "❌"} ${name}: ${JSON.stringify(value).slice(0, 80)}${ok ? "" : ` (기대: ${JSON.stringify(want).slice(0, 80)})`}`);
}

// ===== 내용 정규화·검사 =====
expect("CRLF·앞뒤 공백 정리", () => normalizeComment("  안녕 \r\n반가워  "), "안녕 \n반가워");
expect("CR만 있는 줄바꿈", () => normalizeComment("a\rb"), "a\nb");
expect("문자열이 아니면 빈 값", () => normalizeComment(42), "");
expect("공백만 → 문구", () => checkComment("   \n  "), { ok: false, error: "댓글을 적어 주세요" });
expect("빈 값 → 문구", () => checkComment(""), { ok: false, error: "댓글을 적어 주세요" });
expect("없음 → 문구", () => checkComment(null), { ok: false, error: "댓글을 적어 주세요" });
expect("1000자 통과", () => checkComment("가".repeat(1000)).ok, true);
expect("1001자 → 문구", () => checkComment("가".repeat(1001)), { ok: false, error: "댓글은 1000자까지예요" });
expect("CRLF 10개 포함 1000자(LF 기준) 통과", () => checkComment(`${"a\r\n".repeat(10)}${"b".repeat(980)}`).ok, true);
expect("이모지 1000개는 1000자", () => checkComment("😀".repeat(1000)).ok, true);
expect("HTML 글자 그대로", () => checkComment("<b>굵게</b> https://example.com"), { ok: true, content: "<b>굵게</b> https://example.com" });

// ===== 삭제 권한 =====
const base = { isAdmin: false, authorId: "a", blogOwnerId: "o" };
expect("작성자", () => canDeleteComment({ ...base, viewerId: "a" }), true);
expect("블로그 주인", () => canDeleteComment({ ...base, viewerId: "o" }), true);
expect("관리자", () => canDeleteComment({ ...base, viewerId: "x", isAdmin: true }), true);
expect("남", () => canDeleteComment({ ...base, viewerId: "x" }), false);
expect("방문자", () => canDeleteComment({ ...base, viewerId: null }), false);
expect("탈퇴 자리(작성자 없음)를 남이", () => canDeleteComment({ ...base, authorId: null, viewerId: "x" }), false);

// ===== 즐겨찾는 이웃 기간 (오늘 포함 7일) =====
expect("10월 7일 → 10월 1일", () => favoriteWindowStart("2026-10-07"), "2026-10-01");
expect("3월 3일 → 2월 25일", () => favoriteWindowStart("2026-03-03"), "2026-02-25");
expect("1월 3일 → 전년 12월 28일", () => favoriteWindowStart("2027-01-03"), "2026-12-28");

if (failed) {
  console.log(`\n❌ ${failed}개 실패`);
  process.exit(1);
}
console.log("\n모두 통과");
