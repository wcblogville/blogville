"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { placeFurniture } from "@/app/house/actions";
import { furnitureDataUri } from "@/lib/art/furniture";

type Furniture = { id: number; name: string; assetKey: string };

/**
 * 블로그의 "우리 집" 구역 (마을 개편 2차, 사용자 요청 2026-10-08): 집 안 벽·바닥에 가구를 놓고, 🚪 문으로 마을에 나간다.
 * 칸 수는 집 단계(주인 레벨)로 정한다. 주인은 [가구 놓기]로 칸마다 가진 가구를 고른다
 */
export function HouseRoom({
  house,
  placed,
  owned,
  doorHref,
  highlightDoor = false,
}: {
  house: { stage: number; name: string; slots: number; nextLevel: number | null };
  placed: { slot: number; itemId: number; name: string; assetKey: string }[];
  /** 주인에게만: 가진 가구. null이면 보는 사람 (가구 놓기 없음) */
  owned: Furniture[] | null;
  doorHref: string;
  /** 처음 가입한 회원에게 문을 반짝여 알려 준다 */
  highlightDoor?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const bySlot = new Map(placed.map((p) => [p.slot, p]));
  // 2·3단계(6·8칸)는 휴대폰에서 두 줄(뒷줄·앞줄)로 놓는다. 한 줄이면 7·8번 칸이 카드 밖으로 넘쳐 누를 수 없었다
  const twoRows = house.slots > 4;

  const choose = (slot: number, itemId: number | null) =>
    start(async () => {
      const r = await placeFurniture(slot, itemId);
      setError(r.ok ? null : r.error);
      setPicking(null);
    });

  return (
    <section className="card mt-4 overflow-hidden" aria-labelledby="house-title" data-house-room>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
        <h2 id="house-title" className="font-display text-xl">
          🏠 우리 집 <span className="text-base text-ink-soft">· {house.stage}단계 {house.name}</span>
        </h2>
        <p className="text-sm text-ink-soft">
          가구 {placed.filter((p) => p.slot < house.slots).length}/{house.slots}칸
          {house.nextLevel && ` · Lv.${house.nextLevel}에 집이 커져요`}
        </p>
        {owned && (
          <button
            type="button"
            onClick={() => {
              setEditing(!editing);
              setPicking(null);
              setError(null);
            }}
            aria-pressed={editing}
            className={`btn min-h-11 text-sm ${editing ? "bg-leaf text-white" : "bg-white text-ink"}`}
          >
            {editing ? "✓ 다 놓았어요" : "🛋 가구 놓기"}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mx-4 mt-2 rounded-xl bg-[#ffe4e4] px-3 py-2 text-sm text-berry">
          {error}
        </p>
      )}

      <div className="relative mt-3 h-56 border-t-2 border-line sm:h-64">
        {/* 벽: 줄무늬 벽지와 창문 */}
        <div
          className="absolute inset-x-0 top-0 h-[62%]"
          style={{ background: "repeating-linear-gradient(90deg, #fff4dc 0 22px, #fbe9c6 22px 44px)" }}
          aria-hidden
        >
          <div className="absolute left-[12%] top-[18%] h-16 w-20 rounded-lg border-[3px] border-[#4a3426] bg-[#bfe8ff] sm:h-20 sm:w-24">
            <div className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-[#4a3426]" />
            <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-[#4a3426]" />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-3 bg-[#d9b98a]" />
        </div>
        {/* 바닥: 나무 마루 */}
        <div
          className="absolute inset-x-0 bottom-0 h-[38%]"
          style={{ background: "repeating-linear-gradient(0deg, #d89a63 0 18px, #c98a55 18px 20px)" }}
          aria-hidden
        />

        {/* 문: 누르면 마을로 나간다 */}
        <Link
          href={doorHref}
          data-house-door
          aria-label="문 열고 마을로 나가기"
          className={`group absolute bottom-[34%] right-[5%] flex h-[56%] w-16 flex-col items-center justify-end rounded-t-full border-[3px] border-[#4a3426] bg-[#9b6a43] pb-2 shadow-md transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-sky sm:w-20 ${
            highlightDoor ? "ring-4 ring-sun ring-offset-2 motion-safe:animate-pulse" : ""
          }`}
        >
          <span className="absolute right-2 top-1/2 h-2.5 w-2.5 rounded-full border border-[#4a3426] bg-sun" aria-hidden />
          <span className="whitespace-nowrap rounded-full bg-white/90 px-1.5 py-0.5 text-[11px] font-bold text-ink shadow-sm">🚪 밖으로</span>
        </Link>

        {/* 가구 칸: 바닥 위에 한 줄 (휴대폰에서 6·8칸은 두 줄) */}
        <ul
          className={`absolute bottom-[6%] left-[3%] right-[24%] items-end justify-around gap-1 ${twoRows ? "grid grid-cols-4 justify-items-center sm:flex" : "flex"}`}
          aria-label="집 안 가구"
        >
          {Array.from({ length: house.slots }, (_, slot) => {
            const item = bySlot.get(slot);
            if (!editing) {
              return item ? (
                <li key={slot} title={item.name} data-furniture={item.assetKey}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI) */}
                  <img src={furnitureDataUri(item.assetKey, 160)} alt={item.name} className="h-14 w-14 drop-shadow sm:h-20 sm:w-20" />
                </li>
              ) : (
                <li key={slot} className="h-14 w-14 sm:h-20 sm:w-20" aria-hidden />
              );
            }
            return (
              <li key={slot} className="relative">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setPicking(picking === slot ? null : slot)}
                  aria-label={item ? `${slot + 1}번 칸: ${item.name} 바꾸기` : `${slot + 1}번 칸에 가구 놓기`}
                  data-slot={slot}
                  className="grid h-14 w-14 place-items-center rounded-xl border-2 border-dashed border-white/90 bg-white/30 hover:bg-white/60 sm:h-20 sm:w-20"
                >
                  {item ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI)
                    <img src={furnitureDataUri(item.assetKey, 160)} alt="" className="h-full w-full" />
                  ) : (
                    <span className="text-2xl text-white drop-shadow" aria-hidden>
                      ＋
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {editing && picking !== null && owned && (
          <div
            role="dialog"
            aria-label={`${picking + 1}번 칸에 놓을 가구`}
            // 가구가 많으면 방 높이를 넘어 잘리므로 창 안에서 스크롤한다
            className="absolute inset-x-3 top-3 z-10 max-h-[calc(100%-1.5rem)] overflow-y-auto rounded-2xl bg-white p-3 shadow-lg"
          >
            <p className="mb-2 text-sm font-bold">{picking + 1}번 칸에 놓을 가구를 골라 주세요</p>
            <ul className="flex flex-wrap gap-2">
              {owned.map((f) => {
                const here = bySlot.get(picking)?.itemId === f.id;
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      disabled={pending || here}
                      onClick={() => choose(picking, f.id)}
                      className={`flex w-20 flex-col items-center rounded-xl border-2 p-1 text-xs hover:bg-cream ${here ? "border-sun bg-[#fff3d6]" : "border-line"}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI) */}
                      <img src={furnitureDataUri(f.assetKey, 120)} alt="" className="h-12 w-12" />
                      <span className="line-clamp-1">{f.name}</span>
                    </button>
                  </li>
                );
              })}
              {bySlot.has(picking) && (
                <li>
                  <button type="button" disabled={pending} onClick={() => choose(picking, null)} className="flex h-full w-20 flex-col items-center justify-center rounded-xl border-2 border-line p-1 text-xs hover:bg-cream">
                    <span className="text-2xl" aria-hidden>
                      🧹
                    </span>
                    비우기
                  </button>
                </li>
              )}
            </ul>
            <p className="mt-2 text-xs text-ink-soft">
              가구는 <Link href="/shop" className="underline">상점</Link>에서 더 살 수 있어요.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
