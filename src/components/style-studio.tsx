"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CharacterArt } from "@/components/character";
import { AVATAR_PARTS, type AvatarSlot } from "@/lib/art/avatar";
import { HAIR_COLORS as HAIR_HEX } from "@/lib/art/hair";
import { walkSheetDataUri, WALK_DIRS, type WalkDir } from "@/lib/art/walk";
import { checkout, checkoutState, SLOT_LABELS, STYLE_ERRORS, STYLE_PLACES, styleMessage, type StyleItem, type StylePlace, type StyleSelection } from "@/lib/style";

type Result = { ok: true; bought: string[]; cost: number; coins: number } | { ok: false; error: string };

/** 가게마다 다른 색 (차양 줄무늬·거울 벽지) */
const THEMES: Record<StylePlace, { awning: string; wall: string; floor: string }> = {
  salon: {
    awning: "repeating-linear-gradient(90deg,#ff9ec3 0 28px,#fffaf0 28px 56px)",
    wall: "repeating-linear-gradient(90deg,#ffe3ee 0 16px,#ffd3e4 16px 32px)",
    floor: "repeating-conic-gradient(#fff6ea 0 25%,#f4d9c4 0 50%) 0 0/32px 32px",
  },
  clothes: {
    awning: "repeating-linear-gradient(90deg,#7fd3c0 0 28px,#fffaf0 28px 56px)",
    wall: "repeating-linear-gradient(90deg,#e4f4ec 0 16px,#d4ecdf 16px 32px)",
    floor: "repeating-linear-gradient(90deg,#dba46a 0 30px,#c98f58 30px 32px)",
  },
};

/** "원래대로" 칸의 이름 (그 부위를 비운다) */
const NONE_LABEL: Record<AvatarSlot, string> = {
  hair: "원래 머리",
  hair_color: "원래 색",
  outfit: "옷 벗기",
  hat: "모자 벗기",
  accessory: "소품 빼기",
};

const DIR_LABEL: Record<WalkDir, string> = { down: "앞", left: "왼쪽", right: "오른쪽", up: "뒤" };
const MIRROR = 192; // 거울 속 캐릭터 한 칸 (24칸 × 8배)

/**
 * 미용실·옷가게 화면 (SHOP-07·08). 왼쪽 거울에 고른 모습이 바로 걷는 모습으로 보이고(미리보기),
 * [적용하기]를 누르면 없는 것은 사서(0코인은 그냥 받는다) 입는다. 서버는 화면이 보여 준 코인(pay)과 같은지 한 번 더 확인한다
 */
export function StyleStudio({
  place,
  items: initialItems,
  worn: initialWorn,
  character,
  baseOutfit,
  level,
  coins: initialCoins,
  hairVisible,
  save,
}: {
  place: StylePlace;
  items: StyleItem[];
  /** 지금 입은 것 (이 가게 부위만) */
  worn: StyleSelection;
  character: string;
  /** 이 가게가 다루지 않는 부위에 입은 것 (asset_key, 미리보기에 그대로 입힌다) */
  baseOutfit: string[];
  level: number;
  coins: number;
  /** 지금 캐릭터에게 머리가 보이는지 (동물은 털이라 머리가 안 바뀐다) */
  hairVisible: boolean;
  save: (selection: StyleSelection, pay: number) => Promise<Result>;
}) {
  const slots: readonly AvatarSlot[] = STYLE_PLACES[place].slots;
  const [items, setItems] = useState(initialItems);
  const [worn, setWorn] = useState(initialWorn);
  const [coins, setCoins] = useState(initialCoins);
  const [picked, setPicked] = useState<StyleSelection>(() => Object.fromEntries(slots.map((s) => [s, initialWorn[s] ?? null])));
  const [tab, setTab] = useState<AvatarSlot>(slots[0]);
  const [dir, setDir] = useState<WalkDir>("down");
  const [walking, setWalking] = useState(true);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!message?.ok) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const assetsOf = (sel: StyleSelection) =>
    slots.map((s) => sel[s]).flatMap((id) => (typeof id === "number" && byId.get(id) ? [byId.get(id)!.assetKey] : []));
  const look = [...baseOutfit, ...assetsOf(picked)];
  // 카드 미리보기: 머리가 안 보이는 캐릭터는 미용실 카드만 남자 주민에게 입혀 본다
  const cardCharacter = place === "salon" && !hairVisible ? "char.boy" : character;

  const bill = checkout(items, picked, worn, { level, coins });
  const state = checkoutState(bill);

  const lookId = look.join("+");
  const sheet = useMemo(() => walkSheetDataUri(character, lookId ? lookId.split("+") : [], 8), [character, lookId]);

  function choose(slot: AvatarSlot, id: number | null) {
    setPicked((p) => ({ ...p, [slot]: id }));
    setMessage(null);
  }

  function apply() {
    setMessage(null);
    const selection = picked;
    start(async () => {
      try {
        const r = await save(selection, bill.cost);
        if (!r.ok) return setMessage({ ok: false, text: r.error });
        setItems((list) => list.map((i) => (bill.toBuy.some((b) => b.id === i.id) ? { ...i, owned: true } : i)));
        setWorn(selection);
        setCoins(r.coins);
        setMessage({ ok: true, text: styleMessage(place, r.bought, r.cost) });
      } catch {
        setMessage({ ok: false, text: STYLE_ERRORS.failed });
      }
    });
  }

  const theme = THEMES[place];
  const button =
    state === "same"
      ? "지금 모습이에요"
      : state === "locked"
        ? `🔒 Lv.${bill.lockedLevel}부터 살 수 있어요`
        : state === "short"
          ? `코인이 ${bill.short}개 부족해요`
          : state === "buy"
            ? `🪙 ${bill.cost} 내고 적용하기`
            : "✨ 적용하기";

  const list = items.filter((i) => i.slot === tab);

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]" data-style-studio={place}>
      {/* 거울: 고른 모습이 걷는다 */}
      <section className="lg:sticky lg:top-20 lg:self-start" aria-label="거울 미리보기">
        <div className="overflow-hidden rounded-2xl border-4 border-[#4a3426] bg-white shadow-[0_6px_0_0_#4a3426]">
          <div className="h-5 border-b-4 border-[#4a3426]" style={{ background: theme.awning }} aria-hidden />
          <div className="relative grid h-64 place-items-center" style={{ background: theme.wall }}>
            {/* 나무 거울 틀 */}
            <div className="absolute inset-x-10 top-4 bottom-14 rounded-t-[999px] border-[6px] border-[#ad7445] bg-[#effbff]/70 shadow-[inset_0_0_0_3px_#dba46a]" aria-hidden />
            <div className="absolute inset-x-0 bottom-0 h-14 border-t-4 border-[#4a3426]" style={{ background: theme.floor }} aria-hidden />
            <div
              data-mirror
              data-look={look.join("+")}
              className={`pixelated relative ${walking ? "walk-cycle" : ""}`}
              style={
                {
                  width: MIRROR,
                  height: MIRROR,
                  backgroundImage: `url("${sheet}")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPositionY: -WALK_DIRS.indexOf(dir) * MIRROR,
                  "--cell": `${MIRROR}px`,
                } as React.CSSProperties
              }
              role="img"
              aria-label="고른 모습 미리보기"
            />
          </div>
          <div className="flex items-center justify-between gap-2 border-t-4 border-[#4a3426] bg-[#fff3d6] px-3 py-2">
            <div className="flex gap-1" role="group" aria-label="돌려 보기">
              {(["down", "left", "up", "right"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={dir === d}
                  onClick={() => setDir(d)}
                  className={`min-h-9 rounded-lg border-2 border-[#4a3426] px-2 text-xs font-bold ${dir === d ? "bg-sun" : "bg-white"}`}
                >
                  {DIR_LABEL[d]}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setWalking((w) => !w)} aria-pressed={walking} className="min-h-9 rounded-lg border-2 border-[#4a3426] bg-white px-2 text-xs font-bold">
              {walking ? "🚶 걷는 중" : "🧍 서 있기"}
            </button>
          </div>
        </div>

        {place === "salon" && !hairVisible && (
          <p className="mt-3 rounded-xl border-2 border-dashed border-[#d9a0b8] bg-[#fff0f6] p-3 text-sm" data-hair-hidden>
            🐾 지금 캐릭터는 털이라 머리가 보이지 않아요. 사람 주민(남자·여자 주민, 모험가)일 때 보여요. 골라 둔 머리는 그대로 남아요.
          </p>
        )}

        {/* 계산서 */}
        <div className="card mt-4 p-4" data-style-bill>
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold">🧾 계산서</span>
            <span>
              내 코인 🪙 <b data-style-coins>{coins.toLocaleString()}</b>
            </span>
          </div>
          {bill.toBuy.length ? (
            <ul className="mt-2 space-y-1 text-sm">
              {bill.toBuy.map((i) => (
                <li key={i.id} className="flex justify-between gap-2">
                  <span className="truncate">
                    {SLOT_LABELS[i.slot]} · {i.name}
                  </span>
                  <span className="shrink-0 font-bold">{i.price ? `🪙 ${i.price}` : "무료"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">{state === "same" ? "마음에 드는 걸 골라 보세요." : "가진 것만 골랐어요. 코인이 들지 않아요."}</p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setPicked(Object.fromEntries(slots.map((s) => [s, worn[s] ?? null])));
                setMessage(null);
              }}
              disabled={state === "same" || pending}
              className="btn min-h-11 bg-white px-3 text-sm text-ink"
            >
              되돌리기
            </button>
            <button
              type="button"
              data-style-apply={state}
              onClick={apply}
              disabled={(state !== "buy" && state !== "apply") || pending}
              className="btn min-h-11 flex-1 bg-sun text-sm text-ink"
            >
              {pending ? "적용하는 중…" : button}
            </button>
          </div>
          <p role="status" aria-live="polite" className={`mt-2 min-h-5 text-center text-sm font-bold ${message?.ok ? "text-leaf-dark" : "text-berry"}`}>
            {message?.text}
          </p>
        </div>
      </section>

      {/* 진열대 */}
      <section aria-label="고르기">
        <div className="flex flex-wrap gap-2" role="tablist">
          {slots.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={tab === s}
              onClick={() => setTab(s)}
              className={`min-h-11 rounded-xl border-[3px] border-[#4a3426] px-4 font-display text-lg shadow-[0_3px_0_0_#4a3426] transition active:translate-y-0.5 active:shadow-none ${tab === s ? "bg-sun" : "bg-white hover:bg-cream"}`}
            >
              {SLOT_LABELS[s]}
            </button>
          ))}
        </div>

        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" data-style-grid={tab}>
          <OptionCard
            label={NONE_LABEL[tab]}
            sub={worn[tab] == null ? "지금 모습" : "무료"}
            selected={picked[tab] == null}
            onClick={() => choose(tab, null)}
            character={cardCharacter}
            outfit={[...baseOutfit, ...assetsOf({ ...picked, [tab]: null })]}
            dataId="none"
          />
          {list.map((item) => {
            const locked = !item.owned && item.requiredLevel > level;
            return (
              <OptionCard
                key={item.id}
                label={item.name}
                sub={item.owned ? (worn[tab] === item.id ? "입는 중 ✓" : "보유 ✓") : locked ? `🔒 Lv.${item.requiredLevel}` : item.price ? `🪙 ${item.price}` : "무료"}
                title={item.description ?? undefined}
                selected={picked[tab] === item.id}
                onClick={() => choose(tab, item.id)}
                character={cardCharacter}
                outfit={[...baseOutfit, ...assetsOf({ ...picked, [tab]: item.id })]}
                dataId={String(item.id)}
                owned={item.owned}
                locked={locked}
                swatch={AVATAR_PARTS[item.assetKey]?.slot === "hair_color" ? item.assetKey : undefined}
              />
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function OptionCard({
  label,
  sub,
  title,
  selected,
  onClick,
  character,
  outfit,
  dataId,
  owned = false,
  locked = false,
  swatch,
}: {
  label: string;
  sub: string;
  title?: string;
  selected: boolean;
  onClick: () => void;
  character: string;
  outfit: string[];
  dataId: string;
  owned?: boolean;
  locked?: boolean;
  swatch?: string;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        title={title}
        data-style-option={dataId}
        data-owned={owned || undefined}
        className={`relative flex w-full flex-col items-center rounded-2xl border-[3px] p-2 pb-2.5 text-center transition hover:-translate-y-0.5 ${
          selected ? "border-sun-dark bg-[#fff3d6] shadow-[0_4px_0_0_#e08a00]" : "border-[#4a3426]/25 bg-white shadow-[0_4px_0_0_#ead9c0]"
        } ${locked ? "opacity-60" : ""}`}
      >
        {selected && (
          <span className="absolute -top-2 -right-2 grid size-7 place-items-center rounded-full border-2 border-[#4a3426] bg-sun text-sm" aria-hidden>
            ✓
          </span>
        )}
        <span className="grid w-full place-items-center rounded-xl bg-cream py-1">
          <CharacterArt asset={character} outfit={outfit} size={96} />
        </span>
        <span className="mt-1.5 flex items-center gap-1.5 font-display text-base leading-tight">
          {swatch && <HairSwatch assetKey={swatch} />}
          {label}
        </span>
        <span className={`text-xs ${owned ? "font-bold text-leaf-dark" : "text-ink-soft"}`}>{sub}</span>
      </button>
    </li>
  );
}

/** 머리 색 동그라미 */
function HairSwatch({ assetKey }: { assetKey: string }) {
  const hex = HAIR_HEX[assetKey];
  return hex ? <span className="inline-block size-3.5 rounded-full border-2 border-[#4a3426]" style={{ background: hex }} aria-hidden /> : null;
}
