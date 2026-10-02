"use client";

import { useState, useTransition } from "react";
import { MiniRoom } from "@/components/character";
import { ItemArt } from "@/components/item-art";
import { equipItem } from "./actions";

type OwnedItem = { id: number; type: "character" | "background" | "furniture"; name: string; assetKey: string };

export function ClosetView({
  items,
  equipped,
  nickname,
}: {
  items: OwnedItem[];
  equipped: { characterItemId: number; backgroundItemId: number };
  nickname: string;
}) {
  const [current, setCurrent] = useState(equipped);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const character = items.find((i) => i.id === current.characterItemId);
  const background = items.find((i) => i.id === current.backgroundItemId);

  function equip(item: OwnedItem) {
    const key = item.type === "character" ? "characterItemId" : "backgroundItemId";
    const before = current;
    setCurrent({ ...current, [key]: item.id }); // 미리 바꿔 보여주고
    setError("");
    start(async () => {
      const r = await equipItem(item.id);
      if (!r.ok) {
        setCurrent(before); // 실패하면 되돌린다
        setError(r.error ?? "장착하지 못했어요");
      }
    });
  }

  const section = (type: OwnedItem["type"], title: string) => (
    <section className="mt-8">
      <h2 className="mb-3 font-display text-2xl">{title}</h2>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {items
          .filter((i) => i.type === type)
          .map((item) => {
            const on = item.id === current.characterItemId || item.id === current.backgroundItemId;
            return (
              <button
                key={item.id}
                type="button"
                disabled={pending}
                aria-pressed={on}
                onClick={() => equip(item)}
                className={`card p-2 text-center transition hover:-translate-y-0.5 ${on ? "border-sun! bg-[#fff3d6]" : ""}`}
              >
                <ItemArt type={item.type} assetKey={item.assetKey} className="h-20" />
                <span className="mt-1 block text-sm font-bold">
                  {on && "✓ "}
                  {item.name}
                </span>
              </button>
            );
          })}
      </div>
    </section>
  );

  return (
    <>
      <MiniRoom
        characterAsset={character?.assetKey ?? ""}
        backgroundAsset={background?.assetKey ?? ""}
        nickname={nickname}
        className="h-60 shadow-[0_4px_0_0_var(--color-line)]"
      />
      {error && <p className="mt-3 text-center font-bold text-berry">{error}</p>}
      {section("character", "🐾 내 캐릭터")}
      {section("background", "🖼 내 배경")}
    </>
  );
}
