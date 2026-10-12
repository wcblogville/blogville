"use client";

import { useEffect, useRef, useState } from "react";
import { joinTags, moveTag, parseTags, TAGS_MAX } from "@/lib/post-rules";

/**
 * 태그 칸 + 순서 바꾸기 (POST-04, 사용자 요청 2026-10-12 "가나다 순서 말고 쓴 순서대로, 바꿀 수 있게").
 * 적은 순서대로 칩을 보여 주고, 칩의 ◀ ▶ 버튼(키보드로도)으로 한 칸씩 옮긴다. 옮기면 칸의 글자도 그 순서로 다시 쓴다.
 * 저장하는 값은 늘 칸의 글자(name="tags") 하나라서 서버·임시 저장은 그대로다
 */
export function TagField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const names = parseTags(value);
  const [notice, setNotice] = useState("");
  // 옮긴 뒤에도 누른 버튼(같은 태그의 같은 방향)에 포커스를 둔다. 끝에 닿아 그 버튼이 꺼지면 반대쪽으로
  const focusAfter = useRef<{ name: string; step: -1 | 1 } | null>(null);
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const want = focusAfter.current;
    if (!want || !list.current) return;
    focusAfter.current = null;
    const item = [...list.current.querySelectorAll<HTMLElement>("[data-tag-chip]")].find((el) => el.dataset.tagChip === want.name);
    const same = item?.querySelector<HTMLButtonElement>(`button[data-step="${want.step}"]:not(:disabled)`);
    (same ?? item?.querySelector<HTMLButtonElement>("button:not(:disabled)"))?.focus();
  });

  const move = (index: number, step: -1 | 1) => {
    const next = moveTag(names, index, step);
    if (next === names) return;
    focusAfter.current = { name: names[index], step };
    setNotice(`#${names[index]} 태그를 ${index + step + 1}번째로 옮겼어요`);
    onChange(joinTags(next));
  };

  return (
    <div className="space-y-2">
      <input
        name="tags"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="태그 (쉼표로 구분, 최대 10개)  예: git, 회고"
        className="pixel-input"
        aria-label="태그"
        maxLength={TAGS_MAX}
      />
      {names.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-[3px]">
          <span className="text-xs text-ink-soft" id="tag-order-help">
            {names.length > 1 ? "보이는 순서대로 저장돼요 · ◀ ▶ 로 순서 바꾸기" : "보이는 순서대로 저장돼요"}
          </span>
          <ul ref={list} className="flex flex-wrap gap-2" aria-label="태그 순서" aria-describedby="tag-order-help" data-tag-order>
            {names.map((name, i) => (
              <li key={name} data-tag-chip={name} className="pixel-slot inline-flex min-h-11 items-center gap-0.5 whitespace-nowrap pl-1 pr-1 text-sm">
                <button
                  type="button"
                  data-step="-1"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`#${name} 앞으로`}
                  title="앞으로"
                  className="inline-flex min-h-9 min-w-9 items-center justify-center text-xs text-ink-soft hover:bg-[#fff3d6] hover:text-ink disabled:opacity-25"
                >
                  ◀
                </button>
                <span className="px-1 font-bold text-ink">#{name}</span>
                <button
                  type="button"
                  data-step="1"
                  onClick={() => move(i, 1)}
                  disabled={i === names.length - 1}
                  aria-label={`#${name} 뒤로`}
                  title="뒤로"
                  className="inline-flex min-h-9 min-w-9 items-center justify-center text-xs text-ink-soft hover:bg-[#fff3d6] hover:text-ink disabled:opacity-25"
                >
                  ▶
                </button>
              </li>
            ))}
          </ul>
          <span className="sr-only" role="status" aria-live="polite">
            {notice}
          </span>
        </div>
      )}
    </div>
  );
}
