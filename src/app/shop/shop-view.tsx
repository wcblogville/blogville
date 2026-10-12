"use client";

import Link from "next/link";
import { IconText, PixelIcon } from "@/components/pixel-icon";
import { useState } from "react";
import { DEFAULT_SORT, SHOP_SECTIONS, SHOP_SORTS, sortShopItems, type ShopItem, type ShopSort } from "@/lib/shop";
import { ShopGrid, type ShopMessage } from "./shop-grid";

/** 상점 구역 4개와 정렬 (FR-003, FR-014~015). 정렬은 모든 구역에 같이 적용된다 */
export function ShopView({ items, level, coins, blogSlug }: { items: ShopItem[]; level: number; coins: number; blogSlug: string }) {
  const [sort, setSort] = useState<ShopSort>(DEFAULT_SORT);
  const [message, setMessage] = useState<ShopMessage | null>(null);

  return (
    <>
      <div className="mt-4 flex items-center justify-end gap-3 text-sm">
        <label htmlFor="shop-sort" className="font-bold text-ink-soft">
          정렬
        </label>
        <select
          id="shop-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as ShopSort)}
          className="pixel-select"
        >
          {SHOP_SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      {message && (
        // 헤더(58px, z-20) 아래에 붙는다. 예전 top-2 z-10은 페이지를 내리면 헤더 밑에 숨었다
        <p role="status" className={`pixel-panel sticky top-16 z-30 mt-5 p-3 text-center font-bold ${message.ok ? "text-leaf-dark" : "text-berry"}`}>
          {message.ok && <PixelIcon name="party" scale={2} className="mr-2 align-middle" />}
          {message.text}
          {message.link && (
            <Link
              href={message.link.href}
              // 휴대폰에는 광장이 없다 (/town은 내 블로그로 옮긴다). 광장으로 가는 링크는 PC에서만 보인다
              className={`ml-2 inline-flex min-h-11 items-center whitespace-nowrap text-ink underline ${message.link.pcOnly ? "phone:hidden" : ""}`}
            >
              {message.link.icon ? <IconText icon={message.link.icon}>{message.link.label}</IconText> : message.link.label}
            </Link>
          )}
        </p>
      )}
      {SHOP_SECTIONS.map((s) => {
        const list = sortShopItems(
          items.filter((i) => i.type === s.type),
          sort,
        );
        return (
          <section key={s.type} id={s.type} className="mt-10 scroll-mt-20" data-shop-section={s.type}>
            <h2 className="pixel-heading mb-4">
              <PixelIcon name={s.icon} />
              {s.name}
            </h2>
            {s.type === "furniture" && <p className="-mt-2 mb-4 text-sm text-ink-soft">산 가구는 내 블로그의 &lsquo;우리 집&rsquo;에서 [가구 놓기]로 놓아요.</p>}
            {s.type === "growth" && <p className="-mt-2 mb-4 text-sm text-ink-soft">동물 농장의 친구들을 빨리 키워 주는 먹이·물약이에요. 여러 번 살 수 있고, 동물 농장의 [성장 아이템]에서 써요.</p>}
            {list.length === 0 ? (
              <p className="pixel-paper p-4 text-center text-sm">지금은 파는 아이템이 없어요.</p>
            ) : (
              <ShopGrid items={list} level={level} coins={coins} blogSlug={blogSlug} onMessage={setMessage} />
            )}
          </section>
        );
      })}
    </>
  );
}
