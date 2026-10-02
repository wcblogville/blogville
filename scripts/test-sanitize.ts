// NF-03: 글 HTML 정화가 XSS 공격 문자열을 제거하는지 확인한다
// 실행: npm run test:sanitize
import { sanitizePostHtml } from "../src/server/sanitize";
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
