"use client";

import type { Editor } from "@tiptap/react";
import { useCallback, useRef, useState } from "react";
import { ATTACH_MESSAGES, attachmentKind, attachmentProblem } from "@/lib/attachments";

type Uploaded = { key: string; url: string; kind: "image" | "file"; name: string; size: number };

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
export function useAttachmentUpload(editor: Editor | null) {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const busy = useRef(false);

  const upload = useCallback(
    async (files: File[], at?: number) => {
      if (!editor || !files.length || busy.current) return;
      const problems: string[] = [];
      const ok = files.filter((f) => {
        const problem = attachmentProblem(f.name, f.size);
        if (problem) problems.push(`${f.name}: ${problem}`);
        return !problem;
      });
      setErrors(problems);
      if (!ok.length) return;

      busy.current = true;
      let pos = at ?? editor.state.selection.to;
      for (const [i, file] of ok.entries()) {
        setProgress({ done: i, total: ok.length });
        try {
          const up = await uploadOne(file);
          const node =
            up.kind === "image"
              ? { type: "image", attrs: { src: up.url, alt: "" } }
              : { type: "fileCard", attrs: { href: up.url, name: up.name, size: up.size } };
          editor.chain().insertContentAt(pos, node).run();
          // 다음 파일은 방금 넣은 것 바로 뒤에
          pos = editor.state.selection.to;
        } catch (err) {
          problems.push(`${file.name}: ${err instanceof Error ? err.message : ATTACH_MESSAGES.failed}`);
          setErrors([...problems]);
        }
      }
      setProgress(null);
      busy.current = false;
      editor.commands.focus();
    },
    [editor],
  );

  return { upload, progress, errors, clearErrors: () => setErrors([]) };
}

/** 붙여 넣기·끌어다 놓기에서 파일만 꺼낸다 */
export function filesFrom(list: FileList | null | undefined): File[] {
  return Array.from(list ?? []).filter((f) => f.size > 0 || attachmentKind(f.name));
}
