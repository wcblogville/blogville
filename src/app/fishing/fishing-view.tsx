"use client";

import { useState, useTransition } from "react";
import { catchByKey } from "@/lib/fishing";
import { castLine } from "./actions";

export function FishingView({ todayKey }: { todayKey: string | null }) {
  const [pending, start] = useTransition();
  const [key, setKey] = useState(todayKey);
  const [justCaught, setJustCaught] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const caught = key ? catchByKey(key) : null;

  return (
    <div className="card mt-6 flex flex-col items-center gap-3 bg-[#e6f6fb] p-6 text-center">
      <div className={`text-6xl ${pending ? "motion-safe:animate-bounce" : ""}`} aria-hidden>
        {caught ? caught.emoji : "🎣"}
      </div>
      {caught ? (
        <>
          <p role="status" className="font-display text-xl" data-fishing-result={caught.key}>
            {justCaught ? caught.line : `오늘은 ${caught.name}을(를) 낚았어요.`}
          </p>
          <p className="text-sm text-ink-soft">
            {caught.itemCode ? "동물 먹이 1개를 받았어요." : `🪙 ${caught.coins}를 받았어요.`} 내일 다시 낚시할 수 있어요.
          </p>
        </>
      ) : (
        <>
          <p className="font-display text-xl">연못에 낚싯대를 던져 볼까요?</p>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await castLine();
                if (r.ok) {
                  setKey(r.key);
                  setJustCaught(true);
                  setError(null);
                } else setError(r.error);
              })
            }
            className="btn min-h-11 bg-sky px-6 text-white"
          >
            {pending ? "기다리는 중…" : "🎣 낚싯대 던지기"}
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm font-bold text-berry">
          {error}
        </p>
      )}
    </div>
  );
}
