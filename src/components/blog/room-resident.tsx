"use client";

// 우리 집 방 안의 주인 캐릭터와 전시 동물 (사용자 요청 2026-10-11 "캐릭터랑 전시할 동물은 집으로 옮겨 주라").
// 2026-10-12 정육면체 방: 아이소메트릭 바닥 칸 위를 걷는다. 가구가 놓인 칸은 피해서(칸 길 찾기, BFS) 바닥 축을 따라 걷고,
// 전시 동물은 주인이 지나간 길(발자국 줄)을 그대로 따라온다. 깊이는 바닥 위치(x + y)로 정해 가구 앞뒤로 자연스럽게 겹친다.
//
// 펫 "버퍼링" 고침 (사용자 요청 2026-10-12 "캐릭터 계속 움직이는데 따라다니는 펫이 버퍼링 걸려"):
// 예전에는 동물이 주인보다 빨리(1.25배) 쫓아가 2px 안에 들면 바로 멈춤(숨쉬기 그림) → 다음 프레임에 주인이 멀어지면 다시 걷기(통통 뛰기 처음부터)를
// 몇 프레임마다 되풀이해, 걷는 내내 멈칫멈칫했다. 또 매 프레임 스타일을 쓰고 나서 방 너비(clientWidth)를 읽어 강제 레이아웃이 생겼다.
// 이제는 ① 동물이 주인 길 위의 "몇 칸 뒤" 자리를 속도(부드럽게 붙는 가속)로 따라가고 ② 걷기/서기를 속도 문턱 두 개(히스테리시스)로 바꿔
// 짧게 느려져도 통통 뛰기가 끊기지 않으며 ③ 위치는 transform(translate3d)으로만 바꾸고 레이아웃 값을 읽지 않는다. React 상태는 쓰지 않는다 (rAF + ref).
//
// 도트: 캐릭터 24칸 틀 × 4배(96px, 방 그림과 같은 배율), 동물 32칸 × 3배(96px). 움직임 줄이기 설정이면 가만히 서 있는다.
import { useEffect, useMemo, useRef } from "react";
import { lookKey } from "@/lib/art/characters";
import { ANIMAL_SIZE, animalHalfWidth, hasAnimalArt, PET_IDLE_FRAMES, PET_SHEET_FRAMES, PET_WALK_FRAMES, PET_WALK_LIFT, petSheetDataUri } from "@/lib/art/animals";
import { floorToScreen, type IsoRoom } from "@/lib/art/room";
import { WALK_FPS, WALK_FRAMES, walkSheetDataUri, type WalkDir } from "@/lib/art/walk";
import type { AnimalDisplaySize } from "@/lib/farm";

const SCALE = 4;
const BOX = 24 * SCALE; // 걷기 그림판 한 칸 (96px)
const PET_BOX = 96;
const PET_SCALE = 3;
const ROWS: Record<WalkDir, number> = { down: 0, left: 1, right: 2, up: 3 };
/** 걷는 빠르기 (바닥 칸/초). 한 칸이 화면에서 약 36px라 초당 약 50px */
const SPEED = 1.4;
/** 동물이 주인 길에서 떨어져 걷는 거리 (칸): 큰 동물일수록 조금 더 뒤 */
const petGap = (assetKey: string, size?: AnimalDisplaySize) => 0.9 + animalHalfWidth(assetKey, size) / 16;
/** 걷기 그림 한 칸 시간, 숨쉬기 한 칸 시간 (ms) */
const PET_HOP_MS = 100;
const PET_BREATH_MS = 600;
/** 동물 걷기 ↔ 서기 속도 문턱 (칸/초). 둘 사이에서는 지금 상태를 그대로 둔다 */
const PET_WALK_ON = 0.35;
const PET_WALK_OFF = 0.1;
/** 깊이: 바닥 위치(x + y) × 10 + 100. 가구도 같은 식(칸 가운데)을 쓴다 */
export const depthOf = (x: number, y: number) => 100 + Math.round((x + y) * 10);

type P = { x: number; y: number };

/** 화면 자리: 발밑(그림 아래 가운데에서 10px 위)이 바닥 점에 오게. lift = 통통 뛰는 높이 */
function spot(room: IsoRoom, p: P, box: number, lift = 0) {
  const s = floorToScreen(room, p.x, p.y);
  return {
    transform: `translate3d(${Math.round(s.x - box / 2)}px, ${Math.round(s.y - box + 10 + lift)}px, 0)`,
    zIndex: String(depthOf(p.x, p.y)),
  };
}
const key = (x: number, y: number) => `${x},${y}`;

/** 빈 칸 길 찾기 (4방향 BFS). from에서 갈 수 있는 칸마다 바로 앞 칸 */
function reach(grid: number, blocked: ReadonlySet<string>, from: P) {
  const prev = new Map<string, string | null>([[key(from.x, from.y), null]]);
  const queue: P[] = [from];
  while (queue.length) {
    const c = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = { x: c.x + dx, y: c.y + dy };
      const k = key(n.x, n.y);
      if (n.x < 0 || n.y < 0 || n.x >= grid || n.y >= grid || blocked.has(k) || prev.has(k)) continue;
      prev.set(k, key(c.x, c.y));
      queue.push(n);
    }
  }
  return prev;
}

/** 처음 자리: 방 가운데에서 가장 가까운 빈 칸, 동물은 그 옆 빈 칸 (서버·브라우저가 같은 값) */
function startTiles(grid: number, blocked: ReadonlySet<string>): { me: P; pet: P } {
  const c = (grid - 1) / 2;
  const free: P[] = [];
  for (let y = 0; y < grid; y++) for (let x = 0; x < grid; x++) if (!blocked.has(key(x, y))) free.push({ x, y });
  free.sort((a, b) => Math.hypot(a.x - c, a.y - c - 0.5) - Math.hypot(b.x - c, b.y - c - 0.5) || a.x - b.x);
  const me = free[0] ?? { x: 0, y: 0 };
  const near = [{ x: me.x, y: me.y - 1 }, { x: me.x - 1, y: me.y }, { x: me.x + 1, y: me.y }, { x: me.x, y: me.y + 1 }];
  const pet = near.find((p) => p.x >= 0 && p.y >= 0 && p.x < grid && p.y < grid && !blocked.has(key(p.x, p.y))) ?? me;
  return { me, pet };
}

export function RoomResident({
  room,
  blocked,
  characterAsset,
  outfit,
  pet,
  hidden = false,
}: {
  room: IsoRoom;
  /** 가구가 놓인 칸 ("x,y") */
  blocked: readonly string[];
  characterAsset: string;
  outfit: string[];
  /** 전시 동물 (없거나 그림이 없으면 혼자) */
  pet: { assetKey: string; name: string; skinKey?: string | null; size?: AnimalDisplaySize } | null;
  /** 가구 놓기 중에는 가구를 가리지 않게 숨긴다 */
  hidden?: boolean;
}) {
  const meRef = useRef<HTMLDivElement>(null);
  const petRef = useRef<HTMLSpanElement>(null);
  const shown = pet && hasAnimalArt(pet.assetKey) ? pet : null;
  const sheet = walkSheetDataUri(characterAsset, outfit, SCALE);
  const gap = shown ? petGap(shown.assetKey, shown.size) : 0;
  const blockedKey = blocked.join(";");
  const start = useMemo(() => startTiles(room.grid, new Set(blockedKey ? blockedKey.split(";") : [])), [room.grid, blockedKey]);

  useEffect(() => {
    const me = meRef.current;
    if (!me) return;
    const petEl = petRef.current;
    const put = (el: HTMLElement, p: P, box: number, lift = 0) => Object.assign(el.style, spot(room, p, box, lift));
    const blockedSet = new Set(blockedKey ? blockedKey.split(";") : []);
    const center = (t: P): P => ({ x: t.x + 0.5, y: t.y + 0.5 });
    const s = {
      pos: center(start.me),
      tile: start.me,
      path: [] as P[], // 남은 칸 가운데 점들
      wait: 800 + Math.random() * 1500,
      dir: "down" as WalkDir,
      t: 0,
      // 주인이 지나간 길: 점과 그 점까지 걸은 거리. 동물은 이 줄 위 (주인 거리 − gap) 자리를 따라간다
      trail: [] as { p: P; d: number }[],
      walked: 0,
      petD: 0,
      petV: 0,
      petPos: center(start.pet),
      petWalking: false,
      hop: 0,
      idle: 0,
      face: "right" as "left" | "right",
    };
    const startGap = Math.hypot(s.pos.x - s.petPos.x, s.pos.y - s.petPos.y);
    s.trail = [
      { p: { ...s.petPos }, d: 0 },
      { p: { ...s.pos }, d: startGap },
    ];
    s.walked = startGap;
    s.petD = Math.max(0, startGap - gap);

    const pointAt = (d: number): P => {
      const tr = s.trail;
      if (d <= tr[0].d) return tr[0].p;
      for (let i = 1; i < tr.length; i++) {
        if (tr[i].d >= d) {
          const a = tr[i - 1];
          const b = tr[i];
          const f = b.d === a.d ? 1 : (d - a.d) / (b.d - a.d);
          return { x: a.p.x + (b.p.x - a.p.x) * f, y: a.p.y + (b.p.y - a.p.y) * f };
        }
      }
      return tr[tr.length - 1].p;
    };

    const draw = (frame: number) => {
      put(me, s.pos, BOX);
      me.style.backgroundPosition = `-${frame * BOX}px -${ROWS[s.dir] * BOX}px`;
      me.dataset.walk = `${s.path.length ? "walk" : "idle"}-${s.dir}`;
      if (petEl) {
        // 걸으면 착지·기욺·뛰어오름 그림을 돌리며 통통 뛰고, 서 있으면 숨쉬기 두 칸. 가는 쪽(오른쪽·왼쪽)을 본다
        const step = Math.floor(s.hop / PET_HOP_MS) % PET_WALK_FRAMES.length;
        const f = s.petWalking ? PET_WALK_FRAMES[step] : PET_IDLE_FRAMES[Math.floor(s.idle / PET_BREATH_MS) % PET_IDLE_FRAMES.length];
        const lift = s.petWalking ? -PET_WALK_LIFT[step] * PET_SCALE : 0;
        put(petEl, s.petPos, PET_BOX, lift);
        petEl.style.backgroundPosition = `-${f * PET_BOX}px -${s.face === "left" ? PET_BOX : 0}px`;
        petEl.dataset.walk = `${s.petWalking ? "walk" : "idle"}-${s.face}`;
      }
    };
    draw(0);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    // 다음 갈 곳: 갈 수 있는 빈 칸 중 지금 칸에서 두 칸 넘게 떨어진 곳 하나 (없으면 아무 칸)
    const plan = () => {
      const prev = reach(room.grid, blockedSet, s.tile);
      const far = [...prev.keys()].filter((k) => {
        const [x, y] = k.split(",").map(Number);
        return Math.abs(x - s.tile.x) + Math.abs(y - s.tile.y) >= 2;
      });
      const pick = far.length ? far[Math.floor(Math.random() * far.length)] : null;
      if (!pick) return;
      const path: P[] = [];
      for (let k: string | null | undefined = pick; k && k !== key(s.tile.x, s.tile.y); k = prev.get(k)) {
        const [x, y] = k.split(",").map(Number);
        path.unshift(center({ x, y }));
      }
      s.path = path;
      s.t = 0;
    };

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last, 50) / 1000;
      last = now;
      let frame = 0;
      if (!s.path.length) {
        s.wait -= dt * 1000;
        if (s.wait <= 0) plan();
      }
      if (s.path.length) {
        // 주인: 칸 가운데 점을 차례로 따라 걷는다 (한 프레임에 남은 거리만큼 여러 점을 지날 수 있다)
        let budget = SPEED * dt;
        let vx = 0;
        let vy = 0;
        while (budget > 0 && s.path.length) {
          const to = s.path[0];
          const dx = to.x - s.pos.x;
          const dy = to.y - s.pos.y;
          const d = Math.hypot(dx, dy);
          if (d) [vx, vy] = [dx / d, dy / d];
          if (d <= budget) {
            s.pos = { ...to };
            s.tile = { x: Math.floor(to.x), y: Math.floor(to.y) };
            s.path.shift();
            budget -= d;
            s.walked += d;
          } else {
            s.pos = { x: s.pos.x + (dx / d) * budget, y: s.pos.y + (dy / d) * budget };
            s.walked += budget;
            budget = 0;
          }
        }
        s.trail.push({ p: { ...s.pos }, d: s.walked });
        // 화면에서 가는 쪽: 바닥 x축은 오른쪽 아래, y축은 왼쪽 아래
        const sx = vx - vy;
        const sy = (vx + vy) / 2;
        s.dir = Math.abs(sx) >= Math.abs(sy) * 1.5 ? (sx < 0 ? "left" : "right") : sy < 0 ? "up" : "down";
        if (!s.path.length) {
          s.dir = "down";
          s.wait = 2000 + Math.random() * 4000;
        } else {
          s.t += dt;
          frame = 1 + (Math.floor(s.t * WALK_FPS) % (WALK_FRAMES - 1));
        }
      }

      if (petEl) {
        // 동물: 길 위 목표 자리(주인 거리 − gap)로 부드럽게 붙는다. 목표와의 거리에 비례한 속도를 지수로 따라가 덜컥거리지 않는다
        const target = Math.max(s.petD, s.walked - gap);
        const want = Math.min(SPEED * 1.6, (target - s.petD) * 3);
        s.petV += (want - s.petV) * Math.min(1, dt * 8);
        if (s.petV < 0.001) s.petV = 0;
        const before = s.petPos;
        s.petD = Math.min(target, s.petD + s.petV * dt);
        s.petPos = pointAt(s.petD);
        if (s.petWalking ? s.petV < PET_WALK_OFF : s.petV > PET_WALK_ON) s.petWalking = !s.petWalking;
        const moveX = s.petPos.x - before.x - (s.petPos.y - before.y);
        if (s.petWalking) {
          s.hop += dt * 1000;
          s.idle = 0;
          if (Math.abs(moveX) > 1e-4) s.face = moveX < 0 ? "left" : "right";
        } else {
          s.hop = 0;
          s.idle += dt * 1000;
          // 멈추면 주인 쪽을 본다
          s.face = s.pos.x - s.pos.y < s.petPos.x - s.petPos.y ? "left" : "right";
        }
        // 지나간 길은 동물 뒤 한 칸만 남긴다
        while (s.trail.length > 2 && s.trail[1].d < s.petD - 1) s.trail.shift();
      }
      draw(frame);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [gap, room, start, blockedKey]);

  // 첫 그림(서버·하이드레이션 전)도 처음 자리(칸 가운데)에 둔다
  const first = (p: P, box: number) => spot(room, { x: p.x + 0.5, y: p.y + 0.5 }, box);

  return (
    <>
      {shown && (
        <span
          ref={petRef}
          data-showcase
          data-size={ANIMAL_SIZE[shown.assetKey]?.tier}
          data-skin={shown.skinKey ?? ""}
          data-display-size={shown.size ?? "normal"}
          data-walk="idle-right"
          title={shown.name}
          aria-hidden={hidden}
          className={`pixelated pointer-events-none absolute top-0 left-0 block drop-shadow-sm will-change-transform ${hidden ? "invisible" : ""}`}
          style={{
            ...first(start.pet, PET_BOX),
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
        aria-hidden={hidden}
        data-room-resident
        data-look={lookKey(characterAsset, outfit)}
        data-walk="idle-down"
        className={`pixelated pointer-events-none absolute top-0 left-0 drop-shadow-sm will-change-transform ${hidden ? "invisible" : ""}`}
        style={{
          ...first(start.me, BOX),
          width: BOX,
          height: BOX,
          backgroundImage: `url("${sheet}")`,
          backgroundSize: `${BOX * WALK_FRAMES}px ${BOX * 4}px`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "0 0",
        }}
      />
    </>
  );
}
