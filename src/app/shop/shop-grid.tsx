"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ItemArt } from "@/components/item-art";
import { IconText, PixelIcon } from "@/components/pixel-icon";
import type { IconName } from "@/lib/art/icons";
import { withJosa } from "@/lib/josa";
import { buttonState, maxBuyable, purchaseMessage, type ShopItem } from "@/lib/shop";
import { buyItem } from "./actions";

/** 산 뒤 안내. link: 산 것을 쓰러 가는 곳 (꾸미기·우리 집·동물 농장). pcOnly: 휴대폰에는 광장이 없어 숨기는 링크 */
export type ShopMessage = { ok: boolean; text: string; link?: { href: string; label: string; icon?: IconName; pcOnly?: boolean } };

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
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4">
      {items.map((item) => (
        <ShopCard key={item.id} item={item} level={level} coins={coins} blogSlug={blogSlug} onMessage={onMessage} />
      ))}
    </div>
  );
}

function ShopCard({ item, level, coins, blogSlug, onMessage }: { item: ShopItem; level: number; coins: number; blogSlug: string; onMessage: (m: ShopMessage) => void }) {
  const [pending, start] = useTransition();
  // 성장 아이템은 한 번에 여러 개 산다 (사용자 요청 2026-10-16). 꾸미기 아이템은 늘 1개
  const [count, setCount] = useState(1);
  const state = buttonState(item, { level, coins });
  const growth = item.type === "growth";
  const most = Math.max(1, maxBuyable(item.price, coins));
  const n = growth ? Math.min(count, most) : 1;
  const total = item.price * n;

  return (
    <article data-item-id={item.id} data-state={state} className={`pixel-card flex flex-col p-3 ${state === "owned" ? "opacity-75" : ""}`}>
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
      {growth && state === "buy" && (
        <div className="mt-3" data-buy-count>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="개수 하나 줄이기" disabled={n <= 1 || pending} onClick={() => setCount(n - 1)} className="pixel-btn pixel-btn-sm shrink-0 bg-[#f1ebe2] px-3 text-ink">
              −
            </button>
            <input
              type="number"
              inputMode="numeric"
              aria-label={`${item.name} 살 개수`}
              min={1}
              max={most}
              value={n}
              onChange={(e) => {
                const v = Math.floor(Number(e.target.value));
                setCount(Number.isFinite(v) ? Math.min(most, Math.max(1, v)) : 1);
              }}
              className="pixel-input min-w-0 flex-1 px-1 text-center text-sm"
            />
            <button type="button" aria-label="개수 하나 늘리기" disabled={n >= most || pending} onClick={() => setCount(n + 1)} className="pixel-btn pixel-btn-sm shrink-0 bg-[#f1ebe2] px-3 text-ink">
              +
            </button>
          </div>
          <button type="button" disabled={n >= most || pending} onClick={() => setCount(most)} className="mt-1 min-h-8 text-xs font-bold text-ink-soft underline disabled:no-underline disabled:opacity-50">
            최대 {most}개
          </button>
        </div>
      )}
      <button
        type="button"
        disabled={state !== "buy" || pending}
        onClick={() =>
          start(async () => {
            const r = await buyItem(item.id, n);
            if (!r.ok) return onMessage({ ok: false, text: r.error });
            setCount(1);
            onMessage(
              item.type === "furniture"
                ? { ok: true, text: `${withJosa(r.name, "을/를")} 샀어요! 내 블로그의 우리 집에 놓아 보세요.`, link: { href: `/@${blogSlug}`, label: "우리 집으로", icon: "house" } }
                : {
                    ok: true,
                    text: purchaseMessage(r.kind, r.name, r.count),
                    link: r.kind === "growth" ? { href: "/farm", label: "동물 농장으로", icon: "cow" } : { href: "/closet", label: "꾸미기로", icon: "palette" },
                  },
            );
          })
        }
        className={`pixel-btn pixel-btn-sm mt-3 ${state === "buy" ? "bg-sun" : "bg-[#f1ebe2]"} text-ink`}
      >
        {state === "owned" ? (
          "보유 중"
        ) : state === "locked" ? (
          <IconText icon="lock">Lv.{item.requiredLevel}</IconText>
        ) : state === "short" ? (
          "코인 부족"
        ) : n > 1 ? (
          <span className="inline-flex items-center gap-1">
            {n}개 사기 · <PixelIcon name="coin" scale={1} />
            {total.toLocaleString()}
          </span>
        ) : (
          "사기"
        )}
      </button>
    </article>
  );
}
