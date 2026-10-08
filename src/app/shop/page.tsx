import { requireMember } from "@/server/dal";
import { listShopItems } from "@/server/inventory";
import { getWallet } from "@/server/points";
import { ShopView } from "./shop-view";

export const metadata = { title: "상점" };

export default async function ShopPage() {
  const viewer = await requireMember();
  const [items, wallet] = await Promise.all([listShopItems(viewer.userId), getWallet(viewer.userId)]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">🏪 마을 상점</h1>
          <p className="mt-1 text-ink-soft">글을 쓰고 출석해서 모은 코인으로 내 캐릭터와 미니룸을 꾸며 보세요.</p>
        </div>
        <div className="card flex gap-4 px-4 py-2 text-sm" data-shop-wallet>
          <span>
            Lv.<b>{wallet.level}</b>
          </span>
          <span>
            🪙 <b>{wallet.coins.toLocaleString()}</b>
          </span>
        </div>
      </div>
      <ShopView items={items} level={wallet.level} coins={wallet.coins} />
    </div>
  );
}
