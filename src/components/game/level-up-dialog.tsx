"use client";

import { useEffect, useRef } from "react";
import { dismissLevelUp } from "@/app/notifications/actions";

type PopupItem = { id: number; name: string; image: string };

/**
 * 레벨업 팝업 (GAME-06 / FR-038~040). 네이티브 <dialog>를 열어 뒤 화면을 어둡게 한다.
 * [상점 가기]·[확인] 모두 dismissLevelUp 폼이고, Esc는 [확인]과 같다.
 */
export function LevelUpDialog({ level, title, items, moreCount }: { level: number; title: string; items: PopupItem[]; moreCount: number }) {
  const ref = useRef<HTMLDialogElement>(null);
  const stayRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, [level]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="level-up-title"
      onCancel={(e) => {
        // Esc: 닫기만 하면 다음 화면에서 다시 뜨므로 [확인]을 누른 것처럼 읽음으로 한다
        e.preventDefault();
        stayRef.current?.click();
      }}
      className="m-auto w-[min(92vw,26rem)] rounded-3xl border-4 border-sun bg-cream p-6 text-center shadow-2xl backdrop:bg-black/50"
    >
      <p className="text-6xl" aria-hidden>
        🎉
      </p>
      <h2 id="level-up-title" className="mt-2 font-display text-3xl">
        {title}
      </h2>
      {items.length > 0 && (
        <div className="mt-4">
          <p className="font-bold text-ink-soft">이제 이런 친구를 데려올 수 있어요</p>
          <ul className="mt-2 flex flex-wrap justify-center gap-3">
            {items.map((item) => (
              <li key={item.id} className="flex w-24 flex-col items-center gap-1 text-sm">
                {/* eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI) */}
                <img src={item.image} alt="" width={72} height={72} className="pixelated box-content h-[72px] w-[72px] rounded-xl border-2 border-line bg-white object-contain" />
                <span className="break-keep">{item.name}</span>
              </li>
            ))}
          </ul>
          {moreCount > 0 && <p className="mt-1 text-sm text-ink-soft">외 {moreCount}개</p>}
        </div>
      )}
      {/* 서버 응답을 기다리지 않고 바로 닫는다. 광장처럼 무거운 화면은 다시 그리는 데 몇 초 걸려 팝업이 남아 있었다 */}
      <form action={dismissLevelUp} onSubmit={() => ref.current?.close()} className="mt-6 flex justify-center gap-2">
        <input type="hidden" name="level" value={level} />
        <button name="go" value="shop" className="btn min-h-11 bg-leaf px-5 text-white">
          상점 가기
        </button>
        <button ref={stayRef} name="go" value="stay" className="btn min-h-11 border-2 border-line bg-white px-5" autoFocus>
          확인
        </button>
      </form>
    </dialog>
  );
}
