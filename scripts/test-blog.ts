// 블로그 순수 규칙 테스트 (BLOG-01~05 / FR-009, FR-019, FR-039, FR-040, FR-051, FR-053, quickstart 1절)
// 실행: npm run test:blog
import { buildCategoryTree, charCount, checkBlogTitle, parseSearchQuery, ROOF_COLORS, SLUG_RE, swapPosition, toLikePattern } from "../src/lib/blog";
import { isReservedName, normalizeName, RESERVED_NAMES } from "../src/lib/names";

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
  console.log(`${ok ? "✅" : "❌"} ${name}: ${JSON.stringify(value)}${ok ? "" : ` (기대: ${JSON.stringify(want)})`}`);
}

// FR-009 블로그 주소: 정규화(앞뒤 공백 제거·소문자) 뒤 형식 3~20자
const slug = (raw: string) => {
  const n = normalizeName(raw);
  return SLUG_RE.test(n) ? n : null;
};
expect('"  My_Blog " → my_blog', () => slug("  My_Blog "), "my_blog");
expect("3자 통과", () => slug("abc"), "abc");
expect("2자 거부", () => slug("ab"), null);
expect("20자 통과", () => slug("a".repeat(20)), "a".repeat(20));
expect("21자 거부", () => slug("a".repeat(21)), null);
expect("한글 거부", () => slug("블로그"), null);
expect("하이픈 거부", () => slug("my-blog"), null);
expect("가운데 공백 거부", () => slug("my blog"), null);
expect("SLUG_RE는 DB CHECK와 같은 식", () => SLUG_RE.source, "^[a-z0-9_]{3,20}$");

// FR-009 예약어 16개 + 나중에 생긴 화면 3개 (값은 blog, 모듈은 auth)
const RESERVED = ["admin", "api", "town", "feed", "shop", "closet", "write", "settings", "blog", "onboarding", "farm", "attendance", "tags", "wallet", "files", "notice", "notifications", "fishing", "house", "salon", "clothes"];
expect("예약어 목록이 FR-009 16개 + 새 화면 5개와 같음", () => [...RESERVED_NAMES].sort(), [...RESERVED].sort());
expect("19개 모두 예약어", () => RESERVED.every((n) => isReservedName(n)), true);
expect("Notice → 예약어", () => isReservedName("Notice"), true);
expect("' TOWN ' → 예약어", () => isReservedName(" TOWN "), true);
expect("my_blog는 예약어 아님", () => isReservedName("my_blog"), false);

// FR-016·019 글자 수: 앞뒤 공백 제거 뒤 코드 포인트 (DB char_length와 같다, research R-07)
expect('charCount("😀") === 1', () => charCount("😀"), 1);
expect('charCount("  가나  ") === 2', () => charCount("  가나  "), 2);
expect('charCount("   ") === 0', () => charCount("   "), 0);
expect("이모지 40개 = 40자", () => charCount("😀".repeat(40)), 40);
expect("닉네임 😀 하나는 2자 미만 (500 대신 문구)", () => charCount("😀") < 2, true);

// 블로그 이름: 블로그 관리(BLOG-03)와 회원가입(AUTH-07)이 같은 검사를 쓴다 (1~40자, 앞뒤 공백 제거)
expect("블로그 이름 앞뒤 공백 제거", () => checkBlogTitle("  나의 정원  "), { ok: true, title: "나의 정원" });
expect("블로그 이름 빈 값 → 문구", () => checkBlogTitle("   "), { ok: false, error: "블로그 이름을 적어 주세요" });
expect("블로그 이름 이모지 40개 통과", () => checkBlogTitle("😀".repeat(40)).ok, true);
expect("블로그 이름 41자 → 문구", () => checkBlogTitle("가".repeat(41)), { ok: false, error: "블로그 이름은 40자까지예요" });
expect("블로그 이름이 문자열이 아니면 빈 값", () => checkBlogTitle(null), { ok: false, error: "블로그 이름을 적어 주세요" });

// FR-051 검색 패턴: %, _, \ 를 글자 그대로
expect('toLikePattern("100%_\\\\")', () => toLikePattern("100%_\\"), "%100\\%\\_\\\\%");
expect('toLikePattern("맛집")', () => toLikePattern("맛집"), "%맛집%");

// FR-053 검색어: 공백만 → 빈 검색어, 51자 이상 → 무시, 없음 → 검색 아님
expect('parseSearchQuery("  ") → 빈 검색어', () => parseSearchQuery("  "), { empty: true, q: "" });
expect('parseSearchQuery(" 맛집 ") → "맛집"', () => parseSearchQuery(" 맛집 "), { empty: false, q: "맛집" });
expect("50자 → 검색어", () => parseSearchQuery("가".repeat(50)), { empty: false, q: "가".repeat(50) });
expect("51자 → 무시(null)", () => parseSearchQuery("가".repeat(51)), null);
expect("없음 → null", () => parseSearchQuery(undefined), null);
expect('배열 ["a", "b"] → 첫 값', () => parseSearchQuery(["a", "b"]), { empty: false, q: "a" });

// FR-040 카테고리 트리: 대분류·소분류 모두 position → id, 소분류는 제 대분류 아래
expect(
  "buildCategoryTree 정렬과 묶음",
  () =>
    buildCategoryTree(
      [
        { id: 3, position: 1, name: "공부" },
        { id: 1, position: 0, name: "여행" },
        { id: 2, position: 1, name: "일상" },
      ],
      [
        { id: 12, categoryId: 1, position: 0, name: "카페" },
        { id: 10, categoryId: 1, position: 0, name: "맛집" },
        { id: 11, categoryId: 3, position: 0, name: "책" },
        { id: 13, categoryId: 1, position: -1, name: "숙소" },
        { id: 14, categoryId: 99, position: 0, name: "고아" },
      ],
    ).map((c) => `${c.name}[${c.subcategories.map((s) => s.name).join(",")}]`),
  ["여행[숙소,맛집,카페]", "일상[]", "공부[책]"],
);

// FR-039 순서 맞바꾸기: 끝이면 그대로, 결과는 0부터 빈틈 없음
const pos = (r: { id: number; position: number }[]) => r.map((x) => `${x.id}:${x.position}`).join(" ");
expect("가운데 ▲", () => pos(swapPosition([5, 6, 7], 6, -1)), "6:0 5:1 7:2");
expect("가운데 ▼", () => pos(swapPosition([5, 6, 7], 6, 1)), "5:0 7:1 6:2");
expect("맨 위 ▲ 그대로", () => pos(swapPosition([5, 6, 7], 5, -1)), "5:0 6:1 7:2");
expect("맨 아래 ▼ 그대로", () => pos(swapPosition([5, 6, 7], 7, 1)), "5:0 6:1 7:2");
expect("없는 ID 그대로", () => pos(swapPosition([5, 6, 7], 9, 1)), "5:0 6:1 7:2");
expect('방향 "x" 그대로', () => pos(swapPosition([5, 6, 7], 6, "x")), "5:0 6:1 7:2");
expect("방향 2 그대로", () => pos(swapPosition([5, 6, 7], 6, 2)), "5:0 6:1 7:2");

// TOWN-07 지붕 색 10개 (집 10단계마다 하나씩 열림, 2026-10-09)
expect("ROOF_COLORS 10색", () => ROOF_COLORS, ["red", "orange", "yellow", "green", "sky", "blue", "purple", "brown", "pink", "mint"]);

if (failed) {
  console.log(`\n❌ ${failed}개 실패`);
  process.exit(1);
}
console.log("\n✅ 모두 통과");
