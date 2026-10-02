import "server-only";
import sanitizeHtml from "sanitize-html";
import { ATTACHMENT_URL_RE, extensionOf, fileCardLabel, formatBytes } from "@/lib/attachments";

/** 저장할 때 확인한 첨부 정보 (키 → DB의 원래 이름·크기·종류) */
export type KnownAttachments = Map<string, { kind: "image" | "file"; name: string; size: number }>;

const attachmentKey = (url: string | undefined) => ATTACHMENT_URL_RE.exec(url ?? "")?.[1] ?? null;

// 에디터가 만들 수 있는 태그만 허용한다. <script>, onClick 같은 속성은 모두 제거된다 (XSS 방지)
function options(known?: KnownAttachments): sanitizeHtml.IOptions {
  return {
    allowedTags: [
      "p", "br", "h1", "h2", "h3", "strong", "em", "u", "s", "code", "pre",
      "blockquote", "ul", "ol", "li", "a", "hr", "img",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel", "data-file", "data-name", "data-size", "data-size-label", "data-ext", "aria-label"],
      img: ["src", "alt"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: (tagName, attribs): sanitizeHtml.Tag => {
        // 파일 카드 (POST-09): 이름·크기는 요청에 적힌 값 대신 DB 값을 쓴다
        if ("data-file" in attribs) {
          const info = known?.get(attachmentKey(attribs.href) ?? "");
          const name = info?.name ?? attribs["data-name"] ?? "";
          const size = info?.size ?? (Number(attribs["data-size"]) || 0);
          return {
            tagName,
            attribs: {
              href: attribs.href ?? "",
              "data-file": "",
              "data-name": name,
              "data-size": String(size),
              "data-size-label": formatBytes(size),
              "data-ext": extensionOf(name),
              "aria-label": fileCardLabel(name, size),
            },
          };
        }
        // 외부 링크는 새 탭으로, 원래 페이지에 접근하지 못하게
        return { tagName, attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" } };
      },
    },
    // 사진·파일 카드는 우리 저장소 주소(/files/키)만 남긴다. 저장할 때는 DB에 있는 첨부만 (POST-07)
    exclusiveFilter: (frame) => {
      const isImage = frame.tag === "img";
      const isFileCard = frame.tag === "a" && "data-file" in frame.attribs;
      if (!isImage && !isFileCard) return false;
      const key = attachmentKey(isImage ? frame.attribs.src : frame.attribs.href);
      if (!key) return true;
      if (!known) return false;
      const info = known.get(key);
      return !info || info.kind !== (isImage ? "image" : "file");
    },
  };
}

/**
 * 글 HTML 정화. known을 주면 그 첨부만 남기고 파일 카드의 이름·크기를 DB 값으로 맞춘다 (savePost).
 * known 없이 부르면 주소 형식만 확인한다
 */
export function sanitizePostHtml(html: string, known?: KnownAttachments): string {
  return sanitizeHtml(html, options(known));
}

/** HTML 안의 첨부 키 (/files/키) */
export function attachmentKeysIn(html: string): string[] {
  return [...new Set([...html.matchAll(/\/files\/([a-f0-9]{32})/g)].map((m) => m[1]))];
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
