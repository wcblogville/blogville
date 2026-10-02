import Link from "next/link";
import { requireMember } from "@/server/dal";
import { getEquipped, listItemsWithOwnership } from "@/server/inventory";
import { getWallet } from "@/server/points";
import { ClosetView } from "./closet-view";

export const metadata = { title: "꾸미기" };

export default async function ClosetPage() {
  const viewer = await requireMember();
  const [all, equipped, wallet] = await Promise.all([
    listItemsWithOwnership(viewer.userId),
    getEquipped(viewer.userId),
    getWallet(viewer.userId),
  ]);
  const owned = all.filter((i) => i.owned);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">🎨 꾸미기</h1>
          <p className="mt-1 text-ink-soft">고르면 바로 내 블로그 미니룸과 광장 캐릭터에 적용돼요.</p>
        </div>
        <div className="card w-full p-3 sm:w-72">
          <div className="flex justify-between text-sm">
            <b>Lv.{wallet.level}</b>
            <span className="text-ink-soft">
              {wallet.isMax ? "MAX" : `${wallet.current} / ${wallet.needed} EXP`}
            </span>
          </div>
          <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-cream" role="progressbar" aria-valuenow={wallet.isMax ? 1 : wallet.current} aria-valuemax={wallet.isMax ? 1 : wallet.needed} aria-label="다음 레벨까지">
            <div className="h-full rounded-full bg-leaf" style={{ width: `${Math.round(wallet.ratio * 100)}%` }} />
          </div>
          <Link href="/wallet" className="mt-1.5 inline-block text-xs text-ink-soft underline hover:text-ink">
            경험치·코인 내역 보기
          </Link>
        </div>
      </div>

      <ClosetView items={owned} equipped={equipped} nickname={viewer.profile.nickname} />

      <p className="mt-10 text-center text-ink-soft">
        더 많은 캐릭터와 배경은 <Link href="/shop" className="font-bold text-leaf-dark underline">상점</Link>에서 만날 수 있어요.
      </p>
    </div>
  );
}
