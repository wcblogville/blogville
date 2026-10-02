import "server-only";
import sanitizeHtml from "sanitize-html";

// 에디터가 만들 수 있는 태그만 허용한다. <script>, onClick 같은 속성은 모두 제거된다 (XSS 방지)
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "h1", "h2", "h3", "strong", "em", "u", "s", "code", "pre",
    "blockquote", "ul", "ol", "li", "a", "hr",
  ],
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    // 외부 링크는 새 탭으로, 원래 페이지에 접근하지 못하게
    a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer nofollow" }),
  },
};

export function sanitizePostHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}

/** 태그를 뺀 순수 글자: 요약, 검색, 보상 글자 수 확인용 */
export function htmlToText(html: string): string {
  return sanitizeHtml(html.replace(/<\/(p|h[1-3]|li|blockquote|pre)>/g, "\n$&"), { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function excerpt(text: string, length = 140): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > length ? `${flat.slice(0, length)}…` : flat;
}
