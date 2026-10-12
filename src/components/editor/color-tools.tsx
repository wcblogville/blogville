"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { EMOJI_GROUPS, HIGHLIGHT_COLORS, TEXT_COLORS, type PaletteColor } from "@/lib/editor-palette";
import { ToolTip } from "./tool-tip";

type Panel = "color" | "highlight" | "emoji";

/** 색 없이 칠한 바탕색(mark)이 보이는 색 (globals.css prose-blog mark와 같게) */
const DEFAULT_HIGHLIGHT = "#fff176";

/**
 * 글꼴 색 · 바탕색 · 이모티콘 (사용자 요청 2026-10-12 "글꼴 색, 글꼴 바탕색, 이모티콘 이런거 추가").
 * 버튼 모양은 H2·B 버튼과 같다(기호 + 한글 이름 + 말풍선). 누르면 도구 막대 아래에 작은 도트 창이 열리고,
 * Esc·닫기·바깥을 누르면 닫힌다. 창 안의 칸은 모두 버튼이라 Tab·Enter로도 고를 수 있다
 */
export function ColorTools({ editor }: { editor: Editor | null }) {
  const [open, setOpen] = useState<Panel | null>(null);
  const [group, setGroup] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const triggers = useRef<Partial<Record<Panel, HTMLButtonElement | null>>>({});
  // 지금 커서 자리의 색 (버튼 밑줄·바탕과 팔레트의 고른 칸 표시)
  const current = useEditorState({
    editor,
    selector: ({ editor }) => ({
      color: (editor?.getAttributes("textStyle").color as string | undefined) ?? null,
      highlight: editor?.isActive("highlight") ? ((editor.getAttributes("highlight").color as string | undefined) ?? DEFAULT_HIGHLIGHT) : null,
    }),
  });

  // 열면 창 안 첫 칸(지금 고른 색이 있으면 그 칸)으로 포커스를 옮긴다
  useEffect(() => {
    if (!open || !panel.current) return;
    (panel.current.querySelector<HTMLElement>("[aria-pressed='true']") ?? panel.current.querySelector<HTMLElement>("button"))?.focus();
  }, [open]);
  // 바깥을 누르면 닫는다
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || triggers.current[open]?.contains(t)) return;
      setOpen(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  /** 닫고 연 버튼으로 포커스를 돌려준다 (키보드로 쓰던 자리를 잃지 않게) */
  const shut = () => {
    const was = open;
    setOpen(null);
    if (was) triggers.current[was]?.focus();
  };
  const setColor = (value: string | null) => {
    if (!editor) return;
    if (value) editor.chain().focus().setColor(value).run();
    else editor.chain().focus().unsetColor().run();
    setOpen(null);
  };
  const setHighlight = (value: string | null) => {
    if (!editor) return;
    if (value) editor.chain().focus().setHighlight({ color: value }).run();
    else editor.chain().focus().unsetHighlight().run();
    setOpen(null);
  };
  // 이모티콘은 커서 자리에 넣고 창은 열어 둔다 (여러 개를 이어서 넣을 수 있게)
  const insertEmoji = (emoji: string) => editor?.chain().focus().insertContent(emoji).run();

  const buttons: { id: Panel; title: string; caption: string; hint: string; glyph: React.ReactNode }[] = [
    {
      id: "color",
      title: "글꼴 색",
      caption: "글자색",
      hint: "고른 글자의 색을 바꿔요",
      glyph: (
        <span className="block border-b-[3px] px-0.5 text-base font-black leading-none" style={{ borderColor: current?.color ?? "#3a2a1e" }}>
          가
        </span>
      ),
    },
    {
      id: "highlight",
      title: "글꼴 바탕색",
      caption: "바탕색",
      hint: "고른 글자 뒤에 형광펜처럼 색을 칠해요",
      glyph: (
        <span className="block px-1 text-base font-black leading-tight" style={{ background: current?.highlight ?? DEFAULT_HIGHLIGHT }}>
          가
        </span>
      ),
    },
    { id: "emoji", title: "이모티콘", caption: "이모티콘", hint: "커서 자리에 이모티콘을 넣어요", glyph: <span className="text-base leading-none">😀</span> },
  ];

  const swatches = (colors: PaletteColor[], kind: "color" | "highlight") => {
    const now = (kind === "color" ? current?.color : current?.highlight)?.toLowerCase();
    const pick = kind === "color" ? setColor : setHighlight;
    const label = kind === "color" ? "글꼴 색" : "바탕색";
    return (
      <>
        <p className="mb-2 text-xs font-bold text-ink-soft">{label} 고르기 · 먼저 글자를 고른 뒤 눌러요</p>
        <div className="grid grid-cols-5 gap-1.5">
          {colors.map((c) => (
            <button
              key={c.value}
              type="button"
              onMouseDown={(e) => e.preventDefault()} // 에디터의 고른 글자를 잃지 않게
              onClick={() => pick(c.value)}
              aria-label={`${label} ${c.name}`}
              aria-pressed={now === c.value}
              title={c.name}
              data-swatch={c.value}
              className="flex min-h-11 flex-col items-center justify-center gap-1 bg-white text-[11px] font-bold shadow-[inset_0_0_0_2px_#e0c08e] hover:shadow-[inset_0_0_0_2px_#ad7445] aria-pressed:shadow-[inset_0_0_0_3px_#4a3426]"
            >
              {kind === "color" ? (
                <span className="text-base font-black leading-none" style={{ color: c.value }}>
                  가
                </span>
              ) : (
                <span className="block h-4 w-7" style={{ background: c.value }} />
              )}
              <span className="leading-none text-ink-soft">{c.name}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => pick(null)}
          data-swatch="none"
          className="mt-2 inline-flex min-h-11 w-full items-center justify-center bg-[#fff3d6] text-xs font-bold text-ink shadow-[inset_0_-3px_0_0_#e0c08e] hover:bg-white"
        >
          ✕ {kind === "color" ? "글꼴 색 없애기 (기본 색)" : "바탕색 없애기"}
        </button>
      </>
    );
  };

  return (
    <>
      {buttons.map((b) => (
        <button
          key={b.id}
          ref={(el) => {
            triggers.current[b.id] = el;
          }}
          type="button"
          aria-label={b.title}
          aria-haspopup="dialog"
          aria-expanded={open === b.id}
          disabled={!editor}
          onMouseDown={(e) => e.preventDefault()} // 버튼이 포커스를 가져가 커서 위치를 잃지 않게
          onClick={() => setOpen((o) => (o === b.id ? null : b.id))}
          data-tool={b.title}
          className={`group relative inline-flex min-h-11 min-w-11 flex-col items-center justify-center whitespace-nowrap px-2.5 text-sm font-bold ${
            open === b.id ? "pb-tab-on" : "bg-[#fff3d6] text-ink shadow-[inset_0_-3px_0_0_#e0c08e] hover:bg-white"
          }`}
        >
          <span aria-hidden>{b.glyph}</span>
          <span className="mt-1 text-[10px] font-semibold leading-none opacity-75" aria-hidden>
            {b.caption}
          </span>
          {open !== b.id && <ToolTip title={b.title} hint={b.hint} />}
        </button>
      ))}
      {open && (
        <div
          ref={panel}
          role="dialog"
          aria-label={buttons.find((b) => b.id === open)?.title}
          data-palette={open}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              shut();
            }
          }}
          className="pixel-panel absolute left-2 top-full z-30 mt-2 w-[min(22rem,calc(100%-1rem))] p-3 text-ink"
        >
          {open === "color" && swatches(TEXT_COLORS, "color")}
          {open === "highlight" && swatches(HIGHLIGHT_COLORS, "highlight")}
          {open === "emoji" && (
            <>
              <div className="mb-2 flex gap-1" role="tablist" aria-label="이모티콘 분류">
                {EMOJI_GROUPS.map((g, i) => (
                  <button
                    key={g.name}
                    type="button"
                    role="tab"
                    aria-selected={group === i}
                    aria-label={g.name}
                    title={g.name}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setGroup(i)}
                    className={`inline-flex min-h-11 flex-1 items-center justify-center text-lg ${group === i ? "pb-tab-on" : "bg-[#fff3d6] hover:bg-white"}`}
                  >
                    {g.icon}
                  </button>
                ))}
              </div>
              <p className="mb-1 text-xs font-bold text-ink-soft">{EMOJI_GROUPS[group].name} · 누르면 커서 자리에 들어가요</p>
              <div className="grid grid-cols-8 gap-0.5" role="tabpanel" aria-label={EMOJI_GROUPS[group].name}>
                {EMOJI_GROUPS[group].items.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertEmoji(emoji)}
                    aria-label={`이모티콘 ${emoji} 넣기`}
                    data-emoji={emoji}
                    className="inline-flex aspect-square min-h-9 items-center justify-center text-xl hover:bg-[#fff3d6] focus-visible:bg-[#fff3d6]"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </>
          )}
          <button type="button" onClick={shut} className="mt-2 inline-flex min-h-11 w-full items-center justify-center text-xs text-ink-soft hover:text-ink">
            닫기 (Esc)
          </button>
        </div>
      )}
    </>
  );
}
