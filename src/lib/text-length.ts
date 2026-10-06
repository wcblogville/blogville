/**
 * 글쓰기 화면의 글자 수. 서버가 보상을 판단할 때 쓰는 htmlToText(sanitizePostHtml(html)).length와
 * 같은 값이 나오도록 같은 규칙으로 센다 (POST-01, GAME-05, #18).
 * - 문단·제목·목록 항목·인용·코드 블록이 끝날 때마다 줄바꿈 1자 (마지막 줄바꿈과 앞뒤 공백은 빼고)
 * - Shift+Enter 줄바꿈(<br>)과 구분선(<hr>)은 0자
 * - 공백·탭이 여러 개면 1자, 빈 줄이 여러 개면 2줄까지만
 * 서버 쪽 sanitize-html은 브라우저에서 쓸 수 없어서, 에디터가 만드는 HTML 범위 안에서 같은 결과를 내는 문자열 처리로 옮겼다.
 * 규칙을 바꾸면 src/server/sanitize.ts의 htmlToText와 scripts/test-text-length.ts를 함께 고친다.
 */
export function postTextLength(html: string): number {
  const text = html
    .replace(/<\/(p|h[1-3]|li|blockquote|pre)>/g, "\n$&")
    .replace(/<[^>]*>/g, "")
    // 엔티티는 서버와 같은 순서로 푼다 (순서가 다르면 "&lt;"를 글자로 쓴 글에서 숫자가 달라진다)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length;
}
