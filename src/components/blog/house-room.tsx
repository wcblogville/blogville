"use client";

import Link from "next/link";
import type React from "react";
import { useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { chooseRoofColor, saveFurnitureLayout } from "@/app/house/actions";
import { backgroundDataUri, backgroundSky } from "@/lib/art/backgrounds";
import { furnitureDataUri } from "@/lib/art/furniture";
import { artHit, roomFurnitureArt } from "@/lib/art/room-furniture";
import { floorToScreen, isoRoom, isoRoomDataUri, ROOM_PIXEL, roomCamera, screenToFloor, type IsoRoom, type RoomCamera } from "@/lib/art/room";
import { HOUSE_STAGE_LEVELS, houseSvg, ROOF_HEX, toDataUri, type HouseStage } from "@/lib/art/town";
import type { RoofColor } from "@/lib/blog";
import type { AnimalDisplaySize } from "@/lib/farm";
import { checkLayout, findFreeSpot, fitsRoom, footprintOf, footprintTiles, repairLayout, roomGrid, ROOF_LABELS, WALKABLE_FURNITURE, type FurnitureSpot } from "@/lib/house";
import { ACTION_LABEL, actionOf, layoutDepth } from "@/lib/room-walk";
import { type ResidentControl, RoomResident } from "./room-resident";

type Furniture = { id: number; name: string; assetKey: string };
type Placed = { itemId: number; name: string; assetKey: string; x: number; y: number; flip: boolean };

/** 창밖 장면을 그릴 너비 (px, 4배 도트로 64칸) */
const WINDOW_SCENE_WIDTH = 256;

/**
 * 블로그의 "우리 집" 구역 (마을 개편 2차, 사용자 요청 2026-10-08): 집 안에 가구를 놓고, 🚪 문으로 마을에 나간다.
 * 2026-10-12 "가구 배치 내 마음대로", "평면 말고 정육면체 형태로": 방은 아이소메트릭 상자(마름모 바닥 + 뒤쪽 두 벽, room.ts)이고,
 * 주인은 [🛋 가구 놓기]로 편집에 들어가 가구를 바닥 칸 어디든 끌어 놓고(칸에 맞춰 붙음) 뒤집거나 빼고, 가진 가구를 더한 뒤 [💾 저장]한다.
 * [취소]면 처음 배치로 돌아간다. 놓을 수 있는 개수는 집 단계(주인 레벨), 방 크기도 집 단계로 커진다 (src/lib/house.ts).
 * 키보드: 가구를 고르고(Tab) 방향키로 한 칸씩, Delete로 빼기, F로 뒤집기. 휴대폰은 손가락으로 끈다.
 * 주인 캐릭터·전시 동물이 바닥을 걷는다(RoomResident). [🏅 도감]은 누구에게나 방 도구 줄에 있다
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
  placed: Placed[];
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
  pet?: { assetKey: string; name: string; skinKey?: string | null; size?: AnimalDisplaySize } | null;
  /** [🏅 도감] 버튼 (다 키운 동물 창). 누구에게나 */
  collection: React.ReactNode;
  className?: string;
}) {
  const grid = roomGrid(house.stage);
  const room = useMemo(() => isoRoom(grid), [grid]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<FurnitureSpot[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [roofOpen, setRoofOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // 카메라 (roomCamera, src/lib/art/room.ts): 방이 칸 너비에 안 들어가거나 넓은 방(8×8칸부터)이면 한 걸음 물러나 4배 도트가 3배·2배가 되고,
  // 가구·주인·동물도 같이 작아진다. 휴대폰(좁은 칸)에서는 주인·동물이 한 단계 더 작다. 재기 전에는 방 크기로 정한 CSS 기본값
  const wrapRef = useRef<HTMLDivElement>(null);
  const [camera, setCamera] = useState<RoomCamera | null>(null);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const next = roomCamera({ grid, width: el.clientWidth, dpr: window.devicePixelRatio || 1 });
      setCamera((c) => (c && c.fit === next.fit && c.charScale === next.charScale && c.petScale === next.petScale ? c : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [grid]);
  const fit = camera?.fit;

  const info = useMemo(() => new Map((owned ?? placed.map((p) => ({ id: p.itemId, name: p.name, assetKey: p.assetKey }))).map((f) => [f.id, f])), [owned, placed]);
  // 저장된 배치를 지금 규칙(가구 크기·방 크기)에 맞게 고쳐 읽는다 (repairLayout). 겹치게 된 예전 배치는 빈 자리로 옮겨 보여 주고, 주인이 저장하면 DB에도 남는다
  const repaired = useMemo(() => repairLayout(placed, grid), [placed, grid]);
  const shownSpots: (FurnitureSpot & { name: string; assetKey: string })[] = editing
    ? draft.flatMap((d) => {
        const f = info.get(d.itemId);
        return f ? [{ ...d, name: f.name, assetKey: f.assetKey }] : [];
      })
    : repaired.spots;
  const count = shownSpots.length;
  const keyOf = (id: number) => info.get(id)?.assetKey;

  const openEditor = () => {
    setDraft(repaired.spots.map(({ itemId, x, y, flip }) => ({ itemId, x, y, flip })));
    setSelected(null);
    setEditing(true);
    setRoofOpen(false);
    setError(null);
    setNotice(repaired.moved ? `가구가 커져서 ${repaired.moved}개를 빈 자리로 옮겼어요. [💾 저장]하면 이대로 남아요.` : null);
  };
  const cancel = () => {
    setEditing(false);
    setSelected(null);
    setError(null);
    setNotice(null);
  };
  const save = () =>
    start(async () => {
      const bad = checkLayout(draft, { grid, limit: house.slots, keyOf });
      if (bad) {
        setError(bad);
        return;
      }
      const r = await saveFurnitureLayout(draft);
      if (r.ok) {
        setEditing(false);
        setSelected(null);
        setError(null);
        setNotice("가구 배치를 저장했어요.");
      } else setError(r.error);
    });
  const chooseRoof = (color: RoofColor) =>
    start(async () => {
      const r = await chooseRoofColor(color);
      setError(r.ok ? null : r.error);
    });

  return (
    <section className={`pixel-card flex flex-col overflow-hidden ${className}`} aria-labelledby="house-title" data-house-room>
      <div className="pb-plank relative z-[1] flex flex-wrap items-center justify-between gap-x-2 gap-y-2.5 px-4 pt-2.5 pb-3">
        <h2 id="house-title" className="font-display text-xl">
          🏠 우리 집 <span className="text-base text-[#fff3d6]">· {house.stage}단계 {house.name}</span>
        </h2>
        {/* 휴대폰: 제목 → 버튼 한 줄 → 개수 안내 순서 (안내가 버튼 사이에 끼지 않게 맨 아래로) */}
        <p className="order-last w-full text-sm text-[#fff3d6] sm:order-none sm:w-auto" data-furniture-count>
          가구 {count}/{house.slots}개 · 방 {grid}×{grid}칸
          {house.nextLevel && ` · Lv.${house.nextLevel}에 집이 커져요`}
        </p>
        {/* 버튼 셋은 375px 폰에서도 한 줄 (좁으면 여백·간격을 줄인다) */}
        <div className="flex w-full flex-nowrap gap-2 px-[3px] [text-shadow:none] sm:w-auto sm:gap-2.5 [&>button]:whitespace-nowrap max-sm:[&>button]:px-2">
          {!editing && collection}
          {owned && roof && !editing && (
            <button
              type="button"
              onClick={() => {
                setRoofOpen(!roofOpen);
                setError(null);
                setNotice(null);
              }}
              aria-pressed={roofOpen}
              className={`pixel-btn pixel-btn-sm ${roofOpen ? "bg-leaf text-white" : "bg-[#fffaf0] text-ink"}`}
            >
              {roofOpen ? "✓ 다 골랐어요" : "🏠 지붕 색"}
            </button>
          )}
          {owned && !editing && (
            <button type="button" onClick={openEditor} className="pixel-btn pixel-btn-sm bg-[#fffaf0] text-ink">
              🛋 가구 놓기
            </button>
          )}
          {owned && editing && (
            <>
              <button type="button" onClick={cancel} disabled={pending} className="pixel-btn pixel-btn-sm bg-[#fffaf0] text-ink">
                ✕ 취소
              </button>
              <button type="button" onClick={save} disabled={pending} className="pixel-btn pixel-btn-sm bg-leaf text-white" data-save-layout>
                {pending ? "저장 중…" : "💾 저장"}
              </button>
            </>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="mx-4 mt-3 bg-[#ffe4e4] px-3 py-2 text-sm text-berry shadow-[inset_0_0_0_2px_#e7a3a3]">
          {error}
        </p>
      )}
      {notice && !error && (
        <p role="status" className="mx-4 mt-3 bg-[#e7f7dc] px-3 py-2 text-sm text-ink shadow-[inset_0_0_0_2px_#9fd08a]">
          {notice}
        </p>
      )}

      {/* 방: 아이소메트릭 상자를 가운데에 둔다. 둘레는 어두운 나무색 (밤의 디오라마처럼) */}
      <div
        ref={wrapRef}
        className={`relative flex justify-center overflow-hidden bg-[#3b2a20] bg-[radial-gradient(circle_at_50%_40%,#5a4030_0%,#3b2a20_70%)] py-3 ${grid >= 8 ? "[--fit:0.75]" : "[--fit:1]"} ${grid >= 7 ? "max-sm:[--fit:0.5]" : "max-sm:[--fit:0.75]"}`}
        style={fit ? ({ "--fit": fit } as React.CSSProperties) : undefined}
      >
        <div style={{ width: `calc(${room.width}px * var(--fit))`, height: `calc(${room.height}px * var(--fit))` }} className="relative shrink-0">
          <RoomStage
            room={room}
            spots={shownSpots}
            editing={editing}
            selected={selected}
            setSelected={setSelected}
            setDraft={setDraft}
            setError={setError}
            view={view}
            doorHref={doorHref}
            highlightDoor={highlightDoor}
            resident={resident}
            residentPieces={repaired.spots}
            pet={pet}
            camera={camera}
          />
        </div>

        {roofOpen && roof && (
          <div role="dialog" aria-label="지붕 색 고르기" data-roof-picker className="pixel-panel absolute inset-x-4 top-4 z-[2000] max-h-[calc(100%-2rem)] overflow-y-auto p-3">
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
                  <li key={color} title={`Lv.${i * HOUSE_STAGE_LEVELS}에 열려요`} className="pixel-slot grid h-11 w-11 place-items-center text-[10px] leading-tight text-ink-soft">
                    🔒
                    <br />
                    Lv.{i * HOUSE_STAGE_LEVELS}
                  </li>
                ),
              )}
            </ul>
          </div>
        )}
      </div>

      {editing && owned && (
        <FurnitureTray
          owned={owned}
          draft={draft}
          limit={house.slots}
          grid={grid}
          selected={selected}
          setSelected={setSelected}
          setDraft={setDraft}
          setError={setError}
        />
      )}
    </section>
  );
}

type Spot = FurnitureSpot & { name: string; assetKey: string };
type SetDraft = React.Dispatch<React.SetStateAction<FurnitureSpot[]>>;

/** 다른 가구가 차지한 칸들 (except = 빼고 볼 가구) */
function takenTiles(spots: readonly Spot[], except?: number) {
  const out = new Set<string>();
  for (const s of spots) if (s.itemId !== except) for (const t of footprintTiles(s.assetKey, s)) out.add(t);
  return out;
}
/** 이 가구를 (x, y, flip)에 놓을 수 있는지: 방 안이고 다른 가구와 안 겹친다. 안 되면 보여 줄 문구 */
function placeError(spots: readonly Spot[], s: Spot, at: { x: number; y: number; flip: boolean }, grid: number): string | null {
  if (!fitsRoom(s.assetKey, at, grid)) return "방 밖에는 놓을 수 없어요.";
  const taken = takenTiles(spots, s.itemId);
  return footprintTiles(s.assetKey, at).some((t) => taken.has(t)) ? "그 칸에는 이미 가구가 있어요." : null;
}

/** 차지하는 칸들(x, y에서 w × d)의 바깥 마름모 꼭짓점 (SVG points) */
function diamond(room: IsoRoom, x: number, y: number, w = 1, d = 1) {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + d],
    [x, y + d],
  ]
    .map(([a, b]) => {
      const p = floorToScreen(room, a, b);
      return `${p.x},${p.y}`;
    })
    .join(" ");
}

/** 가구 그림의 방 안 자리 (왼쪽 위 px): 차지하는 칸들의 뒤 꼭짓점에 그림의 기준점을 맞춘다 */
function artBox(room: IsoRoom, s: { assetKey: string; x: number; y: number; flip: boolean }) {
  const art = roomFurnitureArt(s.assetKey);
  const back = floorToScreen(room, s.x, s.y);
  const a = art.anchor(s.flip);
  return { art, left: back.x - a.x, top: back.y - a.y };
}

function RoomStage({
  room,
  spots,
  editing,
  selected,
  setSelected,
  setDraft,
  setError,
  view,
  doorHref,
  highlightDoor,
  resident,
  residentPieces,
  pet,
  camera,
}: {
  room: IsoRoom;
  spots: Spot[];
  editing: boolean;
  selected: number | null;
  setSelected: (id: number | null) => void;
  setDraft: SetDraft;
  setError: (e: string | null) => void;
  view: string;
  doorHref: string;
  highlightDoor: boolean;
  resident: { characterAsset: string; outfit: string[] };
  /** 저장된(편집 전) 가구: 캐릭터가 길을 찾고 쓰는 가구 */
  residentPieces: Spot[];
  pet: { assetKey: string; name: string; skinKey?: string | null; size?: AnimalDisplaySize } | null;
  camera: RoomCamera | null;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<ResidentControl | null>(null);
  // 끄는 중인 가구: 손가락·마우스 아래 칸 (칸이 바뀔 때만 상태가 바뀐다)
  const [drag, setDrag] = useState<{ itemId: number; x: number; y: number; ok: boolean } | null>(null);
  const grab = useRef<{ itemId: number; dx: number; dy: number; moved: boolean; sx: number; sy: number } | null>(null);
  const depth = useMemo(() => layoutDepth(spots), [spots]);

  /** 화면 좌표 → 방 그림 안 px (줄인 배율은 실제 크기로 계산) */
  const toStage = (clientX: number, clientY: number) => {
    const r = stageRef.current!.getBoundingClientRect();
    const k = r.width / room.width;
    return { x: (clientX - r.left) / k, y: (clientY - r.top) / k };
  };
  const inRoom = (x: number, y: number) => x >= 0 && y >= 0 && x < room.grid && y < room.grid;

  /**
   * 누른 곳의 가구: 앞에 있는 가구부터 그림의 칠한 도트 위인지(투명한 곳은 지나간다) → 아니면 그 바닥 칸을 차지한 가구.
   * withWalkable = 러그처럼 밟는 가구도 찾을지 (편집할 때만. 보기에서는 러그 위를 누르면 그 칸으로 걸어간다)
   */
  const pieceAt = (p: { x: number; y: number }, withWalkable: boolean): Spot | null => {
    const order = spots.map((s, i) => ({ s, z: depth.pieceZ[i] })).sort((a, b) => b.z - a.z);
    for (const { s } of order) {
      if (!withWalkable && WALKABLE_FURNITURE.has(s.assetKey)) continue;
      const { art, left, top } = artBox(room, s);
      if (artHit(art, p.x - left, p.y - top, s.flip)) return s;
    }
    const f = screenToFloor(room, p.x, p.y);
    const key = `${Math.floor(f.x)},${Math.floor(f.y)}`;
    return spots.find((s) => (withWalkable || !WALKABLE_FURNITURE.has(s.assetKey)) && footprintTiles(s.assetKey, s).includes(key)) ?? null;
  };

  // ===== 보기: 바닥을 누르면 그 칸으로 걷고, 가구를 누르면 가서 논다 (누구나, 저장하지 않음) =====
  // 잡는 단계(capture)에서 먼저 본다: 가구 그림이 🚪 문 위에 겹쳐 있으면 문보다 가구가 먼저다.
  // 키보드로 누른 단추(detail = 0)는 단추가 직접 처리한다
  const onClickCapture = (e: React.MouseEvent) => {
    if (e.detail === 0) return;
    const p = toStage(e.clientX, e.clientY);
    const piece = pieceAt(p, editing);
    if (editing) {
      if (piece) e.preventDefault();
      return;
    }
    if (!piece && (e.target as HTMLElement).closest("a")) return; // 문
    e.preventDefault();
    e.stopPropagation();
    if (piece) return controlRef.current?.use(piece.itemId);
    const f = screenToFloor(room, p.x, p.y);
    const t = { x: Math.floor(f.x), y: Math.floor(f.y) };
    if (inRoom(t.x, t.y)) controlRef.current?.walkTo(t);
  };

  // ===== 편집: 가구를 끌어 칸에 붙인다 =====
  const dropAt = (clientX: number, clientY: number, g: { dx: number; dy: number }) => {
    const p = toStage(clientX, clientY);
    const f = screenToFloor(room, p.x - g.dx, p.y - g.dy);
    return { x: Math.floor(f.x), y: Math.floor(f.y) };
  };
  const onDown = (e: React.PointerEvent) => {
    if (!editing || e.button > 0) return;
    const p = toStage(e.clientX, e.clientY);
    const s = pieceAt(p, true);
    if (!s) return setSelected(null);
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    // 잡은 점과 뒤 모서리 칸 가운데의 거리를 기억해 손가락이 가구 어디를 잡든 같은 만큼 옮긴다
    const foot = floorToScreen(room, s.x + 0.5, s.y + 0.5);
    grab.current = { itemId: s.itemId, dx: p.x - foot.x, dy: p.y - foot.y, moved: false, sx: e.clientX, sy: e.clientY };
    setSelected(s.itemId);
    setError(null);
    (stageRef.current?.querySelector(`[data-item="${s.itemId}"]`) as HTMLElement | null)?.focus({ preventScroll: true });
  };
  const onMove = (e: React.PointerEvent) => {
    const g = grab.current;
    if (!g) return;
    if (!g.moved && Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < 4) return;
    g.moved = true;
    const s = spots.find((o) => o.itemId === g.itemId);
    if (!s) return;
    const t = dropAt(e.clientX, e.clientY, g);
    const ok = !placeError(spots, s, { ...t, flip: s.flip }, room.grid);
    if (!drag || drag.x !== t.x || drag.y !== t.y || drag.itemId !== g.itemId || drag.ok !== ok) setDrag({ itemId: g.itemId, ...t, ok });
  };
  const onUp = () => {
    const g = grab.current;
    grab.current = null;
    if (!g || !drag) {
      setDrag(null);
      return;
    }
    const s = spots.find((o) => o.itemId === drag.itemId);
    const bad = s ? placeError(spots, s, { x: drag.x, y: drag.y, flip: s.flip }, room.grid) : null;
    if (!bad) setDraft((d) => d.map((o) => (o.itemId === drag.itemId ? { ...o, x: drag.x, y: drag.y } : o)));
    else setError(bad);
    setDrag(null);
  };
  const onKey = (e: React.KeyboardEvent, s: Spot) => {
    const moves: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
    const m = moves[e.key];
    if (m) {
      e.preventDefault();
      setSelected(s.itemId);
      const at = { x: s.x + m[0], y: s.y + m[1], flip: s.flip };
      const bad = placeError(spots, s, at, room.grid);
      if (bad) return setError(bad);
      setError(null);
      setDraft((d) => d.map((o) => (o.itemId === s.itemId ? { ...o, x: at.x, y: at.y } : o)));
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      setDraft((d) => d.filter((o) => o.itemId !== s.itemId));
      setSelected(null);
    } else if (e.key === "f" || e.key === "F") {
      e.preventDefault();
      const bad = flipError(spots, s, room.grid);
      if (bad) return setError(bad);
      setError(null);
      setDraft((d) => d.map((o) => (o.itemId === s.itemId ? { ...o, flip: !o.flip } : o)));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSelected(s.itemId);
    }
  };

  return (
    <div
      ref={stageRef}
      className={`absolute top-0 left-0 origin-top-left ${editing ? "touch-none" : "cursor-pointer"}`}
      style={{ width: room.width, height: room.height, transform: "scale(var(--fit))" }}
      data-room-grid={room.grid}
      data-origin={`${room.origin.x},${room.origin.y}`}
      data-tile-size={`${room.tile.w},${room.tile.h}`}
      data-room-dot={camera?.dot}
      onClickCapture={onClickCapture}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => {
        grab.current = null;
        setDrag(null);
      }}
    >
      {/* 창밖: 주인이 고른 배경 장면(꾸미기의 배경)의 지평선 둘레가 기운 창 유리 너머로 보인다. 장면도 방과 같은 4배 도트 */}
      <div
        className="pixelated absolute bg-no-repeat"
        data-window-view={view}
        style={{
          left: room.glass.x,
          top: room.glass.y,
          width: room.glass.width,
          height: room.glass.height,
          clipPath: room.glass.clip,
          backgroundColor: backgroundSky(view),
          backgroundImage: `url("${backgroundDataUri(view, WINDOW_SCENE_WIDTH, ROOM_PIXEL)}")`,
          // 장면 가운데, 하늘 아래쪽과 땅 줄(44줄) 둘레
          backgroundPosition: `-${(WINDOW_SCENE_WIDTH - room.glass.width) / 2}px -${30 * ROOM_PIXEL}px`,
        }}
      />
      {/* 방 상자: 마름모 마루 + 두 벽 + 창틀 + 문 (한 장의 도트 그림) */}
      {/* eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI) */}
      <img src={isoRoomDataUri(room.grid)} alt="" width={room.width} height={room.height} className="pixelated absolute inset-0 max-w-none select-none" draggable={false} aria-hidden />

      {/* 문: 누르면 마을로 나간다. 휴대폰에는 광장이 없어 숨긴다 (아래 탭으로 다닌다, 2026-10-09) */}
      <Link
        href={doorHref}
        data-house-door
        aria-label="문 열고 마을로 나가기"
        style={{ left: room.door.x, top: room.door.y, width: room.door.width, height: room.door.height }}
        className={`group absolute z-[50] flex flex-col items-center justify-start phone:hidden focus-visible:outline-2 focus-visible:outline-sky ${
          highlightDoor ? "ring-4 ring-sun ring-offset-2 motion-safe:animate-pulse" : ""
        }`}
      >
        <span className="pixel-wood -mt-7 whitespace-nowrap px-1.5 py-0.5 font-display text-xs transition group-hover:-translate-y-0.5">🚪 밖으로</span>
      </Link>

      {/* 편집: 바닥 칸 눈금, 가구마다 차지하는 칸, 끄는 칸 (초록 = 놓을 수 있음, 빨강 = 못 놓음) */}
      {editing && (
        <svg className="pointer-events-none absolute inset-0 z-[60]" width={room.width} height={room.height} aria-hidden>
          {Array.from({ length: room.grid * room.grid }, (_, i) => (
            <polygon key={i} points={diamond(room, i % room.grid, Math.floor(i / room.grid))} fill="#ffffff14" stroke="#fffaf0" strokeOpacity={0.75} strokeWidth={2} strokeDasharray="6 4" />
          ))}
          {spots.map((s) => {
            const { w, d } = footprintOf(s.assetKey, s.flip);
            return (
              <polygon
                key={s.itemId}
                points={diamond(room, s.x, s.y, w, d)}
                data-footprint={`${s.assetKey}:${w}x${d}`}
                fill={selected === s.itemId ? "#ffd36e55" : "#ffffff22"}
                stroke={selected === s.itemId ? "#ffd36e" : "#fffaf0"}
                strokeWidth={3}
              />
            );
          })}
        </svg>
      )}
      {editing && drag && (
        <svg className="pointer-events-none absolute inset-0 z-[1600]" width={room.width} height={room.height} aria-hidden>
          {(() => {
            const s = spots.find((o) => o.itemId === drag.itemId);
            const { w, d } = footprintOf(s?.assetKey, s?.flip);
            return (
              <polygon points={diamond(room, drag.x, drag.y, w, d)} fill={drag.ok ? "#7ed95788" : "#ff6b6b88"} stroke={drag.ok ? "#3f9b2a" : "#c43c3c"} strokeWidth={3} data-drop-target={drag.ok ? "ok" : "blocked"} />
            );
          })()}
        </svg>
      )}

      <ul aria-label="집 안 가구" className="contents">
        {spots.map((s, i) => {
          const dragging = drag?.itemId === s.itemId;
          const at = dragging ? { ...s, x: drag.x, y: drag.y } : s;
          const { art, left, top } = artBox(room, at);
          const { w, d } = footprintOf(s.assetKey, s.flip);
          const style: React.CSSProperties = { left, top, width: art.width, height: art.height, zIndex: dragging ? 1500 : depth.pieceZ[i] };
          const img = (
            // eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI)
            <img
              src={art.uri}
              alt=""
              draggable={false}
              width={art.width}
              height={art.height}
              className={`pixelated block h-full w-full max-w-none select-none ${s.flip ? "-scale-x-100" : ""} ${dragging ? "opacity-80" : ""}`}
            />
          );
          // 마우스·손가락은 방(stage)이 받아 그림의 칠한 도트로 가구를 찾는다. 단추는 키보드·화면 읽기 프로그램용
          return (
            <li key={s.itemId} title={s.name} className="pointer-events-none absolute" style={style} data-furniture={s.assetKey} data-tile={`${s.x},${s.y}`} data-size={`${w}x${d}`} data-flip={s.flip ? "1" : "0"}>
              {editing ? (
                <button
                  type="button"
                  data-item={s.itemId}
                  aria-label={`${s.name} (${s.x + 1}, ${s.y + 1}칸, ${w}×${d}칸) — 끌어서 옮기거나 방향키로 한 칸씩`}
                  aria-pressed={selected === s.itemId}
                  onFocus={() => setSelected(s.itemId)}
                  onKeyDown={(e) => onKey(e, s)}
                  className={`block h-full w-full outline-none ${
                    selected === s.itemId ? "[filter:drop-shadow(0_0_2px_#ffd36e)_drop-shadow(0_0_2px_#ffd36e)]" : ""
                  } focus-visible:[filter:drop-shadow(0_0_2px_#6cb4ee)_drop-shadow(0_0_2px_#6cb4ee)]`}
                >
                  {img}
                </button>
              ) : (
                <button
                  type="button"
                  data-use={s.itemId}
                  aria-label={`${s.name} — ${ACTION_LABEL[actionOf(s.assetKey)]}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    controlRef.current?.use(s.itemId);
                  }}
                  className="block h-full w-full outline-none focus-visible:[filter:drop-shadow(0_0_2px_#6cb4ee)_drop-shadow(0_0_2px_#6cb4ee)]"
                >
                  {img}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {/* 주인 캐릭터와 전시 동물: 누른 칸으로 걷고 가구와 논다. 가구 놓기 중에는 숨긴다 */}
      <RoomResident room={room} pieces={residentPieces} characterAsset={resident.characterAsset} outfit={resident.outfit} pet={pet} hidden={editing} camera={camera} controlRef={controlRef} />
    </div>
  );
}

/** 고른 가구를 뒤집을 수 있는지 (뒤집으면 차지하는 칸의 가로·세로가 바뀐다). 안 되면 문구 */
function flipError(spots: readonly Spot[], s: Spot, grid: number): string | null {
  const bad = placeError(spots, s, { x: s.x, y: s.y, flip: !s.flip }, grid);
  return bad ? "돌리면 방 밖으로 나가거나 다른 가구와 겹쳐요. 빈 곳으로 옮긴 다음 돌려 주세요." : null;
}

/** 편집할 때 방 아래: 고른 가구 도구(뒤집기·빼기), 가진 가구 목록(누르면 빈 칸에 놓기) */
function FurnitureTray({
  owned,
  draft,
  limit,
  grid,
  selected,
  setSelected,
  setDraft,
  setError,
}: {
  owned: Furniture[];
  draft: FurnitureSpot[];
  limit: number;
  grid: number;
  selected: number | null;
  setSelected: (id: number | null) => void;
  setDraft: SetDraft;
  setError: (e: string | null) => void;
}) {
  const sel = selected !== null ? draft.find((d) => d.itemId === selected) : undefined;
  const selInfo = sel && owned.find((f) => f.id === sel.itemId);
  const placedIds = new Set(draft.map((d) => d.itemId));
  const full = draft.length >= limit;
  const keyOf = (id: number) => owned.find((f) => f.id === id)?.assetKey;
  const add = (f: Furniture) => {
    if (placedIds.has(f.id)) return setSelected(f.id);
    if (full) return setError(`지금 집에는 가구를 ${limit}개까지 놓을 수 있어요. 다른 가구를 빼고 넣어 주세요.`);
    const taken = new Set(draft.flatMap((d) => footprintTiles(keyOf(d.itemId), d)));
    const at = findFreeSpot(f.assetKey, taken, grid);
    if (!at) return setError("이 가구가 들어갈 빈 자리가 없어요. 다른 가구를 옮기거나 빼 주세요.");
    setError(null);
    setDraft((d) => [...d, { itemId: f.id, ...at }]);
    setSelected(f.id);
  };
  const flip = (s: FurnitureSpot) => {
    const key = keyOf(s.itemId);
    const at = { x: s.x, y: s.y, flip: !s.flip };
    const taken = new Set(draft.filter((d) => d.itemId !== s.itemId).flatMap((d) => footprintTiles(keyOf(d.itemId), d)));
    if (!fitsRoom(key, at, grid) || footprintTiles(key, at).some((t) => taken.has(t))) return setError("돌리면 방 밖으로 나가거나 다른 가구와 겹쳐요. 빈 곳으로 옮긴 다음 돌려 주세요.");
    setError(null);
    setDraft((d) => d.map((o) => (o.itemId === s.itemId ? { ...o, flip: at.flip } : o)));
  };
  return (
    <div className="pixel-paper border-t-[3px] border-[#4a3426] px-4 py-3" data-furniture-tray>
      <div className="flex min-h-11 flex-wrap items-center gap-2 text-sm">
        {sel && selInfo ? (
          <>
            <span className="font-bold">고른 가구: {selInfo.name}</span>
            <span className="text-xs text-ink-soft" data-selected-size>
              {footprintOf(selInfo.assetKey, sel.flip).w}×{footprintOf(selInfo.assetKey, sel.flip).d}칸
            </span>
            <button type="button" className="pixel-btn pixel-btn-sm bg-[#fffaf0] text-ink" onClick={() => flip(sel)}>
              ↔ 뒤집기
            </button>
            <button
              type="button"
              className="pixel-btn pixel-btn-sm bg-[#fffaf0] text-ink"
              onClick={() => {
                setDraft((d) => d.filter((o) => o.itemId !== sel.itemId));
                setSelected(null);
              }}
            >
              📦 빼기
            </button>
          </>
        ) : (
          <span className="text-ink-soft">가구를 끌어서 바닥 칸에 놓아요. 큰 가구는 여러 칸을 차지하고, 뒤집으면 놓이는 방향이 바뀌어요. 고른 가구는 방향키로 한 칸씩, Delete로 빼기, F로 뒤집기.</span>
        )}
      </div>
      <p className="mt-2 mb-1.5 text-xs font-bold text-ink-soft">
        가진 가구 · 누르면 빈 칸에 놓여요 ({draft.length}/{limit}개)
      </p>
      <ul className="flex flex-wrap gap-2" aria-label="가진 가구">
        {owned.map((f) => {
          const here = placedIds.has(f.id);
          return (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => add(f)}
                aria-pressed={here}
                data-owned={f.id}
                disabled={!here && full}
                className={`flex w-20 flex-col items-center p-1 text-xs hover:bg-[#fff3d6] disabled:opacity-50 ${here ? "bg-[#ffe7a3] shadow-[inset_0_0_0_3px_#d99a36]" : "pixel-slot"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI) */}
                <img src={furnitureDataUri(f.assetKey, 64)} alt="" className="pixelated h-16 w-16" />
                <span className="line-clamp-1">{f.name}</span>
                <span className="text-[10px] text-ink-soft">
                  {footprintOf(f.assetKey).w}×{footprintOf(f.assetKey).d}칸
                </span>
                <span className="text-[10px] text-ink-soft">{here ? "✓ 놓음" : "＋ 놓기"}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-ink-soft">
        가구는 <Link href="/shop" className="underline">상점</Link>에서 더 살 수 있어요. [💾 저장]을 눌러야 다른 사람에게도 보여요.
      </p>
    </div>
  );
}
