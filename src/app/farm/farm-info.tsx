"use client";

// 농장 ⓘ 안내 창 (사용자 요청 2026-10-12 "동물농장에서 i 이런 아이콘 만들어서 확률 정보랑 말로 설명해 줘").
// 알 확률(등급별·종류별), 암수, 특별 진화 확률과 목록, 아기 모습으로 데리고 다니기를 쉬운 말로 알려 준다.
// 숫자는 모두 src/lib/farm.ts 한 곳의 표, 알 확률은 부화가 실제로 쓰는 DB 비중(animal_species.hatch_weight)을 그대로 보여 준다
import { useRef } from "react";
import { animalSvg, toAnimalDataUri } from "@/lib/art/animals";
import {
  HATCH_RARITY,
  type HatchRarity,
  RARITY_ICON,
  RARITY_LABEL,
  RARITY_ODDS,
  RARITY_ORDER,
  SEX_LOOKS,
  SPECIAL_VARIANTS,
  specialPercent,
} from "@/lib/farm";
import type { HatchOdds } from "@/server/farm";
import { IconText, PixelIcon } from "@/components/pixel-icon";

/** 12.5 → "12.5%", 3.75 → "3.75%", 20 → "20%" */
const pct = (n: number) => `${Math.round(n * 100) / 100}%`;

/* eslint-disable @next/next/no-img-element -- 코드로 만든 SVG(data URI)라 next/image 최적화가 필요 없다 */
function Mini({ assetKey, variant = null, sex = null }: { assetKey: string; variant?: string | null; sex?: "female" | "male" | null }) {
  return <img src={toAnimalDataUri(animalSvg(assetKey, "adult", 64, null, "normal", { variant, sex }))} alt="" width={64} height={64} className="pixelated shrink-0" aria-hidden />;
}
/* eslint-enable @next/next/no-img-element */

const RARITY_STYLE: Record<HatchRarity, string> = {
  common: "bg-[#e9f6e4]",
  rare: "bg-[#e3efff]",
  epic: "bg-[#fff0c2]",
  legend: "bg-[#f3e6ff]",
};

export function FarmInfo({ odds }: { odds: HatchOdds[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const total = odds.reduce((sum, o) => sum + o.hatchWeight, 0);
  const hatchable = odds.filter((o) => o.hatchWeight > 0);
  const percentOf = (o: HatchOdds) => (total > 0 ? (o.hatchWeight / total) * 100 : 0);
  const byCode = new Map(odds.map((o) => [o.code, o]));
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        aria-haspopup="dialog"
        title="알 확률·암수·특별 진화 안내"
        // ⓘ만으로는 무엇인지 모를 수 있어 글자로 "확률표"라고 쓴다 (사용자 요청 2026-10-16)
        className="pixel-btn pixel-btn-sm min-w-11 gap-1.5 whitespace-nowrap bg-sun px-3 font-display text-ink"
        data-farm-info-open
      >
        <PixelIcon name="egg" scale={1} />알 확률표 <span aria-hidden>ⓘ</span>
      </button>
      <dialog
        ref={ref}
        aria-labelledby="farm-info-title"
        data-farm-info
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="pixel-dialog m-auto max-h-[88dvh] w-[min(94vw,46rem)] overflow-y-auto p-0 backdrop:bg-[#2b2118]/60"
      >
        <div className="p-5">
          <div className="pb-plank sticky top-0 z-10 -mx-5 -mt-5 mb-4 flex items-center justify-between gap-2 px-5 py-2.5">
            <h2 id="farm-info-title" className="font-display text-xl">
              <IconText icon="egg" scale={2}>알 확률표</IconText> <span className="text-sm text-[#fff3d6]">· 동물 농장 안내</span>
            </h2>
            <button type="button" onClick={() => ref.current?.close()} aria-label="안내 닫기" className="pixel-btn pixel-btn-sm min-w-11 bg-[#fffaf0] px-3 text-ink [text-shadow:none]">
              ✕
            </button>
          </div>

          {/* 알 확률 */}
          <section aria-labelledby="farm-info-egg" data-info-odds>
            <h3 id="farm-info-egg" className="flex items-center gap-2 font-display text-lg">
              <PixelIcon name="egg" scale={2} />알에서 누가 나올까요?
            </h3>
            <p className="mt-1 text-sm">
              알을 부화시키면 아래 {hatchable.length}종류 중 하나가 나와요. 등급은 네 가지예요: 농장에서 흔한 <b>보통</b> 동물은 자주(
              {RARITY_ODDS.common}%), <b>희귀</b>한 동물은 가끔({RARITY_ODDS.rare}%), <b>매우 희귀</b>한 동물은 드물게({RARITY_ODDS.epic}%), 맹수의
              왕 <b>전설</b> 동물은 정말 드물게({RARITY_ODDS.legend}%) 나와요. 같은 등급 안에서는 모두 똑같은 확률이에요.
            </p>
            <div className="mt-3 grid gap-3">
              {RARITY_ORDER.map((tier) => {
                const list = hatchable.filter((o) => HATCH_RARITY[o.code] === tier);
                if (!list.length) return null;
                const sum = list.reduce((s, o) => s + percentOf(o), 0);
                return (
                  <div key={tier} className={`pixel-slot p-2 ${RARITY_STYLE[tier]}`} data-rarity={tier}>
                    <p className="font-bold">
                      <IconText icon={RARITY_ICON[tier]} scale={2}>{RARITY_LABEL[tier]}</IconText> <span className="text-sm text-ink-soft">· 모두 합쳐 {pct(sum)}</span>
                    </p>
                    <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      {list.map((o) => (
                        <li key={o.code} className="flex items-center text-sm" data-odds={o.code}>
                          <Mini assetKey={o.assetKey} />
                          <span>
                            {o.name}
                            <br />
                            <b>{pct(percentOf(o))}</b>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-ink-soft">
              [동물 분양]은 확률 없이 코인을 내고 원하는 동물을 바로 데려와요. 곰·늑대·치타와 전설 동물은 분양하지 않고 알에서만 만날 수 있어요.
            </p>
          </section>

          {/* 암수 */}
          <section aria-labelledby="farm-info-sex" className="mt-6" data-info-sex>
            <h3 id="farm-info-sex" className="font-display text-lg">
              <span className="text-berry">♀</span> 암컷과 <span className="text-[#2f62a8]">♂</span> 수컷
            </h3>
            <p className="mt-1 text-sm">
              알에서 깨어나거나 분양으로 올 때 반반(50%)의 확률로 암컷이나 수컷이 돼요. 아기일 때는 똑같지만, 다 자라면 모습이 조금 달라요.
              암컷은 목에 분홍 리본, 수컷은 파란 나비넥타이를 달아요.
            </p>
            <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
              {Object.entries(SEX_LOOKS).map(([code, look]) => {
                const sp = byCode.get(code);
                if (!sp) return null;
                return (
                  <li key={code} className="pixel-slot flex items-center gap-1 py-0.5 pr-2">
                    <Mini assetKey={sp.assetKey} sex="female" />
                    <Mini assetKey={sp.assetKey} sex="male" />
                    <span>
                      <b>{sp.name}</b>
                      <br />
                      <span className="text-berry">♀</span> {look.female} · <span className="text-[#2f62a8]">♂</span> {look.male}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* 특별 진화 */}
          <section aria-labelledby="farm-info-special" className="mt-6" data-info-special>
            <h3 id="farm-info-special" className="flex items-center gap-2 font-display text-lg">
              <PixelIcon name="sparkle" scale={2} />특별 진화
            </h3>
            <p className="mt-1 text-sm">
              동물이 다 자라는 순간, 아주 낮은 확률로 특별한 모습이 돼요. 알에서 나온 동물도, 분양으로 데려온 동물도 똑같아요. 특별한 동물은 반짝반짝
              빛나고 도감에도 그 이름으로 따로 모여요. 제 모습이 이미 특별해서 스킨은 입지 않아요.
            </p>
            <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
              {SPECIAL_VARIANTS.map((v) => {
                const sp = byCode.get(v.species);
                if (!sp) return null;
                return (
                  <li key={v.key} className="pixel-slot flex items-center gap-1 py-0.5 pr-2" data-special={v.key}>
                    <Mini assetKey={sp.assetKey} variant={v.key} />
                    <span>
                      {sp.name} → <b>{v.name}</b> <b className="text-sun-dark">{pct(v.chance)}</b>
                      <br />
                      <span className="text-xs text-ink-soft">{v.look}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-ink-soft">
              두 가지 모습이 있는 동물(조랑말·곰·여우·독수리·표범·사슴)은 어느 한쪽이 될 확률을 더해서 특별해질 확률이 {pct(specialPercent("fox"))}~
              {pct(specialPercent("pony"))}, 한 가지인 동물은 {pct(specialPercent("chick"))}예요. 구미호와 불사조는 그중에서도 가장 드물어요.
            </p>
          </section>

          {/* 아기 모습 */}
          <section aria-labelledby="farm-info-baby" className="mt-6" data-info-baby>
            <h3 id="farm-info-baby" className="flex items-center gap-2 font-display text-lg">
              <PixelIcon name="bottle" scale={2} />아기 모습으로 데리고 다니기
            </h3>
            <p className="mt-1 text-sm">
              다 키운 동물 카드에서 <b>[아기 모습]</b>을 고르면 광장에서 나를 따라다닐 때와 우리 집 방에서 아기 때 모습으로 보여요. 크기(아주 작게~크게)도
              모습마다 고를 수 있고, 언제든 무료로 <b>[다 자란 모습]</b>으로 되돌릴 수 있어요.
            </p>
            <p className="mt-1 text-sm" data-info-gait>
              독수리는 날개를 퍼덕이며 날아서, 거북이는 느릿느릿 걸어서 따라와요. 거북이가 뒤처지면 잠깐 서서 기다려 주세요.
            </p>
          </section>
        </div>
      </dialog>
    </>
  );
}
