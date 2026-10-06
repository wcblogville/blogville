import Link from "next/link";
import { Pagination, parsePage } from "@/components/pagination";
import { formatDateTime } from "@/lib/format";
import { requireMember } from "@/server/dal";
import { getWallet, listLedger } from "@/server/points";

export const metadata = { title: "경험치·코인 내역" };

// 원장 사유를 화면에 보일 이름으로 (GAME-07)
const REASON_LABEL: Record<string, string> = {
  signup: "🎉 가입 축하",
  attendance: "📮 출석",
  attendance_streak: "🔥 연속 출석 보너스",
  post: "✏️ 글 작성",
  comment: "💬 댓글 작성",
  like_received: "♥ 공감 받음",
  purchase: "🏪 아이템 구매",
  farm_care: "🥕 동물 돌보기",
  farm_grown: "🏅 동물 다 키움",
  egg_purchase: "🥚 알 구매",
};

const signed = (n: number) => (n > 0 ? `+${n.toLocaleString()}` : `−${Math.abs(n).toLocaleString()}`);

export default async function WalletPage(props: PageProps<"/wallet">) {
  const viewer = await requireMember();
  const page = parsePage((await props.searchParams).page);
  const [wallet, ledger] = await Promise.all([getWallet(viewer.userId), listLedger(viewer.userId, page)]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-3xl">📒 경험치·코인 내역</h1>

      <section className="card mt-6 grid grid-cols-3 gap-2 p-5 text-center">
        <div>
          <p className="text-sm text-ink-soft">레벨</p>
          <p className="font-display text-3xl">Lv.{wallet.level}</p>
        </div>
        <div>
          <p className="text-sm text-ink-soft">누적 경험치</p>
          <p className="font-display text-3xl">✨ {wallet.exp.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-sm text-ink-soft">코인</p>
          <p className="font-display text-3xl">🪙 {wallet.coins.toLocaleString()}</p>
        </div>
      </section>

      <section className="card mt-6 p-5">
        <h2 className="mb-2 font-display text-xl">
          기록 <span className="text-base text-ink-soft">{ledger.total}개</span>
        </h2>
        {ledger.rows.length ? (
          <ul className="divide-y-2 divide-line/60">
            {ledger.rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-3">
                <span className="min-w-0 flex-1">
                  <b>{REASON_LABEL[r.reason] ?? r.reason}</b>
                  {r.itemName && <span className="text-ink-soft"> · {r.itemName}</span>}
                  <span className="block text-xs text-ink-soft">{formatDateTime(r.createdAt)}</span>
                </span>
                {r.expDelta !== 0 && <span className="text-sm font-bold text-sky">✨ {signed(r.expDelta)}</span>}
                {r.coinDelta !== 0 && (
                  <span className={`w-24 text-right font-bold ${r.coinDelta > 0 ? "text-leaf-dark" : "text-berry"}`}>
                    🪙 {signed(r.coinDelta)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-ink-soft">아직 기록이 없어요</p>
        )}
        <Pagination page={ledger.page} pageCount={ledger.pageCount} hrefFor={(n) => `/wallet?page=${n}`} />
      </section>

      <p className="mt-6 text-center text-sm text-ink-soft">
        코인은 <Link href="/shop" className="font-bold text-leaf-dark underline">상점</Link>에서 쓸 수 있어요.
      </p>
    </div>
  );
}
