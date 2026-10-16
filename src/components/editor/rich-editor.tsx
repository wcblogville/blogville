"use client";

import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { postTextLength } from "@/lib/text-length";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import { useEffect, useRef } from "react";
import { attachmentPath, FILE_TYPES, IMAGE_TYPES } from "@/lib/attachments";
import { ColorTools } from "./color-tools";
import { FileCard } from "./file-card";
import { ToolTip } from "./tool-tip";
import { filesFrom, useAttachmentUpload } from "./use-attachment-upload";
import { IconText, PixelIcon } from "@/components/pixel-icon";
import type { IconName } from "@/lib/art/icons";

const IMAGE_ACCEPT = Object.keys(IMAGE_TYPES).map((e) => `.${e}`).join(",");
const FILE_ACCEPT = Object.keys(FILE_TYPES).map((e) => `.${e}`).join(",");

// 사진은 이 사이트에 올린 것(/files/키)만 에디터에 둔다. 저장할 때 빠질 다른 사이트 사진이 보였다가 사라지지 않게
const imagePath = (src: string | null) => attachmentPath(src, typeof window === "undefined" ? "http://localhost" : window.location.origin);
const PostImage = Image.extend({
  parseHTML() {
    return [{ tag: "img[src]", getAttrs: (el) => (imagePath((el as HTMLElement).getAttribute("src")) ? null : false) }];
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      src: { default: null, parseHTML: (el) => imagePath(el.getAttribute("src")) },
      // 사진 정렬 (사용자 요청 2026-10-16 "사진 중앙 정렬도"): 기본은 왼쪽, 가운데·오른쪽만 data-align으로 적는다 (모양은 globals.css .prose-blog img)
      align: {
        default: null,
        parseHTML: (el) => alignOf(el.getAttribute("data-align")),
        renderHTML: (attrs) => (attrs.align ? { "data-align": attrs.align } : {}),
      },
      // 사진 크기 (사용자 요청 2026-10-16 "첨부한 사진 크기 조절"): 작게·보통·크게, 없으면 원래 크기(본문 너비까지). 너비는 globals.css
      size: {
        default: null,
        parseHTML: (el) => sizeOf(el.getAttribute("data-size")),
        renderHTML: (attrs) => (attrs.size ? { "data-size": attrs.size } : {}),
      },
    };
  },
});

type Align = "left" | "center" | "right";
/** 정렬 버튼 그림: 길이가 다른 줄 네 개를 왼쪽·가운데·오른쪽에 붙인다 (도트처럼 각지게) */
function AlignArt({ to }: { to: Align }) {
  const rows = [14, 9, 14, 9];
  return (
    <svg width="16" height="14" viewBox="0 0 16 14" shapeRendering="crispEdges" aria-hidden>
      {rows.map((w, i) => (
        <rect key={i} x={to === "left" ? 1 : to === "right" ? 15 - w : (16 - w) / 2} y={1 + i * 3.5} width={w} height="2" fill="currentColor" />
      ))}
    </svg>
  );
}

const IMAGE_SIZES = [
  { key: "s", label: "작게" },
  { key: "m", label: "보통" },
  { key: "l", label: "크게" },
  { key: null, label: "원래 크기" },
] as const;
const sizeOf = (v: string | null): "s" | "m" | "l" | null => (v === "s" || v === "m" || v === "l" ? v : null);
const alignOf = (v: string | null): "center" | "right" | null => (v === "center" || v === "right" ? v : null);

/** 정렬 (사용자 요청 2026-10-16 "오른쪽정렬, 왼쪽 정렬, 중앙 정렬"): 사진을 고른 상태면 사진을, 아니면 글 줄(문단·제목)을 정렬한다 */
function setAlign(e: Editor, a: Align) {
  if (e.isActive("image")) e.chain().focus().updateAttributes("image", { align: a === "left" ? null : a }).run();
  else if (a === "left") e.chain().focus().unsetTextAlign().run();
  else e.chain().focus().setTextAlign(a).run();
}
function isAlign(e: Editor, a: Align) {
  if (e.isActive("image")) return (e.getAttributes("image").align ?? "left") === a;
  return a === "left" ? !e.isActive({ textAlign: "center" }) && !e.isActive({ textAlign: "right" }) : e.isActive({ textAlign: a });
}

// 사용자 요청 2026-10-12 "h2 h3 b i u s 이런 것들 가독성 좋게 알기 쉽게 써 놔 줘, 마우스 올리면 어떤 기능인지":
// 짧은 기호 버튼은 아래에 한글 이름(caption)을 늘 보여 주고, 마우스를 올리거나 키보드로 고르면 바로 설명 말풍선(hint)이 뜬다.
type ToolButton = {
  label: string;
  title: string;
  /** 기호 아래에 늘 보이는 한글 이름 (기호만 있는 버튼) */
  caption?: string;
  /** 말풍선 설명 */
  hint: string;
  /** 단축키 */
  keys?: string;
  /** 기호를 그 기능 모양으로 보이게 (굵게는 굵게, 밑줄은 밑줄) */
  glyph?: string;
  /** 글자 앞 도트 아이콘 */
  icon?: IconName;
  /** 기호 대신 그리는 작은 그림 (정렬 줄 모양) */
  art?: React.ReactNode;
  run: (e: Editor) => void;
  active?: (e: Editor) => boolean;
};

const TOOLS: (ToolButton | "sep" | "colors")[] = [
  { label: "H2", title: "큰 제목", caption: "큰 제목", hint: "줄을 큰 소제목으로 바꿔요", keys: "Ctrl(⌘)+Alt+2", glyph: "text-base", run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(), active: (e) => e.isActive("heading", { level: 2 }) },
  { label: "H3", title: "작은 제목", caption: "작은 제목", hint: "줄을 작은 소제목으로 바꿔요", keys: "Ctrl(⌘)+Alt+3", run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(), active: (e) => e.isActive("heading", { level: 3 }) },
  "sep",
  { label: "B", title: "굵게", caption: "굵게", hint: "고른 글자를 굵게 해요", keys: "Ctrl(⌘)+B", glyph: "font-black", run: (e) => e.chain().focus().toggleBold().run(), active: (e) => e.isActive("bold") },
  { label: "I", title: "기울임", caption: "기울임", hint: "고른 글자를 비스듬히 기울여요", keys: "Ctrl(⌘)+I", glyph: "italic font-serif", run: (e) => e.chain().focus().toggleItalic().run(), active: (e) => e.isActive("italic") },
  { label: "U", title: "밑줄", caption: "밑줄", hint: "고른 글자 아래에 줄을 그어요", keys: "Ctrl(⌘)+U", glyph: "underline underline-offset-2", run: (e) => e.chain().focus().toggleUnderline().run(), active: (e) => e.isActive("underline") },
  { label: "S", title: "취소선", caption: "취소선", hint: "고른 글자 가운데에 줄을 그어요", keys: "Ctrl(⌘)+Shift+S", glyph: "line-through", run: (e) => e.chain().focus().toggleStrike().run(), active: (e) => e.isActive("strike") },
  "colors", // 글꼴 색 · 바탕색 · 이모티콘 (color-tools.tsx)
  "sep",
  { label: "", art: <AlignArt to="left" />, title: "왼쪽 정렬", caption: "왼쪽", hint: "줄(사진을 고르면 사진)을 왼쪽에 붙여요", keys: "Ctrl(⌘)+Shift+L", run: (e) => setAlign(e, "left"), active: (e) => isAlign(e, "left") },
  { label: "", art: <AlignArt to="center" />, title: "가운데 정렬", caption: "가운데", hint: "줄(사진을 고르면 사진)을 가운데에 놓아요", keys: "Ctrl(⌘)+Shift+E", run: (e) => setAlign(e, "center"), active: (e) => isAlign(e, "center") },
  { label: "", art: <AlignArt to="right" />, title: "오른쪽 정렬", caption: "오른쪽", hint: "줄(사진을 고르면 사진)을 오른쪽에 붙여요", keys: "Ctrl(⌘)+Shift+R", run: (e) => setAlign(e, "right"), active: (e) => isAlign(e, "right") },
  "sep",
  { label: "• 목록", title: "글머리 목록", hint: "점(•)으로 시작하는 목록을 만들어요", keys: "Ctrl(⌘)+Shift+8", run: (e) => e.chain().focus().toggleBulletList().run(), active: (e) => e.isActive("bulletList") },
  { label: "1. 목록", title: "번호 목록", hint: "1, 2, 3 번호가 붙는 목록을 만들어요", keys: "Ctrl(⌘)+Shift+7", run: (e) => e.chain().focus().toggleOrderedList().run(), active: (e) => e.isActive("orderedList") },
  { label: "❝ 인용", title: "인용", hint: "다른 사람 말이나 글을 옮길 때 쓰는 인용 상자", keys: "Ctrl(⌘)+Shift+B", run: (e) => e.chain().focus().toggleBlockquote().run(), active: (e) => e.isActive("blockquote") },
  { label: "</> 코드", title: "코드 블록", hint: "프로그램 코드를 고정폭 글씨 상자에 넣어요", keys: "Ctrl(⌘)+Alt+C", run: (e) => e.chain().focus().toggleCodeBlock().run(), active: (e) => e.isActive("codeBlock") },
  { label: "― 구분선", title: "구분선", hint: "가로줄을 넣어 내용을 나눠요", run: (e) => e.chain().focus().setHorizontalRule().run() },
  {
    label: "링크",
    icon: "link",
    title: "링크",
    hint: "고른 글자에 인터넷 주소를 걸어요 (비우면 해제)",
    run: (e) => {
      const prev = e.getAttributes("link").href as string | undefined;
      const url = window.prompt("링크 주소 (비우면 링크 해제)", prev ?? "https://");
      if (url === null) return;
      if (!url || url === "https://") e.chain().focus().extendMarkRange("link").unsetLink().run();
      else e.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    },
    active: (e) => e.isActive("link"),
  },
  "sep",
  { label: "↶", title: "되돌리기", caption: "되돌리기", hint: "방금 한 일을 취소해요", keys: "Ctrl(⌘)+Z", glyph: "text-lg", run: (e) => e.chain().focus().undo().run() },
  { label: "↷", title: "다시 실행", caption: "다시 실행", hint: "취소한 일을 다시 해요", keys: "Ctrl(⌘)+Shift+Z", glyph: "text-lg", run: (e) => e.chain().focus().redo().run() },
];

/** 붙여 넣는 HTML 안의 이 사이트 첨부 주소 (/files/키) */
const ATTACHMENT_IN_HTML = /\/files\/[a-f0-9]{32}/;

export function RichEditor({
  initialHtml,
  postId,
  onChange,
  onUploadingChange,
}: {
  initialHtml: string;
  /** 수정 화면이면 글 번호 (붙여 넣은 첨부가 이 글 것인지 판정, FR-047) */
  postId?: number;
  onChange: (html: string, textLength: number) => void;
  /** 첨부를 올리는 동안 true (그동안 발행 버튼을 막는다) */
  onUploadingChange?: (uploading: boolean) => void;
}) {
  // 붙여 넣기·끌어다 놓기는 에디터 설정(처음 한 번 만들어짐) 안에서 불리므로 최신 함수를 ref로 넘긴다
  const uploadRef = useRef<(files: File[], at?: number) => void>(() => {});
  const pasteRef = useRef<(html: string) => void>(() => {});
  const editor = useEditor({
    extensions: [
      PostImage.configure({ inline: false, allowBase64: false }), // 사진 (POST-07)
      FileCard, // 파일 카드 (POST-09)
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: true } }),
      // 글꼴 색(span style="color")·바탕색(mark). 저장할 때 sanitize.ts가 안전한 색 값만 남긴다 (사용자 요청 2026-10-12)
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      // 글 줄 정렬: style="text-align: center|right" (왼쪽은 기본이라 적지 않는다). 저장할 때 sanitize.ts가 이 둘만 남긴다
      TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right"] }),
      Placeholder.configure({ placeholder: "오늘 배운 것, 생각한 것, 무엇이든 적어 보세요" }),
    ],
    content: initialHtml,
    immediatelyRender: false, // 서버 렌더링과 어긋나지 않게 브라우저에서 처음 그린다
    editorProps: {
      attributes: {
        class: "prose-blog min-h-[360px] px-5 py-4 outline-none",
        "aria-label": "본문",
      },
      // 사진·파일을 붙여 넣거나(Ctrl+V) 끌어다 놓으면 올려서 넣는다. 여러 개도 한 번에
      handlePaste: (_view, event) => {
        const files = filesFrom(event.clipboardData?.files);
        const html = event.clipboardData?.getData("text/html") ?? "";
        // 이 사이트 첨부가 든 HTML(다른 글에서 복사한 사진·파일 카드)은 서버에 물어 넣는다 (FR-047, R8)
        if (html && ATTACHMENT_IN_HTML.test(html)) {
          pasteRef.current(html);
          return true;
        }
        if (!files.length) return false;
        // 엑셀·키노트처럼 글자와 그림을 함께 복사하면 글자를 붙여 넣는다 (스크린샷·파일 복사는 글자가 없다)
        if (html && new DOMParser().parseFromString(html, "text/html").body.textContent?.trim()) return false;
        uploadRef.current(files);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        const files = filesFrom(event.dataTransfer?.files);
        if (moved || !files.length) return false;
        event.preventDefault();
        uploadRef.current(files, view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos);
        return true;
      },
      // 에디터 안에서 파일 카드를 누르면 내려받지 않고 고르기만 한다 (링크로 이동하지 않게)
      handleDOMEvents: {
        click: (_view, event) => {
          if ((event.target as Element | null)?.closest?.("a[data-file]")) event.preventDefault();
          return false;
        },
      },
    },
    // 글자 수는 서버가 보상을 판단하는 규칙과 같게 센다 (#18)
    onUpdate: ({ editor }) => onChange(editor.getHTML(), postTextLength(editor.getHTML())),
    onCreate: ({ editor }) => onChange(editor.getHTML(), postTextLength(editor.getHTML())),
  });

  const { upload, pasteHtml, progress, errors, clearErrors } = useAttachmentUpload(editor, postId);
  useEffect(() => {
    uploadRef.current = upload;
    pasteRef.current = pasteHtml;
  }, [upload, pasteHtml]);
  useEffect(() => {
    onUploadingChange?.(!!progress);
  }, [progress, onUploadingChange]);
  // 파일을 에디터 밖(제목·여백)에 떨어뜨려도 브라우저가 그 파일을 열어 쓰던 글을 잃지 않게 막는다
  useEffect(() => {
    const stop = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    window.addEventListener("dragover", stop);
    window.addEventListener("drop", stop);
    return () => {
      window.removeEventListener("dragover", stop);
      window.removeEventListener("drop", stop);
    };
  }, []);
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pick = (input: HTMLInputElement | null) => {
    if (!input) return;
    upload(filesFrom(input.files));
    input.value = ""; // 같은 파일을 다시 고를 수 있게
  };

  // 버튼 활성 상태는 선택이 바뀔 때마다 다시 계산한다
  const active = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor ? TOOLS.map((t) => (typeof t === "object" && t.active ? t.active(editor) : false)) : [],
  });

  // 고른 사진의 크기 (사진을 고르지 않았으면 undefined → 크기 줄을 숨긴다)
  const imageSize = useEditorState({
    editor,
    selector: ({ editor }) => (editor?.isActive("image") ? ((editor.getAttributes("image").size as string | null) ?? null) : undefined),
  });

  return (
    <div data-rich-editor className="pixel-card bg-white focus-within:shadow-[0_-3px_0_0_#d99a36,0_3px_0_0_#d99a36,-3px_0_0_0_#d99a36,3px_0_0_0_#d99a36,0_0_0_6px_#ffd36e66]">
      <div className="pb-plank relative flex flex-wrap items-center gap-1 p-2 [text-shadow:none]" role="toolbar" aria-label="글꼴 도구">
        {TOOLS.map((tool, i) =>
          tool === "sep" ? (
            <span key={i} className="mx-1 h-6 w-[3px] bg-[#ad7445]" aria-hidden />
          ) : tool === "colors" ? (
            <ColorTools key="colors" editor={editor} />
          ) : (
            <button
              key={tool.title}
              type="button"
              aria-label={tool.title}
              aria-pressed={active?.[i] ?? false}
              disabled={!editor}
              onMouseDown={(e) => e.preventDefault()} // 버튼이 포커스를 가져가 커서 위치를 잃지 않게
              onClick={() => editor && tool.run(editor)}
              data-tool={tool.title}
              className={`group relative inline-flex min-h-11 min-w-11 flex-col items-center justify-center whitespace-nowrap px-2.5 text-sm font-bold ${
                active?.[i] ? "pb-tab-on" : "bg-[#fff3d6] text-ink shadow-[inset_0_-3px_0_0_#e0c08e] hover:bg-white"
              }`}
            >
              <span className={`inline-flex items-center gap-1 leading-none ${tool.glyph ?? ""}`} aria-hidden>
                {tool.icon && <PixelIcon name={tool.icon} scale={1} />}
                {tool.art}
                {tool.label}
              </span>
              {tool.caption && (
                <span className="mt-1 text-[10px] font-semibold leading-none opacity-75" aria-hidden>
                  {tool.caption}
                </span>
              )}
              <ToolTip title={tool.title} hint={tool.hint} keys={tool.keys} />
            </button>
          ),
        )}
        <span className="mx-1 h-6 w-[3px] bg-[#ad7445]" aria-hidden />
        <button
          type="button"
          title="사진 올리기 (PNG·JPG·GIF·WEBP, 10MB까지)"
          disabled={!editor || !!progress}
          onClick={() => imageInput.current?.click()}
          className="inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap bg-[#fff3d6] px-2.5 text-sm font-bold text-ink shadow-[inset_0_-3px_0_0_#e0c08e] hover:bg-white disabled:opacity-40"
        >
          <IconText icon="frame">사진</IconText>
        </button>
        <button
          type="button"
          title="파일 올리기 (PDF·한글·오피스·ZIP 등, 30MB까지)"
          disabled={!editor || !!progress}
          onClick={() => fileInput.current?.click()}
          className="inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap bg-[#fff3d6] px-2.5 text-sm font-bold text-ink shadow-[inset_0_-3px_0_0_#e0c08e] hover:bg-white disabled:opacity-40"
        >
          <IconText icon="file">파일</IconText>
        </button>
        <input ref={imageInput} type="file" accept={IMAGE_ACCEPT} multiple hidden aria-label="사진 고르기" onChange={(e) => pick(e.currentTarget)} />
        <input ref={fileInput} type="file" accept={FILE_ACCEPT} multiple hidden aria-label="파일 고르기" onChange={(e) => pick(e.currentTarget)} />
      </div>
      {imageSize !== undefined && (
        <div className="flex flex-wrap items-center gap-1 border-b-2 border-dashed border-[#e2c9a0] bg-[#fff8ec] px-3 py-1.5 text-sm" role="group" aria-label="사진 크기" data-image-size-bar>
          <span className="mr-1 font-bold text-ink-soft">사진 크기</span>
          {IMAGE_SIZES.map((o) => (
            <button
              key={o.label}
              type="button"
              aria-pressed={imageSize === o.key}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor?.chain().focus().updateAttributes("image", { size: o.key }).run()}
              className={`inline-flex min-h-11 items-center px-3 font-bold ${imageSize === o.key ? "pb-tab-on" : "bg-[#fff3d6] text-ink shadow-[inset_0_-3px_0_0_#e0c08e] hover:bg-white"}`}
            >
              {o.label}
            </button>
          ))}
          <span className="ml-2 text-xs text-ink-soft">정렬 버튼으로 사진을 가운데·오른쪽에 놓을 수 있어요</span>
        </div>
      )}
      {(progress || errors.length > 0) && (
        <div className="border-b-2 border-dashed border-[#e2c9a0] bg-[#fff8ec] px-4 py-2 text-sm" role="status" aria-live="polite">
          {progress && (
            <p className="font-bold text-ink-soft">
              {progress.total ? `올리는 중... (${progress.done + 1}/${progress.total})` : "붙여 넣는 중..."}
            </p>
          )}
          {errors.length > 0 && (
            <div className="flex items-start justify-between gap-3">
              <ul className="font-bold text-berry">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={clearErrors}
                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center text-ink-soft hover:text-ink"
                aria-label="안내 닫기"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
