import "server-only";
import sanitizeHtml from "sanitize-html";
import { ATTACHMENT_URL_RE, extensionOf, fileCardLabel, formatBytes } from "@/lib/attachments";
import { SAFE_COLOR_RE } from "@/lib/editor-palette";

/** 저장할 때 확인한 첨부 정보 (키 → DB의 원래 이름·크기·종류) */
export type KnownAttachments = Map<string, { kind: "image" | "file"; name: string; size: number }>;

const attachmentKey = (url: string | undefined) => ATTACHMENT_URL_RE.exec(url ?? "")?.[1] ?? null;

/** style 글자에서 한 속성의 값 (없으면 null). 마지막에 적힌 값을 쓴다 (브라우저와 같게) */
function styleValue(style: string | undefined, prop: string): string | null {
  let found: string | null = null;
  for (const part of (style ?? "").split(";")) {
    const at = part.indexOf(":");
    if (at < 0) continue;
    if (part.slice(0, at).trim().toLowerCase() === prop) found = part.slice(at + 1).trim();
  }
  return found;
}

/**
 * 안전한 색 값이면 #rrggbb(또는 #rgb) 소문자로, 아니면 null.
 * 에디터(ProseMirror)는 style을 브라우저에 맡겨 그리므로 #d63c3c가 rgb(214, 60, 60)으로 바뀌어 온다. 저장은 늘 hex 한 모양으로
 */
function safeColor(value: string | null | undefined): string | null {
  const v = value?.trim().toLowerCase() ?? "";
  if (!SAFE_COLOR_RE.test(v)) return null;
  const rgb = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(v.replace(/\s+/g, ""));
  return rgb ? `#${rgb.slice(1).map((n) => Number(n).toString(16).padStart(2, "0")).join("")}` : v;
}

const ALIGN_RE = /^(center|right)$/;
function alignBlock(tagName: string, attribs: sanitizeHtml.Attributes): sanitizeHtml.Tag {
  const align = styleValue(attribs.style, "text-align")?.trim().toLowerCase();
  return { tagName, attribs: align && ALIGN_RE.test(align) ? { style: `text-align: ${align}` } : {} };
}

// 에디터가 만들 수 있는 태그만 허용한다. <script>, onClick 같은 속성은 모두 제거된다 (XSS 방지)
function options(known?: KnownAttachments): sanitizeHtml.IOptions {
  return {
    allowedTags: [
      "p", "br", "h1", "h2", "h3", "strong", "em", "u", "s", "code", "pre",
      "blockquote", "ul", "ol", "li", "a", "hr", "img",
      // 글꼴 색(span style="color")·바탕색(mark) (사용자 요청 2026-10-12). 다른 CSS는 남기지 않는다
      "span", "mark",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel", "data-file", "data-name", "data-size", "data-size-label", "data-ext", "aria-label"],
      img: ["src", "alt", "data-align", "data-size"],
      span: ["style"],
      // 줄 정렬 (2026-10-16): 문단·제목의 style="text-align: center|right"만
      p: ["style"],
      h2: ["style"],
      h3: ["style"],
      mark: ["style", "data-color"],
    },
    // 아래 transformTags가 색 하나짜리 style로 다시 쓰고, 여기서 한 번 더 값 모양을 확인한다
    allowedStyles: {
      span: { color: [SAFE_COLOR_RE] },
      mark: { "background-color": [SAFE_COLOR_RE], color: [/^inherit$/] },
      p: { "text-align": [ALIGN_RE] },
      h2: { "text-align": [ALIGN_RE] },
      h3: { "text-align": [ALIGN_RE] },
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      // 줄 정렬: text-align 하나만 (가운데·오른쪽). 다른 CSS는 버린다
      p: alignBlock,
      h1: alignBlock,
      h2: alignBlock,
      h3: alignBlock,
      // 사진 정렬·크기: data-align은 가운데·오른쪽, data-size는 작게·보통·크게일 때만 남긴다
      img: (tagName, attribs): sanitizeHtml.Tag => {
        const { "data-align": align, "data-size": size, ...rest } = attribs;
        return {
          tagName,
          attribs: {
            ...rest,
            ...(align === "center" || align === "right" ? { "data-align": align } : {}),
            ...(size === "s" || size === "m" || size === "l" ? { "data-size": size } : {}),
          },
        };
      },
      // 글꼴 색: color 하나만, 안전한 색 값일 때만 남긴다 (font-size·url() 등은 버린다)
      span: (tagName, attribs): sanitizeHtml.Tag => {
        const color = safeColor(styleValue(attribs.style, "color"));
        return { tagName, attribs: color ? { style: `color: ${color}` } : {} };
      },
      // 글꼴 바탕색 (Tiptap Highlight): data-color 또는 background-color 중 안전한 값 하나로 맞춘다. 색이 없으면 기본 형광펜
      mark: (tagName, attribs): sanitizeHtml.Tag => {
        const color = safeColor(attribs["data-color"]) ?? safeColor(styleValue(attribs.style, "background-color"));
        return { tagName, attribs: color ? { "data-color": color, style: `background-color: ${color}; color: inherit` } : {} };
      },
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
