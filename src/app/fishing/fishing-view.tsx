"use client";

import { useState, useTransition } from "react";
import { PixelIcon } from "@/components/pixel-icon";
import { bobberDataUri, catchDataUri, rippleDataUri, splashDataUri } from "@/lib/art/catches";
import { catchByKey } from "@/lib/fishing";
import { withJosa } from "@/lib/josa";
import { castLine } from "./actions";

/** 도트 배율: 낚은 것 5배(100px), 찌 4배, 물보라 4배, 물결 4배 (모두 정수배) */
const CATCH_SCALE = 5;
const FX_SCALE = 4;

/* eslint-disable @next/next/no-img-element -- 코드로 만든 도트 SVG(data URI) */
/**
 * 연못 (2026-10-12 "낚을 수 있는 것들도 도트로"): 물결 위에 찌가 떠 까딱이고(bob), 던지면 입질로 쑥 잠기고(bite),
 * 낚으면 물보라(splash)와 함께 낚은 것이 튀어 오른다(catch-pop). 오늘 이미 낚았으면 낚은 것이 물가에 가만히 있다
 */
function Pond({ caughtKey, pending, justCaught }: { caughtKey: string | null; pending: boolean; justCaught: boolean }) {
  const art = caughtKey ? catchDataUri(caughtKey, CATCH_SCALE) : null;
  return (
    <div className="relative h-52 w-full max-w-80 overflow-hidden" data-pond aria-hidden>
      {/* 물: 물결 한 줄을 가로로 이어 붙이고 아래는 깊은 물 */}
      <div
        className="pixelated absolute inset-x-0 bottom-0 h-16"
        style={{ background: `url("${rippleDataUri(FX_SCALE)}") repeat-x 0 0 / 64px 24px, #6db2d6` }}
      />
      {art ? (
        <>
          {justCaught && (
            <img
              src={splashDataUri(FX_SCALE)}
              alt=""
              width={28 * FX_SCALE}
              height={12 * FX_SCALE}
              className="pixelated absolute bottom-10 left-1/2 -ml-14 origin-bottom opacity-0 motion-safe:animate-[splash_0.9s_steps(6)_both] motion-reduce:hidden"
            />
          )}
          <img
            src={art}
            alt=""
            width={20 * CATCH_SCALE}
            height={20 * CATCH_SCALE}
            data-catch-art={caughtKey}
            className={`pixelated absolute bottom-12 left-1/2 -ml-[50px] ${justCaught ? "motion-safe:animate-[catch-pop_0.9s_steps(9)_both]" : ""}`}
          />
        </>
      ) : (
        <>
          <span className="absolute left-2 top-4">
            <PixelIcon name="rod" scale={6} />
          </span>
          {/* 낚싯줄: 낚싯대 끝에서 찌까지 */}
          <svg className="absolute inset-0 h-full w-full" shapeRendering="crispEdges">
            <line x1="76" y1="20" x2="50%" y2="122" stroke="#4a3426" strokeOpacity="0.55" strokeWidth="2" />
          </svg>
          {/* 낚싯줄 끝의 찌: 떠 있으면 까딱, 기다리는 중이면 쑥쑥 잠긴다 */}
          <img
            src={bobberDataUri(FX_SCALE)}
            alt=""
            width={7 * FX_SCALE}
            height={12 * FX_SCALE}
            data-bobber={pending ? "bite" : "float"}
            className={`pixelated absolute bottom-10 left-1/2 -ml-3.5 ${pending ? "motion-safe:animate-[bite_0.6s_steps(3)_infinite]" : "motion-safe:animate-[bob_1.2s_steps(2)_infinite]"}`}
          />
        </>
      )}
    </div>
  );
}
/* eslint-enable @next/next/no-img-element */

export function FishingView({ todayKey }: { todayKey: string | null }) {
  const [pending, start] = useTransition();
  const [key, setKey] = useState(todayKey);
  const [justCaught, setJustCaught] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const caught = key ? catchByKey(key) : null;

  return (
    <div className="pixel-card mt-4 flex flex-col items-center gap-3 bg-[#e6f6fb]! p-6 text-center">
      <Pond caughtKey={caught?.key ?? null} pending={pending} justCaught={justCaught} />
      {caught ? (
        <>
          <p role="status" className="font-display text-xl" data-fishing-result={caught.key}>
            {justCaught ? caught.line : `오늘은 ${withJosa(caught.name, "을/를")} 낚았어요.`}
          </p>
          <p className="flex flex-wrap items-center justify-center gap-1 text-sm text-ink-soft">
            {caught.itemCode ? (
              "동물 먹이 1개를 받았어요."
            ) : (
              <>
                <PixelIcon name="coin" />
                {withJosa(`코인 ${caught.coins}개`, "을/를")} 받았어요.
              </>
            )}{" "}
            내일 다시 낚시할 수 있어요.
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
            className="pixel-btn flex items-center gap-2 bg-[#2f78b8] px-6 text-white"
          >
            <PixelIcon name="rod" />
            {pending ? "입질을 기다리는 중…" : "낚싯대 던지기"}
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
