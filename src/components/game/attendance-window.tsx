"use client";

import { useEffect, useRef } from "react";

/**
 * 마을 게시판의 출석 체크 창 (GAME-04, 사용자 요청 2026-10-11 "마을 게시판 들어가면 출석체크 창 없음").
 * 광장 게시판으로 들어오면(/feed?board=1) 창이 먼저 열리고, 닫으면 마을 소식이 보인다. 위쪽 띠의 [📅 출석부 열기]로 다시 연다.
 * 창 안 내용(오늘 결과·보상표·달력)은 서버가 그린 children. 네이티브 <dialog>라 Esc로 닫힌다
 */
export function AttendanceWindow({
  openAtStart,
  summary,
  children,
}: {
  openAtStart: boolean;
  summary: React.ReactNode;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!openAtStart) return;
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    // 새로고침하면 다시 뜨지 않게 ?board=1을 지운다 (DropSearchParam과 같은 방법)
    const url = new URL(window.location.href);
    if (url.searchParams.has("board")) {
      url.searchParams.delete("board");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
  }, [openAtStart]);

  return (
    <>
      <div className="pixel-panel mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3" data-attendance-strip>
        <div className="min-w-0 flex-1 text-sm">{summary}</div>
        <button type="button" className="pixel-btn min-h-11 shrink-0 bg-sun px-3 text-sm text-ink" onClick={() => ref.current?.showModal()}>
          📅 출석부 열기
        </button>
      </div>
      <dialog
        ref={ref}
        aria-labelledby="attendance-window-title"
        data-attendance-window
        onClick={(e) => {
          // 창 바깥(어두운 배경)을 누르면 닫는다
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="pixel-dialog max-h-[92dvh] w-[min(94vw,34rem)] overflow-y-auto"
      >
        <div className="pixel-wood sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-2">
          <h2 id="attendance-window-title" className="font-display text-xl">
            📮 출석 체크
          </h2>
          <form method="dialog">
            <button className="pixel-btn min-h-11 min-w-11 bg-white px-3 text-sm text-ink" aria-label="출석 체크 창 닫기" autoFocus>
              ✕ 닫기
            </button>
          </form>
        </div>
        <div className="grid gap-4 p-4 sm:p-5">{children}</div>
        <form method="dialog" className="px-4 pb-5 sm:px-5">
          <button className="pixel-btn min-h-11 w-full bg-leaf-dark text-white">📋 마을 소식 보러 가기</button>
        </form>
      </dialog>
    </>
  );
}
