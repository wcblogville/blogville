"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { PixelIcon } from "@/components/pixel-icon";
import { bobberDataUri, catchDataUri, rippleDataUri, splashDataUri } from "@/lib/art/catches";
import { catchByKey, type CastTiming, formatSize, TIER_CLASS, TIER_LABEL, TIMING_TEXT } from "@/lib/fishing";
import { FISHING_RULES } from "@/lib/game";
import { withJosa } from "@/lib/josa";
import { reelIn, startCast } from "./actions";

/** 도트 배율: 낚은 것 5배(100px), 찌 4배, 물보라 4배, 물결 4배, 오늘 낚은 칸 2배 (모두 정수배) */
const CATCH_SCALE = 5;
const FX_SCALE = 4;

/** idle = 던지기 전, waiting = 찌를 지켜보는 중, bite = 입질(지금 당기면 딱 맞음), missed = 입질이 지나감, reeling = 당기는 중 */
type Phase = "idle" | "waiting" | "bite" | "missed" | "reeling";
export type TodayCast = {
  castNo: number;
  catchKey: string;
  sizeMm: number | null;
  coins: number;
};
type Fresh = {
  key: string;
  sizeMm: number | null;
  coins: number;
  timing: CastTiming;
};

/* eslint-disable @next/next/no-img-element -- 코드로 만든 도트 SVG(data URI) */
/**
 * 연못: 물결 위에 찌가 떠 까딱이고(bob), 입질이 오면 쑥 잠기고(bite), 낚으면 물보라(splash)와 함께 낚은 것이 튀어 오른다(catch-pop).
 * 던지기 전에 오늘 낚은 것이 있으면 마지막 것이 물가에 가만히 있다
 */
function Pond({ caughtKey, phase, justCaught }: { caughtKey: string | null; phase: Phase; justCaught: boolean }) {
  const art = caughtKey ? catchDataUri(caughtKey, CATCH_SCALE) : null;
  const bobber = phase === "bite" ? "bite" : phase === "reeling" ? "reel" : "float";
  return (
    <div className="relative h-52 w-full max-w-80 overflow-hidden" data-pond aria-hidden>
      <div
        className="pixelated absolute inset-x-0 bottom-0 h-16"
        style={{
          background: `url("${rippleDataUri(FX_SCALE)}") repeat-x 0 0 / 64px 24px, #6db2d6`,
        }}
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
          <svg className="absolute inset-0 h-full w-full" shapeRendering="crispEdges">
            <line x1="76" y1="20" x2="50%" y2={phase === "bite" ? 134 : 122} stroke="#4a3426" strokeOpacity="0.55" strokeWidth="2" />
          </svg>
          {/* 입질: 찌가 쑥 잠기고 위에 "!" (움직임 줄이기면 잠기지 않고 "!"만) */}
          {phase === "bite" && (
            <span className="font-display absolute bottom-24 left-1/2 ml-3 text-3xl font-bold text-berry" data-bite-mark>
              !
            </span>
          )}
          <img
            src={bobberDataUri(FX_SCALE)}
            alt=""
            width={7 * FX_SCALE}
            height={12 * FX_SCALE}
            data-bobber={bobber}
            className={`pixelated absolute left-1/2 -ml-3.5 ${phase === "bite" ? "bottom-7 motion-safe:animate-[bite_0.5s_steps(3)_infinite]" : "bottom-10 motion-safe:animate-[bob_1.2s_steps(2)_infinite]"}`}
          />
        </>
      )}
    </div>
  );
}

/** 오늘 던진 칸 (하루 3칸): 낚은 것 도트 2배, 남은 칸은 빈 칸 */
function CastSlots({ casts }: { casts: TodayCast[] }) {
  return (
    <ol className="flex gap-2" aria-label="오늘 낚은 것">
      {Array.from({ length: FISHING_RULES.castsPerDay }, (_, i) => {
        const c = casts.find((x) => x.castNo === i + 1);
        const info = c ? catchByKey(c.catchKey) : null;
        const src = c ? catchDataUri(c.catchKey, 2) : null;
        return (
          <li
            key={i}
            className="pixel-slot grid size-14 place-items-center"
            data-cast-slot={c ? c.catchKey : "empty"}
            title={info?.name ?? `${i + 1}번째 낚싯대`}
          >
            {src ? (
              <img src={src} alt={info?.name ?? ""} width={40} height={40} className="pixelated" />
            ) : (
              <span className="text-xs text-ink-soft">{i + 1}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
/* eslint-enable @next/next/no-img-element */

export function FishingView({ casts }: { casts: TodayCast[] }) {
  const [pending, start] = useTransition();
  const [phase, setPhase] = useState<Phase>("idle");
  const [fresh, setFresh] = useState<Fresh | null>(null);
  const [error, setError] = useState<string | null>(null);
  const token = useRef<string | null>(null);
  const timers = useRef<number[]>([]);
  const reelButton = useRef<HTMLButtonElement>(null);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const remaining = Math.max(0, FISHING_RULES.castsPerDay - casts.length);
  const last = casts.at(-1) ?? null;
  // 연못에 보여 줄 것: 방금 낚은 것 → (던지기 전이고 남은 게 없으면) 오늘 마지막
  const shownKey = phase === "idle" ? (fresh?.key ?? (remaining === 0 ? last?.catchKey : null) ?? null) : null;
  const caught = fresh ? catchByKey(fresh.key) : null;

  const cast = () =>
    start(async () => {
      setError(null);
      const r = await startCast();
      if (!r.ok) {
        setError(r.error);
        return;
      }
      token.current = r.token;
      setFresh(null);
      setPhase("waiting");
      clearTimers();
      timers.current.push(
        window.setTimeout(() => {
          setPhase("bite");
          navigator.vibrate?.(150);
          reelButton.current?.focus();
        }, r.delayMs),
        // 입질 창이 지나면 찌가 다시 뜬다 (서버는 조금 더 넉넉히 봐준다)
        window.setTimeout(() => setPhase((p) => (p === "bite" ? "missed" : p)), r.delayMs + FISHING_RULES.hitWindowMs - 300),
      );
    });

  const reel = () =>
    start(async () => {
      if (!token.current) return;
      clearTimers();
      setPhase("reeling");
      const r = await reelIn(token.current);
      token.current = null;
      setPhase("idle");
      if (r.ok) {
        setFresh({
          key: r.key,
          sizeMm: r.sizeMm,
          coins: r.coins,
          timing: r.timing,
        });
        setError(null);
      } else setError(r.error);
    });

  const casting = phase === "waiting" || phase === "bite" || phase === "missed" || phase === "reeling";
  const status =
    phase === "waiting"
      ? "찌를 지켜보세요… 쑥 잠기면 당기세요!"
      : phase === "bite"
        ? "찌가 쑥! 지금 당기세요!"
        : phase === "missed"
          ? "찌가 다시 떠올랐어요. 그래도 당기면 평소처럼 건져요."
          : phase === "reeling"
            ? "영차, 끌어올리는 중…"
            : null;

  return (
    <div className="pixel-card mt-4 flex flex-col items-center gap-3 bg-[#e6f6fb]! p-6 text-center" data-fishing-phase={phase}>
      <Pond caughtKey={shownKey} phase={phase} justCaught={!!fresh && phase === "idle"} />
      <CastSlots casts={casts} />

      {casting ? (
        <>
          <p role="status" aria-live="assertive" className={`font-display text-xl ${phase === "bite" ? "text-berry" : ""}`} data-fishing-status={phase}>
            {status}
          </p>
          <button
            ref={reelButton}
            type="button"
            disabled={phase === "reeling"}
            onClick={reel}
            className={`pixel-btn flex min-h-12 items-center gap-2 px-8 text-white ${phase === "bite" ? "bg-berry" : "bg-[#2f78b8]"}`}
            data-reel
          >
            <PixelIcon name="fish" />
            {phase === "bite" ? "지금 당기기!" : "당기기"}
          </button>
          <p className="text-xs text-ink-soft">타이밍이 어려우면 아무 때나 당겨도 돼요. 평소 확률로 무언가를 낚아요.</p>
        </>
      ) : (
        <>
          {fresh && caught ? (
            <div role="status" className="flex flex-col items-center gap-1" data-fishing-result={caught.key} data-timing={fresh.timing}>
              <p className="font-display text-xl">{caught.line}</p>
              <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
                <span className={`pixel-badge ${TIER_CLASS[caught.tier]}`} data-tier={caught.tier}>
                  {TIER_LABEL[caught.tier]}
                </span>
                {fresh.sizeMm !== null && (
                  <b data-catch-size={fresh.sizeMm}>
                    {caught.name} {formatSize(fresh.sizeMm)}
                  </b>
                )}
                <span className="text-ink-soft">{TIMING_TEXT[fresh.timing]}</span>
              </p>
              <p className="flex flex-wrap items-center justify-center gap-1 text-sm text-ink-soft">
                {caught.itemCode ? (
                  "동물 먹이 1개를 받았어요."
                ) : (
                  <>
                    <PixelIcon name="coin" />
                    {withJosa(`코인 ${fresh.coins}개`, "을/를")} 받았어요.
                  </>
                )}
              </p>
            </div>
          ) : (
            <p className="font-display text-xl">{remaining > 0 ? "연못에 낚싯대를 던져 볼까요?" : "오늘 낚싯대는 다 던졌어요."}</p>
          )}
          {remaining > 0 ? (
            <button type="button" disabled={pending} onClick={cast} className="pixel-btn flex min-h-12 items-center gap-2 bg-[#2f78b8] px-6 text-white">
              <PixelIcon name="rod" />
              {pending ? "던지는 중…" : `낚싯대 던지기 (${remaining}번 남음)`}
            </button>
          ) : (
            <p className="text-sm text-ink-soft" data-fishing-done>
              내일 다시 세 번 던질 수 있어요.
            </p>
          )}
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
