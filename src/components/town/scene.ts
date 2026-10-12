// 중앙 광장 (2.5D 3/4 탑다운). Phaser는 브라우저에서만 동작하므로 런타임에 받아서 씬을 만든다.
// 그림은 src/lib/art/ 의 도트 SVG를 이미지로 바꿔 쓴다 (townTextures → TownGame이 미리 불러온다).
// 배치는 layout.ts(좌표)·terrain.ts(땅 높이·걸을 수 있는 곳)·structures.ts(건물·나무·입구·이웃이 걷는 길).
// - 깊이: 모든 그림은 아랫변 y가 깊이라 캐릭터가 나무·건물 뒤로 가면 가려진다 (y-sorting)
// - 땅: 절벽 앞면·물·단 가장자리는 못 지나가고 계단으로만 오르내린다 (발 상자로 미리 확인)
// - 즐겨찾기 이웃은 집 앞에 서 있지 않고 마을 길을 걸어 다닌다 (NPC, 사용자 요청 2026-10-11)
import type * as PhaserNS from "phaser";
import { ANIMAL_SIZE, animalHalfWidth, animalHeight, PET_IDLE_FRAMES, PET_SHEET_FRAMES, PET_WALK_FRAMES, type PetGait, petGait, petSheetDataUri, type PetLook } from "@/lib/art/animals";
import type { AnimalDisplaySize } from "@/lib/farm";
import { VISITOR_CHARACTER } from "@/lib/art/characters";
import {
  boardSvg,
  clothesSvg,
  salonSvg,
  fishingSvg,
  farmSvg,
  FOUNTAIN_FPS,
  FOUNTAIN_FRAMES,
  FOUNTAIN_SIZE,
  fountainSheetSvg,
  fenceSvg,
  homeArchSvg,
  houseSvg,
  lampSvg,
  lotSvg,
  mailboxSvg,
  shopSvg,
  toDataUri,
  treeSvg,
} from "@/lib/art/town";
import { HOUSE_SLOTS, houseAt, houseSlot, START_POS, townSpots, WORLD } from "./layout";
import { bakeGround, GROUND_SIZE, hazeAt } from "./ground";
import { boxWalkable, stairCrossings, terrain, TERRAIN_FEET } from "./terrain";
import { houseKey, npcGraph, segmentClear, solidBox, stageOf, townLayout, townProps, walkKey, type Entrance, type Structure } from "./structures";
import type { TownData, TownNeighbor, TownPet, TownTarget } from "./types";
import { PIXEL, rgbOf } from "@/lib/art/pixel";
import { WALK_DIRS, WALK_FPS, walkDirOf, walkFrameIndex, walkSheetDataUri, type WalkDir } from "@/lib/art/walk";
import { IDLE_AFTER_MS, IDLE_FRAME, IDLE_GAP_MS, IDLE_MOTIONS, idleFrameAt, idleFrameIndex, idleOriginY, idleSheetDataUri, pickIdleMotion, type IdleMotion } from "@/lib/art/idle";
import { townTheme, type Weather } from "@/lib/art/town-theme";

type PhaserLib = typeof PhaserNS;

export { WORLD };
const SPEED = 230;
/** 계단에서는 조금 느리게 */
const STAIRS_SPEED = 0.72;
const INTERACT_DISTANCE = 90;
const PLAYER_SIZE = 24 * PIXEL; // 캐릭터 그림 크기 (도트 24칸 정사각형 × 3배 = 72)
/** 발 상자 (부딪힘) */
const FEET = { w: 28, h: 16 };
// 가상 조이스틱 (터치 화면 전용, TOWN-02)
const JOYSTICK = { radius: 56, thumb: 26, margin: 28, deadZone: 8 };
/** 이웃(NPC) 걷는 빠르기 (px/초)와 이름표가 보이는 거리 */
const NPC_SPEED = 68;
const NPC_NEAR = 170;
/** 이웃에게 말을 걸 수 있는 거리(px)와 말풍선이 떠 있는 시간 (글자가 길면 조금 더, ms) */
const NPC_TALK = 90;
const talkMs = (line: string) => Math.min(7000, 3200 + [...line].length * 45);
/** 말풍선 깊이: 날씨 알갱이 위, Space 안내 아래 */
const BUBBLE_DEPTH = 99000;
/** 가만히 그림판(24×32)이 걷기 그림판(24×24)보다 위로 긴 만큼 (이름표를 올린다) */
const IDLE_LIFT = (IDLE_FRAME.h - IDLE_FRAME.w) * PIXEL;
/** 이웃이 서 있지 않는 내 집 앞 반지름 */
const NPC_AVOID_HOME = 190;
/** 그림이름표·안내는 모든 그림 위 */
const LABEL_DEPTH = 60000;
const HAZE_DEPTH = 90000;
/**
 * 따라다니는 동물 (사용자 요청 2026-10-11 "전시한 동물은 마을 돌아다닐 때 따라다니게"): 32칸 동물 그림 × PIXEL.
 * 내가 걸어온 자취를 거리(petGap)만큼 뒤에서 밟아 오고, 걸을 때는 도트 한 칸씩 통통 뛴다 (높이는 PIXEL의 정수배).
 * 동물마다 크기가 달라(ANIMAL_SIZE) 거리도 다르다: 작은 동물은 바짝, 큰 동물은 몸 폭만큼 더 떨어져 걷는다.
 */
const PET_SIZE = 32 * PIXEL;
/** 내 몸 반폭(px)과 동물과 사이 여백. 걷는 거리 = 내 반폭 + 동물 반폭 + 여백 */
const ME_HALF = 8 * PIXEL;
const PET_MARGIN = 2;
/** 위아래로 걸을 때 옆으로 비켜 설 때 더 띄우는 거리(이름표·머리와 겹치지 않게)와 위쪽으로 처지는 최대 거리 */
const PET_SIDE_EXTRA = 10;
const PET_UP = 8;
/** 캐릭터 키(칸)와, 이보다 큰 동물이 내 이름표에 머리가 닿지 않게 더 떨어지는 거리 (px) */
const ME_HEIGHT = 21;
const TALL_EXTRA = 20;
/** 동물별 따라오는 거리(자취)와 옆으로 비켜 서는 거리 (px) */
export function petGaps(assetKey: string, size?: AnimalDisplaySize, look: PetLook = {}) {
  const gap = ME_HALF + animalHalfWidth(assetKey, size, look) * PIXEL + PET_MARGIN + (animalHeight(assetKey, size, look) > ME_HEIGHT ? TALL_EXTRA : 0);
  return { gap, side: gap + PET_SIDE_EXTRA };
}
/**
 * 부드럽게 따라오기 (사용자 요청 2026-10-12 "따라다니는 펫이 버퍼링 걸려").
 * 예전에는 3px마다 찍은 자취 점 하나를 목표로 삼아 그 점에 딱 닿으면 멈췄다가 다음 점이 생기면 다시 걸었다.
 * 그래서 프레임마다 걷기/서기가 바뀌며 걷기 그림이 첫 칸으로 되돌아가고(hop = 0) 위치도 뚝뚝 끊겼다 (화면 주사율이 높을수록 심했다).
 * 이제는 자취를 촘촘히(1px) 찍고 gap 거리의 정확한 점(두 자취 점 사이를 이은 곳)을 목표로 삼아,
 * 지수 감쇠(PET_EASE_MS)로 다가간다. 같은 속도로 걷는 목표를 같은 속도로, 일정한 간격을 두고 계속 따라간다 (프레임 시간 기준).
 * 걷기/서기는 속도를 부드럽게 잰 값에 문턱 두 개(PET_WALK_ON·OFF)를 둬서 깜빡이지 않고, 걷기 그림은 걸은 거리만큼 넘긴다
 */
const PET_EASE_MS = 70;
/** 가장 빠른 걸음 (내 속도의 배수, 순간 이동처럼 튀지 않게) */
const PET_MAX_SPEED = SPEED * 1.6;
/** 이보다 빠르면 걷기 시작, 이보다 느려지면 멈춤 (px/초) */
const PET_WALK_ON = 24;
const PET_WALK_OFF = 8;
/** 걷기 그림 한 칸마다 걷는 거리(px, 내 빠르기로 90ms)와 숨쉬기 한 칸 시간(ms). 뛰는 높이는 PET_WALK_LIFT × PIXEL */
const PET_HOP_PX = (SPEED * 90) / 1000;
const PET_BREATH_MS = 600;
/**
 * 동물 그림판 이름과 그림 (동물·스킨·크기·암수·특별 진화·모습마다 다르다). 내 동물·이웃이 데리고 다니는 동물이 같이 쓴다.
 * 동물 그림 조건(예: 아기/어른 모습·성별·무늬)이 늘면 이 두 함수만 고친다
 */
export const petKey = (pet: TownPet) => `pet:${pet.assetKey}:${pet.skinKey ?? ""}:${pet.size ?? "normal"}:${pet.sex ?? ""}:${pet.variant ?? ""}:${pet.form ?? "adult"}`;
const petSheet = (pet: TownPet) => petSheetDataUri(pet.assetKey, pet.skinKey, PIXEL, pet.size, pet);

/** 따라다니는 동물 하나 (나의 동물, 이웃의 동물): 그림, 발 위치, 주인이 걸어온 자취 (발 위치 목록, 오래된 것부터) */
type Follower = {
  img: PhaserNS.GameObjects.Image;
  x: number;
  y: number;
  /** 걸은 거리(px, 걷기 그림 넘기기)와 서 있은 시간(ms, 숨쉬기) */
  hop: number;
  idle: number;
  /** 부드럽게 잰 속도 (px/초)와 걷는 중인지 (문턱 두 개) */
  vx: number;
  vy: number;
  walking: boolean;
  face: "right" | "left";
  gap: number;
  side: number;
  trail: { x: number; y: number }[];
  frame: number;
  /** 걸음새 (독수리는 날고 거북이는 느리게, animals.ts petGait) */
  gait: PetGait;
};
/** 이만큼 넘게 떨어지면(순간 이동 등) 바로 옆으로 옮긴다 */
const PET_SNAP = 420;
/** 걷기 그림판 원점 (발밑): 가만히 동작 그림판(8줄 더 높다)도 같은 발 위치에 선다 */
const WALK_ORIGIN_Y = 0.94;
const IDLE_ORIGIN_Y = idleOriginY(WALK_ORIGIN_Y);
/**
 * 날씨 알갱이 (마을 테마, town-theme.ts): 도트 그림 한 장 × PIXEL. 화면 넓이 몇 px²마다 하나, 빠르기(px/초).
 * 알갱이 자리는 마을에 붙어 있어(카메라가 움직이면 같이 지나간다) 화면 크기로 되풀이한다
 */
const WEATHER: Record<Weather, { per: number; rows: string[]; colors: Record<string, string> }> = {
  snow: { per: 9000, rows: ["ww", "ws"], colors: { w: "#ffffff", s: "#dfe8f3" } },
  petals: { per: 16000, rows: ["pP", ".p"], colors: { p: "#ffb3cf", P: "#ff8fb8" } },
  fireflies: { per: 30000, rows: [".y.", "yYy", ".y."], colors: { Y: "#fffbd0", y: "#ffe066" } },
  stars: { per: 22000, rows: [".s.", "sWs", ".s."], colors: { W: "#ffffff", s: "#e9d5ff" } },
  glints: { per: 40000, rows: [".g.", "gWg", ".g."], colors: { W: "#ffffff", g: "#fff3c4" } },
};
const WEATHER_DEPTH = 95000;
const IDLE_MOTIONS_BY_KEY = new Map(IDLE_MOTIONS.map((m) => [m.key, m]));
const TREE_KINDS = ["round", "pine", "bush", "blossom", "oak", "cherry", "rock", "boulder"] as const;

/**
 * 그림 종류 (마을 테마 색 보정을 얼마나 입힐지): world = 건물·나무·장식 (테마 그대로, 눈 테마면 윗면에 눈),
 * plain = 분수처럼 눈을 얹지 않는 장식, character = 캐릭터·동물 (보정을 약하게)
 */
export type TextureKind = "world" | "plain" | "character";

/** 가만히 동작 그림판 이름 (걷기 그림판과 같은 차림 키) */
export const idleKey = (asset: string, outfit: string[] = []) => `idle:${walkKey(asset, outfit).slice(5)}`;

/** 이 광장이 쓸 그림 목록. TownGame이 미리 이미지로 불러 둔다 (kind에 맞춰 테마 색을 입힌다) */
export function townTextures(data: TownData): { key: string; uri: string; kind: TextureKind }[] {
  const list = new Map<string, string>();
  const player = data.player?.characterAsset ?? VISITOR_CHARACTER;
  list.set(walkKey(player, data.player?.outfit), walkSheetDataUri(player, data.player?.outfit ?? [], PIXEL));
  // 가만히 서 있을 때 하는 동작 그림판 (나만, idle.ts)
  list.set(idleKey(player, data.player?.outfit), idleSheetDataUri(player, data.player?.outfit ?? [], PIXEL));
  for (const h of [data.myHouse, ...data.neighbors]) {
    if (!h) continue;
    list.set(houseKey(stageOf(h), h.roof), toDataUri(houseSvg(stageOf(h), h.roof)));
  }
  // 걸어 다니는 이웃 (내 집 주인은 빼고)
  for (const h of data.neighbors) list.set(walkKey(h.characterAsset, h.outfit), walkSheetDataUri(h.characterAsset, h.outfit, PIXEL));
  // 따라다니는 동물 (내가 블로그에 전시한 다 키운 동물, 어른 단계)
  // 그림판: 서 있기·숨쉬기·착지·기욺·뛰어오름 5칸 × 오른쪽·왼쪽 2줄 (animals.ts petSheetSvg), 스킨을 입힌 색
  if (data.pet) list.set(petKey(data.pet), petSheet(data.pet));
  // 이웃(NPC)이 데리고 다니는 전시 동물과 이웃의 가만히 동작 그림판
  for (const h of data.neighbors) {
    if (h.pet) list.set(petKey(h.pet), petSheet(h.pet));
    list.set(idleKey(h.characterAsset, h.outfit), idleSheetDataUri(h.characterAsset, h.outfit, PIXEL));
  }
  list.set("board", toDataUri(boardSvg()));
  list.set("shop", toDataUri(shopSvg()));
  list.set("salon", toDataUri(salonSvg()));
  list.set("clothes", toDataUri(clothesSvg()));
  list.set("fountain", toDataUri(fountainSheetSvg()));
  list.set("lamp", toDataUri(lampSvg()));
  list.set("farm", toDataUri(farmSvg()));
  list.set("fishing", toDataUri(fishingSvg()));
  list.set("lot", toDataUri(lotSvg()));
  list.set("home:arch", toDataUri(homeArchSvg()));
  list.set("home:fence", toDataUri(fenceSvg()));
  list.set("mailbox", toDataUri(mailboxSvg()));
  list.set("mailbox:mine", toDataUri(mailboxSvg("#4a90d9")));
  for (const kind of TREE_KINDS) list.set(`tree:${kind}`, toDataUri(treeSvg(kind)));
  const kindOf = (key: string): TextureKind => (/^(walk|idle|pet):/.test(key) ? "character" : key === "fountain" ? "plain" : "world");
  return [...list].map(([key, uri]) => ({ key, uri, kind: kindOf(key) }));
}

type Npc = {
  house: TownNeighbor;
  sprite: PhaserNS.GameObjects.Sprite;
  tag: PhaserNS.GameObjects.Text;
  sheet: string;
  at: number; // 지금 (또는 막 떠난) 마디
  prev: number;
  to: number | null; // 가는 중인 마디
  wait: number; // 남은 쉬는 시간 (ms)
  dir: WalkDir;
  /** 말풍선 (말을 걸면 몇 초 동안, 그동안은 멈춰 서서 나를 본다) */
  bubble: PhaserNS.GameObjects.Container | null;
  talkUntil: number;
  lastLine: string | null;
  /** 데리고 다니는 전시 동물 (없으면 null) */
  pet: Follower | null;
  /** 가끔 멈춰서 하는 가만히 동작 (그림판 이름, 하는 중인 동작) */
  idleSheet: string;
  act: { motion: IdleMotion; start: number; hold?: number } | null;
};

export function createTownScene(
  Phaser: PhaserLib,
  data: TownData,
  images: Map<string, HTMLImageElement>,
  onEnter: (target: TownTarget) => void,
  fontFamily = "sans-serif",
  /** 처음 설 곳 (텔레포트 목록의 key, 예: "house:0"). 없으면 광장 아래쪽 */
  startAt: string | null = null,
) {
  const allSpots = (() => {
    const { places, houses } = townSpots(data);
    // 계단 양쪽 끝 (메뉴에는 없고 시험(e2e)이 캔버스의 bv-teleport 이벤트로 쓴다)
    const stairs = stairCrossings().flatMap((c, i) => [
      { key: `stair:${i}:a`, ...c.a },
      { key: `stair:${i}:b`, ...c.b },
    ]);
    return [...places, ...houses, ...stairs];
  })();
  const font = (style: PhaserNS.Types.GameObjects.Text.TextStyle = {}) => ({ fontFamily, ...style });
  /** 마을 테마 (이 마을 주인의 꾸미기 배경): 바닥 색·공기 색·날씨 */
  const theme = townTheme(data.theme);

  return class TownScene extends Phaser.Scene {
    private feet!: PhaserNS.GameObjects.Zone; // 부딪힘을 계산하는 발밑 상자
    private playerBody!: PhaserNS.Physics.Arcade.Body;
    private player!: PhaserNS.GameObjects.Sprite; // 보이는 캐릭터 그림 (발 상자를 따라간다, 걷기 그림판)
    private facing: WalkDir = "down";
    private sheet = walkKey(data.player?.characterAsset ?? VISITOR_CHARACTER, data.player?.outfit);
    private nameTag!: PhaserNS.GameObjects.Text;
    private cursors!: PhaserNS.Types.Input.Keyboard.CursorKeys;
    private wasd!: Record<"W" | "A" | "S" | "D", PhaserNS.Input.Keyboard.Key>;
    /** 이번 프레임에 Space·Enter를 눌렀는지 (keydown 이벤트로 받는다) */
    private actionQueued = false;
    private moveTarget: PhaserNS.Math.Vector2 | null = null;
    private entrances: Entrance[] = [];
    private prompt!: PhaserNS.GameObjects.Text;
    private haze!: PhaserNS.GameObjects.Image;
    private npcs: Npc[] = [];
    private graph: { nodes: { x: number; y: number }[]; links: number[][] } = { nodes: [], links: [] };
    private hoverNpc: Npc | null = null;
    /** 나를 따라다니는 동물 (내가 걸어온 자취를 밟아 온다) */
    private pet: Follower | null = null;
    /** 가만히 동작 (idle.ts): 서 있은 시간, 다음 동작을 시작할 때, 지금 하는 동작 */
    private idleSheet = idleKey(data.player?.characterAsset ?? VISITOR_CHARACTER, data.player?.outfit);
    private still = 0;
    private stillSince = 0;
    private nextIdleAt = IDLE_AFTER_MS;
    private idle: { motion: IdleMotion; start: number; hold?: number } | null = null;
    private lastIdle: string | null = null;
    /** 움직임 줄이기 설정이면 가만히 동작·날씨를 하지 않는다 */
    private reduceMotion = false;
    private weather: { img: PhaserNS.GameObjects.Image; x: number; y: number; vx: number; vy: number; phase: number }[] = [];
    private joystick: {
      base: PhaserNS.GameObjects.Arc;
      thumb: PhaserNS.GameObjects.Arc;
      pointerId: number | null;
      vector: PhaserNS.Math.Vector2;
    } | null = null;

    constructor() {
      super("town");
    }

    create() {
      for (const [key, img] of images) {
        if (this.textures.exists(key)) continue;
        // 걷기 그림판은 칸(24칸 틀 × PIXEL)마다 잘라 쓴다
        if (key.startsWith("walk:")) this.textures.addSpriteSheet(key, img, { frameWidth: PLAYER_SIZE, frameHeight: PLAYER_SIZE });
        // 분수 그림판: 3칸을 가로로 이었다 (물만 조금씩 다르다)
        else if (key.startsWith("idle:")) this.textures.addSpriteSheet(key, img, { frameWidth: IDLE_FRAME.w * PIXEL, frameHeight: IDLE_FRAME.h * PIXEL });
        else if (key.startsWith("pet:")) this.textures.addSpriteSheet(key, img, { frameWidth: PET_SIZE, frameHeight: PET_SIZE });
        else if (key === "fountain") this.textures.addSpriteSheet(key, img, { frameWidth: FOUNTAIN_SIZE.width, frameHeight: FOUNTAIN_SIZE.height });
        else this.textures.addImage(key, img);
      }
      this.walkAnims(this.sheet);
      if (!this.anims.exists("fountain:flow")) {
        this.anims.create({ key: "fountain:flow", frames: this.anims.generateFrameNumbers("fountain", { start: 0, end: FOUNTAIN_FRAMES - 1 }), frameRate: FOUNTAIN_FPS, repeat: -1 });
      }

      this.physics.world.setBounds(0, 0, WORLD.width, WORLD.height);
      this.drawGround();

      const walls = this.physics.add.staticGroup();
      const { structures, entrances } = townLayout(data);
      this.entrances = entrances;
      const props = townProps();
      for (const s of [...structures, ...props]) this.placeStructure(s, walls);

      // 플레이어: 발 상자(물리) + 그림
      const start = allSpots.find((p) => p.key === startAt) ?? START_POS;
      this.feet = this.add.zone(start.x, start.y, FEET.w, FEET.h);
      this.physics.add.existing(this.feet);
      this.playerBody = this.feet.body as PhaserNS.Physics.Arcade.Body;
      this.playerBody.setCollideWorldBounds(true);
      this.physics.add.collider(this.feet, walls);
      this.player = this.add.sprite(0, 0, this.sheet, walkFrameIndex("down", 0)).setOrigin(0.5, WALK_ORIGIN_Y);
      this.reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      this.createPet(start);

      this.nameTag = this.add
        .text(0, 0, data.player?.nickname ?? "구경하는 중", font({
          fontSize: "13px",
          fontStyle: "bold",
          color: "#2b2118",
          backgroundColor: "#ffffffe0",
          padding: { x: 7, y: 3 },
        }))
        .setOrigin(0.5);

      this.prompt = this.add
        .text(0, 0, "", font({
          fontSize: "15px",
          fontStyle: "bold",
          color: "#ffffff",
          backgroundColor: "#2b2118e6",
          padding: { x: 10, y: 6 },
        }))
        .setOrigin(0.5, 1)
        .setDepth(100000)
        .setVisible(false);

      this.createNpcs([...structures, ...props]);
      this.createHaze();
      this.createWeather();

      // 카메라
      this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
      this.cameras.main.startFollow(this.feet, true, 0.12, 0.12, 0, 20);
      this.cameras.main.setBackgroundColor(theme.bg);

      // 입력: 방향키, WASD, Space/Enter, 클릭·터치
      const keyboard = this.input.keyboard!;
      this.cursors = keyboard.createCursorKeys();
      this.wasd = keyboard.addKeys("W,A,S,D") as typeof this.wasd;
      // Space·Enter: 키를 등록해 브라우저 기본 동작(스크롤)을 막고, 누른 순간은 keydown 이벤트로 받는다.
      // 화면이 느릴 때(낮은 FPS) 한 프레임 안에 눌렀다 떼면 JustDown이 놓쳤다
      keyboard.addKey("SPACE");
      keyboard.addKey("ENTER");
      const queueAction = () => {
        this.actionQueued = true;
      };
      keyboard.on("keydown-SPACE", queueAction);
      keyboard.on("keydown-ENTER", queueAction);
      // 페이지 스크롤과 겹치지 않게 게임 안에서만 키를 쓴다
      keyboard.addCapture("UP,DOWN,LEFT,RIGHT,SPACE");

      // 터치가 주 입력인 기기(휴대폰·태블릿)에서만 조이스틱을 보여준다
      if (window.matchMedia?.("(pointer: coarse)").matches) this.createJoystick();

      this.input.on("pointerdown", (pointer: PhaserNS.Input.Pointer) => {
        // 조이스틱을 누른 경우: 걷기 목표를 정하지 않고 조이스틱으로 움직인다
        if (this.joystick && this.isOnJoystick(pointer)) {
          this.joystick.pointerId = pointer.id;
          this.moveJoystick(pointer);
          return;
        }
        // 걸어 다니는 이웃을 누르면 말풍선으로 한마디 (사용자 요청 2026-10-12). 말풍선이 떠 있을 때 한 번 더 누르거나
        // 할 말이 없으면 그 집 우체통(새 글·집에 들어가기)을 연다
        const npc = this.npcAt(pointer.worldX, pointer.worldY);
        if (npc) {
          if (npc.bubble || !npc.house.talk?.length) return onEnter({ kind: "mailbox", slot: npc.house.lot });
          return this.talkTo(npc);
        }
        const hit = this.entranceAt(pointer.worldX, pointer.worldY);
        if (hit) {
          // 가까우면 바로 들어가고, 멀면 그 입구 앞까지 걸어간다
          if (this.distanceTo(hit) <= INTERACT_DISTANCE) return onEnter(hit.target);
          this.moveTarget = new Phaser.Math.Vector2(hit.x, hit.y);
          return;
        }
        this.moveTarget = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
      });
      this.input.on("pointermove", (pointer: PhaserNS.Input.Pointer) => {
        if (this.joystick?.pointerId === pointer.id) this.moveJoystick(pointer);
        this.hoverNpc = this.npcAt(pointer.worldX, pointer.worldY);
        this.game.canvas.style.cursor = this.hoverNpc ? "pointer" : "";
      });
      const release = (pointer: PhaserNS.Input.Pointer) => {
        if (this.joystick?.pointerId === pointer.id) this.resetJoystick();
      };
      this.input.on("pointerup", release);
      this.input.on("pointerupoutside", release);

      // 메뉴에서 고른 곳으로 순간 이동 (TownGame이 game.events로 전한다)
      const teleport = (key: string) => {
        const spot = allSpots.find((p) => p.key === key);
        if (!spot) return;
        this.moveTarget = null;
        this.playerBody.reset(spot.x, spot.y);
        this.cameras.main.centerOn(spot.x, spot.y);
        this.placePet(spot);
        // 도착 표시: 반짝이는 고리
        const ring = this.add.circle(spot.x, spot.y, 18, 0xffffff, 0).setStrokeStyle(4, 0xffd36e).setDepth(spot.y + 7);
        this.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 600, onComplete: () => ring.destroy() });
      };
      this.game.events.on("teleport", teleport);
      // 시험(e2e)용: 캔버스에 bv-teleport 이벤트(detail = 텔레포트 key, 계단 끝은 stair:번호:a|b)를 보내면 그 자리로. 계단 양끝 좌표는 data-stairs
      const canvas = this.game.canvas;
      const fromTest = (e: Event) => teleport(String((e as CustomEvent).detail));
      canvas.addEventListener("bv-teleport", fromTest);
      canvas.dataset.stairs = JSON.stringify(stairCrossings().map((c) => [c.a.x, c.a.y, c.b.x, c.b.y]));
      // 시험(e2e)·스크린샷용: bv-idle 이벤트(detail = 동작 key, "key@칸"이면 그 칸에서 멈춰 둔다)를 보내면 서 있을 때 그 동작을 바로 한다
      const idleFromTest = (e: Event) => {
        const [key, hold] = String((e as CustomEvent).detail).split("@");
        const motion = IDLE_MOTIONS_BY_KEY.get(key);
        if (!motion || !this.texturesReady()) return;
        this.startIdle(motion);
        if (hold && this.idle) this.idle.hold = Number(hold);
      };
      canvas.addEventListener("bv-idle", idleFromTest);
      // 시험용: bv-npc-come(detail = 집 자리 번호) → 그 이웃을 내 오른쪽 옆에 세워 둔다 (말 걸기 시험). 자리는 data-npc-here
      const npcFromTest = (e: Event) => {
        const n = this.npcs.find((x) => x.house.lot === Number((e as CustomEvent).detail));
        if (!n) return;
        n.to = null;
        n.wait = 60000;
        if (n.act) this.endNpcAct(n);
        n.sprite.stop().setPosition(Math.round(this.feet.x + 60), Math.round(this.feet.y + 8));
        canvas.dataset.npcHere = `${Math.round(n.sprite.x)},${Math.round(n.sprite.y)}`;
      };
      canvas.addEventListener("bv-npc-come", npcFromTest);
      // 시험용: bv-npc-act(detail = "자리:동작", "자리:동작@칸"이면 그 칸에서 멈춰 둔다) → 그 이웃이 그 자리에서 그 동작을 바로 한다
      const npcActFromTest = (e: Event) => {
        const [lot, rest] = String((e as CustomEvent).detail).split(":");
        const [key, hold] = (rest ?? "").split("@");
        const n = this.npcs.find((x) => x.house.lot === Number(lot));
        const motion = IDLE_MOTIONS_BY_KEY.get(key);
        if (!n || !motion || n.bubble || !this.textures.exists(n.idleSheet)) return;
        n.to = null;
        n.act = { motion, start: this.time.now, hold: hold ? Number(hold) : undefined };
      };
      canvas.addEventListener("bv-npc-act", npcActFromTest);
      canvas.dataset.theme = theme.key;
      canvas.dataset.idle = "";
      this.events.once("shutdown", () => {
        this.game.events.off("teleport", teleport);
        canvas.removeEventListener("bv-teleport", fromTest);
        canvas.removeEventListener("bv-idle", idleFromTest);
        canvas.removeEventListener("bv-npc-come", npcFromTest);
        canvas.removeEventListener("bv-npc-act", npcActFromTest);
      });
    }

    /** 걷기: 방향마다 1~4칸을 돌린다. 멈추면 그 방향의 0칸(서 있기) */
    private walkAnims(sheet: string) {
      for (const dir of WALK_DIRS) {
        const key = `${sheet}:${dir}`;
        if (this.anims.exists(key)) continue;
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(sheet, { frames: [1, 2, 3, 4].map((f) => walkFrameIndex(dir, f)) }),
          frameRate: WALK_FPS,
          repeat: -1,
        });
      }
    }

    // ===== 가상 조이스틱 =====
    private createJoystick() {
      this.input.addPointer(1); // 조이스틱을 누른 채 다른 곳도 탭할 수 있게 두 손가락까지
      const base = this.add.circle(0, 0, JOYSTICK.radius, 0x2b2118, 0.18).setStrokeStyle(3, 0xffffff, 0.7);
      const thumb = this.add.circle(0, 0, JOYSTICK.thumb, 0xffffff, 0.85).setStrokeStyle(2, 0x2b2118, 0.4);
      for (const o of [base, thumb]) o.setScrollFactor(0).setDepth(200000);
      this.joystick = { base, thumb, pointerId: null, vector: new Phaser.Math.Vector2() };
      this.placeJoystick();
      this.scale.on("resize", () => this.placeJoystick());
    }

    /** 화면 왼쪽 아래 (화면 크기가 바뀌어도 따라간다) */
    private placeJoystick() {
      if (!this.joystick) return;
      const x = JOYSTICK.margin + JOYSTICK.radius;
      const y = this.scale.height - JOYSTICK.margin - JOYSTICK.radius;
      this.joystick.base.setPosition(x, y);
      if (this.joystick.pointerId === null) this.joystick.thumb.setPosition(x, y);
    }

    private isOnJoystick(pointer: PhaserNS.Input.Pointer) {
      const { base } = this.joystick!;
      return Phaser.Math.Distance.Between(pointer.x, pointer.y, base.x, base.y) <= JOYSTICK.radius + 20;
    }

    /** 손가락 위치 → 방향 벡터 (조이스틱 반지름 밖으로는 나가지 않는다) */
    private moveJoystick(pointer: PhaserNS.Input.Pointer) {
      const j = this.joystick!;
      const v = new Phaser.Math.Vector2(pointer.x - j.base.x, pointer.y - j.base.y);
      if (v.length() > JOYSTICK.radius) v.setLength(JOYSTICK.radius);
      j.thumb.setPosition(j.base.x + v.x, j.base.y + v.y);
      j.vector = v.length() < JOYSTICK.deadZone ? new Phaser.Math.Vector2() : v.clone().scale(1 / JOYSTICK.radius);
    }

    private resetJoystick() {
      const j = this.joystick!;
      j.pointerId = null;
      j.vector = new Phaser.Math.Vector2();
      j.thumb.setPosition(j.base.x, j.base.y);
    }

    update(time: number, delta: number) {
      const left = this.cursors.left.isDown || this.wasd.A.isDown;
      const right = this.cursors.right.isDown || this.wasd.D.isDown;
      const up = this.cursors.up.isDown || this.wasd.W.isDown;
      const down = this.cursors.down.isDown || this.wasd.S.isDown;
      // 계단에서는 조금 느리게
      const t = terrain();
      const onStairs = t.stairs[Math.floor(this.feet.y / PIXEL) * t.w + Math.floor(this.feet.x / PIXEL)] === 1;
      const speed = SPEED * (onStairs ? STAIRS_SPEED : 1);

      let v = new Phaser.Math.Vector2(0, 0);
      if (left || right || up || down) {
        this.moveTarget = null;
        v = new Phaser.Math.Vector2((right ? 1 : 0) - (left ? 1 : 0), (down ? 1 : 0) - (up ? 1 : 0)).normalize().scale(speed);
      } else if (this.joystick && this.joystick.vector.lengthSq() > 0) {
        // 조이스틱: 많이 밀수록 빠르게 (최대 SPEED)
        this.moveTarget = null;
        v = this.joystick.vector.clone().scale(speed);
      } else if (this.moveTarget) {
        const d = Phaser.Math.Distance.Between(this.feet.x, this.feet.y, this.moveTarget.x, this.moveTarget.y);
        if (d < 8 || this.playerBody.blocked.none === false) this.moveTarget = null;
        else v = new Phaser.Math.Vector2(this.moveTarget.x - this.feet.x, this.moveTarget.y - this.feet.y).setLength(speed);
      }
      // 땅: 다음 자리에 발 상자가 절벽·물·낭떠러지에 걸리면 그 방향은 멈춘다 (한쪽만 막히면 미끄러져 간다).
      // 땅은 작은 발 상자(TERRAIN_FEET)로 본다. 계단 입구 모서리에 걸리면 옆으로 살짝 밀어 계단 쪽으로 들어가게 한다
      if (v.x || v.y) {
        const look = Math.max(0.05, Math.min(delta, 60) / 1000) * 1.2;
        const { x, y } = this.feet;
        const ok = (px: number, py: number) => boxWalkable(px, py, TERRAIN_FEET.w, TERRAIN_FEET.h);
        // 이미 막힌 곳에 서 있으면(순간 이동 등) 막지 않는다 (빠져나올 수 있게)
        if (ok(x, y)) {
          const okX = !v.x || ok(x + v.x * look, y);
          const okY = !v.y || ok(x, y + v.y * look);
          if (okX && okY && v.x && v.y && !ok(x + v.x * look, y + v.y * look)) v.y = 0;
          if (!okY && !v.x) {
            // 위아래로 가다 막히면: 옆 24px 안에 지나갈 틈이 있으면 그쪽으로 미끄러진다
            for (let k = 3; k <= 24; k += 3) {
              const side = ok(x - k, y + v.y * look) && ok(x - k, y) ? -1 : ok(x + k, y + v.y * look) && ok(x + k, y) ? 1 : 0;
              if (side) {
                v.x = side * Math.abs(v.y);
                break;
              }
            }
          } else if (!okX && !v.y) {
            for (let k = 3; k <= 24; k += 3) {
              const side = ok(x + v.x * look, y - k) && ok(x, y - k) ? -1 : ok(x + v.x * look, y + k) && ok(x, y + k) ? 1 : 0;
              if (side) {
                v.y = side * Math.abs(v.x);
                break;
              }
            }
          }
          if (!okX) v.x = 0;
          if (!okY) v.y = 0;
          if (!v.x && !v.y) this.moveTarget = null;
        }
      }
      this.playerBody.setVelocity(v.x, v.y);

      // 그림은 발 상자를 따라간다. 걷는 방향의 걷기 그림을 돌리고(통통 튀는 것도 그림에 있다), 멈추면 그 방향으로 서 있는다.
      // 벽에 막혀 제자리걸음일 때는 걷지 않는다 (속도는 남아도 실제로 움직이지 않는다)
      const { velocity } = this.playerBody;
      const dir = this.playerBody.speed > 1 && (this.playerBody.deltaAbsX() > 0.2 || this.playerBody.deltaAbsY() > 0.2) ? walkDirOf(velocity.x, velocity.y) : null;
      // 가만히 서 있으면(누르는 키·조이스틱·가는 곳이 없을 때) 잠시 뒤 재미있는 동작을 하나 한다. 움직이면 바로 멈춘다
      const pressing = left || right || up || down || !!this.moveTarget || (this.joystick?.vector.lengthSq() ?? 0) > 0;
      // 시간은 실제 시각(time)으로 잰다: 화면이 느리면 Phaser가 프레임 사이 시간(delta)을 줄여 주어 몇 배 늦어진다
      if (dir || pressing) {
        this.stopIdle();
        this.stillSince = time;
        this.nextIdleAt = IDLE_AFTER_MS;
      }
      this.still = time - this.stillSince;
      if (dir) {
        this.facing = dir;
        this.player.play(`${this.sheet}:${dir}`, true);
      } else if (this.idle || (!this.reduceMotion && this.still >= this.nextIdleAt && this.texturesReady())) {
        this.updateIdle(time);
      } else if (this.player.anims.isPlaying || this.player.frame.name !== String(walkFrameIndex(this.facing, 0))) {
        this.player.stop();
        this.player.setFrame(walkFrameIndex(this.facing, 0));
      }
      // 시험(e2e)이 읽는 걷기 상태: "walk-left" / "idle-down"
      const walk = `${dir ? "walk" : "idle"}-${this.facing}`;
      if (this.game.canvas.dataset.walk !== walk) this.game.canvas.dataset.walk = walk;
      // 시험(e2e)이 읽는 카메라 위치 "x,y" (월드 → 화면)
      const cam = `${Math.round(this.cameras.main.scrollX)},${Math.round(this.cameras.main.scrollY)}`;
      if (this.game.canvas.dataset.cam !== cam) this.game.canvas.dataset.cam = cam;
      // 시험(e2e)이 읽는 발 위치 "x,y"
      const feetAt = `${Math.round(this.feet.x)},${Math.round(this.feet.y)}`;
      if (this.game.canvas.dataset.feet !== feetAt) this.game.canvas.dataset.feet = feetAt;
      this.player.setPosition(this.feet.x, this.feet.y + 8);
      // 가만히 동작 중에는 그림판이 위로 더 길어(하트·음표) 이름표를 그만큼 올린다
      this.nameTag.setPosition(this.feet.x, this.feet.y - PLAYER_SIZE - 4 - (this.idle ? IDLE_LIFT : 0));
      // 아래쪽에 있을수록 앞에 그린다 (y-sorting)
      this.player.setDepth(this.feet.y + 8);
      this.hazeTint(this.player, this.feet.y);
      this.nameTag.setDepth(LABEL_DEPTH + this.feet.y);

      this.updatePet(delta);
      this.updateNpcs(delta);
      this.updatePrompt();
      this.updateWeather(delta);
    }

    // ===== 가만히 동작 (사용자 요청 2026-10-12) =====
    private texturesReady() {
      return this.textures.exists(this.idleSheet);
    }

    /** 동작 시작: 가만히 그림판으로 바꾸고 (발 위치가 같도록 원점도) 처음 칸부터 */
    private startIdle(motion: IdleMotion) {
      this.player.stop();
      this.idle = { motion, start: this.time.now };
      this.lastIdle = motion.key;
      this.player.setTexture(this.idleSheet, idleFrameIndex(motion.key, 0)).setOrigin(0.5, IDLE_ORIGIN_Y);
      this.game.canvas.dataset.idle = motion.key;
      this.updateIdle(this.time.now);
    }

    /** 동작 그만: 걷기 그림판의 서 있기 칸으로 (보던 방향 그대로) */
    private stopIdle() {
      if (!this.idle) return;
      this.idle = null;
      this.player.setTexture(this.sheet, walkFrameIndex(this.facing, 0)).setOrigin(0.5, WALK_ORIGIN_Y);
      this.game.canvas.dataset.idle = "";
      delete this.game.canvas.dataset.idleFrame;
    }

    private updateIdle(now: number) {
      if (!this.idle) {
        this.startIdle(pickIdleMotion(Math.random(), this.lastIdle));
        return;
      }
      const f = this.idle.hold ?? idleFrameAt(this.idle.motion, now - this.idle.start);
      if (f === null) {
        // 끝나면 한동안 쉬었다가 다른 동작
        this.stopIdle();
        this.nextIdleAt = this.still + IDLE_GAP_MS[0] + Math.random() * (IDLE_GAP_MS[1] - IDLE_GAP_MS[0]);
        return;
      }
      const index = idleFrameIndex(this.idle.motion.key, f);
      if (this.player.frame.name !== String(index)) this.player.setFrame(index);
      const at = `${this.idle.motion.key}:${f}`;
      if (this.game.canvas.dataset.idleFrame !== at) this.game.canvas.dataset.idleFrame = at;
    }

    // ===== 날씨 (마을 테마) =====
    private createWeather() {
      const kind = theme.weather;
      this.game.canvas.dataset.weather = kind && !this.reduceMotion ? kind : "";
      if (!kind || this.reduceMotion) return;
      const spec = WEATHER[kind];
      const key = `fx:${kind}`;
      if (!this.textures.exists(key)) {
        const canvas = document.createElement("canvas");
        canvas.width = spec.rows[0].length;
        canvas.height = spec.rows.length;
        const ctx = canvas.getContext("2d")!;
        spec.rows.forEach((row, y) =>
          [...row].forEach((ch, x) => {
            if (ch === ".") return;
            ctx.fillStyle = spec.colors[ch];
            ctx.fillRect(x, y, 1, 1);
          }),
        );
        this.textures.addCanvas(key, canvas);
      }
      // 화면이 커져도 넉넉하게 (가장 큰 화면 기준으로 한 번 만든다)
      const count = Math.round((Math.max(this.scale.width, 1280) * Math.max(this.scale.height, 800)) / spec.per);
      for (let i = 0; i < count; i++) {
        const img = this.add.image(0, 0, key).setOrigin(0, 0).setScale(PIXEL).setScrollFactor(0).setDepth(WEATHER_DEPTH);
        // 눈송이는 크기가 둘 (반은 도트 한 칸)
        if (kind === "snow" && i % 2) img.setCrop(0, 0, 1, 1);
        const slow = kind === "fireflies" || kind === "stars" || kind === "glints";
        this.weather.push({
          img,
          x: Math.random() * 4000,
          y: Math.random() * 4000,
          vx: kind === "petals" ? 18 + Math.random() * 22 : slow ? 0 : (Math.random() - 0.5) * 8,
          vy: kind === "snow" ? 26 + Math.random() * 30 : kind === "petals" ? 30 + Math.random() * 25 : 0,
          phase: Math.random() * Math.PI * 2,
        });
      }
      this.game.canvas.dataset.weatherCount = String(count);
    }

    private updateWeather(delta: number) {
      if (!this.weather.length) return;
      const dt = Math.min(delta, 60) / 1000;
      const now = this.time.now / 1000;
      const kind = theme.weather!;
      const { width, height } = this.scale;
      const cam = this.cameras.main;
      const wrap = (v: number, n: number) => ((v % n) + n) % n;
      for (const p of this.weather) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (kind === "snow") p.x += Math.sin(now * 1.3 + p.phase) * 14 * dt;
        if (kind === "fireflies") {
          p.x += Math.sin(now * 0.7 + p.phase) * 16 * dt;
          p.y += Math.cos(now * 0.9 + p.phase * 1.7) * 12 * dt;
        }
        // 마을에 붙은 자리: 카메라가 움직이면 같이 지나간다. 화면 크기로 되풀이 (도트 칸에 맞춘 정수 자리)
        const sx = wrap(p.x - cam.scrollX, width + 12) - 6;
        const sy = wrap(p.y - cam.scrollY, height + 12) - 6;
        p.img.setPosition(Math.round(sx), Math.round(sy));
        if (kind === "petals") p.img.setFlipX(Math.sin(now * 4 + p.phase) > 0);
        else if (kind !== "snow") p.img.setAlpha(Math.max(0, Math.sin(now * (kind === "fireflies" ? 1.6 : 2.2) + p.phase)) ** 2);
      }
    }

    // ===== 따라다니는 동물 =====
    /** 동물 하나를 만든다 (그림이 없으면 null). 발바닥(32칸 중 30번째 줄)이 발 위치에 오게, 캐릭터처럼 발 위치 + 8에 그린다 */
    private makeFollower(pet: TownPet, at: { x: number; y: number }): Follower | null {
      if (!this.textures.exists(petKey(pet))) return null;
      const img = this.add.image(0, 0, petKey(pet), 0).setOrigin(0.5, 30 / 32);
      const f: Follower = { img, x: 0, y: 0, hop: 0, idle: 0, vx: 0, vy: 0, walking: false, face: "right", trail: [], frame: 0, gait: petGait(pet.assetKey), ...petGaps(pet.assetKey, pet.size, pet) };
      this.placeFollower(f, at);
      return f;
    }

    private createPet(start: { x: number; y: number }) {
      if (!data.pet) return;
      this.pet = this.makeFollower(data.pet, start);
      if (!this.pet) return;
      this.game.canvas.dataset.pet = data.pet.assetKey;
      this.game.canvas.dataset.petSize = ANIMAL_SIZE[data.pet.assetKey]?.tier ?? "medium";
      this.game.canvas.dataset.petSkin = data.pet.skinKey ?? "";
      this.game.canvas.dataset.petDisplaySize = data.pet.size ?? "normal";
      this.game.canvas.dataset.petDisplayForm = data.pet.form ?? "adult";
      this.game.canvas.dataset.petSex = data.pet.sex ?? "";
      this.game.canvas.dataset.petVariant = data.pet.variant ?? "";
      this.game.canvas.dataset.petGait = String(this.pet.gait.speed);
    }

    /** 내 동물을 내 옆에 바로 놓는다 (처음·순간 이동) */
    private placePet(at: { x: number; y: number }) {
      if (this.pet) this.placeFollower(this.pet, at);
    }

    /** 주인 옆(왼쪽 조금 앞)에 바로 놓고 자취를 새로 시작한다 */
    private placeFollower(f: Follower, at: { x: number; y: number }) {
      f.x = at.x - f.gap;
      f.y = at.y + 6; // 조금 앞(아래)에 둬서 큰 동물 머리가 주인 이름표에 가리지 않게
      // 자취를 동물 자리에서 시작해 첫걸음부터 바로 따라온다 (자취가 gap만큼 쌓일 때까지 기다렸다 뛰어오지 않게)
      f.trail = [{ x: f.x, y: f.y }, { x: at.x, y: at.y }];
      Object.assign(f, { hop: 0, vx: 0, vy: 0, walking: false });
    }

    private updatePet(delta: number) {
      const pet = this.pet;
      if (!pet) return;
      this.stepFollower(pet, { x: this.feet.x, y: this.feet.y }, delta);
      // 시험(e2e)이 읽는 동물 발 위치 "x,y"와 걷는지
      const at = `${Math.round(pet.x)},${Math.round(pet.y)}`;
      const canvas = this.game.canvas;
      if (canvas.dataset.petAt !== at) canvas.dataset.petAt = at;
      const state = pet.walking ? "walk" : "idle";
      if (canvas.dataset.petFace !== pet.face) canvas.dataset.petFace = pet.face;
      if (canvas.dataset.petFrame !== String(pet.frame)) canvas.dataset.petFrame = String(pet.frame);
      if (canvas.dataset.petWalk !== state) canvas.dataset.petWalk = state;
    }

    /** 동물 한 마리를 주인(me = 주인 발 위치) 뒤로 한 프레임 따라오게 한다 */
    private stepFollower(pet: Follower, me: { x: number; y: number }, delta: number) {
      const dt = Math.min(delta, 50);
      const trail = pet.trail;
      // 자취: 1px 넘게 움직일 때마다 점을 찍는다 (촘촘해야 목표가 뚝뚝 끊기지 않는다)
      const last = trail[trail.length - 1];
      if (!last || Math.hypot(me.x - last.x, me.y - last.y) >= 1) {
        trail.push(me);
        if (trail.length > 600) trail.shift();
      }
      // 자취를 내 발에서 거꾸로 pet.gap만큼 되짚은 정확한 점 (두 자취 점 사이를 잇는다). 자취가 짧으면 맨 끝 점
      let target: { x: number; y: number } | null = null;
      let walked = 0;
      let prev = me;
      for (let i = trail.length - 1; i >= 0; i--) {
        const pt = trail[i];
        const seg = Math.hypot(prev.x - pt.x, prev.y - pt.y);
        if (walked + seg >= pet.gap) {
          const k = seg > 0 ? (pet.gap - walked) / seg : 0;
          target = { x: prev.x + (pt.x - prev.x) * k, y: prev.y + (pt.y - prev.y) * k };
          // 더 오래된 자취는 필요 없다 (이 점까지는 남긴다)
          if (i > 0) trail.splice(0, i);
          break;
        }
        walked += seg;
        prev = pt;
      }
      if (!target && trail.length > 0 && walked > pet.gap * 0.5) target = trail[0];
      // 위아래로 따라올 때는 내 바로 위(이름표 자리)에 가려지지 않게 옆으로 비켜 나란히 걷는다 (위쪽으로는 PET_UP까지만 처진다)
      if (target && Math.abs(me.y - target.y) > Math.abs(me.x - target.x)) {
        target = { x: me.x + (pet.x <= me.x ? -pet.side : pet.side), y: Math.max(target.y, me.y - PET_UP) };
      }
      const [ox, oy] = [pet.x, pet.y];
      if (target) {
        const dx = target.x - pet.x;
        const dy = target.y - pet.y;
        const dist = Math.hypot(dx, dy);
        if (dist > PET_SNAP) {
          pet.x = target.x;
          pet.y = target.y;
        } else if (dist > 0.01) {
          // 지수 감쇠로 다가간다 (프레임 시간 기준이라 60Hz·144Hz 모두 같은 빠르기). 너무 멀면 가장 빠른 걸음까지만
          const step = Math.min(dist * (1 - Math.exp(-dt / PET_EASE_MS)), (PET_MAX_SPEED * pet.gait.speed * dt) / 1000);
          pet.x += (dx / dist) * step;
          pet.y += (dy / dist) * step;
        }
      }
      // 속도를 부드럽게 재서 걷기/서기를 정한다 (문턱 두 개: 프레임마다 깜빡이지 않게)
      if (dt > 0) {
        const k = 1 - Math.exp(-dt / 90);
        pet.vx += (((pet.x - ox) * 1000) / dt - pet.vx) * k;
        pet.vy += (((pet.y - oy) * 1000) / dt - pet.vy) * k;
      }
      const speed = Math.hypot(pet.vx, pet.vy);
      pet.walking = speed > (pet.walking ? PET_WALK_OFF : PET_WALK_ON);
      const moving = pet.walking;
      // 움직임: 걸으면 걸은 거리만큼 착지·기욺·뛰어오름 그림을 넘기며 통통 뛰고(PET_WALK_*), 서 있으면 숨쉬기 두 칸.
      // 걷기 그림은 멈췄다 다시 걸을 때만 처음부터 (걷는 동안 되돌리지 않는다)
      if (moving) {
        pet.hop += Math.hypot(pet.x - ox, pet.y - oy);
        pet.idle = 0;
      } else {
        pet.hop = 0;
        pet.idle += delta;
      }
      // 가로로 움직이는 쪽을 보고, 멈추면 나를 본다 (그림판 아래 줄 = 왼쪽 보기). 문턱을 둬서 좌우로 떨지 않게
      const dxMe = me.x - pet.x;
      if (moving && Math.abs(pet.vx) > 20) pet.face = pet.vx < 0 ? "left" : "right";
      else if (!moving && Math.abs(dxMe) > 12) pet.face = dxMe < 0 ? "left" : "right";
      const step = Math.floor(pet.hop / (PET_HOP_PX * pet.gait.stride)) % PET_WALK_FRAMES.length;
      const frame = moving ? PET_WALK_FRAMES[step] : PET_IDLE_FRAMES[Math.floor(pet.idle / PET_BREATH_MS) % PET_IDLE_FRAMES.length];
      const index = frame + (pet.face === "left" ? PET_SHEET_FRAMES : 0);
      if (pet.img.frame.name !== String(index)) pet.img.setFrame(index);
      pet.frame = frame;
      const lift = moving ? -pet.gait.lift[step] * PIXEL : 0;
      // 캐릭터처럼 소수 자리 그대로 둔다 (roundPixels가 카메라와 함께 맞춘다. 따로 반올림하면 카메라와 1px씩 어긋나 떨린다)
      pet.img.setPosition(pet.x, pet.y + 8 + lift).setDepth(pet.y + 8);
      this.hazeTint(pet.img, pet.y);
    }

    private updatePrompt() {
      let closest: Entrance | null = null;
      let best = INTERACT_DISTANCE;
      for (const e of this.entrances) {
        const d = this.distanceTo(e);
        if (d <= best) {
          best = d;
          closest = e;
        }
      }
      // 규칙: 건물·집 입구 안내가 떠 있으면 Space는 들어가기. 입구가 없을 때만 가까운(NPC_TALK 안) 이웃에게 말을 건다
      const npc = closest ? null : this.nearestNpc();
      if (closest) {
        const verb = closest.target.kind === "login" ? "로그인하고 이용하기" : (closest.verb ?? "들어가기");
        this.prompt.setText(`${closest.emoji} ${closest.label} · Space ${verb}`);
        this.prompt.setPosition(closest.x, closest.promptY).setVisible(true);
        if (this.actionQueued) onEnter(closest.target);
      } else if (npc) {
        this.prompt.setText(`💬 ${npc.house.nickname} · Space 말 걸기`);
        this.prompt.setPosition(npc.sprite.x, npc.sprite.y + 34).setVisible(!npc.bubble);
        if (this.actionQueued) this.talkTo(npc);
      } else {
        this.prompt.setVisible(false);
      }
      // 입구에서 멀 때 누른 것은 버린다 (나중에 입구 앞에 갔을 때 저절로 들어가지 않게)
      this.actionQueued = false;
    }

    /** 입구(문 앞)까지의 거리 */
    private distanceTo(e: Entrance) {
      return Phaser.Math.Distance.Between(this.feet.x, this.feet.y, e.x, e.y);
    }

    private entranceAt(x: number, y: number) {
      return this.entrances.find((e) => x >= e.area.x && x <= e.area.x + e.area.w && y >= e.area.y && y <= e.area.y + e.area.h + 20);
    }

    private placeStructure(s: Structure, walls: PhaserNS.Physics.Arcade.StaticGroup) {
      // 깊이 = 아랫변의 y. 캐릭터가 뒤(위쪽)에 있으면 가려지고, 앞(아래쪽)에 있으면 앞에 보인다
      const img = s.anim
        ? this.add.sprite(s.x, s.y, s.texture, 0).setOrigin(0.5, 1).setDepth(s.y).play(s.anim)
        : this.add.image(s.x, s.y, s.texture).setOrigin(0.5, 1).setDepth(s.y);
      this.hazeTint(img, s.y);
      // 바닥에 닿는 그림자 (빛은 왼쪽 위: 그림자는 살짝 오른쪽 아래)
      if (s.shadow) this.add.image(s.x + 6, s.y + 2, this.shadowTexture(s.shadow)).setOrigin(0.5, 0.6).setScale(PIXEL).setDepth(-5);
      const box = solidBox(s);
      if (box) walls.add(this.add.zone(box.x, box.y, box.w, box.h));
      if (s.label) {
        this.add
          .text(s.x, s.y + 6, s.label.length > 12 ? `${s.label.slice(0, 12)}…` : s.label, font({
            fontSize: "14px",
            fontStyle: "bold",
            color: "#2b2118",
            backgroundColor: "#fff8ece6",
            padding: { x: 7, y: 3 },
          }))
          .setOrigin(0.5, 0)
          .setDepth(LABEL_DEPTH + s.y);
      }
    }

    /** 멀리(북쪽) 있는 그림일수록 공기 색을 살짝 덮는다 (바닥과 같은 세기, 대기 원근). 밝게만 하는 SCREEN 색조 */
    private hazeTint(obj: PhaserNS.GameObjects.Image | PhaserNS.GameObjects.Sprite, y: number) {
      const a = hazeAt(y);
      if (a <= 0.005) {
        if (obj.tintMode !== Phaser.TintModes.MULTIPLY) obj.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
        return;
      }
      const c = Phaser.Display.Color.HexStringToColor(theme.haze);
      obj.setTint(Phaser.Display.Color.GetColor(c.red * a, c.green * a, c.blue * a)).setTintMode(Phaser.TintModes.SCREEN);
    }

    /** 납작한 도트 그림자 (너비 px). 안쪽은 진하게, 둘레는 옅게 두 겹 */
    private shadowTexture(widthPx: number) {
      const w = Math.max(8, Math.round(widthPx / PIXEL / 2) * 2);
      const key = `shadow:${w}`;
      if (this.textures.exists(key)) return key;
      const h = Math.max(4, Math.round(w * 0.22));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const dx = (x + 0.5 - w / 2) / (w / 2);
          const dy = (y + 0.5 - h / 2) / (h / 2);
          const d = dx * dx + dy * dy;
          if (d > 1) continue;
          ctx.fillStyle = d < 0.55 ? "rgba(34,52,30,0.26)" : "rgba(34,52,30,0.14)";
          ctx.fillRect(x, y, 1, 1);
        }
      // 도트 한 칸 = PIXEL px (pixelArt: 가까운 픽셀로 키운다)
      this.textures.addCanvas(key, canvas);
      return key;
    }

    /**
     * 바닥: 도트 해상도(한 칸 = PIXEL px)로 한 번만 구운 그림 한 장을 PIXEL배로 키워 깐다 (ground.ts).
     * 게임 설정의 pixelArt(가까운 픽셀로 키우기) 덕분에 흐려지지 않는다
     */
    private drawGround() {
      const ground = `ground:${theme.key}`;
      if (!this.textures.exists(ground)) {
        const canvas = document.createElement("canvas");
        canvas.width = GROUND_SIZE.w;
        canvas.height = GROUND_SIZE.h;
        const ctx = canvas.getContext("2d")!;
        ctx.putImageData(new ImageData(bakeGround(theme.key) as Uint8ClampedArray<ArrayBuffer>, GROUND_SIZE.w, GROUND_SIZE.h), 0, 0);
        this.textures.addCanvas(ground, canvas);
      }
      this.add.image(0, 0, ground).setOrigin(0, 0).setScale(PIXEL).setDepth(-10);
    }

    /**
     * 원근감 (멀리 있는 것은 옅고 푸르게, 사용자 요청 "멀리 있으면 한 점에 모이는 느낌"): 화면 위쪽에 하늘빛 공기를 얇게 덮는다.
     * 화면에 붙어 있어(scrollFactor 0) 어디서든 화면 위쪽이 먼 곳처럼 보인다. 아래 가장자리는 아주 살짝 어둡게
     */
    private createHaze() {
      const hazeKey = `haze:${theme.key}`;
      const [hr, hg, hb] = rgbOf(theme.haze);
      if (!this.textures.exists(hazeKey)) {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 32;
        const ctx = canvas.getContext("2d")!;
        for (let y = 0; y < 32; y++) {
          const t = y / 31;
          // 위 45%: 하늘빛, 맨 아래 10%: 그늘
          const top = Math.max(0, 1 - t / 0.45) ** 1.6 * 0.3;
          const bottom = Math.max(0, (t - 0.88) / 0.12) ** 2 * 0.12;
          ctx.fillStyle = top > 0 ? `rgba(${hr},${hg},${hb},${top.toFixed(3)})` : `rgba(30,40,40,${bottom.toFixed(3)})`;
          ctx.fillRect(0, y, 1, 1);
        }
        this.textures.addCanvas(hazeKey, canvas);
      }
      this.haze = this.add.image(0, 0, hazeKey).setOrigin(0, 0).setScrollFactor(0).setDepth(HAZE_DEPTH);
      const fit = () => this.haze.setDisplaySize(this.scale.width, this.scale.height);
      fit();
      this.scale.on("resize", fit);
    }

    // ===== 걸어 다니는 이웃 (NPC) =====
    private createNpcs(things: Structure[]) {
      const solids = things.map(solidBox).filter((b) => b !== null);
      // 내 집 앞은 비워 둔다 (사용자 요청 2026-10-11)
      const home = houseSlot(0);
      const g = npcGraph([{ x: home.x, y: home.y + 46, r: NPC_AVOID_HOME }]);
      // 건물·나무에 막히는 줄은 뺀다
      g.links = g.links.map((ls, i) => ls.filter((j) => segmentClear(g.nodes[i], g.nodes[j], solids)));
      this.graph = g;
      const usable = g.nodes.map((_, i) => i).filter((i) => g.links[i].length > 0);
      for (let i = 1; i < HOUSE_SLOTS; i++) {
        const house = houseAt(data, i) as TownNeighbor | null;
        if (!house || !usable.length) continue;
        const sheet = walkKey(house.characterAsset, house.outfit);
        if (!this.textures.exists(sheet)) continue;
        this.walkAnims(sheet);
        // 마을 여기저기에서 시작한다 (집 앞에 모여 서 있지 않게): 자리 번호로 고른 마디
        const start = usable[Math.floor((((i * 7919) % 104729) / 104729) * usable.length)];
        const p = g.nodes[start];
        const sprite = this.add.sprite(p.x, p.y + 8, sheet, walkFrameIndex("down", 0)).setOrigin(0.5, 0.94).setDepth(p.y + 8);
        const tag = this.add
          .text(p.x, p.y - PLAYER_SIZE - 2, house.nickname, font({ fontSize: "12px", fontStyle: "bold", color: "#2b2118", backgroundColor: "#fff8ecd9", padding: { x: 6, y: 2 } }))
          .setOrigin(0.5)
          .setVisible(false);
        const idleSheet = idleKey(house.characterAsset, house.outfit);
        const pet = house.pet ? this.makeFollower(house.pet, p) : null;
        this.npcs.push({ house, sprite, tag, sheet, at: start, prev: -1, to: null, wait: 400 + Math.random() * 2500, dir: "down", bubble: null, talkUntil: 0, lastLine: null, pet, idleSheet, act: null });
      }
      this.game.canvas.dataset.npcs = String(this.npcs.length);
      // 시험(e2e)이 읽는 이웃이 데리고 다니는 동물 수
      this.game.canvas.dataset.npcPets = String(this.npcs.filter((n) => n.pet).length);
    }

    private updateNpcs(delta: number) {
      const g = this.graph;
      let walking = 0;
      let acting = 0;
      for (const n of this.npcs) {
        const pos = { x: n.sprite.x, y: n.sprite.y - 8 };
        // 말하는 동안은 멈춰 서서 나를 본다. 다 말하면 말풍선을 치우고 다시 걷는다
        if (n.bubble) {
          if (this.time.now < n.talkUntil) {
            n.bubble.setPosition(Math.round(n.sprite.x), Math.round(n.sprite.y - PLAYER_SIZE - 8));
            n.tag.setVisible(false);
            if (n.pet) this.stepFollower(n.pet, { x: n.sprite.x, y: n.sprite.y - 8 }, delta);
            continue;
          }
          n.bubble.destroy();
          n.bubble = null;
          if (this.game.canvas.dataset.npcSay) this.game.canvas.dataset.npcSay = "";
        }
        if (n.to === null && n.act) {
          // 멈춰서 동작 중: 끝날 때까지 떠나지 않는다 (실제 시각으로 재생)
          const f = n.act.hold ?? idleFrameAt(n.act.motion, this.time.now - n.act.start);
          if (f === null) this.endNpcAct(n);
          else {
            const index = idleFrameIndex(n.act.motion.key, f);
            if (n.sprite.texture.key !== n.idleSheet) n.sprite.stop().setTexture(n.idleSheet, index).setOrigin(0.5, IDLE_ORIGIN_Y);
            else if (n.sprite.frame.name !== String(index)) n.sprite.setFrame(index);
            acting++;
          }
        } else if (n.to === null) {
          n.wait -= delta;
          if (n.wait <= 0) {
            const options = g.links[n.at];
            if (options.length) {
              // 막 지나온 길로 바로 돌아가지는 않는다 (막다른 길이면 돌아간다)
              const ahead = options.filter((j) => j !== n.prev);
              const pick = ahead.length ? ahead : options;
              n.to = pick[Math.floor(Math.random() * pick.length)];
            } else n.wait = 1500;
          }
        }
        if (n.to !== null) {
          const target = g.nodes[n.to];
          const dx = target.x - pos.x;
          const dy = target.y - pos.y;
          const dist = Math.hypot(dx, dy);
          const step = (NPC_SPEED * Math.min(delta, 60)) / 1000;
          if (dist <= step) {
            n.sprite.setPosition(target.x, target.y + 8);
            n.prev = n.at;
            n.at = n.to;
            n.to = null;
            // 갈림길에서는 잠깐 둘러보고, 막다른 곳(집 앞 등)은 짧게, 길 중간 마디는 그냥 지나간다
            const ways = g.links[n.at].length;
            n.wait = ways > 2 ? 1000 + Math.random() * 3000 : ways === 1 ? 300 + Math.random() * 700 : Math.random() < 0.06 ? 1500 + Math.random() * 2500 : 0;
            // 가끔(쉬는 곳의 40%) 멈춰서 재미있는 동작을 하나 하고 다시 걷는다 (사용자 요청 2026-10-12 "가끔 멈춰서 다른 모션도")
            if (!this.reduceMotion && this.textures.exists(n.idleSheet) && (n.wait >= 1000 || Math.random() < 0.08) && Math.random() < 0.4) {
              n.act = { motion: pickIdleMotion(Math.random(), n.act?.motion.key ?? null), start: this.time.now };
            }
          } else {
            if (n.act) this.endNpcAct(n);
            n.sprite.setPosition(pos.x + (dx / dist) * step, pos.y + (dy / dist) * step + 8);
            const dir = walkDirOf(dx, dy);
            if (dir) n.dir = dir;
            n.sprite.play(`${n.sheet}:${n.dir}`, true);
            walking++;
          }
        }
        if (n.pet) this.stepFollower(n.pet, { x: n.sprite.x, y: n.sprite.y - 8 }, delta);
        if (n.to === null && !n.act && n.sprite.anims.isPlaying) {
          n.sprite.stop();
          n.sprite.setFrame(walkFrameIndex(n.dir === "up" ? "down" : n.dir, 0));
        }
        n.sprite.setDepth(n.sprite.y);
        this.hazeTint(n.sprite, n.sprite.y);
        // 이름표: 가까이 가거나 마우스를 올리면
        const near = Math.hypot(n.sprite.x - this.feet.x, n.sprite.y - 8 - this.feet.y) < NPC_NEAR;
        n.tag.setVisible(near || this.hoverNpc === n).setPosition(n.sprite.x, n.sprite.y - PLAYER_SIZE - 6 - (n.act ? IDLE_LIFT : 0)).setDepth(LABEL_DEPTH + n.sprite.y);
      }
      const state = String(walking);
      if (this.game.canvas.dataset.npcWalking !== state) this.game.canvas.dataset.npcWalking = state;
      // 시험(e2e)이 읽는 지금 동작 중인 이웃 수
      if (this.game.canvas.dataset.npcActing !== String(acting)) this.game.canvas.dataset.npcActing = String(acting);
    }

    /** 이웃의 가만히 동작 끝: 걷기 그림판의 서 있기로 */
    private endNpcAct(n: Npc) {
      n.act = null;
      n.sprite.setTexture(n.sheet, walkFrameIndex(n.dir === "up" ? "down" : n.dir, 0)).setOrigin(0.5, WALK_ORIGIN_Y);
    }

    /** 말을 걸 수 있는 가장 가까운 이웃 (할 말이 있는 이웃만) */
    private nearestNpc() {
      let best: Npc | null = null;
      let bestD = NPC_TALK;
      for (const n of this.npcs) {
        if (!n.house.talk?.length) continue;
        const d = Math.hypot(n.sprite.x - this.feet.x, n.sprite.y - 8 - this.feet.y);
        if (d <= bestD) [best, bestD] = [n, d];
      }
      return best;
    }

    /**
     * 말 걸기: 이웃의 말풍선 후보(마을 한마디, 없으면 공개 글의 문장) 중 하나를 무작위로 (바로 앞 문장은 되도록 피한다).
     * 말풍선은 도트 상자(흰 바탕 + 3px 외곽선 + 계단 꼬리)와 Phaser 글자라 HTML로 해석되지 않는다
     */
    private talkTo(n: Npc) {
      const lines = n.house.talk ?? [];
      if (!lines.length) return;
      const pool = lines.length > 1 ? lines.filter((l) => l !== n.lastLine) : lines;
      const line = pool[Math.floor(Math.random() * pool.length)];
      n.lastLine = line;
      if (n.act) this.endNpcAct(n);
      n.bubble?.destroy();
      const text = this.add.text(0, 0, line, font({ fontSize: "13px", color: "#2b2118", lineSpacing: 2, wordWrap: { width: 186, useAdvancedWrap: true } }));
      const P = PIXEL;
      // 상자 크기는 도트 칸(3px)의 배수
      const w = Math.ceil((text.width + 16) / P) * P;
      const h = Math.ceil((text.height + 12) / P) * P;
      const g = this.add.graphics();
      const ink = 0x4a3426;
      // 외곽선 (모서리 한 칸은 깎는다) → 흰 바탕 → 아래 가운데 계단 꼬리
      g.fillStyle(ink).fillRect(-w / 2 + P, -h - 3 * P, w - 2 * P, h).fillRect(-w / 2, -h - 2 * P, w, h - 2 * P);
      g.fillStyle(0xfffaf0).fillRect(-w / 2 + P, -h - 2 * P, w - 2 * P, h - 2 * P);
      g.fillStyle(ink).fillRect(-2 * P, -3 * P, 4 * P, P).fillRect(-P, -2 * P, 3 * P, P).fillRect(0, -P, P, P);
      g.fillStyle(0xfffaf0).fillRect(-P, -3 * P, 2 * P, P).fillRect(0, -2 * P, P, P);
      text.setPosition(Math.round(-text.width / 2), Math.round(-h - 2 * P + (h - 2 * P - text.height) / 2));
      n.bubble = this.add.container(Math.round(n.sprite.x), Math.round(n.sprite.y - PLAYER_SIZE - 8), [g, text]).setDepth(BUBBLE_DEPTH);
      n.talkUntil = this.time.now + talkMs(line);
      // 멈춰 서서 나를 본다
      n.sprite.stop();
      const dir = walkDirOf(this.feet.x - n.sprite.x, this.feet.y - (n.sprite.y - 8)) ?? "down";
      n.sprite.setFrame(walkFrameIndex(dir === "up" ? "down" : dir, 0));
      // 시험(e2e)이 읽는 말풍선 글과 그 이웃 자리
      this.game.canvas.dataset.npcSay = line;
      this.game.canvas.dataset.npcSayLot = String(n.house.lot);
    }

    /** 그 자리(월드 좌표)에 있는 이웃 */
    private npcAt(x: number, y: number) {
      return (
        this.npcs.find((n) => Math.abs(x - n.sprite.x) < PLAYER_SIZE * 0.32 && y < n.sprite.y + 4 && y > n.sprite.y - PLAYER_SIZE * 0.9) ?? null
      );
    }
  };
}
