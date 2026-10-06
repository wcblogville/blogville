"use client";

import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { postTextLength } from "@/lib/text-length";
import Image from "@tiptap/extension-image";
import { useEffect, useRef } from "react";
import { attachmentPath, FILE_TYPES, IMAGE_TYPES } from "@/lib/attachments";
import { FileCard } from "./file-card";
import { filesFrom, useAttachmentUpload } from "./use-attachment-upload";

const IMAGE_ACCEPT = Object.keys(IMAGE_TYPES).map((e) => `.${e}`).join(",");
const FILE_ACCEPT = Object.keys(FILE_TYPES).map((e) => `.${e}`).join(",");

// 사진은 이 사이트에 올린 것(/files/키)만 에디터에 둔다. 저장할 때 빠질 다른 사이트 사진이 보였다가 사라지지 않게
const imagePath = (src: string | null) => attachmentPath(src, typeof window === "undefined" ? "http://localhost" : window.location.origin);
const PostImage = Image.extend({
  parseHTML() {
    return [{ tag: "img[src]", getAttrs: (el) => (imagePath((el as HTMLElement).getAttribute("src")) ? null : false) }];
  },
  addAttributes() {
    return { ...this.parent?.(), src: { default: null, parseHTML: (el) => imagePath(el.getAttribute("src")) } };
  },
});

type ToolButton = {
  label: string;
  title: string;
  run: (e: Editor) => void;
  active?: (e: Editor) => boolean;
};

const TOOLS: (ToolButton | "sep")[] = [
  { label: "H2", title: "큰 제목", run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(), active: (e) => e.isActive("heading", { level: 2 }) },
  { label: "H3", title: "작은 제목", run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(), active: (e) => e.isActive("heading", { level: 3 }) },
  "sep",
  { label: "B", title: "굵게", run: (e) => e.chain().focus().toggleBold().run(), active: (e) => e.isActive("bold") },
  { label: "I", title: "기울임", run: (e) => e.chain().focus().toggleItalic().run(), active: (e) => e.isActive("italic") },
  { label: "U", title: "밑줄", run: (e) => e.chain().focus().toggleUnderline().run(), active: (e) => e.isActive("underline") },
  { label: "S", title: "취소선", run: (e) => e.chain().focus().toggleStrike().run(), active: (e) => e.isActive("strike") },
  "sep",
  { label: "• 목록", title: "글머리 목록", run: (e) => e.chain().focus().toggleBulletList().run(), active: (e) => e.isActive("bulletList") },
  { label: "1. 목록", title: "번호 목록", run: (e) => e.chain().focus().toggleOrderedList().run(), active: (e) => e.isActive("orderedList") },
  { label: "❝ 인용", title: "인용", run: (e) => e.chain().focus().toggleBlockquote().run(), active: (e) => e.isActive("blockquote") },
  { label: "</> 코드", title: "코드 블록", run: (e) => e.chain().focus().toggleCodeBlock().run(), active: (e) => e.isActive("codeBlock") },
  { label: "― 구분선", title: "구분선", run: (e) => e.chain().focus().setHorizontalRule().run() },
  {
    label: "🔗 링크",
    title: "링크",
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
  { label: "↶", title: "되돌리기", run: (e) => e.chain().focus().undo().run() },
  { label: "↷", title: "다시 실행", run: (e) => e.chain().focus().redo().run() },
];

export function RichEditor({
  initialHtml,
  onChange,
  onUploadingChange,
}: {
  initialHtml: string;
  onChange: (html: string, textLength: number) => void;
  /** 첨부를 올리는 동안 true (그동안 발행 버튼을 막는다) */
  onUploadingChange?: (uploading: boolean) => void;
}) {
  // 붙여 넣기·끌어다 놓기는 에디터 설정(처음 한 번 만들어짐) 안에서 불리므로 최신 함수를 ref로 넘긴다
  const uploadRef = useRef<(files: File[], at?: number) => void>(() => {});
  const editor = useEditor({
    extensions: [
      PostImage.configure({ inline: false, allowBase64: false }), // 사진 (POST-07)
      FileCard, // 파일 카드 (POST-09)
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: true } }),
      Placeholder.configure({ placeholder: "오늘 배운 것, 생각한 것, 무엇이든 적어 보세요 ✏️" }),
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
        if (!files.length) return false;
        // 엑셀·키노트처럼 글자와 그림을 함께 복사하면 글자를 붙여 넣는다 (스크린샷·파일 복사는 글자가 없다)
        const html = event.clipboardData?.getData("text/html") ?? "";
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

  const { upload, progress, errors, clearErrors } = useAttachmentUpload(editor);
  useEffect(() => {
    uploadRef.current = upload;
  }, [upload]);
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
      editor ? TOOLS.map((t) => (t !== "sep" && t.active ? t.active(editor) : false)) : [],
  });

  return (
    <div data-rich-editor className="overflow-hidden rounded-2xl border-2 border-line bg-white focus-within:border-sun">
      <div className="flex flex-wrap items-center gap-1 border-b-2 border-line bg-cream/60 p-2" role="toolbar" aria-label="글꼴 도구">
        {TOOLS.map((tool, i) =>
          tool === "sep" ? (
            <span key={i} className="mx-1 h-5 w-px bg-line" />
          ) : (
            <button
              key={tool.title}
              type="button"
              title={tool.title}
              aria-pressed={active?.[i] ?? false}
              disabled={!editor}
              onMouseDown={(e) => e.preventDefault()} // 버튼이 포커스를 가져가 커서 위치를 잃지 않게
              onClick={() => editor && tool.run(editor)}
              className={`rounded-lg px-2.5 py-1 text-sm font-bold transition ${
                active?.[i] ? "bg-ink text-cream" : "text-ink-soft hover:bg-white hover:text-ink"
              }`}
            >
              {tool.label}
            </button>
          ),
        )}
        <span className="mx-1 h-5 w-px bg-line" />
        <button
          type="button"
          title="사진 올리기 (PNG·JPG·GIF·WEBP, 10MB까지)"
          disabled={!editor || !!progress}
          onClick={() => imageInput.current?.click()}
          className="rounded-lg px-2.5 py-1 text-sm font-bold text-ink-soft transition hover:bg-white hover:text-ink disabled:opacity-40"
        >
          🖼 사진
        </button>
        <button
          type="button"
          title="파일 올리기 (PDF·한글·오피스·ZIP 등, 30MB까지)"
          disabled={!editor || !!progress}
          onClick={() => fileInput.current?.click()}
          className="rounded-lg px-2.5 py-1 text-sm font-bold text-ink-soft transition hover:bg-white hover:text-ink disabled:opacity-40"
        >
          📎 파일
        </button>
        <input ref={imageInput} type="file" accept={IMAGE_ACCEPT} multiple hidden aria-label="사진 고르기" onChange={(e) => pick(e.currentTarget)} />
        <input ref={fileInput} type="file" accept={FILE_ACCEPT} multiple hidden aria-label="파일 고르기" onChange={(e) => pick(e.currentTarget)} />
      </div>
      {(progress || errors.length > 0) && (
        <div className="border-b-2 border-line bg-cream/40 px-4 py-2 text-sm" role="status" aria-live="polite">
          {progress && (
            <p className="font-bold text-ink-soft">
              올리는 중... ({progress.done + 1}/{progress.total})
            </p>
          )}
          {errors.length > 0 && (
            <div className="flex items-start justify-between gap-3">
              <ul className="font-bold text-berry">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
              <button type="button" onClick={clearErrors} className="shrink-0 text-ink-soft hover:text-ink" aria-label="안내 닫기">
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
