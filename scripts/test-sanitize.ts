// NF-03: 글 HTML 정화가 XSS 공격 문자열을 제거하는지 확인한다
// 실행: npm run test:sanitize
import { htmlToText, sanitizePostHtml } from "../src/server/sanitize";
import { RELEASE_NOTES, releaseNoteHtml, releaseNoteText, releaseNoteTitle } from "../src/content/release-notes";
import { TECH_NOTICE_HTML, TECH_NOTICE_TEXT, TECH_NOTICE_TITLE } from "../src/content/tech-notice";
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

// 글꼴 색·바탕색 (사용자 요청 2026-10-12): span은 color, mark는 background-color 하나만, 안전한 색 값(#hex·rgb())일 때만 남는다
{
  let bad = 0;
  const expect = (name: string, html: string, want: string) => {
    const got = sanitizePostHtml(html);
    const ok = got === want;
    if (!ok) bad++;
    console.log(`${ok ? "✅" : "❌"} ${name.padEnd(22)} → ${got}${ok ? "" : `  (기대: ${want})`}`);
  };
  // 남는 것
  expect("글꼴 색 hex", '<p><span style="color: #D63C3C">빨강</span></p>', '<p><span style="color:#d63c3c">빨강</span></p>');
  expect("글꼴 색 짧은 hex", '<p><span style="color:#f00">빨강</span></p>', '<p><span style="color:#f00">빨강</span></p>');
  expect("글꼴 색 rgb() → hex", '<p><span style="color: rgb(214, 60, 60);">빨강</span></p>', '<p><span style="color:#d63c3c">빨강</span></p>');
  expect(
    "바탕색 mark",
    '<p><mark data-color="#fff176" style="background-color: #fff176; color: inherit">노랑</mark></p>',
    '<p><mark data-color="#fff176" style="background-color:#fff176;color:inherit">노랑</mark></p>',
  );
  expect("바탕색 style만", '<p><mark style="background-color: rgb(255, 241, 118); color: inherit;">노랑</mark></p>', '<p><mark data-color="#fff176" style="background-color:#fff176;color:inherit">노랑</mark></p>');
  expect("색 없는 mark", "<p><mark>형광</mark></p>", "<p><mark>형광</mark></p>");
  // 막는 것: 다른 속성·다른 CSS·위험한 값
  expect("url() 색", '<p><span style="color: url(javascript:alert(1))">x</span></p>', "<p><span>x</span></p>");
  expect("expression()", '<p><span style="color: expression(alert(1))">x</span></p>', "<p><span>x</span></p>");
  expect("이름 색·var()", '<p><span style="color: red">a</span><span style="color: var(--x)">b</span></p>', "<p><span>a</span><span>b</span></p>");
  expect("다른 CSS 섞기", '<p><span style="position: fixed; top: 0; color: #00ff00; font-size: 90px">x</span></p>', '<p><span style="color:#00ff00">x</span></p>');
  expect("배경 이미지", '<p><span style="background: url(https://evil.example/x.png)">x</span></p>', "<p><span>x</span></p>");
  expect("rgb 범위 밖", '<p><span style="color: rgb(999, 0, 0)">x</span></p>', "<p><span>x</span></p>");
  expect("세미콜론 끼우기", '<p><span style="color: #fff; } body { display:none">x</span></p>', '<p><span style="color:#fff">x</span></p>');
  expect("mark 가짜 data-color", '<p><mark data-color="red;position:fixed" style="background-color: #fff176">x</mark></p>', '<p><mark data-color="#fff176" style="background-color:#fff176;color:inherit">x</mark></p>');
  // 정렬 (사용자 요청 2026-10-16): 문단·제목은 text-align 가운데·오른쪽만, 사진은 data-align 가운데·오른쪽만
  expect("문단 가운데", '<p style="text-align: center">x</p>', '<p style="text-align:center">x</p>');
  expect("제목 오른쪽", '<h2 style="text-align: right; color: red">x</h2>', '<h2 style="text-align:right">x</h2>');
  expect("왼쪽·양쪽은 기본으로", '<p style="text-align: left">a</p><p style="text-align: justify">b</p>', "<p>a</p><p>b</p>");
  expect("정렬에 다른 CSS", '<p style="position: fixed; text-align: center; background: url(x)">x</p>', '<p style="text-align:center">x</p>');
  expect("사진 가운데", '<img src="/files/0123456789abcdef0123456789abcdef" data-align="center" />', '<img src="/files/0123456789abcdef0123456789abcdef" data-align="center" />');
  expect("사진 크기", '<img src="/files/0123456789abcdef0123456789abcdef" data-size="m" data-align="right" />', '<img src="/files/0123456789abcdef0123456789abcdef" data-align="right" data-size="m" />');
  expect("사진 이상한 크기", '<img src="/files/0123456789abcdef0123456789abcdef" data-size="999px" width="5000" />', '<img src="/files/0123456789abcdef0123456789abcdef" />');
  expect("사진 이상한 정렬", '<img src="/files/0123456789abcdef0123456789abcdef" data-align="x" style="float:left" />', '<img src="/files/0123456789abcdef0123456789abcdef" />');
  expect("mark onclick·class", '<p><mark class="x" onclick="alert(1)" style="background-color: #fff176">x</mark></p>', '<p><mark data-color="#fff176" style="background-color:#fff176;color:inherit">x</mark></p>');
  expect("p·h2 style 막기", '<p style="color:#f00">x</p><h2 style="background-color:#f00">y</h2>', "<p>x</p><h2>y</h2>");
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

// 기술 소개 공지 (사용자 요청 2026-10-12): 첫 공지와 같이 정화해도 그대로·요약 글자 = htmlToText·제목 100자 이내
{
  const same = sanitizePostHtml(TECH_NOTICE_HTML) === TECH_NOTICE_HTML;
  const text = htmlToText(TECH_NOTICE_HTML) === TECH_NOTICE_TEXT;
  const title = [...TECH_NOTICE_TITLE].length <= 100;
  console.log(`${same && text && title ? "✅" : "❌"} 기술 소개 공지 (정화 그대로 ${same}, 요약 ${text}, 제목 ${title})`);
  if (!same || !text || !title) process.exit(1);
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
