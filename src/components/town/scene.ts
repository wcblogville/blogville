// 중앙 광장 (2D 탑다운). Phaser는 브라우저에서만 동작하므로 런타임에 받아서 씬을 만든다.
// 그림은 src/lib/art/ 의 SVG를 이미지로 바꿔 쓴다 (townTextures → TownGame이 미리 불러온다).
// 배치는 layout.ts: 가운데 타운을 집 11채(내 집 + 즐겨찾기 이웃 10)가 원형으로 둘러싼다.
import type * as PhaserNS from "phaser";
import { characterDataUri, lookKey, VISITOR_CHARACTER } from "@/lib/art/characters";
import { DECO_ASSETS, decoDataUri, decoSize } from "@/lib/art/deco";
import {
  BOARD_SIZE,
  boardSvg,
  FARM_SIZE,
  FISHING_SIZE,
  fishingSvg,
  farmSvg,
  FOUNTAIN_SIZE,
  fountainSvg,
  HOUSE_STAGES,
  houseStage,
  houseSvg,
  LAMP_SIZE,
  lampSvg,
  LOT_SIZE,
  lotSvg,
  MAILBOX_SIZE,
  mailboxSvg,
  SHOP_SIZE,
  shopSvg,
  toDataUri,
  TREE_SIZE,
  treeSvg,
  type HouseStage,
} from "@/lib/art/town";
import {
  BOARD_POS,
  CENTER,
  DECO_SLOTS,
  FARM_POS,
  FISHING_POS,
  HOUSE_SLOTS,
  houseAt,
  houseSlot,
  PLAZA_RADIUS,
  POND_POS,
  RING_RADIUS,
  SHOP_POS,
  START_POS,
  TOWN_RADIUS,
  townSpots,
  WORLD,
} from "./layout";
import type { TownData, TownDecoration, TownHouse, TownTarget } from "./types";

type PhaserLib = typeof PhaserNS;

export { WORLD };
const SPEED = 230;
const INTERACT_DISTANCE = 90;
const PLAYER_SIZE = 72; // 캐릭터 그림 크기
// 가상 조이스틱 (터치 화면 전용, TOWN-02)
const JOYSTICK = { radius: 56, thumb: 26, margin: 28, deadZone: 8 };
/** 처음 서는 곳: 광장 아래쪽 */
const START = START_POS;

/** 광장에 놓는 그림 하나. (x, y) = 아랫변 가운데 (발 닿는 곳) */
type Structure = {
  texture: string;
  x: number;
  y: number;
  w: number;
  h: number;
  solid?: { w: number; h: number }; // 부딪히는 영역 (아랫변 기준)
  label?: string;
  sub?: string;
};

/** 들어갈 수 있는 곳: 문 앞 좌표에서 Space / 클릭 */
type Entrance = {
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

/** 캐릭터 + 입은 아바타 아이템마다 그림 하나 (SHOP-06) */
const charKey = (asset: string, outfit: string[] = []) => `char:${lookKey(asset, outfit)}`;
const houseKey = (stage: HouseStage, roof: string) => `house:${stage}:${roof}`;
const decoKey = (asset: string) => `deco:${asset}`;
const stageOf = (h: TownHouse) => houseStage(h.level);

/** 이 광장이 쓸 그림 목록. TownGame이 미리 이미지로 불러 둔다 */
export function townTextures(data: TownData) {
  const list = new Map<string, string>();
  const houses = [data.myHouse, ...data.neighbors].filter(Boolean) as TownHouse[];
  list.set(
    charKey(data.player?.characterAsset ?? VISITOR_CHARACTER, data.player?.outfit),
    characterDataUri(data.player?.characterAsset ?? VISITOR_CHARACTER, PLAYER_SIZE * 2, data.player?.outfit ?? []),
  );
  for (const h of houses) {
    list.set(charKey(h.characterAsset, h.outfit), characterDataUri(h.characterAsset, PLAYER_SIZE * 2, h.outfit));
    const roof = h.roof;
    list.set(houseKey(stageOf(h), roof), toDataUri(houseSvg(stageOf(h), roof)));
  }
  list.set("board", toDataUri(boardSvg()));
  list.set("shop", toDataUri(shopSvg()));
  list.set("fountain", toDataUri(fountainSvg()));
  list.set("lamp", toDataUri(lampSvg()));
  list.set("farm", toDataUri(farmSvg()));
  list.set("fishing", toDataUri(fishingSvg()));
  list.set("lot", toDataUri(lotSvg()));
  list.set("mailbox", toDataUri(mailboxSvg()));
  list.set("mailbox:mine", toDataUri(mailboxSvg("#4a90d9")));
  for (const kind of ["round", "pine", "bush", "blossom"] as const) list.set(`tree:${kind}`, toDataUri(treeSvg(kind)));
  // 광장 장식: 꾸미기 창에서 고르자마자 놓을 수 있게 전부 불러 둔다 (8개, 작다). 선명하게 두 배 크기로
  for (const key of DECO_ASSETS) {
    const { width, height } = decoSize(key);
    list.set(decoKey(key), decoDataUri(key, Math.max(width, height) * 2));
  }
  return [...list].map(([key, uri]) => ({ key, uri }));
}

function layout(data: TownData) {
  const member = Boolean(data.player);
  const need = (href: string): TownTarget => (member ? { kind: "link", href } : { kind: "login" });
  const structures: Structure[] = [];
  const entrances: Entrance[] = [];

  // 마을 게시판: 왼쪽 판 = 마을 소식, 오른쪽 판 = 출석 체크
  const bw = BOARD_SIZE.width, bh = BOARD_SIZE.height;
  structures.push({
    texture: "board", ...BOARD_POS, w: bw, h: bh, solid: { w: bw * 0.92, h: 22 },
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
  structures.push({ texture: "shop", ...SHOP_POS, w: SHOP_SIZE.width, h: SHOP_SIZE.height, solid: { w: SHOP_SIZE.width * 0.86, h: 60 }, label: "상점", sub: "아바타·가구·배경" });
  entrances.push({
    label: "상점", emoji: "🏪", x: SHOP_POS.x + 40, y: SHOP_POS.y + 24, target: need("/shop"),
    area: { x: SHOP_POS.x - SHOP_SIZE.width / 2, y: SHOP_POS.y - SHOP_SIZE.height, w: SHOP_SIZE.width, h: SHOP_SIZE.height },
    promptY: SHOP_POS.y - SHOP_SIZE.height - 6,
  });

  // 연못 낚시터: 하루 한 번 낚시 (사용자 요청 2026-10-08)
  structures.push({
    texture: "fishing", ...FISHING_POS, w: FISHING_SIZE.width, h: FISHING_SIZE.height, solid: { w: FISHING_SIZE.width * 0.9, h: 90 },
    label: "낚시터", sub: "하루 한 번 낚시",
  });
  entrances.push({
    label: "낚시터", emoji: "🎣", x: FISHING_POS.x, y: FISHING_POS.y + 24, target: need("/fishing"),
    area: { x: FISHING_POS.x - FISHING_SIZE.width / 2, y: FISHING_POS.y - FISHING_SIZE.height, w: FISHING_SIZE.width, h: FISHING_SIZE.height },
    promptY: FISHING_POS.y - FISHING_SIZE.height - 6,
  });

  // 동물 농장: 알을 받아 동물을 키운다 (내 집 옆)
  structures.push({
    texture: "farm", ...FARM_POS, w: FARM_SIZE.width, h: FARM_SIZE.height, solid: { w: FARM_SIZE.width * 0.94, h: 100 },
    label: "동물 농장", sub: "알 부화 · 동물 키우기",
  });
  entrances.push({
    label: "동물 농장", emoji: "🐮", x: FARM_POS.x, y: FARM_POS.y + 24, target: need("/farm"),
    area: { x: FARM_POS.x - FARM_SIZE.width / 2, y: FARM_POS.y - FARM_SIZE.height, w: FARM_SIZE.width, h: FARM_SIZE.height },
    promptY: FARM_POS.y - FARM_SIZE.height - 6,
  });

  // 집 11채: 0번 = 내 집, 1~10번 = 즐겨찾기 이웃(방문자는 인기 블로그). 없으면 빈 집터
  for (let i = 0; i < HOUSE_SLOTS; i++) {
    const pos = houseSlot(i);
    const h = houseAt(data, i);
    if (!h) {
      structures.push({ texture: "lot", x: pos.x, y: pos.y, w: LOT_SIZE.width, h: LOT_SIZE.height, label: i === 0 && !data.host ? "내 집 자리" : "빈 집터" });
      continue;
    }
    // 다른 회원의 마을(host)을 구경할 때 0번 집은 그 주인의 집이다
    const mine = i === 0 && !data.host;
    const stage = stageOf(h);
    const { width: w, height: hh } = HOUSE_STAGES[stage];
    const roof = h.roof;
    structures.push({
      texture: houseKey(stage, roof), ...pos, w, h: hh, solid: { w: w * 0.72, h: 46 },
      label: mine ? "내 집" : `${h.nickname}의 집`, sub: h.title,
    });
    // 집 주인 캐릭터가 문 옆에 서 있다
    structures.push({ texture: charKey(h.characterAsset, h.outfit), x: pos.x - w / 2 + 4, y: pos.y + 2, w: 46, h: 46 });
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
  structures.push({ texture: "fountain", x: CENTER.x, y: CENTER.y + FOUNTAIN_SIZE.height / 2, w: FOUNTAIN_SIZE.width, h: FOUNTAIN_SIZE.height, solid: { w: 150, h: 70 } });
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    structures.push({ texture: "lamp", x: CENTER.x + dx * 185, y: CENTER.y + dy * 185 + 40, w: LAMP_SIZE.width, h: LAMP_SIZE.height, solid: { w: 14, h: 10 } });
  }
  // 둘레 길 가로등
  for (let i = 0; i < HOUSE_SLOTS; i++) {
    const a = Math.PI / 2 + ((i + 0.5) * 2 * Math.PI) / HOUSE_SLOTS;
    const x = CENTER.x + Math.cos(a) * (RING_RADIUS + 60);
    const y = CENTER.y + Math.sin(a) * (RING_RADIUS + 60);
    structures.push({ texture: "lamp", x, y, w: LAMP_SIZE.width, h: LAMP_SIZE.height, solid: { w: 14, h: 10 } });
  }
  return { structures, entrances };
}

/** 게임 밖(꾸미기 창)에서 바뀌는 것. 게임이 만들어지기 전에 바뀐 것도 create()에서 읽는다 (TownGame이 들고 있다) */
export type TownLive = { decorations: TownDecoration[]; decoMode: boolean };

export function createTownScene(
  Phaser: PhaserLib,
  data: TownData,
  images: Map<string, HTMLImageElement>,
  onEnter: (target: TownTarget) => void,
  fontFamily = "sans-serif",
  /** 처음 설 곳 (텔레포트 목록의 key, 예: "house:0"). 없으면 광장 아래쪽 */
  startAt: string | null = null,
  live: TownLive = { decorations: data.decorations, decoMode: false },
) {
  const allSpots = (() => {
    const { places, houses, decos } = townSpots(data);
    return [...places, ...houses, ...decos];
  })();
  const font = (style: PhaserNS.Types.GameObjects.Text.TextStyle = {}) => ({ fontFamily, ...style });

  return class TownScene extends Phaser.Scene {
    private feet!: PhaserNS.GameObjects.Zone; // 부딪힘을 계산하는 발밑 상자
    private playerBody!: PhaserNS.Physics.Arcade.Body;
    private player!: PhaserNS.GameObjects.Image; // 보이는 캐릭터 그림 (발 상자를 따라간다)
    private nameTag!: PhaserNS.GameObjects.Text;
    private cursors!: PhaserNS.Types.Input.Keyboard.CursorKeys;
    private wasd!: Record<"W" | "A" | "S" | "D", PhaserNS.Input.Keyboard.Key>;
    /** 이번 프레임에 Space·Enter를 눌렀는지 (keydown 이벤트로 받는다) */
    private actionQueued = false;
    private moveTarget: PhaserNS.Math.Vector2 | null = null;
    private entrances: Entrance[] = [];
    private prompt!: PhaserNS.GameObjects.Text;
    private joystick: {
      base: PhaserNS.GameObjects.Arc;
      thumb: PhaserNS.GameObjects.Arc;
      pointerId: number | null;
      vector: PhaserNS.Math.Vector2;
    } | null = null;
    /** 광장 장식 그림 (자리 번호 → 그림) */
    private decoImages = new Map<number, { assetKey: string; image: PhaserNS.GameObjects.Image }>();
    /** 꾸미기 창이 열려 있는 동안 보이는 자리 표시 */
    private decoMarkers: PhaserNS.GameObjects.GameObject[] = [];

    constructor() {
      super("town");
    }

    create() {
      for (const [key, img] of images) if (!this.textures.exists(key)) this.textures.addImage(key, img);

      this.physics.world.setBounds(0, 0, WORLD.width, WORLD.height);
      this.drawGround();

      const walls = this.physics.add.staticGroup();
      const { structures, entrances } = layout(data);
      this.entrances = entrances;
      for (const s of structures) this.placeStructure(s, walls);
      this.plantTrees(walls);

      // 광장 장식 (광장 꾸미기). 부딪히지 않는 장식이라 벽에 넣지 않는다.
      // 꾸미기 창에서 바꾸면 게임을 다시 만들지 않고 장식만 다시 그린다 (TownGame이 game.events로 전한다)
      this.drawDecorations(live.decorations, false);
      this.showDecoSlots(live.decoMode);
      const redraw = (list: TownDecoration[]) => this.drawDecorations(list, true);
      const decoMode = (on: boolean) => this.showDecoSlots(on);
      this.game.events.on("decorations", redraw);
      this.game.events.on("deco-mode", decoMode);
      this.events.once("shutdown", () => {
        this.game.events.off("decorations", redraw);
        this.game.events.off("deco-mode", decoMode);
      });

      // 플레이어: 발 상자(물리) + 그림
      const start = allSpots.find((p) => p.key === startAt) ?? START;
      this.feet = this.add.zone(start.x, start.y, 28, 16);
      this.physics.add.existing(this.feet);
      this.playerBody = this.feet.body as PhaserNS.Physics.Arcade.Body;
      this.playerBody.setCollideWorldBounds(true);
      this.physics.add.collider(this.feet, walls);
      this.player = this.add
        .image(0, 0, charKey(data.player?.characterAsset ?? VISITOR_CHARACTER, data.player?.outfit))
        .setDisplaySize(PLAYER_SIZE, PLAYER_SIZE)
        .setOrigin(0.5, 0.94);

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

      // 카메라
      this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
      this.cameras.main.startFollow(this.feet, true, 0.12, 0.12, 0, 20);
      this.cameras.main.setBackgroundColor("#8fd18a");

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
        // 도착 표시: 반짝이는 고리
        const ring = this.add.circle(spot.x, spot.y, 18, 0xffffff, 0).setStrokeStyle(4, 0xffd36e).setDepth(spot.y + 7);
        this.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 600, onComplete: () => ring.destroy() });
      };
      this.game.events.on("teleport", teleport);
      this.events.once("shutdown", () => this.game.events.off("teleport", teleport));
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

    update() {
      const left = this.cursors.left.isDown || this.wasd.A.isDown;
      const right = this.cursors.right.isDown || this.wasd.D.isDown;
      const up = this.cursors.up.isDown || this.wasd.W.isDown;
      const down = this.cursors.down.isDown || this.wasd.S.isDown;

      if (left || right || up || down) {
        this.moveTarget = null;
        const v = new Phaser.Math.Vector2((right ? 1 : 0) - (left ? 1 : 0), (down ? 1 : 0) - (up ? 1 : 0))
          .normalize()
          .scale(SPEED);
        this.playerBody.setVelocity(v.x, v.y);
        if (v.x !== 0) this.player.setFlipX(v.x > 0);
      } else if (this.joystick && this.joystick.vector.lengthSq() > 0) {
        // 조이스틱: 많이 밀수록 빠르게 (최대 SPEED)
        this.moveTarget = null;
        const v = this.joystick.vector.clone().scale(SPEED);
        this.playerBody.setVelocity(v.x, v.y);
        if (Math.abs(v.x) > 1) this.player.setFlipX(v.x > 0);
      } else if (this.moveTarget) {
        const d = Phaser.Math.Distance.Between(this.feet.x, this.feet.y, this.moveTarget.x, this.moveTarget.y);
        if (d < 8 || this.playerBody.blocked.none === false) {
          this.moveTarget = null;
          this.playerBody.setVelocity(0, 0);
        } else {
          this.physics.moveTo(this.feet, this.moveTarget.x, this.moveTarget.y, SPEED);
          this.player.setFlipX(this.moveTarget.x > this.feet.x);
        }
      } else {
        this.playerBody.setVelocity(0, 0);
      }

      // 그림은 발 상자를 따라간다. 걷는 동안 살짝 통통 튀기
      const moving = this.playerBody.velocity.lengthSq() > 1;
      const bob = moving ? Math.abs(Math.sin(this.time.now / 90)) * 4 : 0;
      this.player.setPosition(this.feet.x, this.feet.y + 8 - bob);
      this.nameTag.setPosition(this.feet.x, this.feet.y - PLAYER_SIZE - 4 - bob);
      // 아래쪽에 있을수록 앞에 그린다 (y-sorting)
      this.player.setDepth(this.feet.y + 8);
      this.nameTag.setDepth(this.feet.y + 9);

      this.updatePrompt();
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
      if (closest) {
        const verb = closest.target.kind === "login" ? "로그인하고 이용하기" : (closest.verb ?? "들어가기");
        this.prompt.setText(`${closest.emoji} ${closest.label} · Space ${verb}`);
        this.prompt.setPosition(closest.x, closest.promptY).setVisible(true);
        if (this.actionQueued) onEnter(closest.target);
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

    /** 장식을 자리마다 그린다. pop이면 새로 놓인 장식이 톡 튀어나온다 */
    private drawDecorations(list: TownDecoration[], pop: boolean) {
      const next = new Map(list.map((d) => [d.slot, d.assetKey]));
      for (const [slot, shown] of this.decoImages) {
        if (next.get(slot) === shown.assetKey) continue;
        shown.image.destroy();
        this.decoImages.delete(slot);
      }
      for (const [slot, assetKey] of next) {
        const pos = DECO_SLOTS[slot];
        if (!pos || this.decoImages.has(slot) || !this.textures.exists(decoKey(assetKey))) continue;
        const { width, height } = decoSize(assetKey);
        const image = this.add.image(pos.x, pos.y, decoKey(assetKey)).setOrigin(0.5, 1).setDisplaySize(width, height).setDepth(pos.y);
        this.decoImages.set(slot, { assetKey, image });
        if (pop) {
          const { scaleX, scaleY } = image;
          image.setScale(scaleX * 0.6, scaleY * 0.6);
          this.tweens.add({ targets: image, scaleX, scaleY, duration: 260, ease: "Back.easeOut" });
        }
      }
    }

    /** 꾸미기 자리 표시: 열린 자리는 노란 동그라미와 번호, 아직 닫힌 자리는 🔒 */
    private showDecoSlots(on: boolean) {
      for (const m of this.decoMarkers) m.destroy();
      this.decoMarkers = [];
      if (!on) return;
      DECO_SLOTS.forEach((p, i) => {
        const open = i < data.decoSlots;
        const ring = this.add
          .ellipse(p.x, p.y - 4, 124, 46, open ? 0xffd36e : 0x2b2118, open ? 0.35 : 0.12)
          .setStrokeStyle(3, open ? 0xffffff : 0x8a7a6a, open ? 0.95 : 0.6)
          .setDepth(-5);
        // 번호는 동그라미 왼쪽에 둔다 (자리 앞에 선 캐릭터를 가리지 않게)
        const tag = this.add
          .text(p.x - 64, p.y - 4, open ? `${i + 1}번` : `🔒 ${i + 1}번`, font({
            fontSize: "14px",
            fontStyle: "bold",
            color: open ? "#2b2118" : "#5b4a3c",
            backgroundColor: open ? "#ffd36ef0" : "#ffffffd0",
            padding: { x: 7, y: 2 },
          }))
          .setOrigin(1, 0.5)
          .setDepth(99999);
        this.decoMarkers.push(ring, tag);
      });
    }

    private placeStructure(s: Structure, walls: PhaserNS.Physics.Arcade.StaticGroup) {
      // 깊이 = 아랫변의 y. 캐릭터가 뒤(위쪽)에 있으면 가려지고, 앞(아래쪽)에 있으면 앞에 보인다
      this.add.image(s.x, s.y, s.texture).setOrigin(0.5, 1).setDisplaySize(s.w, s.h).setDepth(s.y);
      if (s.solid) walls.add(this.add.zone(s.x, s.y - s.solid.h / 2, s.solid.w, s.solid.h));
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
          .setDepth(s.y + 1);
      }
      if (s.sub) {
        this.add
          .text(s.x, s.y + 30, s.sub, font({ fontSize: "12px", color: "#3e2b20", stroke: "#fff8ec", strokeThickness: 3 }))
          .setOrigin(0.5, 0)
          .setDepth(s.y + 1);
      }
    }

    private drawGround() {
      const rng = new Phaser.Math.RandomDataGenerator(["blogville"]);
      const g = this.add.graphics().setDepth(-10);

      // 잔디: 바깥은 짙은 초록, 타운 안쪽은 밝은 초록 (은은한 체크 무늬)
      const TILE = 80;
      for (let x = 0; x < WORLD.width; x += TILE)
        for (let y = 0; y < WORLD.height; y += TILE) {
          const inTown = Phaser.Math.Distance.Between(x + TILE / 2, y + TILE / 2, CENTER.x, CENTER.y) < RING_RADIUS + 120;
          const odd = (x / TILE + y / TILE) % 2;
          g.fillStyle(inTown ? (odd ? 0x95d68e : 0x9cdb94) : odd ? 0x7fc579 : 0x86ca7f).fillRect(x, y, TILE, TILE);
        }
      // 풀 포기
      g.lineStyle(2, 0x6fb868, 0.9);
      for (let i = 0; i < 900; i++) {
        const x = rng.between(0, WORLD.width);
        const y = rng.between(0, WORLD.height);
        g.beginPath();
        g.moveTo(x - 4, y - 5).lineTo(x - 1, y).lineTo(x + 1, y - 7).lineTo(x + 3, y).lineTo(x + 6, y - 4);
        g.strokePath();
      }

      // 타운 잔디 원 테두리 (꽃 울타리)
      g.lineStyle(10, 0x6fb868, 0.6).strokeCircle(CENTER.x, CENTER.y, TOWN_RADIUS);

      // 돌길: 둘레 길 + 광장에서 집마다 뻗는 길 + 타운 안 십자 길
      const stoneLine = (x1: number, y1: number, x2: number, y2: number, width: number) => {
        g.lineStyle(width + 6, 0xcdb27f, 1).lineBetween(x1, y1, x2, y2);
        g.lineStyle(width, 0xe2cc9c, 1).lineBetween(x1, y1, x2, y2);
      };
      g.lineStyle(84, 0xcdb27f, 1).strokeCircle(CENTER.x, CENTER.y, RING_RADIUS);
      g.lineStyle(76, 0xe2cc9c, 1).strokeCircle(CENTER.x, CENTER.y, RING_RADIUS);
      for (let i = 0; i < HOUSE_SLOTS; i++) {
        const p = houseSlot(i);
        const ex = CENTER.x + Math.cos(p.angle) * PLAZA_RADIUS;
        const ey = CENTER.y + Math.sin(p.angle) * PLAZA_RADIUS;
        stoneLine(ex, ey, p.x, p.y + 30, 54);
      }
      // 돌 무늬 (둘레 길 위)
      for (let a = 0; a < 360; a += 1.6) {
        const rad = Phaser.Math.DegToRad(a);
        for (const off of [-24, 0, 24]) {
          const r = RING_RADIUS + off + rng.between(-3, 3);
          g.fillStyle(rng.pick([0xead8ad, 0xd9c08c, 0xf0e2c0])).fillRoundedRect(CENTER.x + Math.cos(rad) * r - 7, CENTER.y + Math.sin(rad) * r - 5, rng.between(12, 16), rng.between(9, 11), 4);
        }
      }

      // 연못 (타운 안 남서쪽)
      g.fillStyle(0x6fb868).fillEllipse(POND_POS.x, POND_POS.y, 250, 150);
      g.fillStyle(0x7ec8e3).fillEllipse(POND_POS.x, POND_POS.y, 226, 128);
      g.fillStyle(0xa8def0).fillEllipse(POND_POS.x - 30, POND_POS.y - 18, 90, 34);
      for (const [dx, dy] of [[-60, 20], [40, -10], [70, 30]]) {
        g.fillStyle(0x5cae55).fillCircle(POND_POS.x + dx, POND_POS.y + dy, 12);
        g.fillStyle(0xff9ecb).fillCircle(POND_POS.x + dx + 3, POND_POS.y + dy - 3, 4);
      }

      // 돌광장 + 화단 테두리
      g.fillStyle(0xe8ddd0).fillCircle(CENTER.x, CENTER.y, PLAZA_RADIUS + 16);
      g.fillStyle(0xd8ccbe).fillCircle(CENTER.x, CENTER.y, PLAZA_RADIUS);
      for (let r = 60; r < PLAZA_RADIUS; r += 42) g.lineStyle(3, 0xc6b8a8, 1).strokeCircle(CENTER.x, CENTER.y, r);
      for (let a = 0; a < 360; a += 15) {
        const rad = Phaser.Math.DegToRad(a);
        g.lineStyle(2, 0xc6b8a8, 1).lineBetween(
          CENTER.x + Math.cos(rad) * 60, CENTER.y + Math.sin(rad) * 60,
          CENTER.x + Math.cos(rad) * PLAZA_RADIUS, CENTER.y + Math.sin(rad) * PLAZA_RADIUS,
        );
      }
      g.lineStyle(6, 0xb5a493, 1).strokeCircle(CENTER.x, CENTER.y, PLAZA_RADIUS + 16);
      // 광장 둘레 꽃
      for (let a = 0; a < 360; a += 5) {
        const rad = Phaser.Math.DegToRad(a);
        const x = CENTER.x + Math.cos(rad) * (PLAZA_RADIUS + 32);
        const y = CENTER.y + Math.sin(rad) * (PLAZA_RADIUS + 32);
        g.fillStyle(0x5cae55).fillCircle(x, y, 9);
        g.fillStyle(rng.pick([0xff7aa2, 0xffd36e, 0xffffff, 0xb79cff])).fillCircle(x + rng.between(-3, 3), y - 3, 4);
      }

      // 집 마당: 집 뒤 동그란 잔디 마당
      for (let i = 0; i < HOUSE_SLOTS; i++) {
        const p = houseSlot(i);
        g.fillStyle(0xa6de9c, 0.9).fillEllipse(p.x, p.y - 40, 260, 170);
      }

      // 들꽃
      for (let i = 0; i < 420; i++) {
        const x = rng.between(0, WORLD.width);
        const y = rng.between(0, WORLD.height);
        if (Phaser.Math.Distance.Between(x, y, CENTER.x, CENTER.y) < PLAZA_RADIUS + 50) continue;
        const c = rng.pick([0xffffff, 0xffeb3b, 0xf48fb1, 0xce93d8]);
        for (const [dx, dy] of [[-2.5, 0], [2.5, 0], [0, -2.5], [0, 2.5]]) g.fillStyle(c).fillCircle(x + dx, y + dy, 2.3);
        g.fillStyle(0xffb300).fillCircle(x, y, 1.6);
      }
    }

    /** 나무: 길, 광장, 건물·집 자리를 피해서 심는다. 바깥쪽은 숲처럼 빽빽하게 */
    private plantTrees(walls: PhaserNS.Physics.Arcade.StaticGroup) {
      const rng = new Phaser.Math.RandomDataGenerator(["blogville-trees"]);
      const blocked = [
        { ...BOARD_POS, r: 190 }, { ...SHOP_POS, r: 170 }, { ...FARM_POS, r: 190 }, { ...FISHING_POS, r: 180 }, { ...POND_POS, r: 150 },
        ...Array.from({ length: HOUSE_SLOTS }, (_, i) => ({ ...houseSlot(i), r: 190 })),
        // 광장 꾸미기 자리 (장식이 나무에 가리지 않게)
        ...DECO_SLOTS.map((p) => ({ ...p, r: 110 })),
      ];
      const onRoad = (x: number, y: number) => {
        const d = Phaser.Math.Distance.Between(x, y, CENTER.x, CENTER.y);
        if (Math.abs(d - RING_RADIUS) < 80) return true;
        const ang = Math.atan2(y - CENTER.y, x - CENTER.x);
        for (let i = 0; i < HOUSE_SLOTS; i++) {
          const a = houseSlot(i).angle;
          let diff = Math.abs(ang - a) % (2 * Math.PI);
          if (diff > Math.PI) diff = 2 * Math.PI - diff;
          if (d < RING_RADIUS + 200 && diff * d < 70) return true;
        }
        return false;
      };
      let planted = 0;
      for (let i = 0; i < 2000 && planted < 150; i++) {
        const x = rng.between(40, WORLD.width - 40);
        const y = rng.between(110, WORLD.height - 20);
        const d = Phaser.Math.Distance.Between(x, y, CENTER.x, CENTER.y);
        if (d < PLAZA_RADIUS + 120) continue;
        // 타운 안은 드문드문, 바깥은 빽빽하게
        if (d < RING_RADIUS && rng.frac() > 0.25) continue;
        if (onRoad(x, y)) continue;
        if (blocked.some((b) => Phaser.Math.Distance.Between(x, y - 60, b.x, b.y - 60) < b.r)) continue;
        const kind = rng.pick(["round", "round", "pine", "pine", "bush", "blossom"]);
        const scale = kind === "bush" ? 0.75 : rng.realInRange(0.9, 1.2);
        this.placeStructure(
          { texture: `tree:${kind}`, x, y, w: TREE_SIZE.width * scale, h: TREE_SIZE.height * scale, solid: { w: 26 * scale, h: 12 } },
          walls,
        );
        planted++;
      }
    }
  };
}
