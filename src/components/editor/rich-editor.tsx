"use client";

import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

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
}: {
  initialHtml: string;
  onChange: (html: string, textLength: number) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: true } }),
      Placeholder.configure({ placeholder: "오늘 배운 것, 생각한 것, 무엇이든 적어 보세요 ✏️" }),
      CharacterCount,
    ],
    content: initialHtml,
    immediatelyRender: false, // 서버 렌더링과 어긋나지 않게 브라우저에서 처음 그린다
    editorProps: {
      attributes: {
        class: "prose-blog min-h-[360px] px-5 py-4 outline-none",
        "aria-label": "본문",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML(), editor.storage.characterCount.characters()),
    onCreate: ({ editor }) => onChange(editor.getHTML(), editor.storage.characterCount.characters()),
  });

  // 버튼 활성 상태는 선택이 바뀔 때마다 다시 계산한다
  const active = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor ? TOOLS.map((t) => (t !== "sep" && t.active ? t.active(editor) : false)) : [],
  });

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-line bg-white focus-within:border-sun">
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
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
