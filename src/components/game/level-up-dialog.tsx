"use client";

import { useEffect, useRef } from "react";
import { dismissLevelUp } from "@/app/notifications/actions";
import { PixelIcon } from "@/components/pixel-icon";

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
      className="pixel-dialog w-[min(92vw,26rem)] text-center"
    >
      {/* 나무 간판 머리 + 반짝이는 별 (도트) */}
      <div className="pixel-wood flex items-center justify-center gap-2 px-4 py-2 font-display text-lg">
        <PixelIcon name="star" />
        LEVEL UP!
        <PixelIcon name="star" />
      </div>
      <div className="p-6 pt-5">
        <p className="flex justify-center motion-safe:animate-[hop_0.9s_steps(2)_infinite]" aria-hidden>
          <PixelIcon name="gift" scale={5} />
        </p>
        <h2 id="level-up-title" className="pixel-heading mt-3 justify-center text-3xl">
          {title}
        </h2>
        {items.length > 0 && (
          <div className="mt-4">
            <p className="font-bold text-ink-soft">이제 이런 친구를 데려올 수 있어요</p>
            <ul className="mt-2 flex flex-wrap justify-center gap-3">
              {items.map((item) => (
                <li key={item.id} className="flex w-24 flex-col items-center gap-1 text-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI) */}
                  <img src={item.image} alt="" width={72} height={72} className="pixelated pixel-slot box-content h-[72px] w-[72px] object-contain p-1" />
                  <span className="break-keep">{item.name}</span>
                </li>
              ))}
            </ul>
            {moreCount > 0 && <p className="mt-1 text-sm text-ink-soft">외 {moreCount}개</p>}
          </div>
        )}
        {/* 서버 응답을 기다리지 않고 바로 닫는다. 광장처럼 무거운 화면은 다시 그리는 데 몇 초 걸려 팝업이 남아 있었다 */}
        <form action={dismissLevelUp} onSubmit={() => ref.current?.close()} className="mt-6 flex justify-center gap-4">
          <input type="hidden" name="level" value={level} />
          <button name="go" value="shop" className="pixel-btn min-h-11 bg-leaf-dark px-5 text-white">
            상점 가기
          </button>
          <button ref={stayRef} name="go" value="stay" className="pixel-btn min-h-11 bg-white px-5 text-ink" autoFocus>
            확인
          </button>
        </form>
      </div>
    </dialog>
  );
}
