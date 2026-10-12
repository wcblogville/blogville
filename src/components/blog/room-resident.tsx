"use client";

// 우리 집 방 안의 주인 캐릭터와 전시 동물 (사용자 요청 2026-10-11 "캐릭터랑 전시할 동물은 집으로 옮겨 주라").
// 프로필 카드를 없애면서 미니룸의 주인·전시 동물이 집 안 마루로 왔다. 주인은 광장과 같은 걷기 그림판(walk.ts)으로
// 마루를 이리저리 걷고, 전시 동물은 그 뒤를 통통 뛰며 따라간다. 움직임 줄이기 설정이면 가만히 서 있는다.
// 도트: 캐릭터 24칸 틀 × 4배(96px, 방 벽지·마루와 같은 배율), 동물 32칸 × 3배(96px, 가구와 같은 배율).
// 동물 크기는 종마다 다르고(ANIMAL_SIZE, 그림판은 같은 96px) 주인과의 거리도 동물 폭에 맞춘다 (작은 동물은 바짝)
import { useEffect, useRef } from "react";
import { lookKey } from "@/lib/art/characters";
import {
  ANIMAL_SIZE,
  animalHalfWidth,
  hasAnimalArt,
  PET_IDLE_FRAMES,
  PET_SHEET_FRAMES,
  PET_WALK_FRAMES,
  PET_WALK_LIFT,
  petSheetDataUri,
} from "@/lib/art/animals";
import { WALK_FPS, WALK_FRAMES, walkSheetDataUri, type WalkDir } from "@/lib/art/walk";
import type { AnimalDisplaySize } from "@/lib/farm";

const SCALE = 4;
const BOX = 24 * SCALE; // 걷기 그림판 한 칸 (96px)
const PET_BOX = 96;
const ROWS: Record<WalkDir, number> = { down: 0, left: 1, right: 2, up: 3 };
/** 걷는 빠르기 (px/초), 통통 뛰는 높이 (동물 도트 3배의 정수배) */
const SPEED = 46;
/** 동물이 서는 거리 = 주인 반폭(8칸 × 4) + 동물 반폭(칸 × 3) + 여백 */
const petGap = (assetKey: string, size?: AnimalDisplaySize) => 8 * SCALE + animalHalfWidth(assetKey, size) * 3 + 6;
/** 걷기 그림 한 칸 시간, 숨쉬기 한 칸 시간 (ms). 뛰는 높이는 PET_WALK_LIFT × 동물 도트 3배 */
const PET_HOP_MS = 100;
const PET_BREATH_MS = 600;
const PET_SCALE = 3;
const EDGE = 8;

export function RoomResident({
  characterAsset,
  outfit,
  pet,
  hidden = false,
}: {
  characterAsset: string;
  outfit: string[];
  /** 전시 동물 (없거나 그림이 없으면 혼자) */
  pet: { assetKey: string; name: string; skinKey?: string | null; size?: AnimalDisplaySize } | null;
  /** 가구 놓기 중에는 칸을 가리지 않게 숨긴다 */
  hidden?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const meRef = useRef<HTMLDivElement>(null);
  const petRef = useRef<HTMLSpanElement>(null);
  const shown = pet && hasAnimalArt(pet.assetKey) ? pet : null;
  const sheet = walkSheetDataUri(characterAsset, outfit, SCALE);
  const gap = shown ? petGap(shown.assetKey, shown.size) : 0;

  useEffect(() => {
    const track = trackRef.current;
    const me = meRef.current;
    if (!track || !me) return;
    const petEl = petRef.current;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const width = () => track.clientWidth;
    // 처음 자리: 방 왼쪽 1/3쯤, 동물은 그 오른쪽 옆
    const s = {
      x: Math.round(width() * 0.3),
      to: null as number | null,
      wait: 1200 + Math.random() * 1500,
      dir: "down" as WalkDir,
      face: "right" as "right" | "left", // 동물이 보는 쪽
      side: 1, // 동물이 있는 쪽 (1 = 오른쪽, 매 프레임 지금 자리로 다시 정한다)
      t: 0,
      petX: Math.round(width() * 0.3) + gap,
      hop: 0,
      idle: 0,
    };
    const draw = (frame: number) => {
      me.style.left = `${Math.round(s.x)}px`;
      me.style.backgroundPosition = `-${frame * BOX}px -${ROWS[s.dir] * BOX}px`;
      me.dataset.walk = `${s.to === null ? "idle" : "walk"}-${s.dir}`;
      if (petEl) {
        // 걸으면 착지·기욺·뛰어오름 그림을 돌리며 통통 뛰고, 서 있으면 숨쉬기 두 칸. 가는 쪽(오른쪽·왼쪽)을 본다
        const step = Math.floor(s.hop / PET_HOP_MS) % PET_WALK_FRAMES.length;
        const walking = s.hop > 0;
        const f = walking ? PET_WALK_FRAMES[step] : PET_IDLE_FRAMES[Math.floor(s.idle / PET_BREATH_MS) % PET_IDLE_FRAMES.length];
        const lift = walking ? -PET_WALK_LIFT[step] * PET_SCALE : 0;
        petEl.style.left = `${Math.round(s.petX + (BOX - PET_BOX) / 2)}px`;
        petEl.style.transform = `translateY(${lift}px)`;
        petEl.style.backgroundPosition = `-${f * PET_BOX}px -${s.face === "left" ? PET_BOX : 0}px`;
        petEl.dataset.walk = `${walking ? "walk" : "idle"}-${s.face}`;
      }
    };
    draw(0);
    if (still) return;

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last, 60);
      last = now;
      const max = Math.max(EDGE, width() - BOX - EDGE);
      if (s.to === null) {
        s.wait -= dt;
        if (s.wait <= 0) {
          // 다음 갈 곳: 지금 자리에서 80px 넘게 떨어진 곳
          let to = EDGE + Math.random() * (max - EDGE);
          if (Math.abs(to - s.x) < 80) to = s.x < (EDGE + max) / 2 ? Math.min(max, s.x + 120) : Math.max(EDGE, s.x - 120);
          s.to = to;
          s.t = 0;
        }
      }
      let frame = 0;
      if (s.to !== null) {
        const d = s.to - s.x;
        const step = (SPEED * dt) / 1000;
        s.dir = d < 0 ? "left" : "right";
        if (Math.abs(d) <= step) {
          s.x = s.to;
          s.to = null;
          s.dir = "down";
          s.wait = 2000 + Math.random() * 4000;
        } else {
          s.x += Math.sign(d) * step;
          s.t += dt;
          frame = 1 + (Math.floor((s.t / 1000) * WALK_FPS) % (WALK_FRAMES - 1));
        }
      }
      // 동물: 지금 있는 쪽(주인 왼쪽 또는 오른쪽)에서 gap(동물 크기별) 떨어진 자리로. 주인이 다가오면 앞서 걷고, 멀어지면 따라간다.
      // 그쪽이 방 밖이면 반대쪽으로 (벽에 몰려 주인과 겹치지 않게)
      s.side = s.petX < s.x ? -1 : 1;
      if (s.x + s.side * gap < 0 || s.x + s.side * gap > width() - BOX) s.side = -s.side;
      const target = Math.min(width() - BOX, Math.max(0, s.x + s.side * gap));
      const pd = target - s.petX;
      if (Math.abs(pd) > 2) {
        s.petX += Math.sign(pd) * Math.min(Math.abs(pd), (SPEED * 1.25 * dt) / 1000);
        s.face = pd < 0 ? "left" : "right";
        s.hop += dt;
        s.idle = 0;
      } else {
        s.hop = 0;
        s.idle += dt;
        // 멈추면 주인 쪽을 본다
        s.face = s.x < s.petX ? "left" : "right";
      }
      draw(frame);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [gap]);

  return (
    <div ref={trackRef} className={`pointer-events-none absolute inset-x-0 bottom-[2%] z-[5] h-24 ${hidden ? "invisible" : ""}`} aria-hidden={hidden}>
      {shown && (
        <span
          ref={petRef}
          data-showcase
          data-size={ANIMAL_SIZE[shown.assetKey]?.tier}
          data-skin={shown.skinKey ?? ""}
          data-display-size={shown.size ?? "normal"}
          data-walk="idle-right"
          title={shown.name}
          className="pixelated absolute bottom-0 block drop-shadow-sm"
          style={{
            left: `calc(30% + ${gap}px)`,
            width: PET_BOX,
            height: PET_BOX,
            backgroundImage: `url("${petSheetDataUri(shown.assetKey, shown.skinKey, PET_SCALE, shown.size)}")`,
            backgroundSize: `${PET_BOX * PET_SHEET_FRAMES}px ${PET_BOX * 2}px`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "0 0",
          }}
        >
          <span className="sr-only">전시 동물 {shown.name}</span>
        </span>
      )}
      <div
        ref={meRef}
        role="img"
        aria-label="블로그 주인 캐릭터"
        data-room-resident
        data-look={lookKey(characterAsset, outfit)}
        data-walk="idle-down"
        className="pixelated absolute bottom-0 drop-shadow-sm"
        style={{
          left: "30%",
          width: BOX,
          height: BOX,
          backgroundImage: `url("${sheet}")`,
          backgroundSize: `${BOX * WALK_FRAMES}px ${BOX * 4}px`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "0 0",
        }}
      />
    </div>
  );
}
