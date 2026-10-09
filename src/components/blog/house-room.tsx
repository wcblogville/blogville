"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { chooseRoofColor, placeFurniture } from "@/app/house/actions";
import { furnitureDataUri } from "@/lib/art/furniture";
import { ROOM_ART } from "@/lib/art/room";
import { HOUSE_STAGE_LEVELS, houseSvg, ROOF_HEX, toDataUri, type HouseStage } from "@/lib/art/town";
import type { RoofColor } from "@/lib/blog";
import { ROOF_LABELS } from "@/lib/house";

type Furniture = { id: number; name: string; assetKey: string };

/**
 * 블로그의 "우리 집" 구역 (마을 개편 2차, 사용자 요청 2026-10-08): 집 안 벽·바닥에 가구를 놓고, 🚪 문으로 마을에 나간다.
 * 칸 수는 집 단계(주인 레벨)로 정한다. 주인은 [가구 놓기]로 칸마다 가진 가구를 고르고, [지붕 색]으로 광장에 보일 지붕 색을 고른다
 */
export function HouseRoom({
  house,
  placed,
  owned,
  roof,
  doorHref,
  highlightDoor = false,
  className = "",
}: {
  house: { stage: HouseStage; name: string; slots: number; nextLevel: number | null };
  placed: { slot: number; itemId: number; name: string; assetKey: string }[];
  /** 주인에게만: 가진 가구. null이면 보는 사람 (가구 놓기 없음) */
  owned: Furniture[] | null;
  /** 주인에게만: 지붕 색 (TOWN-07). order = 이 집의 색 순서, 앞에서 unlocked개가 열렸다 */
  roof: { current: RoofColor; order: RoofColor[]; unlocked: number } | null;
  doorHref: string;
  /** 처음 가입한 회원에게 문을 반짝여 알려 준다 */
  highlightDoor?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState<number | null>(null);
  const [roofOpen, setRoofOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const bySlot = new Map(placed.map((p) => [p.slot, p]));
  // 2·3단계(6·8칸)는 휴대폰에서 두 줄(뒷줄·앞줄)로 놓는다. 한 줄이면 7·8번 칸이 카드 밖으로 넘쳐 누를 수 없었다
  const twoRows = house.slots > 4;
  // 가구 그림 크기: 32칸 그림의 2배(64px), 넓은 화면에서 4칸 집은 3배(96px). 정수배라 도트가 고르다
  const furnitureBox = twoRows ? "h-16 w-16" : "h-16 w-16 sm:h-24 sm:w-24";

  const choose = (slot: number, itemId: number | null) =>
    start(async () => {
      const r = await placeFurniture(slot, itemId);
      setError(r.ok ? null : r.error);
      setPicking(null);
    });
  const chooseRoof = (color: RoofColor) =>
    start(async () => {
      const r = await chooseRoofColor(color);
      setError(r.ok ? null : r.error);
    });

  return (
    <section className={`card flex flex-col overflow-hidden ${className}`} aria-labelledby="house-title" data-house-room>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
        <h2 id="house-title" className="font-display text-xl">
          🏠 우리 집 <span className="text-base text-ink-soft">· {house.stage}단계 {house.name}</span>
        </h2>
        <p className="text-sm text-ink-soft">
          가구 {placed.filter((p) => p.slot < house.slots).length}/{house.slots}칸
          {house.nextLevel && ` · Lv.${house.nextLevel}에 집이 커져요`}
        </p>
        {owned && (
          <div className="flex flex-wrap gap-2">
            {roof && (
              <button
                type="button"
                onClick={() => {
                  setRoofOpen(!roofOpen);
                  setEditing(false);
                  setPicking(null);
                  setError(null);
                }}
                aria-pressed={roofOpen}
                className={`btn min-h-11 text-sm ${roofOpen ? "bg-leaf text-white" : "bg-white text-ink"}`}
              >
                {roofOpen ? "✓ 다 골랐어요" : "🏠 지붕 색"}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setEditing(!editing);
                setRoofOpen(false);
                setPicking(null);
                setError(null);
              }}
              aria-pressed={editing}
              className={`btn min-h-11 text-sm ${editing ? "bg-leaf text-white" : "bg-white text-ink"}`}
            >
              {editing ? "✓ 다 놓았어요" : "🛋 가구 놓기"}
            </button>
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="mx-4 mt-2 rounded-xl bg-[#ffe4e4] px-3 py-2 text-sm text-berry">
          {error}
        </p>
      )}

      {/* 방은 옆 프로필 카드와 높이를 맞추려고 남는 높이를 채운다 (넓은 화면). 좁으면 최소 높이 */}
      <div className="relative mt-3 min-h-56 flex-1 border-t-2 border-line sm:min-h-64">
        {/* 벽: 도트 줄무늬 벽지와 창문 (src/lib/art/room.ts, 모두 4배 도트) */}
        <div
          className="pixelated absolute inset-x-0 top-0 h-[62%]"
          style={{ backgroundImage: `url("${ROOM_ART.wall}")`, backgroundSize: `${ROOM_ART.tile}px ${ROOM_ART.tile}px` }}
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI) */}
          <img src={ROOM_ART.window} alt="" width={ROOM_ART.windowSize.width} height={ROOM_ART.windowSize.height} className="pixelated absolute left-[12%] top-[14%] max-w-none" />
          <div className="absolute inset-x-0 bottom-0 h-3 border-y-4 border-[#4a3426] bg-[#d9b98a]" />
        </div>
        {/* 바닥: 도트 나무 마루 */}
        <div
          className="pixelated absolute inset-x-0 bottom-0 h-[38%]"
          style={{ backgroundImage: `url("${ROOM_ART.floor}")`, backgroundSize: `${ROOM_ART.tile}px ${ROOM_ART.tile}px` }}
          aria-hidden
        />

        {/* 문: 누르면 마을로 나간다. 휴대폰에는 광장이 없어 숨긴다 (아래 탭으로 다닌다, 2026-10-09) */}
        <Link
          href={doorHref}
          data-house-door
          aria-label="문 열고 마을로 나가기"
          style={{ backgroundImage: `url("${ROOM_ART.door}")`, width: ROOM_ART.doorSize.width, height: ROOM_ART.doorSize.height }}
          className={`pixelated group absolute bottom-[34%] right-[5%] flex flex-col phone:hidden items-center justify-end rounded-t-full pb-2 transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-sky ${
            highlightDoor ? "ring-4 ring-sun ring-offset-2 motion-safe:animate-pulse" : ""
          }`}
        >
          <span className="whitespace-nowrap rounded-full bg-white/90 px-1.5 py-0.5 text-[11px] font-bold text-ink shadow-sm">🚪 밖으로</span>
        </Link>

        {/* 가구 칸: 바닥 위에 한 줄 (휴대폰에서 6·8칸은 두 줄) */}
        <ul
          className={`absolute bottom-[6%] left-[3%] right-[24%] items-end phone:right-[3%] justify-around gap-1 ${twoRows ? "grid grid-cols-4 justify-items-center sm:flex" : "flex"}`}
          aria-label="집 안 가구"
        >
          {Array.from({ length: house.slots }, (_, slot) => {
            const item = bySlot.get(slot);
            if (!editing) {
              return item ? (
                <li key={slot} title={item.name} data-furniture={item.assetKey}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI) */}
                  <img src={furnitureDataUri(item.assetKey, 96)} alt={item.name} className={`pixelated ${furnitureBox}`} />
                </li>
              ) : (
                <li key={slot} className={furnitureBox} aria-hidden />
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
                  className={`box-content grid place-items-center rounded-xl border-2 border-dashed border-white/90 bg-white/30 hover:bg-white/60 ${furnitureBox}`}
                >
                  {item ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI)
                    <img src={furnitureDataUri(item.assetKey, 96)} alt="" className={`pixelated ${furnitureBox}`} />
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

        {roofOpen && roof && (
          <div
            role="dialog"
            aria-label="지붕 색 고르기"
            data-roof-picker
            className="absolute inset-x-3 top-3 z-10 max-h-[calc(100%-1.5rem)] overflow-y-auto rounded-2xl bg-white p-3 shadow-lg"
          >
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI) */}
              <img src={toDataUri(houseSvg(house.stage, ROOF_HEX[roof.current]))} alt="" className="h-20 w-20 shrink-0 object-contain" />
              <div className="min-w-0 text-sm">
                <p className="font-bold">광장에 보일 지붕 색을 골라 주세요</p>
                <p className="text-ink-soft">
                  처음 색은 무작위로 받았어요. 집이 한 단계 클 때마다 색이 하나씩 늘어요 ({roof.unlocked}/{roof.order.length}색).
                </p>
              </div>
            </div>
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="지붕 색">
              {roof.order.map((color, i) =>
                i < roof.unlocked ? (
                  <li key={color}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => chooseRoof(color)}
                      aria-pressed={color === roof.current}
                      aria-label={`${ROOF_LABELS[color]} 지붕`}
                      title={ROOF_LABELS[color]}
                      data-roof={color}
                      className={`grid h-11 w-11 place-items-center rounded-full border-[3px] text-sm font-bold text-white ${color === roof.current ? "border-ink" : "border-white shadow"}`}
                      style={{ background: ROOF_HEX[color] }}
                    >
                      {color === roof.current ? "✓" : ""}
                    </button>
                  </li>
                ) : (
                  <li
                    key={color}
                    title={`Lv.${i * HOUSE_STAGE_LEVELS}에 열려요`}
                    className="grid h-11 w-11 place-items-center rounded-full border-2 border-dashed border-line bg-cream text-[10px] leading-tight text-ink-soft"
                  >
                    🔒
                    <br />
                    Lv.{i * HOUSE_STAGE_LEVELS}
                  </li>
                ),
              )}
            </ul>
          </div>
        )}

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
                      <img src={furnitureDataUri(f.assetKey, 64)} alt="" className="pixelated h-16 w-16" />
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
