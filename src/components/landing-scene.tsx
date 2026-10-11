// 첫 화면 배경: 도트로 그린 하늘·구름·언덕·잔디·흙길 위에 광장의 집·나무와 주민·동물이 서 있는 마을 풍경
// (2026-10-11 사용자 요청 "첫 화면도 도트로, 스타듀밸리·메이플·동물 농장 느낌").
// 모든 그림은 src/lib/art의 코드 그림이고 광장과 같은 3배 도트다 (늘이거나 줄이지 않는다).
// 지평선(잔디가 시작하는 줄): 휴대폰·태블릿은 위에서 HORIZON_TOP px, 넓은 화면(lg)은 아래에서 GROUND px.
// 소품 좌표는 화면 가운데 기준 px라 어느 너비에서도 가운데 마을이 보이고, 넓을수록 양옆이 더 보인다.
import { characterDataUri } from "@/lib/assets";
import { animalSvg, toAnimalDataUri } from "@/lib/art/animals";
import { cloudDataUri, cloudSize, fenceDataUri, FENCE_PX, hillsDataUri, HILLS_SIZE, lawnDataUri, LAWN_PX, roadDataUri, ROAD_PX, type CloudKind } from "@/lib/art/landing";
import { PIXEL } from "@/lib/art/pixel";
import {
  HOUSE_STAGES,
  houseSvg,
  lampSvg,
  LAMP_SIZE,
  mailboxSvg,
  MAILBOX_SIZE,
  ROOF_HEX,
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

type Prop = {
  src: string;
  width: number;
  height: number;
  /** 왼쪽 끝: 화면 가운데에서 px (3의 배수) */
  x: number;
  /** 발 위치: 지평선에서 아래로 px. 클수록 앞에 서고 앞에 그린다 */
  y: number;
  /** 좁은 화면에서 숨김 등 */
  className?: string;
};

const house = (stage: HouseStage, roof: keyof typeof ROOF_HEX, x: number, y: number, className?: string): Prop => ({
  src: toDataUri(houseSvg(stage, ROOF_HEX[roof])),
  ...HOUSE_STAGES[stage],
  x,
  y,
  className,
});
const tree = (kind: TreeKind, x: number, y: number, className?: string): Prop => ({ src: toDataUri(treeSvg(kind)), ...treeSize(kind), x, y, className });
const person = (asset: string, x: number, y: number, className?: string): Prop => ({ src: characterDataUri(asset, 72), width: 72, height: 72, x, y, className });
const animal = (asset: string, x: number, y: number, className?: string): Prop => ({
  src: toAnimalDataUri(animalSvg(asset, "adult", 96)),
  width: 96,
  height: 96,
  x,
  y,
  className,
});

// 움직임 (움직임 줄이기 설정이면 멈춘다)
const HOP = "motion-safe:animate-[hop_0.9s_steps(2)_infinite]";
const HOP_SLOW = "motion-safe:animate-[hop_1.4s_steps(2)_infinite]";

/** 지평선 위치 (CSS 값). 휴대폰·태블릿은 위에서, 넓은 화면은 아래에서 잰다 */
export const HORIZON_TOP = 300;
export const GROUND = 246;
const horizon = `top-[300px] lg:top-[calc(100%-246px)]`;

// 그리는 순서 = 뒤(지평선 가까이)부터 앞으로. 가운데(±180px)는 휴대폰에서도 보인다
const PROPS: Prop[] = [
  // ── 뒷줄: 집과 나무 ──
  tree("pine", -1059, 3),
  house(6, "brown", -1005, 9),
  tree("round", -786, 6),
  house(5, "blue", -726, 9),
  tree("pine", -534, 3),
  house(2, "yellow", -474, 6),
  tree("blossom", -336, 9),
  house(3, "red", -255, 9),
  tree("round", -81, 3),
  house(1, "mint", 0, 6),
  tree("blossom", 126, 9),
  house(4, "pink", 213, 9),
  tree("pine", 408, 3),
  { src: toDataUri(shopSvg()), ...SHOP_SIZE, x: 477, y: 12 },
  tree("round", 690, 6),
  house(7, "purple", 768, 9),
  tree("pine", 990, 3),
  // ── 길가: 우체통·가로등·이정표 ──
  { src: toDataUri(mailboxSvg()), ...MAILBOX_SIZE, x: -114, y: 33 },
  { src: toDataUri(mailboxSvg("#4a7fd6")), ...MAILBOX_SIZE, x: 150, y: 33 },
  { src: toDataUri(lampSvg()), ...LAMP_SIZE, x: -378, y: 42 },
  { src: toDataUri(lampSvg()), ...LAMP_SIZE, x: 381, y: 42 },
  { src: toDataUri(signpostSvg()), ...SIGNPOST_SIZE, x: -564, y: 60, className: "max-lg:hidden" },
  tree("bush", -168, 48),
  tree("bush", 300, 48),
  // ── 흙길 위 주민 ──
  person("char.fox", -486, 102, HOP_SLOW),
  person("char.girl", -150, 99, HOP_SLOW),
  person("char.boy", -78, 102, HOP),
  person("char.cat", 96, 105, HOP_SLOW),
  person("char.dog", 528, 99, HOP),
  person("char.rabbit", 840, 105, HOP),
  // ── 앞 풀밭: 울타리 앞 동물 (넓은 화면) ──
  // 휴대폰·태블릿에서는 로그인 판에 반쯤 가려 보여 숨긴다
  animal("animal.calf", -771, 222, "max-lg:hidden"),
  animal("animal.piglet", -660, 228, "max-lg:hidden"),
  animal("animal.chick", -387, 219, `max-lg:hidden ${HOP_SLOW}`),
  animal("animal.bunny", -246, 225, `max-lg:hidden ${HOP}`),
  animal("animal.chick", 30, 216, `max-lg:hidden ${HOP}`),
];

const CLOUDS: { kind: CloudKind; top: number; duration: number; delay: number }[] = [
  { kind: "big", top: 36, duration: 140, delay: -20 },
  { kind: "small", top: 120, duration: 100, delay: -70 },
  { kind: "big", top: 210, duration: 170, delay: -120 },
  { kind: "small", top: 60, duration: 120, delay: -10 },
];

export function LandingScene() {
  const lawn = lawnDataUri();
  return (
    <div className="pixelated pointer-events-none absolute inset-0 -z-0 select-none overflow-hidden" aria-hidden>
      {/* 하늘: 띠마다 색이 딱 끊기는 도트 하늘 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(#7cc6f5 0 72px, #8ccff7 72px 144px, #9dd7f8 144px 210px, #b0e0fa 210px 270px, #c6e9fb 270px 330px, #dbf1fb 330px 390px, #ecf7f6 390px)",
        }}
      />
      {/* 구름 */}
      {CLOUDS.map((c, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI)
        <img
          key={i}
          src={cloudDataUri(c.kind)}
          alt=""
          {...cloudSize(c.kind)}
          className="absolute left-0 max-w-none opacity-95 motion-safe:animate-[drift_linear_infinite]"
          style={{ top: c.top, animationDuration: `${c.duration}s`, animationDelay: `${c.delay}s` }}
        />
      ))}
      {/* 먼 언덕 (지평선에 붙는다) */}
      <div
        className={`absolute inset-x-0 -translate-y-full bg-bottom bg-repeat-x ${horizon}`}
        style={{ height: HILLS_SIZE.h * PIXEL, backgroundImage: `url("${hillsDataUri()}")`, backgroundSize: `${HILLS_SIZE.w * PIXEL}px ${HILLS_SIZE.h * PIXEL}px` }}
      />
      {/* 잔디: 지평선부터 맨 아래까지 */}
      <div className={`absolute inset-x-0 bottom-0 bg-[#9cdb94] ${horizon}`} style={{ backgroundImage: `url("${lawn}")`, backgroundSize: `${LAWN_PX}px ${LAWN_PX}px`, backgroundPosition: "center top" }}>
        {/* 울타리 (왼쪽 풀밭) */}
        <div
          className="absolute top-[156px] right-[calc(50%+120px)] w-[720px] bg-repeat-x max-sm:hidden"
          style={{ height: FENCE_PX.h, backgroundImage: `url("${fenceDataUri()}")`, backgroundSize: `${FENCE_PX.w}px ${FENCE_PX.h}px` }}
        />
        {/* 흙길 */}
        <div
          className="absolute inset-x-0 top-[54px] bg-repeat-x"
          style={{ height: ROAD_PX.h, backgroundImage: `url("${roadDataUri()}")`, backgroundSize: `${ROAD_PX.w}px ${ROAD_PX.h}px`, backgroundPosition: "center top" }}
        />
      </div>
      {/* 집·나무·주민·동물 (지평선이 기준선) */}
      <div className={`absolute left-1/2 h-0 w-0 ${horizon}`}>
        {PROPS.map((p, i) => (
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
