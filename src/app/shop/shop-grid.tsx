"use client";

import { useTransition } from "react";
import { ItemArt } from "@/components/item-art";
import { buttonState, purchaseMessage, type ShopItem } from "@/lib/shop";
import { buyItem } from "./actions";

export function ShopGrid({
  items,
  level,
  coins,
  onMessage,
}: {
  items: ShopItem[];
  level: number;
  coins: number;
  onMessage: (m: { ok: boolean; text: string }) => void;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => {
        const state = buttonState(item, { level, coins });
        const growth = item.type === "growth";
        return (
          <article key={item.id} data-item-id={item.id} data-state={state} className={`card flex flex-col p-3 ${state === "owned" ? "opacity-70" : ""}`}>
            <ItemArt type={item.type} assetKey={item.assetKey} />
            <h3 className="mt-2 font-display text-lg">{item.name}</h3>
            <p className="line-clamp-2 min-h-10 text-xs text-ink-soft">{item.description}</p>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm">
              <span>
                🪙 <b>{item.price.toLocaleString()}</b>
              </span>
              {item.requiredLevel >= 2 && <span className="text-xs text-ink-soft">Lv.{item.requiredLevel}+</span>}
              {growth && item.quantity > 0 && (
                <span className="text-xs font-bold text-leaf-dark" data-quantity>
                  보유 {item.quantity}개
                </span>
              )}
            </p>
            <button
              type="button"
              disabled={state !== "buy" || pending}
              onClick={() =>
                start(async () => {
                  const r = await buyItem(item.id);
                  onMessage(
                    r.ok
                      ? { ok: true, text: item.type === "furniture" ? `🎉 ${r.name}을(를) 샀어요! 내 블로그의 우리 집에 놓아 보세요.` : purchaseMessage(r.kind, r.name) }
                      : { ok: false, text: r.error },
                  );
                })
              }
              className="btn mt-3 min-h-11 bg-sun py-1.5 text-sm text-ink"
            >
              {state === "owned" ? "보유 중" : state === "locked" ? `🔒 Lv.${item.requiredLevel}` : state === "short" ? "코인 부족" : "사기"}
            </button>
          </article>
        );
      })}
    </div>
  );
}
