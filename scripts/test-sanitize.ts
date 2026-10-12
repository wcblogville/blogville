// NF-03: 글 HTML 정화가 XSS 공격 문자열을 제거하는지 확인한다
// 실행: npm run test:sanitize
import { htmlToText, sanitizePostHtml } from "../src/server/sanitize";
import { RELEASE_NOTES, releaseNoteHtml, releaseNoteText, releaseNoteTitle } from "../src/content/release-notes";
import { WELCOME_NOTICE_HTML, WELCOME_NOTICE_TEXT, WELCOME_NOTICE_TITLE } from "../src/lib/welcome-notice";
// 글쓰기 화면 글자 수가 서버 보상 판단과 같은지도 함께 확인한다 (#18)
import "./test-text-length";
const cases = {
  script: '<p>안녕</p><script>alert(1)</script>',
  onerror: '<p><img src=x onerror="alert(1)">사진</p>',
  jsLink: '<p><a href="javascript:alert(1)">눌러</a></p>',
  onclick: '<p onclick="alert(1)">클릭</p>',
  iframe: '<iframe src="https://evil.example"></iframe><p>본문</p>',
  styleTag: '<style>body{display:none}</style><p>본문</p>',
  normal: '<h2>제목</h2><p><strong>굵게</strong> <a href="https://example.com">링크</a></p><pre><code>code</code></pre>',
};
for (const [name, html] of Object.entries(cases)) {
  const out = sanitizePostHtml(html);
  const bad = /<script|onerror|onclick|javascript:|<iframe|<style/i.test(out);
  console.log(`${bad ? "❌" : "✅"} ${name.padEnd(9)} → ${out}`);
}
const failed = Object.values(cases).some((html) => /<script|onerror|onclick|javascript:|<iframe|<style/i.test(sanitizePostHtml(html)));
if (failed) process.exit(1);

// POST-07·POST-09: 사진·파일 카드는 우리 저장소 주소(/files/키)만 남는다
{
  const KEY = "0123456789abcdef0123456789abcdef";
  const OTHER = "fedcba9876543210fedcba9876543210";
  const known = new Map([
    [KEY, { kind: "image" as const, name: "사진.png", size: 2048 }],
    [OTHER, { kind: "file" as const, name: "보고서 최종.pdf", size: 1258291 }],
  ]);
  let bad = 0;
  const expect = (name: string, got: string, ok: boolean) => {
    if (!ok) bad++;
    console.log(`${ok ? "✅" : "❌"} ${name.padEnd(22)} → ${got}`);
  };
  const s = (html: string) => sanitizePostHtml(html, known);

  let out = s(`<img src="/files/${KEY}" alt="고양이" onerror="alert(1)">`);
  expect("우리 사진 남김", out, out === `<img src="/files/${KEY}" alt="고양이" />`);
  out = s('<img src="https://evil.example/x.png">');
  expect("다른 사이트 사진 뺌", out, out === "");
  out = s('<img src="data:image/png;base64,AAAA">');
  expect("data: 사진 뺌", out, out === "");
  out = s('<img src="javascript:alert(1)">');
  expect("javascript: 사진 뺌", out, out === "");
  out = s(`<img src="/files/${"a".repeat(32)}">`);
  expect("DB에 없는 사진 뺌", out, out === "");
  out = s(`<img src="/files/${OTHER}">`);
  expect("파일을 사진으로 쓰면 뺌", out, out === "");
  out = s(`<a href="/files/${OTHER}" data-file="" data-name="가짜.exe" data-size="1" onclick="x()"></a>`);
  expect(
    "파일 카드: DB 이름·크기",
    out,
    out.includes('data-name="보고서 최종.pdf"') && out.includes('data-size="1258291"') && out.includes('data-size-label="1.2MB"') &&
      out.includes('data-ext="pdf"') && out.includes('aria-label="보고서 최종.pdf 내려받기 (1.2MB)"') && !out.includes("onclick") && !out.includes("target"),
  );
  out = s(`<a href="/files/${"c".repeat(32)}" data-file="" data-name="없는파일.pdf"></a>`);
  expect("DB에 없는 파일 카드 뺌", out, out === "");
  out = s('<a href="https://evil.example/x.pdf" data-file="" data-name="x.pdf"></a>');
  expect("다른 주소 파일 카드 뺌", out, out === "");
  out = s('<p><a href="https://example.com">링크</a></p>');
  expect("보통 링크는 새 탭", out, out.includes('target="_blank"') && out.includes('rel="noopener noreferrer nofollow"'));
  out = sanitizePostHtml(`<img src="/files/${"b".repeat(32)}">`);
  expect("known 없으면 형식만 확인", out, out === `<img src="/files/${"b".repeat(32)}" />`);

  // 저장 때 붙일 수 있는 첨부만 known으로 좁혀 넘긴 경우 (POST-09 / FR-055, research R17):
  // 남의 것·다른 글 것이라 known에서 빠진 키의 카드는 빠지고, 남은 카드 이름·크기는 처음 올린 값으로 다시 쓴다
  const narrowed = new Map([[OTHER, { kind: "file" as const, name: "보고서 최종.pdf", size: 1258291 }]]);
  out = sanitizePostHtml(`<a href="/files/${KEY}" data-file="" data-name="남의.pdf" data-size="9"></a><a href="/files/${OTHER}" data-file="" data-name="바꾼.pdf" data-size="1"></a>`, narrowed);
  expect(
    "좁힌 known: 빠진 키 카드 뺌, 남은 카드 다시 씀",
    out,
    !out.includes(KEY) && out.includes('data-name="보고서 최종.pdf"') && out.includes('data-size="1258291"') && !out.includes("바꾼"),
  );
  if (bad) process.exit(1);
}

// 첫 공지 "사용법 안내" (사용자 요청 2026-10-12): 시드가 정화 없이 넣으므로 정화해도 그대로이고, 요약 글자도 htmlToText와 같아야 한다
{
  const same = sanitizePostHtml(WELCOME_NOTICE_HTML) === WELCOME_NOTICE_HTML;
  const text = htmlToText(WELCOME_NOTICE_HTML) === WELCOME_NOTICE_TEXT;
  const title = [...WELCOME_NOTICE_TITLE].length <= 100;
  console.log(`${same ? "✅" : "❌"} 첫 공지 본문은 정화해도 그대로`);
  console.log(`${text ? "✅" : "❌"} 첫 공지 요약 글자 = htmlToText`);
  console.log(`${title ? "✅" : "❌"} 첫 공지 제목 100자 이내`);
  if (!same || !text || !title) {
    if (!text) console.log(JSON.stringify(htmlToText(WELCOME_NOTICE_HTML)).slice(0, 300), "\n", JSON.stringify(WELCOME_NOTICE_TEXT).slice(0, 300));
    process.exit(1);
  }
}

// 릴리스 노트 (src/content/release-notes.ts): 버전마다 정화해도 그대로·요약 글자 = htmlToText·제목 100자 이내·버전과 날짜 형식·버전 겹침 없음
{
  const versions = new Set<string>();
  let ok = true;
  for (const note of RELEASE_NOTES) {
    const html = releaseNoteHtml(note);
    const good =
      sanitizePostHtml(html) === html &&
      htmlToText(html) === releaseNoteText(note) &&
      [...releaseNoteTitle(note)].length <= 100 &&
      /^v\d+\.\d+(\.\d+)?$/.test(note.version) &&
      /^\d{4}-\d{2}-\d{2}$/.test(note.date) &&
      !versions.has(note.version);
    versions.add(note.version);
    console.log(`${good ? "✅" : "❌"} 릴리스 노트 ${note.version}`);
    ok &&= good;
  }
  if (!ok) process.exit(1);
}
