import Link from "next/link";
import { Pagination, parsePage } from "@/components/pagination";
import { PixelIcon } from "@/components/pixel-icon";
import { PlaceHeader } from "@/components/place-banner";
import { formatDateTime } from "@/lib/format";
import { requireMember } from "@/server/dal";
import { getWallet, type LedgerReason, listLedger } from "@/server/points";

export const metadata = { title: "경험치·코인 내역" };

// 원장 사유를 화면에 보일 이름으로 (GAME-07). 연속 출석 보너스는 지난 기록용 (FR-030)
const REASON_LABEL: Record<LedgerReason, string> = {
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
  animal_adopt: "🐾 동물 분양",
  skin_purchase: "🎨 동물 스킨",
  fishing: "🎣 낚시",
  admin_grant: "👑 관리자 테스트 지급",
};

const signed = (n: number) => (n > 0 ? `+${n.toLocaleString()}` : `−${Math.abs(n).toLocaleString()}`);

export default async function WalletPage(props: PageProps<"/wallet">) {
  const viewer = await requireMember();
  const page = parsePage((await props.searchParams).page);
  const [wallet, ledger] = await Promise.all([getWallet(viewer.userId), listLedger(viewer.userId, page)]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <PlaceHeader place="wallet" icon="book" title="경험치·코인 내역" />

      <section className="mt-6 grid grid-cols-3 gap-3 text-center sm:gap-5">
        {[
          { icon: "medal" as const, label: "레벨", value: `Lv.${wallet.level}` },
          { icon: "star" as const, label: "누적 경험치", value: `✨ ${wallet.exp.toLocaleString()}` },
          { icon: "coin" as const, label: "코인", value: `🪙 ${wallet.coins.toLocaleString()}` },
        ].map((stat) => (
          <div key={stat.label} className="pixel-card flex min-w-0 flex-col items-center px-1 py-3 sm:p-4">
            <p className="flex items-center gap-1 text-xs font-bold text-ink-soft sm:text-sm">
              <PixelIcon name={stat.icon} scale={1} />
              {stat.label}
            </p>
            <p className="mt-1 break-all font-display text-xl sm:text-3xl">{stat.value}</p>
          </div>
        ))}
      </section>

      <section className="pixel-card mt-8 p-4 sm:p-5">
        <h2 className="pixel-heading mb-2 text-xl">
          <PixelIcon name="book" />
          <span>
            기록 <span className="pixel-badge ml-1 text-sm">{ledger.total}개</span>
          </span>
        </h2>
        {ledger.rows.length ? (
          <ul className="pixel-rows">
            {ledger.rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-3">
                <span className="min-w-0 flex-1">
                  <b>{REASON_LABEL[r.reason]}</b>
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

      <p className="pixel-paper mt-8 p-3 text-center text-sm">
        코인은 <Link href="/shop" className="font-bold text-leaf-dark underline">상점</Link>에서 쓸 수 있어요.
      </p>
    </div>
  );
}
