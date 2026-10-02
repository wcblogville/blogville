// 중앙 광장 (2D 탑다운). Phaser는 브라우저에서만 동작하므로 런타임에 받아서 씬을 만든다.
// 그림은 src/lib/art/ 의 SVG를 이미지로 바꿔 쓴다 (townTextures → TownGame이 미리 불러온다).
import type * as PhaserNS from "phaser";
import { backgroundAccent } from "@/lib/art/backgrounds";
import { characterDataUri, VISITOR_CHARACTER } from "@/lib/art/characters";
import {
  BOARD_SIZE,
  boardSvg,
  FOUNTAIN_SIZE,
  fountainSvg,
  HOUSE_STAGES,
  houseSvg,
  LAMP_SIZE,
  lampSvg,
  SHOP_SIZE,
  shopSvg,
  SIGN_SIZE,
  toDataUri,
  TREE_SIZE,
  treeSvg,
  welcomeSignSvg,
  type HouseStage,
} from "@/lib/art/town";
import type { TownData, TownHouse, TownTarget } from "./types";

type PhaserLib = typeof PhaserNS;

export const WORLD = { width: 1800, height: 1400 };
const CENTER = { x: WORLD.width / 2, y: WORLD.height / 2 };
const PLAZA_RADIUS = 230;
const SPEED = 230;
const INTERACT_DISTANCE = 90;
const PLAYER_SIZE = 72; // 캐릭터 그림 크기
// 가상 조이스틱 (터치 화면 전용, TOWN-02)
const JOYSTICK = { radius: 56, thumb: 26, margin: 28, deadZone: 8 };
// 지금은 모든 집이 1단계. 성장 규칙이 정해지면 블로그마다 단계를 넘긴다.
const DEFAULT_HOUSE_STAGE: HouseStage = 1;

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
};

// 이웃 집 자리 (아랫변 가운데): 광장 바깥쪽 위·아래 줄
const NEIGHBOR_SLOTS = [
  { x: 260, y: 300 }, { x: 560, y: 250 }, { x: 1240, y: 250 }, { x: 1540, y: 300 },
  { x: 260, y: 1210 }, { x: 560, y: 1270 }, { x: 1240, y: 1270 }, { x: 1540, y: 1210 },
];
const BOARD_POS = { x: CENTER.x, y: CENTER.y - PLAZA_RADIUS - 70 };
const SHOP_POS = { x: CENTER.x + 480, y: CENTER.y + 80 };
const SIGN_POS = { x: CENTER.x - 480, y: CENTER.y + 60 };
const MY_HOUSE_POS = { x: CENTER.x, y: CENTER.y + PLAZA_RADIUS + 190 };

const charKey = (asset: string) => `char:${asset}`;
const houseKey = (stage: HouseStage, roof: string) => `house:${stage}:${roof}`;

/** 이 광장이 쓸 그림 목록. TownGame이 미리 이미지로 불러 둔다 */
export function townTextures(data: TownData) {
  const list = new Map<string, string>();
  const houses = [data.myHouse, ...data.neighbors].filter(Boolean) as TownHouse[];
  list.set(charKey(data.player?.characterAsset ?? VISITOR_CHARACTER), characterDataUri(data.player?.characterAsset ?? VISITOR_CHARACTER, PLAYER_SIZE * 2));
  for (const h of houses) {
    list.set(charKey(h.characterAsset), characterDataUri(h.characterAsset, PLAYER_SIZE * 2));
    const roof = backgroundAccent(h.backgroundAsset);
    list.set(houseKey(DEFAULT_HOUSE_STAGE, roof), toDataUri(houseSvg(DEFAULT_HOUSE_STAGE, roof)));
  }
  list.set("board", toDataUri(boardSvg()));
  list.set("shop", toDataUri(shopSvg()));
  list.set("fountain", toDataUri(fountainSvg()));
  list.set("lamp", toDataUri(lampSvg()));
  list.set("sign", toDataUri(welcomeSignSvg()));
  for (const kind of ["round", "pine", "bush", "blossom"] as const) list.set(`tree:${kind}`, toDataUri(treeSvg(kind)));
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
    label: "마을 게시판", sub: `마을 소식 · 출석 체크 ${data.attendedToday ? "(오늘 완료 ✅)" : "(보상 받기 🎁)"}`,
  });
  const boardArea = { x: BOARD_POS.x - bw / 2, y: BOARD_POS.y - bh, w: bw, h: bh };
  entrances.push(
    { label: "마을 소식", emoji: "📋", x: BOARD_POS.x - 55, y: BOARD_POS.y + 26, target: { kind: "link", href: "/feed" },
      area: { ...boardArea, w: bw / 2 }, promptY: BOARD_POS.y - bh - 6 },
    { label: data.attendedToday ? "출석 체크 (오늘 완료)" : "출석 체크", emoji: "📮", x: BOARD_POS.x + 55, y: BOARD_POS.y + 26,
      target: need("/attendance"), area: { ...boardArea, x: BOARD_POS.x, w: bw / 2 }, promptY: BOARD_POS.y - bh - 6 },
  );

  // 상점
  structures.push({ texture: "shop", ...SHOP_POS, w: SHOP_SIZE.width, h: SHOP_SIZE.height, solid: { w: SHOP_SIZE.width * 0.86, h: 60 }, label: "상점", sub: "캐릭터·배경" });
  entrances.push({
    label: "상점", emoji: "🏪", x: SHOP_POS.x + 40, y: SHOP_POS.y + 24, target: need("/shop"),
    area: { x: SHOP_POS.x - SHOP_SIZE.width / 2, y: SHOP_POS.y - SHOP_SIZE.height, w: SHOP_SIZE.width, h: SHOP_SIZE.height },
    promptY: SHOP_POS.y - SHOP_SIZE.height - 6,
  });

  // 환영 표지판 (꾸밈)
  structures.push({ texture: "sign", ...SIGN_POS, w: SIGN_SIZE.width, h: SIGN_SIZE.height, solid: { w: 90, h: 18 } });

  // 집: 내 집 + 이웃집
  const addHouse = (h: TownHouse, pos: { x: number; y: number }, mine: boolean) => {
    const { width: w, height: hh } = HOUSE_STAGES[DEFAULT_HOUSE_STAGE];
    const roof = backgroundAccent(h.backgroundAsset);
    structures.push({
      texture: houseKey(DEFAULT_HOUSE_STAGE, roof), ...pos, w, h: hh, solid: { w: w * 0.72, h: 46 },
      label: mine ? "내 집" : `${h.nickname}의 집`, sub: h.title,
    });
    // 집 주인 캐릭터가 문 옆에 서 있다
    structures.push({ texture: charKey(h.characterAsset), x: pos.x + w / 2 - 6, y: pos.y + 2, w: 46, h: 46 });
    entrances.push({
      label: mine ? "내 집" : `${h.nickname}의 집`, emoji: "🏠", x: pos.x, y: pos.y + 22, target: { kind: "link", href: `/@${h.slug}` },
      area: { x: pos.x - w / 2, y: pos.y - hh, w, h: hh }, promptY: pos.y - hh - 4,
    });
  };
  if (data.myHouse) addHouse(data.myHouse, MY_HOUSE_POS, true);
  data.neighbors.slice(0, NEIGHBOR_SLOTS.length).forEach((h, i) => addHouse(h, NEIGHBOR_SLOTS[i], false));

  // 분수, 가로등
  structures.push({ texture: "fountain", x: CENTER.x, y: CENTER.y + FOUNTAIN_SIZE.height / 2, w: FOUNTAIN_SIZE.width, h: FOUNTAIN_SIZE.height, solid: { w: 150, h: 70 } });
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    structures.push({ texture: "lamp", x: CENTER.x + dx * 175, y: CENTER.y + dy * 175 + 40, w: LAMP_SIZE.width, h: LAMP_SIZE.height, solid: { w: 14, h: 10 } });
  }
  return { structures, entrances };
}

export function createTownScene(
  Phaser: PhaserLib,
  data: TownData,
  images: Map<string, HTMLImageElement>,
  onEnter: (target: TownTarget) => void,
  fontFamily = "sans-serif",
) {
  const font = (style: PhaserNS.Types.GameObjects.Text.TextStyle = {}) => ({ fontFamily, ...style });

  return class TownScene extends Phaser.Scene {
    private feet!: PhaserNS.GameObjects.Zone; // 부딪힘을 계산하는 발밑 상자
    private playerBody!: PhaserNS.Physics.Arcade.Body;
    private player!: PhaserNS.GameObjects.Image; // 보이는 캐릭터 그림 (발 상자를 따라간다)
    private nameTag!: PhaserNS.GameObjects.Text;
    private cursors!: PhaserNS.Types.Input.Keyboard.CursorKeys;
    private wasd!: Record<"W" | "A" | "S" | "D", PhaserNS.Input.Keyboard.Key>;
    private actionKeys: PhaserNS.Input.Keyboard.Key[] = [];
    private moveTarget: PhaserNS.Math.Vector2 | null = null;
    private entrances: Entrance[] = [];
    private prompt!: PhaserNS.GameObjects.Text;
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
      for (const [key, img] of images) if (!this.textures.exists(key)) this.textures.addImage(key, img);

      this.physics.world.setBounds(0, 0, WORLD.width, WORLD.height);
      this.drawGround();

      const walls = this.physics.add.staticGroup();
      const { structures, entrances } = layout(data);
      this.entrances = entrances;
      for (const s of structures) this.placeStructure(s, walls);
      this.plantTrees(walls);

      // 플레이어: 발 상자(물리) + 그림
      this.feet = this.add.zone(CENTER.x, CENTER.y + 160, 28, 16);
      this.physics.add.existing(this.feet);
      this.playerBody = this.feet.body as PhaserNS.Physics.Arcade.Body;
      this.playerBody.setCollideWorldBounds(true);
      this.physics.add.collider(this.feet, walls);
      this.player = this.add
        .image(0, 0, charKey(data.player?.characterAsset ?? VISITOR_CHARACTER))
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
      this.actionKeys = [keyboard.addKey("SPACE"), keyboard.addKey("ENTER")];
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
        const verb = closest.target.kind === "login" ? "로그인하고 이용하기" : "들어가기";
        this.prompt.setText(`${closest.emoji} ${closest.label} · Space ${verb}`);
        this.prompt.setPosition(closest.x, closest.promptY).setVisible(true);
        if (this.actionKeys.some((k) => Phaser.Input.Keyboard.JustDown(k))) onEnter(closest.target);
      } else {
        this.prompt.setVisible(false);
      }
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

      // 잔디: 은은한 체크 무늬 타일
      const TILE = 80;
      for (let x = 0; x < WORLD.width; x += TILE)
        for (let y = 0; y < WORLD.height; y += TILE) {
          g.fillStyle((x / TILE + y / TILE) % 2 ? 0x8ccf86 : 0x93d58c).fillRect(x, y, TILE, TILE);
        }
      // 풀 포기
      g.lineStyle(2, 0x6fb868, 0.9);
      for (let i = 0; i < 420; i++) {
        const x = rng.between(0, WORLD.width);
        const y = rng.between(0, WORLD.height);
        g.beginPath();
        g.moveTo(x - 4, y - 5).lineTo(x - 1, y).lineTo(x + 1, y - 7).lineTo(x + 3, y).lineTo(x + 6, y - 4);
        g.strokePath();
      }

      // 길: 돌이 깔린 길
      const roads: [number, number, number, number][] = [
        [CENTER.x - 46, 0, 92, WORLD.height],
        [0, CENTER.y - 46, WORLD.width, 92],
        [0, 395, WORLD.width, 64],
        [0, WORLD.height - 470, WORLD.width, 64],
      ];
      for (const [x, y, w, h] of roads) {
        g.fillStyle(0xe2cc9c).fillRect(x, y, w, h);
        g.lineStyle(3, 0xcdb27f, 1).strokeRect(x, y, w, h);
      }
      for (const [x, y, w, h] of roads) {
        for (let sx = x + 4; sx < x + w - 10; sx += 20)
          for (let sy = y + 4; sy < y + h - 10; sy += 16) {
            const ox = rng.between(-2, 2);
            g.fillStyle(rng.pick([0xead8ad, 0xd9c08c, 0xf0e2c0]))
              .fillRoundedRect(sx + ox + ((sy / 16) % 2 ? 6 : 0), sy, rng.between(13, 17), rng.between(10, 12), 4);
          }
      }

      // 돌광장 + 화단 테두리
      g.fillStyle(0xe8ddd0).fillCircle(CENTER.x, CENTER.y, PLAZA_RADIUS + 16);
      g.fillStyle(0xd8ccbe).fillCircle(CENTER.x, CENTER.y, PLAZA_RADIUS);
      for (let r = 60; r < PLAZA_RADIUS; r += 42) {
        g.lineStyle(3, 0xc6b8a8, 1).strokeCircle(CENTER.x, CENTER.y, r);
      }
      for (let a = 0; a < 360; a += 15) {
        const rad = Phaser.Math.DegToRad(a);
        g.lineStyle(2, 0xc6b8a8, 1).lineBetween(
          CENTER.x + Math.cos(rad) * 60, CENTER.y + Math.sin(rad) * 60,
          CENTER.x + Math.cos(rad) * PLAZA_RADIUS, CENTER.y + Math.sin(rad) * PLAZA_RADIUS,
        );
      }
      g.lineStyle(6, 0xb5a493, 1).strokeCircle(CENTER.x, CENTER.y, PLAZA_RADIUS + 16);
      // 광장 둘레 꽃 (길이 지나가는 곳은 비운다)
      for (let a = 0; a < 360; a += 6) {
        if (a % 90 < 14 || a % 90 > 76) continue;
        const rad = Phaser.Math.DegToRad(a);
        const x = CENTER.x + Math.cos(rad) * (PLAZA_RADIUS + 30);
        const y = CENTER.y + Math.sin(rad) * (PLAZA_RADIUS + 30);
        g.fillStyle(0x5cae55).fillCircle(x, y, 9);
        g.fillStyle(rng.pick([0xff7aa2, 0xffd36e, 0xffffff, 0xb79cff])).fillCircle(x + rng.between(-3, 3), y - 3, 4);
      }

      // 들꽃
      for (let i = 0; i < 160; i++) {
        const x = rng.between(0, WORLD.width);
        const y = rng.between(0, WORLD.height);
        if (Phaser.Math.Distance.Between(x, y, CENTER.x, CENTER.y) < PLAZA_RADIUS + 50) continue;
        const c = rng.pick([0xffffff, 0xffeb3b, 0xf48fb1, 0xce93d8]);
        for (const [dx, dy] of [[-2.5, 0], [2.5, 0], [0, -2.5], [0, 2.5]]) g.fillStyle(c).fillCircle(x + dx, y + dy, 2.3);
        g.fillStyle(0xffb300).fillCircle(x, y, 1.6);
      }
    }

    /** 나무: 길, 광장, 건물 자리를 피해서 심는다 */
    private plantTrees(walls: PhaserNS.Physics.Arcade.StaticGroup) {
      const rng = new Phaser.Math.RandomDataGenerator(["blogville-trees"]);
      const blocked = [
        { ...BOARD_POS, r: 190 }, { ...SHOP_POS, r: 170 }, { ...SIGN_POS, r: 110 }, { ...MY_HOUSE_POS, r: 150 },
        ...NEIGHBOR_SLOTS.map((p) => ({ ...p, r: 150 })),
      ];
      let planted = 0;
      for (let i = 0; i < 400 && planted < 46; i++) {
        const x = rng.between(40, WORLD.width - 40);
        const y = rng.between(90, WORLD.height - 20);
        if (Phaser.Math.Distance.Between(x, y, CENTER.x, CENTER.y) < PLAZA_RADIUS + 110) continue;
        if (Math.abs(x - CENTER.x) < 95 || Math.abs(y - CENTER.y) < 95) continue;
        if (y > 380 && y < 490) continue;
        if (y > WORLD.height - 490 && y < WORLD.height - 380) continue;
        if (blocked.some((b) => Phaser.Math.Distance.Between(x, y - 60, b.x, b.y - 60) < b.r)) continue;
        const kind = rng.pick(["round", "round", "pine", "pine", "bush", "blossom"]);
        const scale = kind === "bush" ? 0.75 : rng.realInRange(0.9, 1.15);
        this.placeStructure(
          { texture: `tree:${kind}`, x, y, w: TREE_SIZE.width * scale, h: TREE_SIZE.height * scale, solid: { w: 26 * scale, h: 12 } },
          walls,
        );
        planted++;
      }
    }
  };
}
