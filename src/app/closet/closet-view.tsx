"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { MiniRoom } from "@/components/character";
import { ItemArt } from "@/components/item-art";
import { orderOutfit } from "@/lib/assets";
import { withJosa } from "@/lib/josa";
import { CLOSET_ERRORS, equipMessage } from "@/lib/shop";
import { equipItem, unequipAvatar } from "./actions";

type Slot = "hat" | "outfit" | "accessory";
type OwnedItem = { id: number; type: string; name: string; assetKey: string; avatarSlot: Slot | null };
type Equipped = { characterItemId: number; backgroundItemId: number; avatar: Partial<Record<Slot, number>> };

const SLOT_NAMES: Record<Slot, string> = { hat: "모자", outfit: "옷", accessory: "소품" };

export function ClosetView({ items, equipped, nickname, slug }: { items: OwnedItem[]; equipped: Equipped; nickname: string; slug: string }) {
  const [current, setCurrent] = useState(equipped);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  // "저장했어요"는 2초 뒤에 사라진다
  useEffect(() => {
    if (!message?.ok) return;
    const t = setTimeout(() => setMessage(null), 2000);
    return () => clearTimeout(t);
  }, [message]);

  const byId = new Map(items.map((i) => [i.id, i]));
  const character = byId.get(current.characterItemId);
  const background = byId.get(current.backgroundItemId);
  const outfit = orderOutfit(
    Object.values(current.avatar)
      .map((id) => (id ? byId.get(id)?.assetKey : undefined))
      .filter((k): k is string => !!k),
  );

  const isOn = (item: OwnedItem) =>
    item.type === "avatar" && item.avatarSlot ? current.avatar[item.avatarSlot] === item.id : item.id === current.characterItemId || item.id === current.backgroundItemId;

  function toggle(item: OwnedItem) {
    const before = current;
    const off = item.type === "avatar" && isOn(item);
    // 미리 바꿔 보여주고, 실패하면 되돌린다 (SHOP-04)
    if (item.type === "avatar" && item.avatarSlot) {
      setCurrent({ ...current, avatar: { ...current.avatar, [item.avatarSlot]: off ? undefined : item.id } });
    } else {
      setCurrent({ ...current, [item.type === "character" ? "characterItemId" : "backgroundItemId"]: item.id });
    }
    setMessage(null);
    start(async () => {
      try {
        const r = off ? await unequipAvatar(item.id) : await equipItem(item.id);
        if (r.ok) {
          setMessage({ ok: true, text: off ? `${withJosa(item.name, "을/를")} 벗었어요 ✓` : equipMessage(item.name) });
          return;
        }
        setCurrent(before);
        setMessage({ ok: false, text: r.error ?? CLOSET_ERRORS.failed });
      } catch {
        // 서버 오류(네트워크, DB 등)도 오류 화면 대신 되돌리고 알려준다
        setCurrent(before);
        setMessage({ ok: false, text: CLOSET_ERRORS.failed });
      }
    });
  }

  const grid = (list: OwnedItem[], clickable = true) => (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {list.map((item) => {
        const on = clickable && isOn(item);
        const art = (
          <>
            <ItemArt type={item.type} assetKey={item.assetKey} className="h-20" characterSize={72} />
            <span className="mt-1 block text-sm font-bold">
              {on && "✓ "}
              {item.name}
            </span>
            {item.avatarSlot && <span className="block text-xs text-ink-soft">{SLOT_NAMES[item.avatarSlot]}</span>}
          </>
        );
        return clickable ? (
          <button
            key={item.id}
            type="button"
            disabled={pending}
            aria-pressed={on}
            data-closet-item={item.id}
            onClick={() => toggle(item)}
            className={`card p-2 text-center transition hover:-translate-y-0.5 ${on ? "border-sun! bg-[#fff3d6]" : ""}`}
          >
            {art}
          </button>
        ) : (
          <div key={item.id} className="card p-2 text-center" data-closet-item={item.id}>
            {art}
          </div>
        );
      })}
    </div>
  );

  const of = (type: string) => items.filter((i) => i.type === type);
  const avatars = of("avatar");
  const characters = of("character");
  const furniture = of("furniture");
  const decos = of("deco");

  return (
    <>
      <MiniRoom
        characterAsset={character?.assetKey ?? ""}
        backgroundAsset={background?.assetKey ?? ""}
        outfit={outfit}
        nickname={nickname}
        className="h-60 rounded-2xl border-2 border-line shadow-[0_4px_0_0_var(--color-line)]"
      />
      <p role="status" aria-live="polite" className={`mt-3 min-h-6 text-center font-bold ${message?.ok ? "text-leaf-dark" : "text-berry"}`}>
        {message?.text}
      </p>

      <section className="mt-8" data-closet-section="avatar">
        <h2 className="mb-3 font-display text-2xl">👕 아바타 꾸미기</h2>
        {avatars.length === 0 ? (
          <p className="card p-4 text-center text-sm text-ink-soft">
            아직 아바타 아이템이 없어요. <Link href="/shop" className="font-bold underline">상점</Link>에서 모자·옷·소품을 사 보세요.
          </p>
        ) : (
          <>
            <p className="-mt-2 mb-3 text-sm text-ink-soft">모자·옷·소품을 하나씩 입을 수 있어요. 입은 걸 한 번 더 누르면 벗어요.</p>
            {grid(avatars)}
          </>
        )}
      </section>

      <section className="mt-8" data-closet-section="background">
        <h2 className="mb-3 font-display text-2xl">🖼 내 배경</h2>
        {grid(of("background"))}
      </section>

      {furniture.length > 0 && (
        <section className="mt-8" data-closet-section="furniture">
          <h2 className="mb-3 font-display text-2xl">🪑 가구</h2>
          <p className="-mt-2 mb-3 text-sm text-ink-soft">
            가구는 <Link href={`/@${slug}`} className="font-bold underline">내 블로그의 우리 집</Link>에서 [가구 놓기]로 놓아요.
          </p>
          {grid(furniture, false)}
        </section>
      )}

      {decos.length > 0 && (
        <section className="mt-8" data-closet-section="deco">
          <h2 className="mb-3 font-display text-2xl">🌷 광장 장식</h2>
          <p className="-mt-2 mb-3 text-sm text-ink-soft">
            장식은 PC의 <Link href="/town?deco=1" className="font-bold underline">광장</Link>에서 ☰ 메뉴 → 🌷 광장 꾸미기로 놓아요. 친구가 내 마을에 놀러 오면 볼 수 있어요.
          </p>
          {grid(decos, false)}
        </section>
      )}

      {/* 캐릭터는 이제 상점에서 팔지 않는다. 예전에 산 캐릭터가 있어 2마리 이상일 때만 고를 수 있게 보여 준다 */}
      {characters.length >= 2 && (
        <section className="mt-8" data-closet-section="character">
          <h2 className="mb-3 font-display text-2xl">🐾 내 캐릭터</h2>
          {grid(characters)}
        </section>
      )}
    </>
  );
}
