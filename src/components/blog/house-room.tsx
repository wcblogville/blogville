"use client";

import Link from "next/link";
import type React from "react";
import { useState, useTransition } from "react";
import { chooseRoofColor, placeFurniture } from "@/app/house/actions";
import { backgroundDataUri, backgroundSky } from "@/lib/art/backgrounds";
import { furnitureDataUri } from "@/lib/art/furniture";
import { ROOM_ART } from "@/lib/art/room";
import { HOUSE_STAGE_LEVELS, houseSvg, ROOF_HEX, toDataUri, type HouseStage } from "@/lib/art/town";
import type { RoofColor } from "@/lib/blog";
import { ROOF_LABELS } from "@/lib/house";
import { RoomResident } from "./room-resident";

type Furniture = { id: number; name: string; assetKey: string };

/** 창밖 장면을 그릴 너비 (px, 4배 도트로 64칸). 가운데 16칸이 창에 보인다 */
const WINDOW_SCENE_WIDTH = 256;

/**
 * 블로그의 "우리 집" 구역 (마을 개편 2차, 사용자 요청 2026-10-08): 집 안 벽·바닥에 가구를 놓고, 🚪 문으로 마을에 나간다.
 * 칸 수는 집 단계(주인 레벨)로 정한다. 주인은 [가구 놓기]로 칸마다 가진 가구를 고르고, [지붕 색]으로 광장에 보일 지붕 색을 고른다.
 * 프로필 카드를 없애고(사용자 요청 2026-10-11) 주인 캐릭터·전시 동물이 방 안 마루를 걷는다(RoomResident).
 * [🏅 도감]은 누구에게나 방 도구 줄에 있다
 */
export function HouseRoom({
  house,
  placed,
  owned,
  roof,
  doorHref,
  highlightDoor = false,
  resident,
  view,
  pet = null,
  collection,
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
  /** 방 안을 걷는 주인 캐릭터 (입은 아바타 아이템 포함) */
  resident: { characterAsset: string; outfit: string[] };
  /** 창밖 풍경: 주인이 고른 배경 장면 (blogs.background_item_id의 asset_key) */
  view: string;
  /** 전시 동물: 주인을 따라 걷는다 */
  pet?: { assetKey: string; name: string; skinKey?: string | null } | null;
  /** [🏅 도감] 버튼 (다 키운 동물 창). 누구에게나 */
  collection: React.ReactNode;
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
    <section className={`pb-card flex flex-col overflow-hidden ${className}`} aria-labelledby="house-title" data-house-room>
      <div className="pb-plank relative z-[1] flex flex-wrap items-center justify-between gap-x-2 gap-y-2.5 px-4 pt-2.5 pb-3">
        <h2 id="house-title" className="font-display text-xl">
          🏠 우리 집 <span className="text-base text-[#fff3d6]">· {house.stage}단계 {house.name}</span>
        </h2>
        {/* 휴대폰: 제목 → 버튼 한 줄 → 칸 안내 순서 (안내가 버튼 사이에 끼지 않게 맨 아래로) */}
        <p className="order-last w-full text-sm text-[#fff3d6] sm:order-none sm:w-auto">
          가구 {placed.filter((p) => p.slot < house.slots).length}/{house.slots}칸
          {house.nextLevel && ` · Lv.${house.nextLevel}에 집이 커져요`}
        </p>
        {/* 버튼 셋은 375px 폰에서도 한 줄 (좁으면 여백·간격을 줄인다) */}
        <div className="flex w-full flex-nowrap gap-2 px-[3px] [text-shadow:none] sm:w-auto sm:gap-2.5 [&>button]:whitespace-nowrap max-sm:[&>button]:px-2">
          {collection}
          {owned && roof && (
            <button
              type="button"
              onClick={() => {
                setRoofOpen(!roofOpen);
                setEditing(false);
                setPicking(null);
                setError(null);
              }}
              aria-pressed={roofOpen}
              className={`pixel-btn min-h-11 pt-1.5 pb-2 text-sm ${roofOpen ? "bg-leaf text-white" : "bg-[#fffaf0] text-ink"}`}
            >
              {roofOpen ? "✓ 다 골랐어요" : "🏠 지붕 색"}
            </button>
          )}
          {owned && (
            <button
              type="button"
              onClick={() => {
                setEditing(!editing);
                setRoofOpen(false);
                setPicking(null);
                setError(null);
              }}
              aria-pressed={editing}
              className={`pixel-btn min-h-11 pt-1.5 pb-2 text-sm ${editing ? "bg-leaf text-white" : "bg-[#fffaf0] text-ink"}`}
            >
              {editing ? "✓ 다 놓았어요" : "🛋 가구 놓기"}
            </button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="mx-4 mt-3 bg-[#ffe4e4] px-3 py-2 text-sm text-berry shadow-[inset_0_0_0_2px_#e7a3a3]">
          {error}
        </p>
      )}

      {/* 방: 블로그 위쪽 너비를 다 쓴다 (프로필 카드를 없앰, 2026-10-11). 휴대폰은 조금 낮게 */}
      <div className="relative h-72 sm:h-80">
        {/* 벽: 도트 줄무늬 벽지와 창문 (src/lib/art/room.ts, 모두 4배 도트) */}
        <div
          className="pixelated absolute inset-x-0 top-0 h-[62%]"
          style={{ backgroundImage: `url("${ROOM_ART.wall}")`, backgroundSize: `${ROOM_ART.tile}px ${ROOM_ART.tile}px` }}
          aria-hidden
        >
          {/* 창: 유리 자리로 주인이 고른 배경 장면(꾸미기의 배경)의 지평선 둘레가 보인다. 장면도 방과 같은 4배 도트 */}
          <div className="absolute left-[12%] top-[14%]" style={{ width: ROOM_ART.windowSize.width, height: ROOM_ART.windowSize.height }} data-window-view={view}>
            <div
              className="pixelated absolute bg-no-repeat"
              style={{
                left: ROOM_ART.windowGlass.x,
                top: ROOM_ART.windowGlass.y,
                width: ROOM_ART.windowGlass.width,
                height: ROOM_ART.windowGlass.height,
                backgroundColor: backgroundSky(view),
                backgroundImage: `url("${backgroundDataUri(view, WINDOW_SCENE_WIDTH, ROOM_ART.scale)}")`,
                // 장면 가운데, 땅 줄(44줄) 바로 위까지: 35~45줄
                backgroundPosition: `-${(WINDOW_SCENE_WIDTH - ROOM_ART.windowGlass.width) / 2}px -${35 * ROOM_ART.scale}px`,
              }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI) */}
            <img src={ROOM_ART.windowFrame} alt="" width={ROOM_ART.windowSize.width} height={ROOM_ART.windowSize.height} className="pixelated absolute inset-0 max-w-none" />
          </div>
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
          <span className="pixel-wood whitespace-nowrap px-1.5 py-0.5 font-display text-xs">🚪 밖으로</span>
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
                  className={`box-content grid place-items-center border-2 border-dashed border-white/90 bg-white/30 hover:bg-white/60 ${furnitureBox}`}
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

        {/* 주인 캐릭터와 전시 동물: 가구 앞 마루를 걷는다. 누르는 칸을 막지 않고, 가구 놓기 중에는 숨긴다 */}
        <RoomResident characterAsset={resident.characterAsset} outfit={resident.outfit} pet={pet} hidden={editing} />

        {roofOpen && roof && (
          <div
            role="dialog"
            aria-label="지붕 색 고르기"
            data-roof-picker
            className="pixel-panel absolute inset-x-4 top-4 z-10 max-h-[calc(100%-2rem)] overflow-y-auto p-3"
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
                      className={`grid h-11 w-11 place-items-center border-[3px] text-sm font-bold text-white ${color === roof.current ? "border-ink shadow-[0_0_0_3px_#ffd36e]" : "border-[#4a3426]"}`}
                      style={{ background: ROOF_HEX[color] }}
                    >
                      {color === roof.current ? "✓" : ""}
                    </button>
                  </li>
                ) : (
                  <li
                    key={color}
                    title={`Lv.${i * HOUSE_STAGE_LEVELS}에 열려요`}
                    className="pb-slot grid h-11 w-11 place-items-center text-[10px] leading-tight text-ink-soft"
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
            className="pixel-panel absolute inset-x-4 top-4 z-10 max-h-[calc(100%-2rem)] overflow-y-auto p-3"
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
                      className={`flex w-20 flex-col items-center p-1 text-xs hover:bg-[#fff3d6] ${here ? "bg-[#ffe7a3] shadow-[inset_0_0_0_3px_#d99a36]" : "pb-slot"}`}
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
                  <button type="button" disabled={pending} onClick={() => choose(picking, null)} className="pb-slot flex h-full w-20 flex-col items-center justify-center p-1 text-xs hover:bg-[#fff3d6]">
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
