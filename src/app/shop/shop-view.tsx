"use client";

import { useState } from "react";
import { DEFAULT_SORT, SHOP_SECTIONS, SHOP_SORTS, sortShopItems, type ShopItem, type ShopSort } from "@/lib/shop";
import { ShopGrid } from "./shop-grid";

/** 상점 구역 4개와 정렬 (FR-003, FR-014~015). 정렬은 모든 구역에 같이 적용된다 */
export function ShopView({ items, level, coins }: { items: ShopItem[]; level: number; coins: number }) {
  const [sort, setSort] = useState<ShopSort>(DEFAULT_SORT);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <>
      <div className="mt-6 flex items-center justify-end gap-2 text-sm">
        <label htmlFor="shop-sort" className="text-ink-soft">
          정렬
        </label>
        <select
          id="shop-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as ShopSort)}
          className="min-h-11 rounded-xl border-2 border-line bg-white px-3"
        >
          {SHOP_SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      {message && (
        <p role="status" className={`card sticky top-2 z-10 mt-4 p-3 text-center font-bold ${message.ok ? "text-leaf-dark" : "text-berry"}`}>
          {message.text}
        </p>
      )}
      {SHOP_SECTIONS.map((s) => {
        const list = sortShopItems(
          items.filter((i) => i.type === s.type),
          sort,
        );
        return (
          <section key={s.type} className="mt-8" data-shop-section={s.type}>
            <h2 className="mb-3 font-display text-2xl">{s.title}</h2>
            {s.type === "furniture" && <p className="-mt-2 mb-3 text-sm text-ink-soft">산 가구는 내 블로그의 &lsquo;우리 집&rsquo;에서 [가구 놓기]로 놓아요.</p>}
            {s.type === "growth" && <p className="-mt-2 mb-3 text-sm text-ink-soft">동물 농장의 친구들을 빨리 키워 주는 먹이예요. 여러 번 살 수 있어요.</p>}
            {list.length === 0 ? (
              <p className="card p-4 text-center text-sm text-ink-soft">지금은 파는 아이템이 없어요.</p>
            ) : (
              <ShopGrid items={list} level={level} coins={coins} onMessage={setMessage} />
            )}
          </section>
        );
      })}
    </>
  );
}
