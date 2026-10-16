"use client";

import Link from "next/link";
import { IconText, PixelIcon } from "@/components/pixel-icon";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_SORT, DEFAULT_TAB, isClothesHash, SHOP_SORTS, SHOP_TABS, shopTabOf, sortShopItems, tabFromHash, type ShopItem, type ShopSort, type ShopTab } from "@/lib/shop";
import { ShopGrid, type ShopMessage } from "./shop-grid";

/** 탭 아래 짧은 안내 */
const TAB_NOTE: Partial<Record<ShopTab, React.ReactNode>> = {
  furniture: <>산 가구는 내 블로그의 &lsquo;우리 집&rsquo;에서 [가구 놓기]로 놓아요.</>,
  background: <>배경은 우리 집 창밖 풍경이 되고, 내 마을 분위기(눈·벚꽃·밤…)도 바꿔요. 꾸미기에서 골라요.</>,
  growth: <>동물 농장의 친구들을 빨리 키워 주는 먹이·물약이에요. [−]·[+]로 개수를 골라 한 번에 여러 개 살 수 있고, 동물 농장의 [성장 아이템]에서 써요.</>,
};

/**
 * 상점: 종류별 탭(가구·배경·성장 아이템)과 정렬 (FR-003, FR-014~015, 2026-10-16 탭으로 나눔).
 * 옷·모자·소품은 옷가게에서만 판다 (2026-10-16): 위에 옷가게 안내를 두고, 예전 주소 #outfit 등은 옷가게로 보낸다.
 * 탭은 주소 #key와 같이 움직여 다른 화면에서 /shop#growth처럼 바로 연다
 */
export function ShopView({ items, level, coins, blogSlug }: { items: ShopItem[]; level: number; coins: number; blogSlug: string }) {
  const [sort, setSort] = useState<ShopSort>(DEFAULT_SORT);
  const [message, setMessage] = useState<ShopMessage | null>(null);
  const [tab, setTab] = useState<ShopTab>(DEFAULT_TAB);
  const router = useRouter();
  useEffect(() => {
    const sync = () => {
      if (isClothesHash(window.location.hash)) return router.replace("/clothes");
      setTab(tabFromHash(window.location.hash) ?? DEFAULT_TAB);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [router]);
  const choose = (key: ShopTab) => {
    setTab(key);
    // 뒤로 가기 기록을 쌓지 않고 주소만 바꾼다 (새로 고침해도 같은 탭)
    history.replaceState(null, "", `#${key}`);
  };
  const current = SHOP_TABS.find((t) => t.key === tab)!;
  const list = sortShopItems(
    items.filter((i) => shopTabOf(i) === tab),
    sort,
  );
  const count = (key: ShopTab) => items.filter((i) => shopTabOf(i) === key).length;

  return (
    <>
      <p className="pixel-paper mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm" data-clothes-note>
        <PixelIcon name="shirt" />
        <span>옷·모자·소품은 꼬까 옷가게에서 거울로 입어 보고 살 수 있어요.</span>
        <Link href="/clothes" className="inline-flex min-h-11 items-center whitespace-nowrap font-bold text-ink underline">
          옷가게 가기
        </Link>
      </p>
      <div role="tablist" aria-label="상점 종류" className="mt-4 flex flex-wrap items-end gap-x-5 gap-y-3">
        {(["우리 집", "동물 농장"] as const).map((group) => (
          <div key={group} className="flex flex-col gap-1">
            <span className="text-xs font-bold text-ink-soft">{group}</span>
            <div className="flex flex-wrap gap-2">
              {SHOP_TABS.filter((t) => t.group === group).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  id={`shop-tab-${t.key}`}
                  aria-selected={tab === t.key}
                  aria-controls={t.key}
                  onClick={() => choose(t.key)}
                  className="pixel-tab px-3 text-base"
                  data-shop-tab-button={t.key}
                >
                  <IconText icon={t.icon}>{t.name}</IconText>
                  <span className="ml-1 text-xs text-ink-soft">{count(t.key)}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
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
      <section id={current.key} role="tabpanel" aria-labelledby={`shop-tab-${current.key}`} className="mt-6 scroll-mt-20" data-shop-section={current.type} data-shop-tab={current.key}>
        <h2 className="pixel-heading mb-4">
          <PixelIcon name={current.icon} />
          {current.name}
        </h2>
        <p className="-mt-2 mb-4 text-sm text-ink-soft">
          {TAB_NOTE[tab]}
        </p>
        {list.length === 0 ? (
          <p className="pixel-paper p-4 text-center text-sm">지금은 파는 아이템이 없어요.</p>
        ) : (
          <ShopGrid items={list} level={level} coins={coins} blogSlug={blogSlug} onMessage={setMessage} />
        )}
      </section>
    </>
  );
}
