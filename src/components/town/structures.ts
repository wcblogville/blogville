// 광장에 놓는 것들 (Phaser 없이 쓰는 순수 계산): 건물·집·우체통·가로등·나무·바위와 입구, 이웃(NPC)이 걷는 길 그래프.
// 좌표는 layout.ts, 땅은 terrain.ts. 장면(scene.ts)이 그리고, 시험(test-game.ts)이 겹침과 갈 수 있는지를 확인한다.
import {
  BOARD_SIZE,
  CLOTHES_SIZE,
  FARM_SIZE,
  FISHING_SIZE,
  FOUNTAIN_SIZE,
  HOUSE_STAGES,
  houseStage,
  LAMP_SIZE,
  LOT_SIZE,
  MAILBOX_SIZE,
  SALON_SIZE,
  SHOP_SIZE,
  treeSize,
  type HouseStage,
  type TreeKind,
} from "@/lib/art/town";
import { lookKey } from "@/lib/art/characters";
import {
  BOARD_POS,
  CENTER,
  CLOTHES_POS,
  FARM_POS,
  FISHING_POS,
  FOREST_EDGE,
  HORIZON,
  HOUSE_SLOTS,
  houseAt,
  houseSlot,
  LAMPS,
  PATHS,
  SALON_POS,
  smoothPath,
  SHOP_POS,
  townSpots,
  WORLD,
} from "./layout";
import { boxWalkable, hash, terrain, type Box } from "./terrain";
import { PIXEL } from "@/lib/art/pixel";
import type { TownData, TownHouse, TownTarget } from "./types";

/** 광장에 놓는 그림 하나. (x, y) = 아랫변 가운데 (발 닿는 곳) */
export type Structure = {
  texture: string;
  x: number;
  y: number;
  w: number;
  h: number;
  solid?: { w: number; h: number }; // 부딪히는 영역 (아랫변 기준)
  label?: string;
  sub?: string;
  /** 칸을 돌리는 그림판이면 그 애니메이션 키 (분수) */
  anim?: string;
  /** 바닥 그림자 너비 (px). 없으면 그림자 없음 (그림에 이미 있는 작은 것들) */
  shadow?: number;
};

/** 들어갈 수 있는 곳: 문 앞 좌표에서 Space / 클릭 */
export type Entrance = {
  label: string;
  emoji: string;
  x: number;
  y: number;
  target: TownTarget;
  /** 클릭으로 들어가기 판정할 그림 영역 */
  area: { x: number; y: number; w: number; h: number };
  promptY: number;
  /** 안내 동사 (기본 "들어가기") */
  verb?: string;
};

export const houseKey = (stage: HouseStage, roof: string) => `house:${stage}:${roof}`;
export const stageOf = (h: TownHouse) => houseStage(h.level);
/** 걷기 그림판 (TOWN-17): 방향 4줄 × 5칸 */
export const walkKey = (asset: string, outfit: string[] = []) => `walk:${lookKey(asset, outfit)}`;

/** 부딪히는 상자 (가운데 x, y) */
export function solidBox(s: Structure): Box | null {
  return s.solid ? { x: s.x, y: s.y - s.solid.h / 2, w: s.solid.w, h: s.solid.h } : null;
}

/** 건물·집·가로등과 입구 */
export function townLayout(data: TownData) {
  const member = Boolean(data.player);
  const need = (href: string): TownTarget => (member ? { kind: "link", href } : { kind: "login" });
  const structures: Structure[] = [];
  const entrances: Entrance[] = [];

  // 마을 게시판: 왼쪽 판 = 마을 소식, 오른쪽 판 = 출석 체크
  const bw = BOARD_SIZE.width, bh = BOARD_SIZE.height;
  structures.push({
    texture: "board", ...BOARD_POS, w: bw, h: bh, solid: { w: bw * 0.92, h: 22 }, shadow: bw,
    label: "마을 게시판", sub: `마을 소식 · 출석 체크${data.attendanceDay ? ` (오늘 ${data.attendanceDay}일차 ✅)` : ""}`,
  });
  const boardArea = { x: BOARD_POS.x - bw / 2, y: BOARD_POS.y - bh, w: bw, h: bh };
  entrances.push(
    { label: "마을 소식", emoji: "📋", x: BOARD_POS.x - 55, y: BOARD_POS.y + 26, target: { kind: "link", href: "/feed" },
      area: { ...boardArea, w: bw / 2 }, promptY: BOARD_POS.y - bh - 6 },
    { label: data.attendanceDay ? `출석 체크 (오늘 ${data.attendanceDay}일차 ✅)` : "출석 체크", emoji: "📮", x: BOARD_POS.x + 55, y: BOARD_POS.y + 26,
      target: need("/attendance"), area: { ...boardArea, x: BOARD_POS.x, w: bw / 2 }, promptY: BOARD_POS.y - bh - 6 },
  );

  // 상점
  structures.push({ texture: "shop", ...SHOP_POS, w: SHOP_SIZE.width, h: SHOP_SIZE.height, solid: { w: SHOP_SIZE.width * 0.86, h: 60 }, shadow: SHOP_SIZE.width, label: "상점", sub: "아바타·가구·배경" });
  entrances.push({
    label: "상점", emoji: "🏪", x: SHOP_POS.x + 40, y: SHOP_POS.y + 24, target: need("/shop"),
    area: { x: SHOP_POS.x - SHOP_SIZE.width / 2, y: SHOP_POS.y - SHOP_SIZE.height, w: SHOP_SIZE.width, h: SHOP_SIZE.height },
    promptY: SHOP_POS.y - SHOP_SIZE.height - 6,
  });

  // 미용실·옷가게 (SHOP-07·08): 문은 건물 오른쪽에 있다
  for (const b of [
    { texture: "salon", pos: SALON_POS, size: SALON_SIZE, label: "미용실", sub: "머리 모양 · 머리 색", emoji: "💇", href: "/salon" },
    { texture: "clothes", pos: CLOTHES_POS, size: CLOTHES_SIZE, label: "옷가게", sub: "옷 · 모자 · 소품", emoji: "👗", href: "/clothes" },
  ]) {
    structures.push({ texture: b.texture, ...b.pos, w: b.size.width, h: b.size.height, solid: { w: b.size.width * 0.86, h: 54 }, shadow: b.size.width, label: b.label, sub: b.sub });
    entrances.push({
      label: b.label, emoji: b.emoji, x: b.pos.x + 30, y: b.pos.y + 24, target: need(b.href),
      area: { x: b.pos.x - b.size.width / 2, y: b.pos.y - b.size.height, w: b.size.width, h: b.size.height },
      promptY: b.pos.y - b.size.height - 6,
    });
  }

  // 연못 낚시터: 하루 한 번 낚시 (사용자 요청 2026-10-08)
  structures.push({
    texture: "fishing", ...FISHING_POS, w: FISHING_SIZE.width, h: FISHING_SIZE.height, solid: { w: FISHING_SIZE.width * 0.9, h: 90 }, shadow: FISHING_SIZE.width * 0.9,
    label: "낚시터", sub: "하루 한 번 낚시",
  });
  entrances.push({
    label: "낚시터", emoji: "🎣", x: FISHING_POS.x, y: FISHING_POS.y + 24, target: need("/fishing"),
    area: { x: FISHING_POS.x - FISHING_SIZE.width / 2, y: FISHING_POS.y - FISHING_SIZE.height, w: FISHING_SIZE.width, h: FISHING_SIZE.height },
    promptY: FISHING_POS.y - FISHING_SIZE.height - 6,
  });

  // 동물 농장: 알을 받아 동물을 키운다 (내 집 옆)
  structures.push({
    texture: "farm", ...FARM_POS, w: FARM_SIZE.width, h: FARM_SIZE.height, solid: { w: FARM_SIZE.width * 0.94, h: 100 }, shadow: FARM_SIZE.width,
    label: "동물 농장", sub: "알 부화 · 동물 키우기",
  });
  entrances.push({
    label: "동물 농장", emoji: "🐮", x: FARM_POS.x, y: FARM_POS.y + 24, target: need("/farm"),
    area: { x: FARM_POS.x - FARM_SIZE.width / 2, y: FARM_POS.y - FARM_SIZE.height, w: FARM_SIZE.width, h: FARM_SIZE.height },
    promptY: FARM_POS.y - FARM_SIZE.height - 6,
  });

  // 집 11채: 0번 = 내 집, 1~10번 = 즐겨찾기 이웃이 고른 자리(방문자는 인기 블로그). 없으면 빈 집터.
  // 집 앞에 사람을 세우지 않는다 (사용자 요청 2026-10-11): 이웃은 마을을 걸어 다닌다 (npcs)
  const mineTown = member && !data.host;
  for (let i = 0; i < HOUSE_SLOTS; i++) {
    const pos = houseSlot(i);
    const h = houseAt(data, i);
    if (!h) {
      structures.push({ texture: "lot", x: pos.x, y: pos.y, w: LOT_SIZE.width, h: LOT_SIZE.height, label: i === 0 && !data.host ? "내 집 자리" : "빈 집터", sub: i > 0 && mineTown ? "Space로 이웃 집 고르기" : undefined });
      // 내 마을의 빈 집터: 그 자리에 살 즐겨찾기 이웃을 고른다 (TOWN-18)
      if (i > 0 && mineTown) {
        entrances.push({
          label: `빈 집터 ${i}번`, emoji: "🪧", x: pos.x, y: pos.y + 22, target: { kind: "lot", slot: i }, verb: "이웃 집 고르기",
          area: { x: pos.x - LOT_SIZE.width / 2, y: pos.y - LOT_SIZE.height, w: LOT_SIZE.width, h: LOT_SIZE.height }, promptY: pos.y - LOT_SIZE.height - 4,
        });
      }
      continue;
    }
    // 다른 회원의 마을(host)을 구경할 때 0번 집은 그 주인의 집이다
    const mine = i === 0 && !data.host;
    const stage = stageOf(h);
    const { width: w, height: hh } = HOUSE_STAGES[stage];
    structures.push({
      texture: houseKey(stage, h.roof), ...pos, w, h: hh, solid: { w: w * 0.72, h: 46 }, shadow: w * 0.9,
      label: mine ? "내 집" : `${h.nickname}의 집`, sub: h.title,
    });
    entrances.push({
      label: mine ? "내 집" : `${h.nickname}의 집`, emoji: "🏠", x: pos.x, y: pos.y + 22, target: { kind: "link", href: `/@${h.slug}` },
      area: { x: pos.x - w / 2, y: pos.y - hh, w, h: hh }, promptY: pos.y - hh - 4,
    });
    // 집 앞 우체통: 내 집은 내 소식(알림), 이웃집은 그 집 새 글
    const mb = { x: pos.x + w / 2 + 6, y: pos.y + 14 };
    structures.push({ texture: mine ? "mailbox:mine" : "mailbox", ...mb, w: MAILBOX_SIZE.width, h: MAILBOX_SIZE.height, solid: { w: 14, h: 10 } });
    entrances.push({
      label: mine ? "내 우체통" : `${h.nickname}의 우체통`, emoji: "📬", x: mb.x, y: mb.y + 22, target: { kind: "mailbox", slot: i }, verb: "소식 보기",
      area: { x: mb.x - MAILBOX_SIZE.width / 2, y: mb.y - MAILBOX_SIZE.height, w: MAILBOX_SIZE.width, h: MAILBOX_SIZE.height }, promptY: mb.y - MAILBOX_SIZE.height - 4,
    });
  }

  // 분수, 가로등
  structures.push({ texture: "fountain", x: CENTER.x, y: CENTER.y + FOUNTAIN_SIZE.height / 2, w: FOUNTAIN_SIZE.width, h: FOUNTAIN_SIZE.height, solid: { w: 150, h: 70 }, anim: "fountain:flow", shadow: FOUNTAIN_SIZE.width });
  for (const l of LAMPS) structures.push({ texture: "lamp", ...l, w: LAMP_SIZE.width, h: LAMP_SIZE.height, solid: { w: 14, h: 10 } });
  return { structures, entrances };
}

/** 같은 씨앗이면 늘 같은 수열 (mulberry32) */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 나무·바위 자리를 정할 때 피하는 상자: 건물·가장 큰 집·우체통·가로등·입구 앞 */
function keepOut(): Box[] {
  const big = HOUSE_STAGES[10];
  const boxes: Box[] = [
    { x: BOARD_POS.x, y: BOARD_POS.y - BOARD_SIZE.height / 2, w: BOARD_SIZE.width + 40, h: BOARD_SIZE.height + 80 },
    { x: SHOP_POS.x, y: SHOP_POS.y - SHOP_SIZE.height / 2, w: SHOP_SIZE.width + 40, h: SHOP_SIZE.height + 80 },
    { x: SALON_POS.x, y: SALON_POS.y - SALON_SIZE.height / 2, w: SALON_SIZE.width + 40, h: SALON_SIZE.height + 80 },
    { x: CLOTHES_POS.x, y: CLOTHES_POS.y - CLOTHES_SIZE.height / 2, w: CLOTHES_SIZE.width + 40, h: CLOTHES_SIZE.height + 80 },
    { x: FISHING_POS.x, y: FISHING_POS.y - FISHING_SIZE.height / 2, w: FISHING_SIZE.width + 40, h: FISHING_SIZE.height + 80 },
    { x: FARM_POS.x, y: FARM_POS.y - FARM_SIZE.height / 2, w: FARM_SIZE.width + 40, h: FARM_SIZE.height + 80 },
    { x: CENTER.x, y: CENTER.y, w: 620, h: 620 },
    ...Array.from({ length: HOUSE_SLOTS }, (_, i) => {
      const p = houseSlot(i);
      // 집 + 오른쪽 우체통 + 문 앞
      return { x: p.x + 10, y: p.y - big.height / 2 + 30, w: big.width + 90, h: big.height + 120 };
    }),
    ...LAMPS.map((l) => ({ x: l.x, y: l.y - 20, w: 50, h: 70 })),
  ];
  const { places, houses } = townSpots({ player: null, myHouse: null, neighbors: [], attendanceDay: null, host: null });
  for (const s of [...places, ...houses]) boxes.push({ x: s.x, y: s.y, w: 110, h: 90 });
  return boxes;
}

export type Prop = Structure & { kind: TreeKind };

let props: Prop[] | null = null;

/**
 * 나무·바위 (늘 같은 자리, 씨앗 고정). 가장자리 숲은 두 줄로 빽빽하게, 안쪽은 절벽 위·길가·연못가에 무리 지어.
 * 길·계단·물·절벽 앞면·건물 자리를 피한다. 집 크기와 상관없이 같은 자리라 한 번만 계산한다
 */
export function townProps(): Prop[] {
  if (props) return props;
  const t = terrain();
  const rand = rng(20261011);
  const out: Prop[] = [];
  const avoid = keepOut();
  const near = (x: number, y: number, d: number) => out.some((p) => Math.abs(p.x - x) < d && Math.abs(p.y - y) < d * 0.7);
  /** 그 자리가 풀밭인가 (길·물·절벽에서 pad px 떨어진 곳) */
  const grassy = (x: number, y: number, pad: number) => {
    for (const [dx, dy] of [[0, 0], [-pad, 0], [pad, 0], [0, -pad], [0, pad]]) {
      const gx = Math.floor((x + dx) / PIXEL);
      const gy = Math.floor((y + dy) / PIXEL);
      if (gx < 0 || gy < 0 || gx >= t.w || gy >= t.h) return false;
      const i = gy * t.w + gx;
      if (t.path[i] || t.water[i] || t.face[i] || t.edge[i] || t.stairs[i]) return false;
    }
    return true;
  };
  const add = (kind: TreeKind, x: number, y: number) => {
    const { width, height } = treeSize(kind);
    const small = kind === "rock" || kind === "bush";
    out.push({
      kind, texture: `tree:${kind}`, x: Math.round(x), y: Math.round(y), w: width, h: height,
      solid: { w: kind === "boulder" ? 60 : small ? 30 : 24, h: kind === "boulder" ? 22 : 12 },
    });
  };
  const blockedBy = (x: number, y: number) => avoid.some((b) => Math.abs(x - b.x) < b.w / 2 && Math.abs(y - b.y) < b.h / 2);

  // 1) 가장자리 숲: 걸을 수 없는 띠 안쪽 끝을 따라 두 줄 (위쪽은 먼 풍경 바로 아래)
  const edgeKinds: TreeKind[] = ["oak", "oak", "pine", "round", "pine", "oak", "cherry"];
  const inner = FOREST_EDGE;
  for (let row = 0; row < 2; row++) {
    const off = row === 0 ? inner - 20 : inner - 70;
    const step = row === 0 ? 62 : 74;
    for (let s = 0; s < WORLD.width; s += step) {
      const j = (rand() - 0.5) * 24;
      const pick = () => edgeKinds[Math.floor(rand() * edgeKinds.length)];
      // 아래쪽·왼쪽·오른쪽 (위쪽은 먼 풍경 바로 아래 언덕 끝)
      add(pick(), s + j, WORLD.height - off + 10);
      add(pick(), off, s + j + 40);
      add(pick(), WORLD.width - off, s + j + 70);
      if (s > 60 && s < WORLD.width - 60) add(pick(), s + j + 30, HORIZON + 40 + row * 46 + rand() * 10);
    }
  }
  // 바깥 두 줄은 땅 모양과 상관없이 심었으니, 절벽·길에 걸린 것은 뺀다 (계단 길이 끊기지 않게)
  for (let i = out.length - 1; i >= 0; i--) {
    const p = out[i];
    const gx = Math.floor(p.x / PIXEL);
    const gy = Math.floor(p.y / PIXEL);
    const k = gy * t.w + gx;
    if (gx < 0 || gy < 0 || gx >= t.w || gy >= t.h || t.path[k] || t.stairs[k] || t.face[k] || t.water[k]) out.splice(i, 1);
  }

  // 2) 안쪽: 무리 지어 심는다 (무리 가운데를 고르고 그 둘레에 몇 그루)
  const kinds: TreeKind[] = ["oak", "oak", "oak", "round", "round", "pine", "pine", "cherry", "blossom", "bush", "bush", "oak", "boulder"];
  let groups = 0;
  for (let tries = 0; tries < 6000 && groups < 70; tries++) {
    const cx = FOREST_EDGE + 60 + rand() * (WORLD.width - 2 * FOREST_EDGE - 120);
    const cy = HORIZON + 160 + rand() * (WORLD.height - HORIZON - FOREST_EDGE - 220);
    if (!grassy(cx, cy, 40) || blockedBy(cx, cy)) continue;
    groups++;
    const n = 1 + Math.floor(rand() * 4);
    for (let k = 0; k < n; k++) {
      const x = cx + (rand() - 0.5) * 170;
      const y = cy + (rand() - 0.5) * 110;
      if (!grassy(x, y, 34) || blockedBy(x, y) || near(x, y, 58)) continue;
      add(kinds[Math.floor(rand() * kinds.length)], x, y);
    }
  }
  // 3) 길가 바위·덤불 몇 개
  let extras = 0;
  for (let tries = 0; tries < 900; tries++) {
    const x = FOREST_EDGE + rand() * (WORLD.width - 2 * FOREST_EDGE);
    const y = HORIZON + 120 + rand() * (WORLD.height - HORIZON - 200);
    if (!grassy(x, y, 24) || blockedBy(x, y) || near(x, y, 70)) continue;
    // 길에서 30~60px 떨어진 곳만
    if (grassy(x, y, 60)) continue;
    add(hash(Math.round(x), Math.round(y)) < 0.3 ? "rock" : "bush", x, y);
    if (++extras >= 20) break;
  }
  out.sort((a, b) => a.y - b.y);
  props = out;
  return out;
}

/**
 * 이웃(NPC)이 걷는 길 그래프: 길 꺾은선의 점이 마디, 이웃한 점이 줄. 갈림길은 같은 좌표라 하나로 이어진다.
 * avoid(내 집 앞) 가까운 마디는 뺀다 (사용자 요청 2026-10-11: 내 집 앞에는 사람 필요 없음)
 */
export function npcGraph(avoid: { x: number; y: number; r: number }[] = []) {
  const nodes: { x: number; y: number }[] = [];
  const index = new Map<string, number>();
  const links: Set<number>[] = [];
  const id = ([x, y]: readonly [number, number]) => {
    const k = `${x},${y}`;
    let i = index.get(k);
    if (i === undefined) {
      i = nodes.length;
      index.set(k, i);
      nodes.push({ x, y });
      links.push(new Set());
    }
    return i;
  };
  for (const p of PATHS) {
    const pts = p.kind === "plaza" ? p.points : smoothPath(p.points);
    for (let s = 0; s < pts.length - 1; s++) {
      const a = id(pts[s]);
      const b = id(pts[s + 1]);
      if (a === b) continue;
      links[a].add(b);
      links[b].add(a);
    }
  }
  const banned = (i: number) => avoid.some((a) => Math.hypot(nodes[i].x - a.x, nodes[i].y - a.y) < a.r);
  return {
    nodes,
    links: links.map((set, i) => (banned(i) ? [] : [...set].filter((j) => !banned(j)))),
  };
}

/** 이웃(NPC)이 걸어도 되는 선분인가: 땅이 막히지 않고 (계단은 된다) 건물 상자와 부딪히지 않는다 */
export function segmentClear(a: { x: number; y: number }, b: { x: number; y: number }, solids: Box[]) {
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6);
  for (let s = 0; s <= steps; s++) {
    const x = a.x + ((b.x - a.x) * s) / steps;
    const y = a.y + ((b.y - a.y) * s) / steps;
    if (!boxWalkable(x, y, 16, 8)) return false;
    if (solids.some((o) => Math.abs(x - o.x) < o.w / 2 + 4 && Math.abs(y - o.y) < o.h / 2 + 2)) return false;
  }
  return true;
}
