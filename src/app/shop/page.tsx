import { requireMember } from "@/server/dal";
import { listItemsWithOwnership } from "@/server/inventory";
import { getWallet } from "@/server/points";
import { ShopGrid } from "./shop-grid";

export const metadata = { title: "상점" };

export default async function ShopPage() {
  const viewer = await requireMember();
  const [all, wallet] = await Promise.all([listItemsWithOwnership(viewer.userId), getWallet(viewer.userId)]);
  const forSale = all.filter((i) => !i.isStarter);
  const characters = forSale.filter((i) => i.type === "character");
  const backgrounds = forSale.filter((i) => i.type === "background");
  const furniture = forSale.filter((i) => i.type === "furniture");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">🏪 마을 상점</h1>
          <p className="mt-1 text-ink-soft">글을 쓰고 출석해서 모은 코인으로 새 친구와 배경을 데려가세요.</p>
        </div>
        <div className="card flex gap-4 px-4 py-2 text-sm">
          <span>
            Lv.<b>{wallet.level}</b>
          </span>
          <span>
            🪙 <b>{wallet.coins.toLocaleString()}</b>
          </span>
        </div>
      </div>

      <h2 className="mb-3 mt-8 font-display text-2xl">🐾 캐릭터</h2>
      <ShopGrid items={characters} level={wallet.level} coins={wallet.coins} />
      <h2 className="mb-3 mt-10 font-display text-2xl">🖼 배경</h2>
      <ShopGrid items={backgrounds} level={wallet.level} coins={wallet.coins} />
      <h2 className="mb-3 mt-10 font-display text-2xl">🛋 가구</h2>
      <p className="-mt-2 mb-3 text-sm text-ink-soft">산 가구는 내 블로그의 &lsquo;우리 집&rsquo;에서 [가구 놓기]로 놓아요.</p>
      <ShopGrid items={furniture} level={wallet.level} coins={wallet.coins} />
    </div>
  );
}
