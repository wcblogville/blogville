// 글 순수 규칙 테스트 (POST-01~04, POST-07, POST-09 / FR-006, FR-009, FR-018, FR-029, FR-041, FR-047, quickstart §1)
// 실행: npm run test:post
import { attachmentAccess, pasteAction } from "../src/lib/attachments";
import { checkPostInput, isContentTooLarge, parseTags, type PostInputRaw } from "../src/lib/post-rules";

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

// ===== postInputSchema: 검사 순서와 문구 (contracts/write-actions.md §2 표 1~7) =====
function postInput() {
  const base: PostInputRaw = { postId: "", title: "제목", contentHtml: "<p>본문</p>", categoryId: "", subcategoryId: "", tags: "", visibility: "public" };
  const err = (over: Partial<PostInputRaw>) => {
    const r = checkPostInput({ ...base, ...over });
    return "error" in r ? r.error : "ok";
  };
  expect("기본 입력 통과", () => err({}), "ok");
  expect("빈 제목", () => err({ title: "" }), "제목을 적어 주세요");
  expect("공백만 제목", () => err({ title: "   " }), "제목을 적어 주세요");
  expect("제목 100자 통과", () => err({ title: "가".repeat(100) }), "ok");
  expect("제목 101자", () => err({ title: "가".repeat(101) }), "제목은 100자까지예요");
  expect("본문 200,000자 통과", () => err({ contentHtml: "a".repeat(200_000) }), "ok");
  expect("본문 200,001자", () => err({ contentHtml: "a".repeat(200_001) }), "글이 너무 길어요");
  expect("태그 300자 통과", () => err({ tags: "a".repeat(300) }), "ok");
  expect("태그 301자", () => err({ tags: "a".repeat(301) }), "태그는 모두 합쳐 300자까지예요");
  expect("공개 설정 x", () => err({ visibility: "x" }), "잘못된 요청이에요");
  for (const bad of ["0", "abc", "1.5", "99999999999", "1e1", "-1", "012"]) {
    expect(`대분류 ${bad}`, () => err({ categoryId: bad }), "잘못된 요청이에요");
    expect(`소분류 ${bad}`, () => err({ subcategoryId: bad }), "잘못된 요청이에요");
  }
  expect("글 번호 0", () => err({ postId: "0" }), "잘못된 요청이에요");
  expect("대분류 2147483647 통과", () => err({ categoryId: "2147483647" }), "ok");
  expect("여러 오류면 글 번호가 먼저", () => err({ postId: "x", title: "", tags: "a".repeat(301) }), "잘못된 요청이에요");
  expect("여러 오류면 제목이 태그보다 먼저", () => err({ title: "", tags: "a".repeat(301), visibility: "x" }), "제목을 적어 주세요");
  expect("여러 오류면 본문 길이가 대분류보다 먼저", () => err({ contentHtml: "a".repeat(200_001), categoryId: "abc" }), "글이 너무 길어요");
  expect("여러 오류면 대분류가 태그보다 먼저", () => err({ categoryId: "abc", tags: "a".repeat(301) }), "잘못된 요청이에요");
  expect("여러 오류면 태그가 공개 설정보다 먼저", () => err({ tags: "a".repeat(301), visibility: "x" }), "태그는 모두 합쳐 300자까지예요");
  expect(
    "정리된 값",
    () => checkPostInput({ ...base, postId: "7", title: "  제목  ", categoryId: "3", subcategoryId: "" }),
    { value: { postId: 7, title: "제목", contentHtml: "<p>본문</p>", categoryId: 3, subcategoryId: null, tags: "", visibility: "public" } },
  );

  // 본문 크기 판단 (R11): UTF-8 900,000바이트 경계. 한글은 3바이트
  expect("900,000바이트 통과", () => isContentTooLarge("a".repeat(900_000)), false);
  expect("900,001바이트 막음", () => isContentTooLarge("a".repeat(900_001)), true);
  expect("한글 300,000자 = 900,000바이트 통과", () => isContentTooLarge("가".repeat(300_000)), false);
  expect("한글 300,001자 막음", () => isContentTooLarge("가".repeat(300_001)), true);
}

// ===== parseTags (FR-041, US6-1·2) =====
function tags() {
  expect("git, #회고, Git → git, 회고", () => parseTags("git, #회고, Git"), ["git", "회고"]);
  expect("21자 버림", () => parseTags(`${"a".repeat(21)}, ok`), ["ok"]);
  expect("20자 남김", () => parseTags("b".repeat(20)), ["b".repeat(20)]);
  expect("11개 → 앞 10개", () => parseTags(Array.from({ length: 11 }, (_, i) => `t${i + 1}`).join(",")), Array.from({ length: 10 }, (_, i) => `t${i + 1}`));
  expect("c# → c", () => parseTags("c#"), ["c"]);
  expect("가운데 공백 한 칸", () => parseTags("  next    js  "), ["next js"]);
  expect("줄바꿈 구분", () => parseTags("a\nb"), ["a", "b"]);
  expect("공백은 구분자가 아님", () => parseTags("a b"), ["a b"]);
  expect("빈 칸", () => parseTags(" , # ,"), []);
}

// ===== attachmentAccess (FR-029, FR-059, data-model 3.4) =====
function access() {
  const a = (over: Partial<Parameters<typeof attachmentAccess>[0]>) =>
    attachmentAccess({ postVisibility: null, postOwnerId: null, uploaderId: "u1", isProfilePhoto: false, viewerId: null, ...over });
  expect("공개 글 첨부 방문자", () => a({ postVisibility: "public", postOwnerId: "u1" }), true);
  expect("공개 글 첨부 다른 회원", () => a({ postVisibility: "public", postOwnerId: "u1", viewerId: "u2" }), true);
  expect("비공개 글 첨부 주인", () => a({ postVisibility: "private", postOwnerId: "u1", viewerId: "u1" }), true);
  expect("비공개 글 첨부 다른 회원(관리자 포함)", () => a({ postVisibility: "private", postOwnerId: "u1", viewerId: "admin" }), false);
  expect("비공개 글 첨부 방문자", () => a({ postVisibility: "private", postOwnerId: "u1" }), false);
  expect("붙지 않은 첨부 올린 사람", () => a({ viewerId: "u1" }), true);
  expect("붙지 않은 첨부 다른 회원", () => a({ viewerId: "u2" }), false);
  expect("붙지 않은 첨부 방문자", () => a({}), false);
  expect("붙지 않은 첨부 + 프로필 사진 방문자", () => a({ isProfilePhoto: true }), true);
}

// ===== pasteAction (FR-047, contracts/write-actions.md §4) =====
function paste() {
  const row = (over: Partial<{ uploaderId: string; postId: number | null; isProfilePhoto: boolean }>) => ({
    uploaderId: "me",
    postId: null,
    isProfilePhoto: false,
    ...over,
  });
  expect("내 것·안 붙음 keep", () => pasteAction(row({}), "me", null), "keep");
  expect("내 것·이 글 keep", () => pasteAction(row({ postId: 5 }), "me", 5), "keep");
  expect("내 것·다른 글 reupload", () => pasteAction(row({ postId: 4 }), "me", 5), "reupload");
  expect("내 것·다른 글(새 글 화면) reupload", () => pasteAction(row({ postId: 4 }), "me", null), "reupload");
  expect("내 것·프로필 사진 reupload", () => pasteAction(row({ isProfilePhoto: true }), "me", null), "reupload");
  expect("남의 것 drop", () => pasteAction(row({ uploaderId: "other" }), "me", null), "drop");
  expect("없는 키 drop", () => pasteAction(null, "me", null), "drop");
}

postInput();
tags();
access();
paste();

console.log(failed ? `\n❌ ${failed}개 실패` : "\n✅ 모두 통과");
if (failed) process.exit(1);
