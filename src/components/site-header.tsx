import Link from "next/link";
import { CharacterBadge } from "@/components/character";
import { ExitButton, HomeLogo } from "@/components/exit-button";
import { AttendanceDayWatcher } from "@/components/game/attendance-day-watcher";
import { LevelUpPopup } from "@/components/game/level-up-popup";
import { NotificationBell } from "@/components/game/notification-bell";
import { SessionKeeper } from "@/components/session-keeper";
import { SignOutButton } from "@/components/sign-out-button";
import { todayKST } from "@/lib/game";
import { getViewer } from "@/server/dal";
import { getHeaderNotifications } from "@/server/notifications";
import { getWallet } from "@/server/points";

export async function SiteHeader() {
  const viewer = await getViewer();
  const member = viewer?.profile ? { ...viewer, profile: viewer.profile } : null;
  // getViewer()가 자동 출석(GAME-04)을 먼저 끝내므로 코인·레벨은 출석 보상까지 반영된 값이다
  const [wallet, alerts] = member ? await Promise.all([getWallet(member.userId), getHeaderNotifications(member.userId)]) : [null, null];

  return (
    <header className="sticky top-0 z-20 border-b-2 border-line bg-cream/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <HomeLogo href={member ? "/town" : "/"} />

        <div className="flex min-w-0 flex-1">
          <ExitButton />
        </div>

        {member && wallet && alerts ? (
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {/* 좁은 화면에서도 레벨이 보이게 글씨와 여백만 줄인다 (GAME-02, 이슈 #5) */}
            <span className="whitespace-nowrap rounded-full bg-white px-2 py-1 text-xs font-bold shadow-sm sm:px-2.5 sm:text-sm" title="레벨">
              Lv.{wallet.level}
            </span>
            <Link href="/wallet" className="whitespace-nowrap rounded-full bg-white px-2 py-1 text-xs font-bold shadow-sm hover:text-leaf-dark sm:px-2.5 sm:text-sm" title="코인">
              🪙 {wallet.coins.toLocaleString()}
            </Link>
            {/* 알림함 🔔 (GAME-08 / FR-042) */}
            <NotificationBell unread={alerts.unread} />
            {member.user.role === "admin" && (
              <Link href="/admin" className="rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-cream">
                👑 관리자
              </Link>
            )}
            {/* 캐릭터 배지 → 내 정보 (AUTH-05 / FR-036). 상태창(TOWN-10)이 생기면 입구를 town과 다시 정한다 */}
            <Link href="/settings/account" title="내 정보" aria-label="내 정보" className="-m-1.5 grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-sky">
              <CharacterBadge asset={member.profile.characterAsset} size={32} />
            </Link>
            {/* 로그인 유지 세션만 7일 연장 (AUTH-09 / FR-021) */}
            {member.rememberMe && <SessionKeeper />}
            {/* 로그아웃 때 이 브라우저의 임시 글도 지운다 (POST-08 / FR-063) */}
            <SignOutButton userId={member.userId} />
            {/* 안 본 레벨업 팝업 (GAME-06 / FR-038), 0시를 넘긴 화면의 자동 출석 (GAME-04) */}
            {alerts.pendingLevel !== null && alerts.pendingMinLevel !== null && (
              <LevelUpPopup userId={member.userId} minLevel={alerts.pendingMinLevel} maxLevel={alerts.pendingLevel} />
            )}
            <AttendanceDayWatcher today={member.attendance?.date ?? todayKST()} />
          </div>
        ) : viewer ? (
          <SignOutButton />
        ) : (
          <Link href="/" className="btn shrink-0 bg-leaf text-sm text-white">
            시작하기
          </Link>
        )}
      </div>
    </header>
  );
}
