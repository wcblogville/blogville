// 중앙 광장 (2D 탑다운). Phaser는 브라우저에서만 동작하므로 런타임에 받아서 씬을 만든다.
import type * as PhaserNS from "phaser";
import { backgroundAsset, characterEmoji } from "@/lib/assets";
import type { TownData, TownHouse, TownTarget } from "./types";

type PhaserLib = typeof PhaserNS;

export const WORLD = { width: 1800, height: 1400 };
const CENTER = { x: WORLD.width / 2, y: WORLD.height / 2 };
const SPEED = 230;
const INTERACT_DISTANCE = 90;
// 가상 조이스틱 (터치 화면 전용, TOWN-02)
const JOYSTICK = { radius: 56, thumb: 26, margin: 28, deadZone: 8 };

type Building = {
  label: string;
  emoji: string;
  x: number;
  y: number;
  w: number;
  h: number;
  roof: number;
  wall: number;
  target: TownTarget;
  sub?: string;
};

// 이웃 집 자리: 광장 바깥쪽 위·아래 줄
const NEIGHBOR_SLOTS = [
  { x: 260, y: 230 }, { x: 560, y: 180 }, { x: 1240, y: 180 }, { x: 1540, y: 230 },
  { x: 260, y: 1130 }, { x: 560, y: 1190 }, { x: 1240, y: 1190 }, { x: 1540, y: 1130 },
];

function hex(color: string) {
  return parseInt(color.replace("#", ""), 16);
}

function buildingsFor(data: TownData): Building[] {
  const member = Boolean(data.player);
  const need = (href: string): TownTarget => (member ? { kind: "link", href } : { kind: "login" });

  const list: Building[] = [
    { label: "마을 게시판", emoji: "📋", x: CENTER.x, y: CENTER.y - 400, w: 170, h: 90, roof: 0x8d6e63, wall: 0xfff3e0, target: { kind: "link", href: "/feed" }, sub: "최신 글 보기" },
    { label: "상점", emoji: "🏪", x: CENTER.x + 480, y: CENTER.y, w: 170, h: 120, roof: 0xe53935, wall: 0xfffde7, target: need("/shop"), sub: "캐릭터·배경" },
    { label: "우체통", emoji: "📮", x: CENTER.x - 480, y: CENTER.y, w: 110, h: 90, roof: 0xd84315, wall: 0xffebee, target: need("/attendance"), sub: data.attendedToday ? "오늘 출석 완료 ✅" : "출석 보상 받기 🎁" },
  ];

  if (data.myHouse) list.push(houseBuilding(data.myHouse, CENTER.x, CENTER.y + 400, true));
  data.neighbors.slice(0, NEIGHBOR_SLOTS.length).forEach((h, i) => {
    list.push(houseBuilding(h, NEIGHBOR_SLOTS[i].x, NEIGHBOR_SLOTS[i].y, false));
  });
  return list;
}

function houseBuilding(h: TownHouse, x: number, y: number, mine: boolean): Building {
  const bg = backgroundAsset(h.backgroundAsset);
  return {
    label: mine ? "내 집" : h.title,
    emoji: characterEmoji(h.characterAsset),
    x,
    y,
    w: mine ? 170 : 150,
    h: mine ? 120 : 105,
    roof: hex(bg.accent),
    wall: 0xffffff,
    target: { kind: "link", href: `/@${h.slug}` },
    sub: mine ? h.title : `${h.nickname}의 블로그`,
  };
}

export function createTownScene(
  Phaser: PhaserLib,
  data: TownData,
  onEnter: (target: TownTarget) => void,
  fontFamily = "sans-serif",
) {
  const font = (style: PhaserNS.Types.GameObjects.Text.TextStyle = {}) => ({ fontFamily, ...style });

  return class TownScene extends Phaser.Scene {
    private player!: PhaserNS.GameObjects.Text;
    private playerBody!: PhaserNS.Physics.Arcade.Body;
    private nameTag!: PhaserNS.GameObjects.Text;
    private cursors!: PhaserNS.Types.Input.Keyboard.CursorKeys;
    private wasd!: Record<"W" | "A" | "S" | "D", PhaserNS.Input.Keyboard.Key>;
    private actionKeys: PhaserNS.Input.Keyboard.Key[] = [];
    private moveTarget: PhaserNS.Math.Vector2 | null = null;
    private buildings: Building[] = [];
    private prompt!: PhaserNS.GameObjects.Text;
    private nearby: Building | null = null;
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
      this.physics.world.setBounds(0, 0, WORLD.width, WORLD.height);
      this.drawGround();

      const walls = this.physics.add.staticGroup();
      this.buildings = buildingsFor(data);
      for (const b of this.buildings) this.drawBuilding(b, walls);

      // 분수 (부딪히는 장애물)
      this.drawFountain(walls);

      // 플레이어
      const emoji = data.player ? characterEmoji(data.player.characterAsset) : "👤";
      this.player = this.add.text(CENTER.x, CENTER.y + 170, emoji, font({ fontSize: "44px" })).setOrigin(0.5);
      this.physics.add.existing(this.player);
      this.playerBody = this.player.body as PhaserNS.Physics.Arcade.Body;
      this.playerBody.setSize(34, 30).setOffset((this.player.width - 34) / 2, this.player.height - 32);
      this.playerBody.setCollideWorldBounds(true);
      this.physics.add.collider(this.player, walls);

      this.nameTag = this.add
        .text(0, 0, data.player?.nickname ?? "구경하는 중", font({
          fontSize: "13px",
          color: "#2b2118",
          backgroundColor: "#ffffffd9",
          padding: { x: 6, y: 2 },
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
      this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
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
        const hit = this.buildingAt(pointer.worldX, pointer.worldY);
        if (hit) {
          // 가까우면 바로 들어가고, 멀면 그쪽으로 걸어간다
          if (this.distanceTo(hit) <= INTERACT_DISTANCE) return onEnter(hit.target);
          this.moveTarget = new Phaser.Math.Vector2(hit.x, hit.y + hit.h / 2 + 40);
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
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.moveTarget.x, this.moveTarget.y);
        if (d < 8 || this.playerBody.blocked.none === false) {
          this.moveTarget = null;
          this.playerBody.setVelocity(0, 0);
        } else {
          this.physics.moveTo(this.player, this.moveTarget.x, this.moveTarget.y, SPEED);
          this.player.setFlipX(this.moveTarget.x > this.player.x);
        }
      } else {
        this.playerBody.setVelocity(0, 0);
      }

      // 걷는 동안 살짝 통통 튀기
      const moving = this.playerBody.velocity.lengthSq() > 1;
      this.player.setScale(1, moving ? 1 + Math.sin(this.time.now / 70) * 0.06 : 1);
      this.nameTag.setPosition(this.player.x, this.player.y - 36);
      // 아래쪽에 있을수록 앞에 그린다 (y-sorting)
      this.player.setDepth(this.player.y + 20);
      this.nameTag.setDepth(this.player.y + 21);

      this.updatePrompt();
    }

    private updatePrompt() {
      let closest: Building | null = null;
      let best = INTERACT_DISTANCE;
      for (const b of this.buildings) {
        const d = this.distanceTo(b);
        if (d <= best) {
          best = d;
          closest = b;
        }
      }
      this.nearby = closest;
      if (closest) {
        const verb = closest.target.kind === "login" ? "로그인하고 이용하기" : "들어가기";
        this.prompt.setText(`${closest.emoji} ${closest.label} · Space ${verb}`);
        this.prompt.setPosition(closest.x, closest.y - closest.h / 2 - 34).setVisible(true);
        if (this.actionKeys.some((k) => Phaser.Input.Keyboard.JustDown(k))) onEnter(closest.target);
      } else {
        this.prompt.setVisible(false);
      }
    }

    /** 건물 문 앞까지의 거리 */
    private distanceTo(b: Building) {
      return Phaser.Math.Distance.Between(this.player.x, this.player.y, b.x, b.y + b.h / 2 + 20);
    }

    private buildingAt(x: number, y: number) {
      return this.buildings.find(
        (b) => x >= b.x - b.w / 2 && x <= b.x + b.w / 2 && y >= b.y - b.h / 2 - 40 && y <= b.y + b.h / 2 + 20,
      );
    }

    private drawGround() {
      const g = this.add.graphics();
      // 잔디
      g.fillStyle(0x8fd18a).fillRect(0, 0, WORLD.width, WORLD.height);
      const rng = new Phaser.Math.RandomDataGenerator(["blogville"]);
      for (let i = 0; i < 500; i++) {
        g.fillStyle(rng.pick([0x7cc576, 0x9fdb98, 0x86cb80]), 1);
        g.fillCircle(rng.between(0, WORLD.width), rng.between(0, WORLD.height), rng.between(2, 5));
      }
      // 꽃
      for (let i = 0; i < 90; i++) {
        g.fillStyle(rng.pick([0xffffff, 0xffeb3b, 0xf48fb1, 0xce93d8]), 1);
        g.fillCircle(rng.between(0, WORLD.width), rng.between(0, WORLD.height), 3);
      }
      // 길
      g.fillStyle(0xe8d5a9);
      g.fillRect(CENTER.x - 45, 0, 90, WORLD.height);
      g.fillRect(0, CENTER.y - 45, WORLD.width, 90);
      g.fillRect(0, 330, WORLD.width, 60);
      g.fillRect(0, WORLD.height - 390, WORLD.width, 60);
      // 돌광장
      g.fillStyle(0xd7ccc8).fillCircle(CENTER.x, CENTER.y, 230);
      g.lineStyle(6, 0xbcaaa4).strokeCircle(CENTER.x, CENTER.y, 230);
      g.lineStyle(2, 0xc9bbb6);
      for (let r = 80; r < 230; r += 45) g.strokeCircle(CENTER.x, CENTER.y, r);
      // 나무
      for (let i = 0; i < 40; i++) {
        const x = rng.between(40, WORLD.width - 40);
        const y = rng.between(40, WORLD.height - 40);
        if (Math.abs(x - CENTER.x) < 330 && Math.abs(y - CENTER.y) < 330) continue;
        if (Math.abs(x - CENTER.x) < 80 || Math.abs(y - CENTER.y) < 80) continue;
        if (NEIGHBOR_SLOTS.some((s) => Math.abs(s.x - x) < 130 && Math.abs(s.y - y) < 120)) continue;
        this.add.text(x, y, rng.pick(["🌳", "🌲", "🌳", "🌷"]), font({ fontSize: "34px" })).setOrigin(0.5, 0.85).setDepth(y);
      }
    }

    private drawFountain(walls: PhaserNS.Physics.Arcade.StaticGroup) {
      const g = this.add.graphics().setDepth(CENTER.y - 70);
      g.fillStyle(0x90a4ae).fillCircle(CENTER.x, CENTER.y, 70);
      g.fillStyle(0x4fc3f7).fillCircle(CENTER.x, CENTER.y, 58);
      g.fillStyle(0x81d4fa).fillCircle(CENTER.x, CENTER.y, 26);
      const splash = this.add.text(CENTER.x, CENTER.y - 6, "⛲", font({ fontSize: "46px" })).setOrigin(0.5).setDepth(CENTER.y + 60);
      this.tweens.add({ targets: splash, y: CENTER.y - 14, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

      const block = this.add.zone(CENTER.x, CENTER.y, 120, 110);
      walls.add(block);
    }

    private drawBuilding(b: Building, walls: PhaserNS.Physics.Arcade.StaticGroup) {
      // 깊이 = 건물 아랫변의 y. 캐릭터가 건물 뒤(위쪽)에 있으면 가려지고, 앞(아래쪽)에 있으면 앞에 보인다
      const depth = b.y + b.h / 2;
      const g = this.add.graphics().setDepth(depth);
      const left = b.x - b.w / 2;
      const top = b.y - b.h / 2;
      // 그림자
      g.fillStyle(0x000000, 0.15).fillEllipse(b.x, b.y + b.h / 2 + 4, b.w + 20, 22);
      // 벽
      g.fillStyle(b.wall).fillRoundedRect(left, top + 18, b.w, b.h - 18, 10);
      g.lineStyle(3, 0x6d4c41).strokeRoundedRect(left, top + 18, b.w, b.h - 18, 10);
      // 지붕
      g.fillStyle(b.roof).fillTriangle(left - 14, top + 26, b.x, top - 34, left + b.w + 14, top + 26);
      g.lineStyle(3, 0x4e342e).strokeTriangle(left - 14, top + 26, b.x, top - 34, left + b.w + 14, top + 26);
      // 문
      g.fillStyle(0x8d6e63).fillRoundedRect(b.x - 16, b.y + b.h / 2 - 38, 32, 38, { tl: 12, tr: 12, bl: 0, br: 0 });

      this.add.text(b.x, top + 42, b.emoji, font({ fontSize: "30px" })).setOrigin(0.5).setDepth(depth);
      this.add
        .text(b.x, b.y + b.h / 2 + 16, b.label.length > 12 ? `${b.label.slice(0, 12)}…` : b.label, font({
          fontSize: "15px",
          fontStyle: "bold",
          color: "#2b2118",
          backgroundColor: "#fff8ece6",
          padding: { x: 6, y: 2 },
        }))
        .setOrigin(0.5, 0)
        .setDepth(depth + 1);
      if (b.sub) {
        this.add
          .text(b.x, b.y + b.h / 2 + 40, b.sub, font({ fontSize: "12px", color: "#4e342e" }))
          .setOrigin(0.5, 0)
          .setDepth(depth + 1);
      }

      const block = this.add.zone(b.x, b.y + 6, b.w, b.h - 30);
      walls.add(block);
    }
  };
}
