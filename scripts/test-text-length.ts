// 글쓰기 화면 글자 수(postTextLength)가 서버 보상 판단(htmlToText(sanitizePostHtml(html)).length)과 같은지 (#18)
// 실행: npm run test:sanitize (test-sanitize.ts가 이 파일을 불러 함께 실행한다)
import { postTextLength } from "../src/lib/text-length";
import { htmlToText, sanitizePostHtml } from "../src/server/sanitize";

// 에디터(Tiptap getHTML)가 만드는 모양의 HTML
const CASES: [string, string][] = [
  ["빈 본문", "<p></p>"],
  ["한 문단", "<p>안녕하세요</p>"],
  ["두 문단 49자 + 50자", `<p>${"가".repeat(49)}</p><p>${"나".repeat(50)}</p>`],
  ["Shift+Enter 줄바꿈", `<p>${"가".repeat(50)}<br>${"나".repeat(49)}</p>`],
  ["구분선", "<p>위</p><hr><p>아래</p>"],
  ["빈 문단 여러 개", "<p>위</p><p></p><p></p><p></p><p>아래</p>"],
  ["제목과 문단", "<h2>오늘 배운 것</h2><h3>작은 제목</h3><p>내용</p>"],
  ["글머리 목록", "<ul><li><p>하나</p></li><li><p>둘</p></li></ul>"],
  ["번호 목록 안의 목록", "<ol><li><p>바깥</p><ul><li><p>안쪽</p></li></ul></li></ol>"],
  ["인용", "<blockquote><p>인용한 말</p><p>둘째 줄</p></blockquote>"],
  ["코드 블록 여러 줄", '<pre><code class="language-js">const a = 1;\n  return a;\n</code></pre>'],
  ["굵게·기울임·밑줄·취소선·글자 속 코드", "<p><strong>굵게</strong> <em>기울임</em> <u>밑줄</u> <s>취소</s> <code>x</code></p>"],
  ["링크", '<p><a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com">링크 글자</a> 뒤</p>'],
  ["특수 문자", "<p>a &amp; b &lt;tag&gt; \"따옴표\" 'it'</p>"],
  ["엔티티를 글자로 쓴 글", "<p>&amp;lt; &amp;amp; &amp;nbsp; &amp;quot;</p>"],
  ["띄어쓰기 여러 개(nbsp)", "<p>가&nbsp;&nbsp;&nbsp;나 다</p>"],
  ["앞뒤 공백", "<p>&nbsp; 가운데 &nbsp;</p>"],
  ["탭 문자", "<p>가\t\t나</p>"],
  ["이모지", "<p>오늘 ☕ 마시고 😀 웃음</p>"],
  ["구분선만", "<hr>"],
  ["빈 줄만", "<p></p><p></p>"],
  // 사진·파일 카드는 0자 (POST-07, POST-09)
  ["사진", '<p>위</p><img src="/files/0123456789abcdef0123456789abcdef" alt=""><p>아래</p>'],
  ["파일 카드", '<p>위</p><a href="/files/0123456789abcdef0123456789abcdef" data-file="" data-name="보고서.pdf" data-size="1024" data-size-label="1KB" data-ext="pdf" aria-label="보고서.pdf 내려받기 (1KB)"></a><p>아래</p>'],
  ["사진만", '<img src="/files/0123456789abcdef0123456789abcdef" alt="">'],
];

let failed = 0;
for (const [name, html] of CASES) {
  const server = htmlToText(sanitizePostHtml(html)).length;
  const screen = postTextLength(html);
  const ok = server === screen;
  if (!ok) failed++;
  console.log(`${ok ? "✅" : "❌"} ${name}: 화면 ${screen} / 서버 ${server}`);
}
if (failed) process.exit(1);
