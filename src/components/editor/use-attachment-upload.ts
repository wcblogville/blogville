"use client";

import { TextSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { useCallback, useRef, useState } from "react";
import { classifyPastedAttachments, reuploadAttachment } from "@/app/write/actions";
import { ATTACH_MESSAGES, attachmentKind, attachmentPath, attachmentProblem, attachmentUrl } from "@/lib/attachments";

type Uploaded = { key: string; url: string; kind: "image" | "file"; name: string; size: number };

export const BUSY_MESSAGE = "다른 파일을 올리는 중이에요. 끝난 뒤 다시 넣어 주세요";

/** 파일 하나를 /api/uploads로 올린다. 실패하면 보여줄 문구를 담아 던진다 */
async function uploadOne(file: File): Promise<Uploaded> {
  const body = new FormData();
  body.append("file", file);
  let res: Response;
  try {
    res = await fetch("/api/uploads", { method: "POST", body });
  } catch {
    throw new Error(ATTACH_MESSAGES.failed);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? ATTACH_MESSAGES.failed);
  return data as Uploaded;
}

/**
 * 버튼·붙여 넣기·끌어다 놓기로 고른 파일들을 차례로 올려 본문에 넣는다 (POST-07 사진, POST-09 파일).
 * 사진은 <img>, 나머지는 파일 카드. 형식·크기가 맞지 않는 파일은 건너뛰고 문구로 알려준다
 */
export function useAttachmentUpload(editor: Editor | null, postId?: number) {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const busy = useRef(false);

  const upload = useCallback(
    async (files: File[], at?: number) => {
      if (!editor || !files.length) return;
      if (busy.current) {
        setErrors((prev) => [...prev.filter((e) => e !== BUSY_MESSAGE), BUSY_MESSAGE]);
        return;
      }
      const problems: string[] = [];
      const ok = files.filter((f) => {
        const problem = attachmentProblem(f.name, f.size);
        if (problem) problems.push(`${f.name}: ${problem}`);
        return !problem;
      });
      setErrors(problems);
      if (!ok.length) return;

      busy.current = true;
      // 올리는 동안 사용자가 글을 고쳐도 넣을 자리가 따라가도록 모든 변경에 맞춰 옮긴다
      let pos = at ?? editor.state.selection.to;
      const track = ({ transaction }: { transaction: { mapping: { map: (p: number) => number } } }) => {
        pos = transaction.mapping.map(pos);
      };
      editor.on("transaction", track);
      try {
        for (const [i, file] of ok.entries()) {
          setProgress({ done: i, total: ok.length });
          try {
            const up = await uploadOne(file);
            if (editor.isDestroyed) return;
            const node =
              up.kind === "image"
                ? { type: "image", attrs: { src: up.url, alt: "" } }
                : { type: "fileCard", attrs: { href: up.url, name: up.name, size: up.size } };
            editor.chain().insertContentAt(Math.min(pos, editor.state.doc.content.size), node).run();
            // 방금 넣은 것 바로 뒤. 커서를 글자 자리로 옮겨 두어야 다음 글자가 사진을 덮어쓰지 않는다
            pos = editor.state.selection.to;
            const $end = editor.state.doc.resolve(pos);
            const next = TextSelection.findFrom($end, 1, true) ?? TextSelection.findFrom($end, -1, true);
            if (next) editor.view.dispatch(editor.state.tr.setSelection(next));
          } catch (err) {
            problems.push(`${file.name}: ${err instanceof Error ? err.message : ATTACH_MESSAGES.failed}`);
            setErrors([...problems]);
          }
        }
      } finally {
        editor.off("transaction", track);
        setProgress(null);
        busy.current = false;
      }
      if (editor.isDestroyed) return;
      // 그사이 제목·태그 칸으로 옮겨 갔으면 포커스를 빼앗지 않는다
      const active = document.activeElement;
      const root = editor.view.dom.closest("[data-rich-editor]");
      if (!active || active === document.body || root?.contains(active)) editor.commands.focus();
    },
    [editor],
  );

  /**
   * 이 사이트 첨부(/files/키)가 든 HTML 붙여 넣기 (FR-047, research R8, contracts/write-actions.md §4·§5).
   * keep은 그대로, reupload(내 다른 글·프로필 사진)는 새 첨부로 복사해 주소를 바꾸고, drop(남의 것·없는 키)은 뺀다.
   * 다시 올리는 동안은 파일 올리기와 같이 `올리는 중... (i/n)`을 보이고 버튼을 막는다
   */
  const pasteHtml = useCallback(
    async (html: string) => {
      if (!editor) return;
      if (busy.current) {
        setErrors((prev) => [...prev.filter((e) => e !== BUSY_MESSAGE), BUSY_MESSAGE]);
        return;
      }
      const doc = new DOMParser().parseFromString(html, "text/html");
      const origin = window.location.origin;
      const keyOf = (el: Element) => {
        const path = attachmentPath(el.getAttribute(el.tagName === "IMG" ? "src" : "href"), origin);
        return path ? path.slice("/files/".length) : null;
      };
      const els = [...doc.body.querySelectorAll("img[src], a[data-file]")].filter((el) => keyOf(el));
      const keys = [...new Set(els.map((el) => keyOf(el)!))];

      busy.current = true;
      let pos = editor.state.selection.to;
      const from = editor.state.selection.from;
      const track = ({ transaction }: { transaction: { mapping: { map: (p: number) => number } } }) => {
        pos = transaction.mapping.map(pos);
      };
      editor.on("transaction", track);
      const problems: string[] = [];
      try {
        const res = keys.length ? await classifyPastedAttachments(keys.slice(0, 50), postId) : { items: [] };
        const items = "items" in res ? res.items : [];
        if ("error" in res) problems.push(res.error);
        const action = new Map(items.map((it) => [it.key, it]));
        const replaced = new Map<string, Uploaded | null>();
        const reuploads = items.filter((it) => it.action === "reupload");
        for (const [i, it] of reuploads.entries()) {
          setProgress({ done: i, total: reuploads.length });
          const r = await reuploadAttachment(it.key, postId).catch(() => ({ error: ATTACH_MESSAGES.failed }));
          if ("ok" in r) replaced.set(it.key, r.ok);
          else {
            replaced.set(it.key, null);
            problems.push(`${it.name || "첨부"}: ${ATTACH_MESSAGES.failed}`);
          }
        }
        if (editor.isDestroyed) return;
        for (const el of els) {
          const key = keyOf(el)!;
          const a = action.get(key)?.action ?? "drop";
          if (a === "keep") continue;
          const up = a === "reupload" ? replaced.get(key) : null;
          if (!up) {
            el.remove();
            continue;
          }
          if (el.tagName === "IMG") el.setAttribute("src", attachmentUrl(up.key));
          else {
            el.setAttribute("href", attachmentUrl(up.key));
            el.setAttribute("data-name", up.name);
            el.setAttribute("data-size", String(up.size));
          }
        }
        // 붙여 넣은 자리(선택했던 범위는 바꿔 넣는다)
        const start = Math.min(from, pos);
        editor.chain().insertContentAt({ from: start, to: Math.min(pos, editor.state.doc.content.size) }, doc.body.innerHTML).run();
      } finally {
        editor.off("transaction", track);
        setProgress(null);
        busy.current = false;
        setErrors(problems);
      }
    },
    [editor, postId],
  );

  return { upload, pasteHtml, progress, errors, clearErrors: () => setErrors([]) };
}

/** 붙여 넣기·끌어다 놓기에서 파일만 꺼낸다 */
export function filesFrom(list: FileList | null | undefined): File[] {
  return Array.from(list ?? []).filter((f) => f.size > 0 || attachmentKind(f.name));
}
