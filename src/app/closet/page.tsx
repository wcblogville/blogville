import Link from "next/link";
import { PlaceHeader } from "@/components/place-banner";
import { requireMember } from "@/server/dal";
import { getEquipped, listOwnedItems } from "@/server/inventory";
import { getWallet } from "@/server/points";
import { ClosetView } from "./closet-view";

export const metadata = { title: "꾸미기" };

export default async function ClosetPage() {
  const viewer = await requireMember();
  const [owned, equipped, wallet] = await Promise.all([listOwnedItems(viewer.userId), getEquipped(viewer.userId), getWallet(viewer.userId)]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <PlaceHeader
        place="closet"
        icon="palette"
        title="꾸미기"
        aside={
          <div className="pixel-card w-full p-3 sm:w-72">
            <div className="flex justify-between text-sm">
              <b>Lv.{wallet.level}</b>
              <span className="text-ink-soft">{wallet.isMax ? "MAX" : `${wallet.current} / ${wallet.needed} EXP`}</span>
            </div>
            <div className="pixel-bar mt-2" role="progressbar" aria-valuenow={wallet.isMax ? 1 : wallet.current} aria-valuemax={wallet.isMax ? 1 : wallet.needed} aria-label="다음 레벨까지">
              <div className="pixel-bar-fill" style={{ width: `${Math.round(wallet.ratio * 100)}%` }} />
            </div>
            <Link href="/wallet" className="mt-1 inline-flex min-h-11 items-center text-xs text-ink-soft underline hover:text-ink">
              경험치·코인 내역 보기
            </Link>
          </div>
        }
      >
        <p>고르면 바로 내 블로그 우리 집(캐릭터·창밖 풍경)과 마을 캐릭터에 적용돼요.</p>
      </PlaceHeader>

      <ClosetView items={owned} equipped={equipped} nickname={viewer.profile.nickname} slug={viewer.profile.blogSlug} />

      <p className="pixel-paper mt-10 p-3 text-center">
        더 많은 꾸미기 아이템과 배경은 <Link href="/clothes" className="font-bold text-leaf-dark underline">옷가게</Link>(옷·모자·소품)와{" "}
        <Link href="/shop" className="font-bold text-leaf-dark underline">상점</Link>(가구·배경)에서 만날 수 있어요.
      </p>
    </div>
  );
}
