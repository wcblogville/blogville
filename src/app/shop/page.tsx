import { PlaceHeader, WalletChips } from "@/components/place-banner";
import { requireMember } from "@/server/dal";
import { listShopItems } from "@/server/inventory";
import { getWallet } from "@/server/points";
import { ShopView } from "./shop-view";

export const metadata = { title: "상점" };

export default async function ShopPage() {
  const viewer = await requireMember();
  const [items, wallet] = await Promise.all([listShopItems(viewer.userId), getWallet(viewer.userId)]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <PlaceHeader place="shop" icon="shop" title="마을 상점" aside={<WalletChips level={wallet.level} coins={wallet.coins} />}>
        <p>글을 쓰고 출석해서 모은 코인으로 내 캐릭터와 우리 집을 꾸며 보세요.</p>
      </PlaceHeader>
      <ShopView items={items} level={wallet.level} coins={wallet.coins} blogSlug={viewer.profile.blogSlug} />
    </div>
  );
}
