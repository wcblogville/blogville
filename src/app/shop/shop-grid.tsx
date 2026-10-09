"use client";

import { useTransition } from "react";
import { ItemArt } from "@/components/item-art";
import { withJosa } from "@/lib/josa";
import { buttonState, purchaseMessage, type ShopItem } from "@/lib/shop";
import { buyItem } from "./actions";

/** 산 뒤 안내. link: 산 것을 쓰러 가는 곳 (꾸미기·우리 집·동물 농장) */
export type ShopMessage = { ok: boolean; text: string; link?: { href: string; label: string } };

export function ShopGrid({
  items,
  level,
  coins,
  blogSlug,
  onMessage,
}: {
  items: ShopItem[];
  level: number;
  coins: number;
  blogSlug: string;
  onMessage: (m: ShopMessage) => void;
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
                  if (!r.ok) return onMessage({ ok: false, text: r.error });
                  onMessage(
                    item.type === "furniture"
                      ? { ok: true, text: `🎉 ${withJosa(r.name, "을/를")} 샀어요! 내 블로그의 우리 집에 놓아 보세요.`, link: { href: `/@${blogSlug}`, label: "🏠 우리 집으로" } }
                      : item.type === "deco"
                      ? { ok: true, text: `🎉 ${withJosa(r.name, "을/를")} 샀어요! 광장의 ☰ 메뉴 → 광장 꾸미기에서 놓아 보세요.`, link: { href: "/town?deco=1", label: "🌷 광장으로" } }
                      : {
                          ok: true,
                          text: purchaseMessage(r.kind, r.name),
                          link: r.kind === "growth" ? { href: "/farm", label: "🐮 동물 농장으로" } : { href: "/closet", label: "🎨 꾸미기로" },
                        },
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
