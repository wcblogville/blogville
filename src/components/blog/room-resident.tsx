"use client";

// 우리 집 방 안의 주인 캐릭터와 전시 동물 (사용자 요청 2026-10-11 "캐릭터랑 전시할 동물은 집으로 옮겨 주라").
// 2026-10-12 "방에서 혼자 막 돌아다니는 것 보다 사용자가 클릭했을 때 이동하게 해주고 가구들이랑 상호작용하는거 넣어줘":
// - 혼자 돌아다니지 않는다. 처음에는 방 가운데 빈 칸에 서 있고, 방을 누르면(휴대폰은 톡)
//   그 칸까지 길을 찾아(src/lib/room-walk.ts findPath, 8방향, 가구가 차지한 칸은 피한다) 걸어간다.
// - 가구를 누르면 그 가구 옆 빈 칸까지 걸어가(planUse) 가구마다 정한 행동을 한다 (FURNITURE_ACTION):
//   침대 → 누워서 쿨쿨(Z), 의자·소파 → 앉기, 탁자·책상 → 글 쓰기, 책장 → 책 읽기, 화분 → 물 주기(물방울),
//   스탠드·버섯 조명 → 불 켜고 끄기(방이 어두워지고 조명 둘레만 환하다), TV·라디오·축음기·피아노 → 음표와 함께 들썩,
//   옷장·서랍장 → 옷 갈아입고 한 바퀴(반짝이), 그 밖의 가구 → 바라보며 하트.
// - 보는 사람 누구나 눌러 움직일 수 있다. 이 화면 안에서만 움직이고 저장하지 않는다 (다시 열면 처음 자리).
// - 전시 동물은 주인이 지나간 길(발자국 줄)을 몇 칸 뒤에서 그대로 따라온다 (예전 "버퍼링" 고침 그대로: 속도 문턱 두 개, transform만).
// - 깊이는 가구가 차지하는 칸 상자로 정한다 (layoutDepth). 앉거나 누우면 그 가구 바로 위.
// - React 상태를 매 프레임 바꾸지 않는다: requestAnimationFrame + ref로 style·data-*만 고친다.
// - 움직임 줄이기 설정이면 걷지 않고 바로 그 자리로 옮기고, 몸짓은 첫 칸에 멈춰 있으며 효과는 움직이지 않는다.
//
// 도트: 캐릭터 24칸 틀, 동물 32칸 틀, 크기는 방 카메라(roomCamera, src/lib/art/room.ts)를 따른다. 자리는 기기 픽셀에 맞춘다(snap).
import type React from "react";
import { useEffect, useMemo, useRef } from "react";
import { lookKey } from "@/lib/art/characters";
import { ANIMAL_SIZE, animalHalfWidth, hasAnimalArt, PET_IDLE_FRAMES, PET_SHEET_FRAMES, PET_WALK_FRAMES, PET_WALK_LIFT, petSheetDataUri } from "@/lib/art/animals";
import { type Particle, PARTICLE_SIZE, particleDataUri, type Pose, POSE_ANCHOR, POSE_FRAMES, POSES, poseSheetDataUri } from "@/lib/art/poses";
import { floorToScreen, type IsoRoom, isoRoomDataUri, type RoomCamera } from "@/lib/art/room";
import { restSpot, roomFurnitureArt } from "@/lib/art/room-furniture";
import { WALK_FPS, WALK_FRAMES, walkSheetDataUri, type WalkDir } from "@/lib/art/walk";
import type { TownPet } from "@/components/town/types";
import type { AnimalDisplaySize } from "@/lib/farm";
import { footprintOf } from "@/lib/house";
import { ACTION_LABEL, actionOf, blockedTiles, findPath, layoutDepth, ON_FURNITURE, planUse, type RoomAction, type RoomPiece, seatTile, type Tile } from "@/lib/room-walk";

/** 카메라를 재기 전 도트 크기 (방 그림 좌표 px): 캐릭터 4배(96px), 동물 3배(96px) */
const SCALE = 4;
const PET_SCALE = 3;
const ROWS: Record<WalkDir, number> = { down: 0, left: 1, right: 2, up: 3 };
/** 걷는 빠르기 (바닥 칸/초) */
const SPEED = 2.2;
/** 동물이 주인 길에서 떨어져 걷는 거리 (칸): 큰 동물일수록 조금 더 뒤 */
const petGap = (assetKey: string, size?: AnimalDisplaySize, look?: TownPet) => 0.9 + animalHalfWidth(assetKey, size, look) / 16;
/** 걷기 그림 한 칸 시간, 숨쉬기 한 칸 시간 (ms) */
const PET_HOP_MS = 100;
const PET_BREATH_MS = 600;
/** 동물 걷기 ↔ 서기 속도 문턱 (칸/초). 둘 사이에서는 지금 상태를 그대로 둔다 */
const PET_WALK_ON = 0.35;
const PET_WALK_OFF = 0.1;
/** 잠깐 하고 끝나는 행동 (ms): 끝나면 그 자리에 선다 */
const SHORT_MS: Partial<Record<RoomAction, number>> = { spin: 1800, look: 1800, light: 1400 };
/** 효과 조각 개수 */
const FX_COUNT = 3;

type P = { x: number; y: number };

/** 이 방을 밖(방 그림·가구 단추)에서 움직이는 손잡이 */
export type ResidentControl = {
  /** 이 칸까지 걸어간다 */
  walkTo: (tile: Tile) => void;
  /** 이 가구 옆까지 걸어가 가구마다 정한 행동을 한다 */
  use: (itemId: number) => void;
};

/** 화면 자리: 발밑(그림 아래 가운데에서 그림 높이의 10/96 위)이 바닥 점에 오게. lift = 통통 뛰는 높이, snap = 기기 픽셀 한 칸 */
function spot(room: IsoRoom, p: P, box: number, snap: number, lift = 0) {
  const s = floorToScreen(room, p.x, p.y);
  const at = (v: number) => +(Math.round(v / snap) * snap).toFixed(3);
  return `translate3d(${at(s.x - box / 2)}px, ${at(s.y - box + (box * 10) / 96 + lift)}px, 0)`;
}
const key = (x: number, y: number) => `${x},${y}`;
const center = (t: Tile): P => ({ x: t.x + 0.5, y: t.y + 0.5 });

/** 처음 자리: 방 가운데에서 가장 가까운 빈 칸, 동물은 그 옆 빈 칸 (서버·브라우저가 같은 값) */
function startTiles(grid: number, blocked: ReadonlySet<string>): { me: Tile; pet: Tile } {
  const c = (grid - 1) / 2;
  const free: Tile[] = [];
  for (let y = 0; y < grid; y++) for (let x = 0; x < grid; x++) if (!blocked.has(key(x, y))) free.push({ x, y });
  free.sort((a, b) => Math.hypot(a.x - c, a.y - c - 0.5) - Math.hypot(b.x - c, b.y - c - 0.5) || a.x - b.x);
  const me = free[0] ?? { x: 0, y: 0 };
  const near = [{ x: me.x, y: me.y - 1 }, { x: me.x - 1, y: me.y }, { x: me.x + 1, y: me.y }, { x: me.x, y: me.y + 1 }];
  const pet = near.find((p) => p.x >= 0 && p.y >= 0 && p.x < grid && p.y < grid && !blocked.has(key(p.x, p.y))) ?? me;
  return { me, pet };
}

/** 바닥에서 움직인 방향 → 그림 방향 (바닥 x축은 화면 오른쪽 아래, y축은 왼쪽 아래) */
function dirOf(vx: number, vy: number, fallback: WalkDir): WalkDir {
  const sx = vx - vy;
  const sy = (vx + vy) / 2;
  if (Math.abs(sx) < 1e-6 && Math.abs(sy) < 1e-6) return fallback;
  return Math.abs(sx) >= Math.abs(sy) * 1.5 ? (sx < 0 ? "left" : "right") : sy < 0 ? "up" : "down";
}

/** 행동마다 몸짓 그림 (없으면 걷기 그림의 서 있기 칸을 쓴다) */
const POSE_OF: Partial<Record<RoomAction, Pose>> = { sleep: "sleep", sit: "sit", write: "write", read: "read", water: "water" };
/** 행동마다 효과 조각 */
const FX_OF: Partial<Record<RoomAction, Particle>> = { sleep: "z", music: "note", spin: "sparkle", light: "sparkle", water: "drop", look: "heart" };

export function RoomResident({
  room,
  pieces,
  characterAsset,
  outfit,
  pet,
  hidden = false,
  camera = null,
  controlRef,
}: {
  room: IsoRoom;
  /** 방에 놓인 가구 (길 찾기·깊이·행동) */
  pieces: readonly RoomPiece[];
  characterAsset: string;
  outfit: string[];
  /** 전시 동물 (없거나 그림이 없으면 혼자) */
  pet: TownPet | null;
  /** 가구 놓기 중에는 가구를 가리지 않게 숨긴다 */
  hidden?: boolean;
  /** 방 카메라: 캐릭터·동물 도트 크기와 기기 픽셀 (null = 아직 재지 않음) */
  camera?: RoomCamera | null;
  /** 방을 누르면 움직이게 하는 손잡이 (RoomStage가 쓴다) */
  controlRef?: React.RefObject<ResidentControl | null>;
}) {
  const meRef = useRef<HTMLDivElement>(null);
  const poseRef = useRef<HTMLDivElement>(null);
  const petRef = useRef<HTMLSpanElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);
  const lightRef = useRef<HTMLDivElement>(null);
  const sayRef = useRef<HTMLSpanElement>(null);
  const shown = pet && hasAnimalArt(pet.assetKey) ? pet : null;
  const scale = camera?.charScale ?? SCALE;
  const petScale = camera?.petScale ?? PET_SCALE;
  const snap = camera?.snap ?? 1;
  const BOX = 24 * scale; // 걷기·몸짓 그림판 한 칸
  const PET_BOX = 32 * petScale;
  const sheet = useMemo(() => walkSheetDataUri(characterAsset, outfit, scale), [characterAsset, outfit, scale]);
  const poseSheet = useMemo(() => poseSheetDataUri(characterAsset, outfit, scale), [characterAsset, outfit, scale]);
  const gap = shown ? petGap(shown.assetKey, shown.size, shown) : 0;
  const piecesKey = pieces.map((p) => `${p.itemId}:${p.assetKey}:${p.x},${p.y}${p.flip ? "~" : ""}`).join(";");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 가구가 실제로 바뀔 때만 (배열은 렌더마다 새로 온다)
  const layout = useMemo(() => pieces.map((p) => ({ ...p })), [piecesKey]);
  const blocked = useMemo(() => blockedTiles(layout), [layout]);
  const depth = useMemo(() => layoutDepth(layout), [layout]);
  const start = useMemo(() => startTiles(room.grid, blocked), [room.grid, blocked]);

  useEffect(() => {
    const me = meRef.current;
    const poseEl = poseRef.current;
    const fxEl = fxRef.current;
    if (!me || !poseEl || !fxEl) return;
    const petEl = petRef.current;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const fxSpans = [...fxEl.children] as HTMLElement[];
    const fxBox = PARTICLE_SIZE * scale;

    const s = {
      pos: center(start.me),
      tile: start.me,
      path: [] as P[], // 남은 칸 가운데 점들
      dir: "down" as WalkDir,
      t: 0,
      /** 걸어가서 할 일 */
      goal: null as null | { piece: RoomPiece; stand: Tile },
      /** 지금 하는 행동 */
      act: null as null | {
        action: RoomAction;
        piece: RoomPiece;
        since: number;
        at: P;
        lift: number;
        z: number;
        mirror: boolean;
        fx: P | null;
      },
      light: null as null | { x: number; y: number },
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
      clock: 0,
    };
    const resetTrail = () => {
      const g = Math.hypot(s.pos.x - s.petPos.x, s.pos.y - s.petPos.y);
      s.trail = [
        { p: { ...s.petPos }, d: 0 },
        { p: { ...s.pos }, d: g },
      ];
      s.walked = g;
      s.petD = Math.max(0, g - gap);
      s.petV = 0;
    };
    resetTrail();

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
    const snapPx = (v: number) => +(Math.round(v / snap) * snap).toFixed(3);
    /** 가구 그림 위쪽 가운데 (효과가 나오는 곳, 방 그림 px) */
    const pieceTop = (p: RoomPiece): P => {
      const art = roomFurnitureArt(p.assetKey);
      const back = floorToScreen(room, p.x, p.y);
      const a = art.anchor(p.flip);
      return { x: back.x - a.x + art.width / 2, y: back.y - a.y + art.height * 0.15 };
    };
    const pieceCenter = (p: RoomPiece): P => {
      const { w, d } = footprintOf(p.assetKey, p.flip);
      return { x: p.x + w / 2, y: p.y + d / 2 };
    };
    const say = (text: string) => {
      if (sayRef.current) sayRef.current.textContent = text;
    };

    // ===== 불 켜고 끄기: 방이 어두워지고 조명 둘레만 환하다 =====
    const drawLight = () => {
      const el = lightRef.current;
      if (!el) return;
      if (!s.light) {
        el.style.opacity = "0";
        el.dataset.light = "off";
        return;
      }
      const { x, y } = s.light;
      el.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255,214,120,0.38) 0, rgba(255,214,120,0.12) 70px, rgba(255,214,120,0) 130px), radial-gradient(circle at ${x}px ${y}px, rgba(18,22,58,0) 60px, rgba(18,22,58,0.5) 260px)`;
      el.style.opacity = "1";
      el.dataset.light = "on";
    };

    const endAct = () => {
      s.act = null;
      me.dataset.pose = "";
      poseEl.dataset.pose = "";
      for (const f of fxSpans) f.style.opacity = "0";
    };

    const startAct = (piece: RoomPiece, stand: Tile) => {
      const action = actionOf(piece.assetKey);
      const c = pieceCenter(piece);
      s.dir = dirOf(c.x - s.pos.x, c.y - s.pos.y, "down");
      let at: P = { ...s.pos };
      let lift = 0;
      let z = depth.pointZ(s.pos);
      if (ON_FURNITURE.has(action)) {
        const rest = restSpot(piece.assetKey, piece, seatTile(piece, stand));
        at = { x: rest.x, y: rest.y };
        lift = rest.lift;
        z = depth.pieceZ[layout.indexOf(piece)] + 5;
      }
      const meScreen = floorToScreen(room, s.pos.x, s.pos.y);
      const top = pieceTop(piece);
      let fx: P | null = null;
      if (action === "sleep") {
        const h = floorToScreen(room, at.x, at.y);
        fx = { x: h.x + BOX * 0.25, y: h.y - lift - BOX * 0.55 };
      } else if (action === "water") fx = { x: meScreen.x + (top.x < meScreen.x ? -1 : 1) * BOX * 0.42, y: meScreen.y - BOX * 0.25 };
      else if (action === "look" || action === "spin") fx = { x: meScreen.x, y: meScreen.y - BOX * 0.95 };
      else if (FX_OF[action]) fx = top;
      s.act = { action, piece, since: s.clock, at, lift, z, mirror: top.x < meScreen.x, fx };
      if (action === "light") {
        const lamp = pieceTop(piece);
        s.light = s.light ? null : lamp;
        drawLight();
      }
      me.dataset.pose = action;
      poseEl.dataset.pose = action;
      const name = (piece as RoomPiece & { name?: string }).name;
      say(`${name ? `${name}: ` : ""}${ACTION_LABEL[action]}`);
      const sym = FX_OF[action];
      fxSpans.forEach((f, i) => {
        if (!sym) return;
        f.style.backgroundImage = `url("${particleDataUri(sym, scale)}")`;
        f.style.opacity = reduced && i > 0 ? "0" : "1";
      });
    };

    const walkTo = (to: Tile, goal: { piece: RoomPiece; stand: Tile } | null, path?: Tile[]) => {
      endAct();
      const from = { x: Math.floor(s.pos.x), y: Math.floor(s.pos.y) };
      const tiles = path ?? findPath(room.grid, blocked, from, to);
      s.goal = goal;
      if (reduced) {
        // 움직임 줄이기: 걷지 않고 바로 옮긴다 (동물도 옆으로)
        const last = tiles[tiles.length - 1] ?? from;
        s.pos = center(last);
        s.tile = last;
        s.path = [];
        s.petPos = { x: s.pos.x - 0.6, y: s.pos.y };
        resetTrail();
        if (goal) startAct(goal.piece, goal.stand);
        else s.dir = "down";
        draw(0);
        return;
      }
      s.path = tiles.map(center);
      s.t = 0;
      if (!s.path.length && goal) startAct(goal.piece, goal.stand);
    };

    if (controlRef)
      controlRef.current = {
        walkTo: (tile) => {
          if (tile.x < 0 || tile.y < 0 || tile.x >= room.grid || tile.y >= room.grid) return;
          walkTo(tile, null);
        },
        use: (itemId) => {
          const piece = layout.find((p) => p.itemId === itemId);
          if (!piece) return;
          const from = { x: Math.floor(s.pos.x), y: Math.floor(s.pos.y) };
          const plan = planUse(room.grid, blocked, from, piece);
          if (!plan) {
            // 둘레에 빈 칸이 없으면 그 자리에서 바라보기만
            endAct();
            startAct(piece, from);
            return;
          }
          walkTo(plan.stand, { piece, stand: plan.stand }, plan.path);
        },
      };

    // ===== 그리기 =====
    const draw = (frame: number) => {
      const a = s.act;
      const posing = a && POSE_OF[a.action];
      if (posing) {
        me.style.visibility = "hidden";
        poseEl.style.visibility = hidden ? "hidden" : "visible";
        const pose = POSE_OF[a.action]!;
        const row = POSES.indexOf(pose);
        const el = floorToScreen(room, a.at.x, a.at.y);
        // 몸짓 칸 고르기: 앉기는 3초마다 깜빡, 책은 1.2초마다 넘기기, 연필·물뿌리개는 번갈아, 잠은 숨쉬기
        const t = s.clock - a.since;
        const f = reduced ? 0 : pose === "sit" ? (t % 3000 > 2850 ? 1 : 0) : pose === "read" ? (t % 1200 > 900 ? 1 : 0) : pose === "sleep" ? Math.floor(t / 900) % POSE_FRAMES : Math.floor(t / 320) % POSE_FRAMES;
        const anchor = POSE_ANCHOR[pose] * scale;
        poseEl.style.transform = `translate3d(${snapPx(el.x - BOX / 2)}px, ${snapPx(el.y - a.lift - anchor)}px, 0)${a.mirror && pose === "water" ? " scaleX(-1)" : ""}`;
        poseEl.style.zIndex = String(a.z);
        poseEl.style.backgroundPosition = `-${f * BOX}px -${row * BOX}px`;
      } else {
        poseEl.style.visibility = "hidden";
        me.style.visibility = hidden ? "hidden" : "visible";
        let lift = 0;
        let dir = s.dir;
        if (a && !reduced) {
          const t = s.clock - a.since;
          if (a.action === "music") lift = -(Math.floor(t / 250) % 2) * scale; // 음악에 맞춰 들썩
          if (a.action === "spin" && t < 1200) dir = (["down", "left", "up", "right"] as const)[Math.floor(t / 150) % 4]; // 한 바퀴
        }
        me.style.transform = spot(room, s.pos, BOX, snap, lift);
        me.style.zIndex = String(depth.pointZ(s.pos));
        me.style.backgroundPosition = `-${frame * BOX}px -${ROWS[dir] * BOX}px`;
      }
      me.dataset.walk = `${s.path.length ? "walk" : "idle"}-${s.dir}`;
      me.dataset.tile = `${Math.floor(s.pos.x)},${Math.floor(s.pos.y)}`;

      // 효과 조각: 위로 떠오르며 흐려진다 (물방울은 아래로 떨어진다). 셋이 번갈아
      if (a?.fx) {
        const t = s.clock - a.since;
        fxSpans.forEach((f, i) => {
          if (reduced) {
            if (i === 0) f.style.transform = `translate3d(${snapPx(a.fx!.x - fxBox / 2)}px, ${snapPx(a.fx!.y - fxBox)}px, 0)`;
            return;
          }
          const k = ((t / 1400 + i / FX_COUNT) % 1 + 1) % 1;
          const down = a.action === "water";
          const dx = down ? (a.mirror ? -1 : 1) * k * scale * 3 : Math.sin((k + i) * Math.PI * 2) * scale * 3 + (a.action === "sleep" ? k * scale * 6 : 0);
          const dy = down ? k * scale * 14 : -k * scale * 16;
          const short = SHORT_MS[a.action];
          const fade = short && t > short - 400 ? Math.max(0, (short - t) / 400) : 1;
          f.style.opacity = String(+(Math.min(1, (1 - k) * 2.2) * fade).toFixed(2));
          f.style.transform = `translate3d(${snapPx(a.fx!.x - fxBox / 2 + dx)}px, ${snapPx(a.fx!.y - fxBox + dy)}px, 0)`;
        });
      }

      if (petEl) {
        // 걸으면 착지·기욺·뛰어오름 그림을 돌리며 통통 뛰고, 서 있으면 숨쉬기 두 칸. 가는 쪽(오른쪽·왼쪽)을 본다
        const step = Math.floor(s.hop / PET_HOP_MS) % PET_WALK_FRAMES.length;
        const pf = s.petWalking ? PET_WALK_FRAMES[step] : PET_IDLE_FRAMES[Math.floor(s.idle / PET_BREATH_MS) % PET_IDLE_FRAMES.length];
        const lift = s.petWalking ? -PET_WALK_LIFT[step] * petScale : 0;
        petEl.style.transform = spot(room, s.petPos, PET_BOX, snap, lift);
        petEl.style.zIndex = String(depth.pointZ(s.petPos));
        petEl.style.backgroundPosition = `-${pf * PET_BOX}px -${s.face === "left" ? PET_BOX : 0}px`;
        petEl.dataset.walk = `${s.petWalking ? "walk" : "idle"}-${s.face}`;
      }
    };
    draw(0);
    drawLight();

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dtMs = Math.min(now - last, 50);
      const dt = dtMs / 1000;
      last = now;
      s.clock += dtMs;
      let frame = 0;
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
        s.dir = dirOf(vx, vy, s.dir);
        if (!s.path.length) {
          if (s.goal) startAct(s.goal.piece, s.goal.stand);
          else s.dir = "down";
          s.goal = null;
        } else {
          s.t += dt;
          frame = 1 + (Math.floor(s.t * WALK_FPS) % (WALK_FRAMES - 1));
        }
      }
      // 잠깐 하는 행동은 끝나면 선다 (불은 켜진 채로)
      const short = s.act && SHORT_MS[s.act.action];
      if (short && s.clock - s.act!.since > short) {
        s.dir = "down";
        endAct();
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
          s.hop += dtMs;
          s.idle = 0;
          if (Math.abs(moveX) > 1e-4) s.face = moveX < 0 ? "left" : "right";
        } else {
          s.hop = 0;
          s.idle += dtMs;
          // 멈추면 주인 쪽을 본다
          s.face = s.pos.x - s.pos.y < s.petPos.x - s.petPos.y ? "left" : "right";
        }
        // 지나간 길은 동물 뒤 한 칸만 남긴다
        while (s.trail.length > 2 && s.trail[1].d < s.petD - 1) s.trail.shift();
      }
      draw(frame);
      raf = requestAnimationFrame(tick);
    };
    if (!reduced) raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (controlRef) controlRef.current = null;
    };
  }, [gap, room, start, blocked, depth, layout, BOX, PET_BOX, scale, petScale, snap, hidden, controlRef]);

  // 첫 그림(서버·하이드레이션 전)도 처음 자리(칸 가운데)에 둔다
  const first = (p: Tile, box: number) => ({ transform: spot(room, center(p), box, snap), zIndex: depth.pointZ(center(p)) });
  const fxBox = PARTICLE_SIZE * scale;

  return (
    <>
      {/* 불 끄기(밤): 방에 덮는 어둠 + 조명 둘레 빛. 방 그림 모양으로 오려 방 밖(둘레 나무색)은 그대로 */}
      <div
        ref={lightRef}
        aria-hidden
        data-room-light
        data-light="off"
        className="pointer-events-none absolute inset-0 z-[1800] opacity-0 transition-opacity duration-500 motion-reduce:transition-none"
        style={{ maskImage: `url("${isoRoomDataUri(room.grid)}")`, maskSize: "100% 100%", WebkitMaskImage: `url("${isoRoomDataUri(room.grid)}")`, WebkitMaskSize: "100% 100%" }}
      />
      {shown && (
        <span
          ref={petRef}
          data-showcase
          data-size={ANIMAL_SIZE[shown.assetKey]?.tier}
          data-skin={shown.skinKey ?? ""}
          data-display-size={shown.size ?? "normal"}
          data-display-form={shown.form ?? "adult"}
          data-sex={shown.sex ?? ""}
          data-variant={shown.variant ?? ""}
          data-walk="idle-right"
          title={shown.name}
          aria-hidden={hidden}
          className={`pixelated pointer-events-none absolute top-0 left-0 block drop-shadow-sm will-change-transform ${hidden ? "invisible" : ""}`}
          style={{
            ...first(start.pet, PET_BOX),
            width: PET_BOX,
            height: PET_BOX,
            backgroundImage: `url("${petSheetDataUri(shown.assetKey, shown.skinKey, petScale, shown.size, shown)}")`,
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
        data-pose=""
        data-tile={`${start.me.x},${start.me.y}`}
        data-dot={+(scale * (camera?.fit ?? 1)).toFixed(3)}
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
      {/* 앉기·눕기·책·글·물뿌리개 몸짓 (행동할 때만 보인다) */}
      <div
        ref={poseRef}
        aria-hidden
        data-room-pose
        data-pose=""
        className="pixelated pointer-events-none invisible absolute top-0 left-0 drop-shadow-sm will-change-transform"
        style={{
          width: BOX,
          height: BOX,
          backgroundImage: `url("${poseSheet}")`,
          backgroundSize: `${BOX * POSE_FRAMES}px ${BOX * POSES.length}px`,
          backgroundRepeat: "no-repeat",
        }}
      />
      {/* 효과 조각 (Z·음표·반짝이·물방울·하트) */}
      <div ref={fxRef} aria-hidden data-room-fx className="pointer-events-none absolute top-0 left-0 z-[1700]">
        {Array.from({ length: FX_COUNT }, (_, i) => (
          <span key={i} className="pixelated absolute top-0 left-0 opacity-0 will-change-transform" style={{ width: fxBox, height: fxBox, backgroundSize: "100% 100%" }} />
        ))}
      </div>
      <span ref={sayRef} aria-live="polite" className="sr-only" data-room-say />
    </>
  );
}
