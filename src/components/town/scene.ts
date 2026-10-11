// 중앙 광장 (2.5D 3/4 탑다운). Phaser는 브라우저에서만 동작하므로 런타임에 받아서 씬을 만든다.
// 그림은 src/lib/art/ 의 도트 SVG를 이미지로 바꿔 쓴다 (townTextures → TownGame이 미리 불러온다).
// 배치는 layout.ts(좌표)·terrain.ts(땅 높이·걸을 수 있는 곳)·structures.ts(건물·나무·입구·이웃이 걷는 길).
// - 깊이: 모든 그림은 아랫변 y가 깊이라 캐릭터가 나무·건물 뒤로 가면 가려진다 (y-sorting)
// - 땅: 절벽 앞면·물·단 가장자리는 못 지나가고 계단으로만 오르내린다 (발 상자로 미리 확인)
// - 즐겨찾기 이웃은 집 앞에 서 있지 않고 마을 길을 걸어 다닌다 (NPC, 사용자 요청 2026-10-11)
import type * as PhaserNS from "phaser";
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
  houseSvg,
  lampSvg,
  lotSvg,
  mailboxSvg,
  shopSvg,
  toDataUri,
  treeSvg,
} from "@/lib/art/town";
import { HOUSE_SLOTS, houseAt, houseSlot, START_POS, townSpots, WORLD } from "./layout";
import { bakeGround, GROUND_SIZE, HAZE_COLOR, hazeAt } from "./ground";
import { boxWalkable, terrain } from "./terrain";
import { houseKey, npcGraph, segmentClear, solidBox, stageOf, townLayout, townProps, walkKey, type Entrance, type Structure } from "./structures";
import type { TownData, TownNeighbor, TownTarget } from "./types";
import { PIXEL } from "@/lib/art/pixel";
import { WALK_DIRS, WALK_FPS, walkDirOf, walkFrameIndex, walkSheetDataUri, type WalkDir } from "@/lib/art/walk";

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
/** 이웃이 서 있지 않는 내 집 앞 반지름 */
const NPC_AVOID_HOME = 190;
/** 그림이름표·안내는 모든 그림 위 */
const LABEL_DEPTH = 60000;
const HAZE_DEPTH = 90000;
const TREE_KINDS = ["round", "pine", "bush", "blossom", "oak", "cherry", "rock", "boulder"] as const;

/** 이 광장이 쓸 그림 목록. TownGame이 미리 이미지로 불러 둔다 */
export function townTextures(data: TownData) {
  const list = new Map<string, string>();
  const player = data.player?.characterAsset ?? VISITOR_CHARACTER;
  list.set(walkKey(player, data.player?.outfit), walkSheetDataUri(player, data.player?.outfit ?? [], PIXEL));
  for (const h of [data.myHouse, ...data.neighbors]) {
    if (!h) continue;
    list.set(houseKey(stageOf(h), h.roof), toDataUri(houseSvg(stageOf(h), h.roof)));
  }
  // 걸어 다니는 이웃 (내 집 주인은 빼고)
  for (const h of data.neighbors) list.set(walkKey(h.characterAsset, h.outfit), walkSheetDataUri(h.characterAsset, h.outfit, PIXEL));
  list.set("board", toDataUri(boardSvg()));
  list.set("shop", toDataUri(shopSvg()));
  list.set("salon", toDataUri(salonSvg()));
  list.set("clothes", toDataUri(clothesSvg()));
  list.set("fountain", toDataUri(fountainSheetSvg()));
  list.set("lamp", toDataUri(lampSvg()));
  list.set("farm", toDataUri(farmSvg()));
  list.set("fishing", toDataUri(fishingSvg()));
  list.set("lot", toDataUri(lotSvg()));
  list.set("mailbox", toDataUri(mailboxSvg()));
  list.set("mailbox:mine", toDataUri(mailboxSvg("#4a90d9")));
  for (const kind of TREE_KINDS) list.set(`tree:${kind}`, toDataUri(treeSvg(kind)));
  return [...list].map(([key, uri]) => ({ key, uri }));
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
    return [...places, ...houses];
  })();
  const font = (style: PhaserNS.Types.GameObjects.Text.TextStyle = {}) => ({ fontFamily, ...style });

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
      this.player = this.add.sprite(0, 0, this.sheet, walkFrameIndex("down", 0)).setOrigin(0.5, 0.94);

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
        // 걸어 다니는 이웃을 누르면 그 집 우체통(새 글·집에 들어가기)을 연다
        const npc = this.npcAt(pointer.worldX, pointer.worldY);
        if (npc) return onEnter({ kind: "mailbox", slot: npc.house.lot });
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
        // 도착 표시: 반짝이는 고리
        const ring = this.add.circle(spot.x, spot.y, 18, 0xffffff, 0).setStrokeStyle(4, 0xffd36e).setDepth(spot.y + 7);
        this.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 600, onComplete: () => ring.destroy() });
      };
      this.game.events.on("teleport", teleport);
      this.events.once("shutdown", () => this.game.events.off("teleport", teleport));
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

    update(_time: number, delta: number) {
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
      // 땅: 다음 자리에 발 상자가 절벽·물·낭떠러지에 걸리면 그 방향은 멈춘다 (한쪽만 막히면 미끄러져 간다)
      if (v.x || v.y) {
        const look = Math.max(0.05, Math.min(delta, 60) / 1000) * 1.2;
        const { x, y } = this.feet;
        // 이미 막힌 곳에 서 있으면(순간 이동 등) 막지 않는다 (빠져나올 수 있게)
        if (boxWalkable(x, y, FEET.w, FEET.h)) {
          const okX = !v.x || boxWalkable(x + v.x * look, y, FEET.w, FEET.h);
          const okY = !v.y || boxWalkable(x, y + v.y * look, FEET.w, FEET.h);
          if (okX && okY && v.x && v.y && !boxWalkable(x + v.x * look, y + v.y * look, FEET.w, FEET.h)) v.y = 0;
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
      if (dir) {
        this.facing = dir;
        this.player.play(`${this.sheet}:${dir}`, true);
      } else if (this.player.anims.isPlaying || this.player.frame.name !== String(walkFrameIndex(this.facing, 0))) {
        this.player.stop();
        this.player.setFrame(walkFrameIndex(this.facing, 0));
      }
      // 시험(e2e)이 읽는 걷기 상태: "walk-left" / "idle-down"
      const walk = `${dir ? "walk" : "idle"}-${this.facing}`;
      if (this.game.canvas.dataset.walk !== walk) this.game.canvas.dataset.walk = walk;
      this.player.setPosition(this.feet.x, this.feet.y + 8);
      this.nameTag.setPosition(this.feet.x, this.feet.y - PLAYER_SIZE - 4);
      // 아래쪽에 있을수록 앞에 그린다 (y-sorting)
      this.player.setDepth(this.feet.y + 8);
      this.hazeTint(this.player, this.feet.y);
      this.nameTag.setDepth(LABEL_DEPTH + this.feet.y);

      this.updateNpcs(delta);
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
      if (s.sub) {
        this.add
          .text(s.x, s.y + 30, s.sub, font({ fontSize: "12px", color: "#3e2b20", stroke: "#fff8ec", strokeThickness: 3 }))
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
      const c = Phaser.Display.Color.HexStringToColor(HAZE_COLOR);
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
      if (!this.textures.exists("ground")) {
        const canvas = document.createElement("canvas");
        canvas.width = GROUND_SIZE.w;
        canvas.height = GROUND_SIZE.h;
        const ctx = canvas.getContext("2d")!;
        ctx.putImageData(new ImageData(bakeGround() as Uint8ClampedArray<ArrayBuffer>, GROUND_SIZE.w, GROUND_SIZE.h), 0, 0);
        this.textures.addCanvas("ground", canvas);
      }
      this.add.image(0, 0, "ground").setOrigin(0, 0).setScale(PIXEL).setDepth(-10);
    }

    /**
     * 원근감 (멀리 있는 것은 옅고 푸르게, 사용자 요청 "멀리 있으면 한 점에 모이는 느낌"): 화면 위쪽에 하늘빛 공기를 얇게 덮는다.
     * 화면에 붙어 있어(scrollFactor 0) 어디서든 화면 위쪽이 먼 곳처럼 보인다. 아래 가장자리는 아주 살짝 어둡게
     */
    private createHaze() {
      if (!this.textures.exists("haze")) {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 32;
        const ctx = canvas.getContext("2d")!;
        for (let y = 0; y < 32; y++) {
          const t = y / 31;
          // 위 45%: 하늘빛, 맨 아래 10%: 그늘
          const top = Math.max(0, 1 - t / 0.45) ** 1.6 * 0.3;
          const bottom = Math.max(0, (t - 0.88) / 0.12) ** 2 * 0.12;
          ctx.fillStyle = top > 0 ? `rgba(214,236,248,${top.toFixed(3)})` : `rgba(30,40,40,${bottom.toFixed(3)})`;
          ctx.fillRect(0, y, 1, 1);
        }
        this.textures.addCanvas("haze", canvas);
      }
      this.haze = this.add.image(0, 0, "haze").setOrigin(0, 0).setScrollFactor(0).setDepth(HAZE_DEPTH);
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
        this.npcs.push({ house, sprite, tag, sheet, at: start, prev: -1, to: null, wait: 400 + Math.random() * 2500, dir: "down" });
      }
      this.game.canvas.dataset.npcs = String(this.npcs.length);
    }

    private updateNpcs(delta: number) {
      const g = this.graph;
      let walking = 0;
      for (const n of this.npcs) {
        const pos = { x: n.sprite.x, y: n.sprite.y - 8 };
        if (n.to === null) {
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
          } else {
            n.sprite.setPosition(pos.x + (dx / dist) * step, pos.y + (dy / dist) * step + 8);
            const dir = walkDirOf(dx, dy);
            if (dir) n.dir = dir;
            n.sprite.play(`${n.sheet}:${n.dir}`, true);
            walking++;
          }
        }
        if (n.to === null && n.sprite.anims.isPlaying) {
          n.sprite.stop();
          n.sprite.setFrame(walkFrameIndex(n.dir === "up" ? "down" : n.dir, 0));
        }
        n.sprite.setDepth(n.sprite.y);
        this.hazeTint(n.sprite, n.sprite.y);
        // 이름표: 가까이 가거나 마우스를 올리면
        const near = Math.hypot(n.sprite.x - this.feet.x, n.sprite.y - 8 - this.feet.y) < NPC_NEAR;
        n.tag.setVisible(near || this.hoverNpc === n).setPosition(n.sprite.x, n.sprite.y - PLAYER_SIZE - 6).setDepth(LABEL_DEPTH + n.sprite.y);
      }
      const state = String(walking);
      if (this.game.canvas.dataset.npcWalking !== state) this.game.canvas.dataset.npcWalking = state;
    }

    /** 그 자리(월드 좌표)에 있는 이웃 */
    private npcAt(x: number, y: number) {
      return (
        this.npcs.find((n) => Math.abs(x - n.sprite.x) < PLAYER_SIZE * 0.32 && y < n.sprite.y + 4 && y > n.sprite.y - PLAYER_SIZE * 0.9) ?? null
      );
    }
  };
}
