import { mergeAttributes, Node } from "@tiptap/core";
import { attachmentPath, extensionOf, fileCardLabel, formatBytes } from "@/lib/attachments";

const pathOf = (url: string | null) =>
  attachmentPath(url, typeof window === "undefined" ? "http://localhost" : window.location.origin);

/**
 * 본문의 파일 카드 (POST-09): <a href="/files/키" data-file data-name data-size ...></a>
 * 아이콘·이름·크기는 글자로 넣지 않고 속성으로만 담아 CSS가 그린다 (globals.css의 prose-blog a[data-file]).
 * 그래서 보상 글자 수(content_text)에 섞이지 않는다
 */
export const FileCard = Node.create({
  name: "fileCard",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      href: { default: "", parseHTML: (el) => pathOf(el.getAttribute("href")) ?? "" },
      name: { default: "", parseHTML: (el) => el.getAttribute("data-name") ?? "" },
      size: { default: 0, parseHTML: (el) => Number(el.getAttribute("data-size")) || 0 },
    };
  },

  parseHTML() {
    // 링크(Link) 표시보다 먼저 파일 카드로 읽되, 이 사이트 첨부 주소(/files/키)인 것만.
    // 붙여 넣은 HTML의 javascript:·다른 사이트 주소는 카드가 되지 않고 Link 규칙으로 넘어간다
    return [{ tag: "a[data-file]", priority: 1000, getAttrs: (el) => (pathOf((el as HTMLElement).getAttribute("href")) ? null : false) }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const name = String(node.attrs.name);
    const size = Number(node.attrs.size);
    return [
      "a",
      mergeAttributes(
        { href: pathOf(String(HTMLAttributes.href ?? "")) },
        {
          "data-file": "",
          "data-name": name,
          "data-size": String(size),
          "data-size-label": formatBytes(size),
          "data-ext": extensionOf(name),
          "aria-label": fileCardLabel(name, size),
        },
      ),
    ];
  },
});
