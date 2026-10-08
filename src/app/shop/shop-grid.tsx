"use client";

import { useState, useTransition } from "react";
import { ItemArt } from "@/components/item-art";
import { buyItem } from "./actions";

type ShopItem = {
  id: number;
  type: "character" | "background" | "furniture";
  name: string;
  description: string | null;
  price: number;
  requiredLevel: number;
  assetKey: string;
  owned: boolean;
};

export function ShopGrid({ items, level, coins }: { items: ShopItem[]; level: number; coins: number }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <>
      {message && (
        <p role="status" className={`card mb-4 p-3 text-center font-bold ${message.ok ? "text-leaf-dark" : "text-berry"}`}>
          {message.text}
        </p>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => {
          const locked = level < item.requiredLevel;
          const short = coins < item.price;
          return (
            <article key={item.id} className={`card flex flex-col p-3 ${item.owned ? "opacity-70" : ""}`}>
              <ItemArt type={item.type} assetKey={item.assetKey} />
              <h3 className="mt-2 font-display text-lg">{item.name}</h3>
              <p className="line-clamp-2 min-h-10 text-xs text-ink-soft">{item.description}</p>
              <p className="mt-2 text-sm">
                🪙 <b>{item.price.toLocaleString()}</b>
                {item.requiredLevel > 1 && <span className="ml-2 text-xs text-ink-soft">Lv.{item.requiredLevel}+</span>}
              </p>
              <button
                type="button"
                disabled={item.owned || locked || short || pending}
                onClick={() =>
                  start(async () => {
                    const r = await buyItem(item.id);
                    setMessage(
                      r.ok
                        ? { ok: true, text: `🎉 ${r.name}을(를) 샀어요! ${item.type === "furniture" ? "내 블로그의 우리 집에 놓아 보세요." : "꾸미기에서 장착해 보세요."}` }
                        : { ok: false, text: r.error },
                    );
                  })
                }
                className="btn mt-3 bg-sun py-1.5 text-sm text-ink"
              >
                {item.owned ? "보유 중" : locked ? `🔒 Lv.${item.requiredLevel}` : short ? "코인 부족" : "사기"}
              </button>
            </article>
          );
        })}
      </div>
    </>
  );
}
