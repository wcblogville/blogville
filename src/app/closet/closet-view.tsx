"use client";

import { useEffect, useState, useTransition } from "react";
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
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  // "저장했어요"는 2초 뒤에 사라진다
  useEffect(() => {
    if (!message?.ok) return;
    const t = setTimeout(() => setMessage(null), 2000);
    return () => clearTimeout(t);
  }, [message]);

  const character = items.find((i) => i.id === current.characterItemId);
  const background = items.find((i) => i.id === current.backgroundItemId);

  function equip(item: OwnedItem) {
    const key = item.type === "character" ? "characterItemId" : "backgroundItemId";
    const before = current;
    setCurrent({ ...current, [key]: item.id }); // 미리 바꿔 보여주고
    setMessage(null);
    start(async () => {
      try {
        const r = await equipItem(item.id);
        if (r.ok) {
          setMessage({ ok: true, text: `${item.name} 장착을 저장했어요 ✓` });
          return;
        }
        setCurrent(before); // 실패하면 되돌린다
        setMessage({ ok: false, text: r.error ?? "장착하지 못했어요" });
      } catch {
        // 서버 오류(네트워크, DB 등)도 오류 화면 대신 되돌리고 알려준다 (SHOP-04)
        setCurrent(before);
        setMessage({ ok: false, text: "장착하지 못했어요. 잠시 뒤 다시 시도해 주세요" });
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
                <ItemArt type={item.type} assetKey={item.assetKey} className="h-20" characterSize={70} />
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
        className="h-60 rounded-2xl border-2 border-line shadow-[0_4px_0_0_var(--color-line)]"
      />
      <p role="status" aria-live="polite" className={`mt-3 min-h-6 text-center font-bold ${message?.ok ? "text-leaf-dark" : "text-berry"}`}>
        {message?.text}
      </p>
      {section("character", "🐾 내 캐릭터")}
      {section("background", "🖼 내 배경")}
    </>
  );
}
