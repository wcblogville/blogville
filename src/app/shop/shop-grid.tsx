"use client";

import Link from "next/link";
import { useTransition } from "react";
import { ItemArt } from "@/components/item-art";
import { PixelIcon } from "@/components/pixel-icon";
import { withJosa } from "@/lib/josa";
import { buttonState, purchaseMessage, type ShopItem } from "@/lib/shop";
import { buyItem } from "./actions";

/** 산 뒤 안내. link: 산 것을 쓰러 가는 곳 (꾸미기·우리 집·동물 농장). pcOnly: 휴대폰에는 광장이 없어 숨기는 링크 */
export type ShopMessage = { ok: boolean; text: string; link?: { href: string; label: string; pcOnly?: boolean } };

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
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4">
      {items.map((item) => {
        const state = buttonState(item, { level, coins });
        const growth = item.type === "growth";
        return (
          <article key={item.id} data-item-id={item.id} data-state={state} className={`pixel-card flex flex-col p-3 ${state === "owned" ? "opacity-75" : ""}`}>
            <ItemArt type={item.type} assetKey={item.assetKey} />
            <h3 className="mt-2 font-display text-lg leading-tight">{item.name}</h3>
            <p className="line-clamp-2 min-h-10 text-xs text-ink-soft">{item.description}</p>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="inline-flex items-center gap-1">
                <PixelIcon name="coin" scale={1} />
                <b>{item.price.toLocaleString()}</b>
              </span>
              {item.requiredLevel >= 2 && <span className="pixel-badge bg-[#f1ebe2] px-1.5 text-xs leading-4 text-ink-soft">Lv.{item.requiredLevel}+</span>}
              {growth && item.quantity > 0 && (
                <span className="text-xs font-bold text-leaf-dark" data-quantity>
                  보유 {item.quantity}개 ·{" "}
                  <Link href="/farm" className="underline">
                    농장에서 쓰기
                  </Link>
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
                      : {
                          ok: true,
                          text: purchaseMessage(r.kind, r.name),
                          link: r.kind === "growth" ? { href: "/farm", label: "🐮 동물 농장으로" } : { href: "/closet", label: "🎨 꾸미기로" },
                        },
                  );
                })
              }
              className={`pixel-btn pixel-btn-sm mt-4 ${state === "buy" ? "bg-sun" : "bg-[#f1ebe2]"} text-ink`}
            >
              {state === "owned" ? "보유 중" : state === "locked" ? `🔒 Lv.${item.requiredLevel}` : state === "short" ? "코인 부족" : "사기"}
            </button>
          </article>
        );
      })}
    </div>
  );
}
