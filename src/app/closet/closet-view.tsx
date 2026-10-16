"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { MiniRoom } from "@/components/character";
import { ItemArt } from "@/components/item-art";
import { PixelIcon } from "@/components/pixel-icon";
import { orderOutfit } from "@/lib/assets";
import { CLOSET_ERRORS } from "@/lib/shop";
import { type ClosetChange, saveCloset } from "./actions";

type Slot = "hat" | "outfit" | "accessory" | "hair" | "hair_color" | "face_shape";
type OwnedItem = { id: number; type: string; name: string; assetKey: string; avatarSlot: Slot | null };
type Equipped = { characterItemId: number; backgroundItemId: number; avatar: Partial<Record<Slot, number>> };

const SLOT_NAMES: Record<Slot, string> = { hat: "모자", outfit: "옷", accessory: "소품", hair: "머리 모양", hair_color: "머리 색", face_shape: "얼굴형" };

export function ClosetView({ items, equipped, nickname, slug }: { items: OwnedItem[]; equipped: Equipped; nickname: string; slug: string }) {
  // saved = 저장된 모습, current = 눌러 본 모습 (미리보기). [저장]을 눌러야 적용된다 (2026-10-16 "저장 누르면 적용")
  const [saved, setSaved] = useState(equipped);
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

  // 저장된 모습과 다른 것만 보낸다
  const changes: ClosetChange[] = [
    ...(current.characterItemId !== saved.characterItemId ? [{ kind: "character" as const, itemId: current.characterItemId }] : []),
    ...(current.backgroundItemId !== saved.backgroundItemId ? [{ kind: "background" as const, itemId: current.backgroundItemId }] : []),
    ...(Object.keys(SLOT_NAMES) as Slot[])
      .filter((slot) => (current.avatar[slot] ?? null) !== (saved.avatar[slot] ?? null))
      .map((slot) => ({ kind: "avatar" as const, slot, itemId: current.avatar[slot] ?? null })),
  ];
  const dirty = changes.length > 0;

  function toggle(item: OwnedItem) {
    const off = item.type === "avatar" && isOn(item);
    if (item.type === "avatar" && item.avatarSlot) {
      setCurrent({ ...current, avatar: { ...current.avatar, [item.avatarSlot]: off ? undefined : item.id } });
    } else {
      setCurrent({ ...current, [item.type === "character" ? "characterItemId" : "backgroundItemId"]: item.id });
    }
    setMessage(null);
  }

  function save() {
    const next = current;
    start(async () => {
      try {
        const r = await saveCloset(changes);
        if (r.ok) {
          setSaved(next);
          setMessage({ ok: true, text: "꾸민 모습을 저장했어요 ✓" });
          return;
        }
        setMessage({ ok: false, text: r.error ?? CLOSET_ERRORS.failed });
      } catch {
        // 서버 오류(네트워크, DB 등)도 오류 화면 대신 알려준다. 미리보기는 그대로 두어 다시 저장할 수 있다
        setMessage({ ok: false, text: CLOSET_ERRORS.failed });
      }
    });
  }

  const grid = (list: OwnedItem[], clickable = true) => (
    <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 sm:gap-x-4 lg:grid-cols-6">
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
            aria-pressed={on}
            data-closet-item={item.id}
            onClick={() => toggle(item)}
            className="pixel-card p-2 text-center transition hover:-translate-y-0.5"
          >
            {art}
          </button>
        ) : (
          <div key={item.id} className="pixel-card p-2 text-center" data-closet-item={item.id}>
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
        className="pixel-banner mt-4 h-60"
      />
      <p role="status" aria-live="polite" className={`mt-3 min-h-6 text-center font-bold ${message?.ok ? "text-leaf-dark" : "text-berry"}`}>
        {message?.ok && <PixelIcon name="check" scale={1} className="mr-1.5 align-[-1px]" />}
        {message?.text}
      </p>

      <section className="mt-10" data-closet-section="avatar">
        <h2 className="pixel-heading mb-4">
          <PixelIcon name="shirt" />
          아바타 꾸미기
        </h2>
        {avatars.length === 0 ? (
          <p className="pixel-paper p-4 text-center text-sm">
            아직 아바타 아이템이 없어요. <Link href="/clothes" className="font-bold underline">옷가게</Link>에서 모자·옷·소품을 사 보세요.
          </p>
        ) : (
          <>
            <p className="-mt-2 mb-3 text-sm text-ink-soft">모자·옷·소품을 하나씩 입을 수 있어요. 입은 걸 한 번 더 누르면 벗어요. 다 고르면 아래 [저장]을 눌러 주세요.</p>
            {grid(avatars)}
          </>
        )}
      </section>

      <section className="mt-10" data-closet-section="background">
        <h2 className="pixel-heading mb-4">
          <PixelIcon name="frame" />
          내 배경
        </h2>
        {grid(of("background"))}
      </section>

      {furniture.length > 0 && (
        <section className="mt-10" data-closet-section="furniture">
          <h2 className="pixel-heading mb-4">
          <PixelIcon name="chair" />
          가구
        </h2>
          <p className="-mt-2 mb-3 text-sm text-ink-soft">
            가구는 <Link href={`/@${slug}`} className="font-bold underline">내 블로그의 우리 집</Link>에서 [가구 놓기]로 놓아요.
          </p>
          {grid(furniture, false)}
        </section>
      )}

      {decos.length > 0 && (
        <section className="mt-10" data-closet-section="deco">
          <h2 className="pixel-heading mb-4">
          <PixelIcon name="flower" />
          광장 장식
        </h2>
          <p className="-mt-2 mb-3 text-sm text-ink-soft">
            광장 꾸미기는 지금 쉬고 있어요. 이미 산 장식은 이곳에 그대로 남아 있어요.
          </p>
          {grid(decos, false)}
        </section>
      )}

      {/* 캐릭터는 이제 상점에서 팔지 않는다. 예전에 산 캐릭터가 있어 2마리 이상일 때만 고를 수 있게 보여 준다 */}
      {characters.length >= 2 && (
        <section className="mt-10" data-closet-section="character">
          <h2 className="pixel-heading mb-4">
          <PixelIcon name="paw" />
          내 캐릭터
        </h2>
          {grid(characters)}
        </section>
      )}

      {/* 저장 줄: 화면 아래에 붙어 있다 (휴대폰은 아래 탭 위). 눌러 본 것은 [저장]해야 적용된다 */}
      <div
        className="pixel-panel sticky bottom-3 z-20 mt-8 flex flex-wrap items-center justify-end gap-2 px-4 py-3 phone:bottom-[calc(4.5rem+env(safe-area-inset-bottom))]"
        data-closet-savebar
        data-dirty={dirty ? "true" : "false"}
      >
        <p className="mr-auto text-sm">
          {dirty ? <b>{changes.length}가지 바꿨어요. [저장]을 눌러야 적용돼요</b> : <span className="text-ink-soft">아이템을 눌러 입어 보고 [저장]을 눌러 주세요</span>}
        </p>
        <button type="button" disabled={pending || !dirty} onClick={() => setCurrent(saved)} className="pixel-btn pixel-btn-sm bg-[#fffaf0] text-ink">
          되돌리기
        </button>
        <button type="button" disabled={pending || !dirty} onClick={save} className="pixel-btn bg-leaf px-4 text-white" data-closet-save>
          <PixelIcon name="save" scale={1} />
          {pending ? "저장 중…" : "저장"}
        </button>
      </div>
    </>
  );
}
