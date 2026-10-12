// 장소 머리 그림 (2026-10-12 사용자 요청 "상점·낚시터… 들어갔을 때 나오는 화면도 도트감성으로").
// 광장에서 건물에 들어가면 화면 맨 위에 그 장소의 도트 풍경이 나오고, 그 아래 나무 간판(h1)에 이름이 걸린다.
// - 그림은 모두 코드 그림(src/lib/art)이다. 광장 건물·나무·캐릭터·동물·가구를 2배로 늘어놓는다 (광장은 3배, 여기는 좁은 띠라 2배).
//   SVG라 2배로 그려도 칸이 정확히 2px씩이다 (정수배).
// - 바깥 장소(상점·옷가게·미용실·농장·낚시터·게시판·우체통)는 하늘·언덕·잔디, 안쪽 장소(꾸미기 방·내역·관리자)는 벽지·마루.
// - 소품 좌표는 띠 가운데 기준 px라 휴대폰(375px)에서는 가운데만, 넓을수록 양옆이 더 보인다. 가로 스크롤은 생기지 않는다 (overflow hidden).
import { PixelIcon } from "@/components/pixel-icon";
import { animalSvg, toAnimalDataUri } from "@/lib/art/animals";
import type { IconName } from "@/lib/art/icons";
import { cloudDataUri, cloudSize, fenceDataUri, hillsDataUri, HILLS_SIZE, lawnDataUri, roadDataUri } from "@/lib/art/landing";
import { PIXEL } from "@/lib/art/pixel";
import { ROOM_ART } from "@/lib/art/room";
import {
  boardSvg,
  BOARD_SIZE,
  clothesSvg,
  CLOTHES_SIZE,
  farmSvg,
  FARM_SIZE,
  fishingSvg,
  FISHING_SIZE,
  HOUSE_STAGES,
  houseSvg,
  lampSvg,
  LAMP_SIZE,
  mailboxSvg,
  MAILBOX_SIZE,
  ROOF_HEX,
  salonSvg,
  SALON_SIZE,
  shopSvg,
  SHOP_SIZE,
  signpostSvg,
  SIGNPOST_SIZE,
  toDataUri,
  treeSize,
  treeSvg,
  type HouseStage,
  type TreeKind,
} from "@/lib/art/town";
import { characterDataUri, furnitureDataUri } from "@/lib/assets";

/** 화면 배율: 도트 한 칸 = 2px */
const S = 2;
/** 띠 높이와 지평선(바닥이 시작하는 줄, 위에서 px) */
const H = 176;
const HORIZON = 124;

export type PlaceKey = "shop" | "clothes" | "salon" | "farm" | "fishing" | "attendance" | "notifications" | "wallet" | "closet" | "admin";

type Prop = {
  src: string;
  width: number;
  height: number;
  /** 왼쪽 끝: 띠 가운데에서 px */
  x: number;
  /** 발 위치: 지평선에서 아래로 px */
  y: number;
  className?: string;
};

// 광장 그림(3배 크기 값)을 2배로
const town = (svg: string, size: { width: number; height: number }, x: number, y: number, className?: string): Prop => ({
  src: toDataUri(svg),
  width: (size.width / PIXEL) * S,
  height: (size.height / PIXEL) * S,
  x,
  y,
  className,
});
const tree = (kind: TreeKind, x: number, y = 0, className?: string) => town(treeSvg(kind), treeSize(kind), x, y, className);
const house = (stage: HouseStage, roof: keyof typeof ROOF_HEX, x: number, y = 0, className?: string) =>
  town(houseSvg(stage, ROOF_HEX[roof]), HOUSE_STAGES[stage], x, y, className);
const lamp = (x: number, y = 6) => town(lampSvg(), LAMP_SIZE, x, y);
/** 캐릭터 24칸 → 48px */
const person = (asset: string, x: number, y = 18, outfit: string[] = [], className = HOP): Prop => ({
  src: characterDataUri(asset, 24 * S, outfit),
  width: 24 * S,
  height: 24 * S,
  x,
  y,
  className,
});
/** 동물·가구 32칸 → 64px */
const animal = (asset: string, x: number, y = 24, className?: string): Prop => ({
  src: toAnimalDataUri(animalSvg(asset, "adult", 32 * S)),
  width: 32 * S,
  height: 32 * S,
  x,
  y,
  className,
});
const furniture = (asset: string, x: number, y = 0): Prop => ({ src: furnitureDataUri(asset, 32 * S), width: 32 * S, height: 32 * S, x, y });

const HOP = "motion-safe:animate-[hop_1.2s_steps(2)_infinite]";

type Scene = { indoor: boolean; props: () => Prop[]; road?: boolean; fence?: boolean };

// 소품은 뒤(지평선 가까이, y 작은 것)부터 앞으로 그린다
const SCENES: Record<PlaceKey, Scene> = {
  shop: {
    indoor: false,
    road: true,
    props: () => [
      tree("pine", -380),
      tree("round", -300, 3),
      tree("round", 230, 3),
      tree("pine", 320),
      house(2, "yellow", 400, 0, "max-xl:hidden"),
      house(3, "blue", -540, 0, "max-xl:hidden"),
      town(shopSvg(), SHOP_SIZE, -64, 6),
      lamp(-120),
      lamp(96),
      tree("bush", -210, 12),
      tree("bush", 160, 12),
      person("char.cat", -170, 30),
      person("char.girl", 120, 34),
    ],
  },
  clothes: {
    indoor: false,
    road: true,
    props: () => [
      tree("blossom", -330),
      tree("round", 220, 3),
      tree("pine", 300),
      house(4, "pink", -560, 0, "max-xl:hidden"),
      house(1, "mint", 380, 0, "max-xl:hidden"),
      town(clothesSvg(), CLOTHES_SIZE, -52, 6),
      lamp(-100),
      tree("bush", -230, 12),
      person("char.girl", -170, 32, ["outfit.dress", "hat.ribbon"]),
      person("char.boy", 90, 34, ["outfit.suit"]),
    ],
  },
  salon: {
    indoor: false,
    road: true,
    props: () => [
      tree("round", -330),
      tree("blossom", 220, 3),
      tree("pine", 310),
      house(6, "purple", -600, 0, "max-xl:hidden"),
      house(2, "red", 380, 0, "max-xl:hidden"),
      town(salonSvg(), SALON_SIZE, -52, 6),
      lamp(80),
      tree("bush", -220, 12),
      person("char.boy", -160, 32),
      person("char.rabbit", 130, 34),
    ],
  },
  farm: {
    indoor: false,
    fence: true,
    props: () => [
      tree("round", -400),
      tree("pine", 300),
      tree("round", 380, 3),
      house(5, "brown", -640, 0, "max-xl:hidden"),
      town(farmSvg(), FARM_SIZE, -86, 6),
      animal("animal.calf", -190, 24),
      animal("animal.lamb", 110, 22),
      animal("animal.chick", -250, 40, HOP),
      animal("animal.piglet", 170, 42),
      person("char.boy", -40, 44, ["outfit.overalls", "hat.straw"]),
    ],
  },
  fishing: {
    indoor: false,
    props: () => [
      tree("pine", -360),
      tree("round", -280, 3),
      tree("pine", 230),
      tree("round", 300, 3),
      tree("blossom", 400, 0, "max-xl:hidden"),
      town(fishingSvg(), FISHING_SIZE, -82, 8),
      tree("bush", -200, 12),
      person("char.fox", -150, 36),
      animal("animal.kitten", 120, 40, HOP),
    ],
  },
  attendance: {
    indoor: false,
    road: true,
    props: () => [
      tree("round", -330),
      tree("blossom", 230, 3),
      tree("pine", 320),
      house(1, "mint", -520, 0, "max-xl:hidden"),
      house(3, "red", 390, 0, "max-xl:hidden"),
      town(boardSvg(), BOARD_SIZE, -50, 6),
      town(mailboxSvg(), MAILBOX_SIZE, -120, 14),
      town(signpostSvg(), SIGNPOST_SIZE, 110, 8),
      person("char.dog", -190, 32),
      person("char.rabbit", 70, 36),
    ],
  },
  notifications: {
    indoor: false,
    road: true,
    props: () => [
      tree("pine", -340),
      tree("round", 240, 3),
      house(3, "blue", -560, 0, "max-xl:hidden"),
      house(2, "mint", -78, 0),
      house(4, "yellow", 330, 0, "max-xl:hidden"),
      tree("blossom", -180, 3),
      town(mailboxSvg(), MAILBOX_SIZE, 30, 18),
      town(mailboxSvg("#4a7fd6"), MAILBOX_SIZE, 150, 18),
      lamp(-120, 10),
      person("char.dog", 70, 36),
      person("char.cat", -200, 34),
    ],
  },
  wallet: {
    indoor: true,
    props: () => [
      furniture("furniture.shelf", -250),
      furniture("furniture.clock", -150, -40),
      furniture("furniture.desk", -40, 6),
      furniture("furniture.globe", -36, -34),
      furniture("furniture.crate", 70, 8),
      furniture("furniture.cupboard", 150),
      furniture("furniture.plant", 240, 4),
      person("char.panda", 20, 30),
    ],
  },
  closet: {
    indoor: true,
    props: () => [
      furniture("furniture.wardrobe", -260),
      furniture("furniture.dresser", -170, 2),
      furniture("furniture.easel", 120, 2),
      furniture("furniture.monstera", 210),
      furniture("furniture.rug", -32, 28),
      furniture("furniture.lamp", 300, 2),
      person("char.girl", -24, 40, ["outfit.hanbok", "hat.ribbon"]),
    ],
  },
  admin: {
    indoor: true,
    props: () => [
      furniture("furniture.shelf", -280),
      furniture("furniture.globe", -190, 4),
      furniture("furniture.computer", 110, 4),
      furniture("furniture.clock", 200, -40),
      furniture("furniture.fireplace", 260),
      furniture("furniture.rug", -32, 30),
      furniture("furniture.throne", -32, 8),
    ],
  },
};

const SKY = "linear-gradient(#7cc6f5 0 24px, #8ccff7 24px 48px, #9dd7f8 48px 72px, #b0e0fa 72px 92px, #c6e9fb 92px 108px, #dbf1fb 108px)";

/** 장소 그림 띠 */
export function PlaceBanner({ place }: { place: PlaceKey }) {
  const scene = SCENES[place];
  const props = scene.props();
  props.sort((a, b) => a.y - b.y);
  const hills = { w: HILLS_SIZE.w * S, h: HILLS_SIZE.h * S };

  return (
    <div className="pixel-banner select-none" style={{ height: H }} aria-hidden data-place-banner={place}>
      {scene.indoor ? (
        <>
          {/* 벽지 + 창 둘 + 걸레받이 + 마루 */}
          <div className="absolute inset-0" style={{ backgroundImage: `url("${ROOM_ART.wall}")`, backgroundSize: `${16 * S}px ${16 * S}px`, backgroundPosition: "center top" }} />
          {[-150, 90].map((x) => (
            // eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI)
            <img key={x} src={ROOM_ART.window} alt="" width={20 * S} height={17 * S} className="absolute max-w-none" style={{ left: `calc(50% + ${x}px)`, top: 26 }} />
          ))}
          <div
            className="absolute inset-x-0 bottom-0 border-t-[6px] border-[#a8703f]"
            style={{ top: HORIZON - 6, backgroundImage: `url("${ROOM_ART.floor}")`, backgroundSize: `${16 * S}px ${16 * S}px`, boxShadow: "inset 0 3px 0 0 #4a3426" }}
          />
        </>
      ) : (
        <>
          <div className="absolute inset-0" style={{ background: SKY }} />
          {[
            { kind: "small" as const, top: 10, duration: 90, delay: -30 },
            { kind: "big" as const, top: 34, duration: 140, delay: -90 },
          ].map((c, i) => {
            const size = cloudSize(c.kind);
            return (
              // eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI)
              <img
                key={i}
                src={cloudDataUri(c.kind)}
                alt=""
                width={(size.width / PIXEL) * S}
                height={(size.height / PIXEL) * S}
                className="absolute left-0 max-w-none opacity-90 motion-safe:animate-[drift_linear_infinite]"
                style={{ top: c.top, animationDuration: `${c.duration}s`, animationDelay: `${c.delay}s` }}
              />
            );
          })}
          <div
            className="absolute inset-x-0 bg-repeat-x"
            style={{ top: HORIZON - hills.h, height: hills.h, backgroundImage: `url("${hillsDataUri()}")`, backgroundSize: `${hills.w}px ${hills.h}px`, backgroundPosition: "center bottom" }}
          />
          <div
            className="absolute inset-x-0 bottom-0 bg-[#9cdb94]"
            style={{ top: HORIZON, backgroundImage: `url("${lawnDataUri()}")`, backgroundSize: `${48 * S}px ${48 * S}px`, backgroundPosition: "center top" }}
          >
            {scene.road && (
              <div
                className="absolute inset-x-0 bg-repeat-x"
                style={{ top: 10, height: 24 * S, backgroundImage: `url("${roadDataUri()}")`, backgroundSize: `${16 * S}px ${24 * S}px`, backgroundPosition: "center top" }}
              />
            )}
            {scene.fence && (
              <div
                className="absolute inset-x-0 bg-repeat-x"
                style={{ bottom: -4, height: 16 * S, backgroundImage: `url("${fenceDataUri()}")`, backgroundSize: `${16 * S}px ${16 * S}px`, backgroundPosition: "center top" }}
              />
            )}
          </div>
        </>
      )}
      {/* 소품: 지평선이 기준선 */}
      <div className="absolute left-1/2 h-0 w-0" style={{ top: HORIZON }}>
        {props.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI)
          <img
            key={i}
            src={p.src}
            alt=""
            width={p.width}
            height={p.height}
            className={`absolute max-w-none ${p.className ?? ""}`}
            style={{ left: p.x, top: p.y - p.height }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * 장소 화면 머리: 그림 띠 + 나무 간판 제목(h1) + 안내 글 + 오른쪽 칸(코인 등).
 * 제목 글자는 그대로 h1에 두어 화면 읽기·시험이 이름을 읽는다. 아이콘은 꾸밈(aria-hidden)
 */
export function PlaceHeader({
  place,
  icon,
  title,
  children,
  aside,
}: {
  place: PlaceKey;
  icon: IconName;
  title: string;
  /** 안내 글 */
  children?: React.ReactNode;
  /** 간판 오른쪽 (코인·레벨 칩, 버튼) */
  aside?: React.ReactNode;
}) {
  return (
    <header className="mb-2">
      <PlaceBanner place={place} />
      {/* 간판은 그림 띠 아래 끝에 걸치고(-mt-7), 오른쪽 칸은 띠 아래에 붙는다 */}
      <div className="relative flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-2 sm:px-4">
        <h1 className="pixel-sign -mt-7 max-w-full text-2xl sm:text-3xl">
          <PixelIcon name={icon} scale={2} />
          <span className="min-w-0 break-keep">{title}</span>
        </h1>
        {aside && <div className="flex flex-wrap items-center gap-3 pt-3">{aside}</div>}
      </div>
      {children && <div className="mt-4 px-1 text-ink-soft sm:px-2">{children}</div>}
    </header>
  );
}

/** 간판 옆 레벨·코인 칩 (상점·옷가게·미용실) */
export function WalletChips({ level, coins }: { level: number; coins: number }) {
  return (
    <div className="flex items-center gap-3" data-shop-wallet>
      <span className="pixel-badge gap-1 bg-[#e9f6e4] py-0.5 text-sm" title="레벨">
        <PixelIcon name="star" scale={2} />
        Lv.<b>{level}</b>
      </span>
      <span className="pixel-badge gap-1 bg-[#fff3d6] py-0.5 text-sm" title="내 코인">
        <PixelIcon name="coin" scale={2} />
        <b>{coins.toLocaleString()}</b>
      </span>
    </div>
  );
}
