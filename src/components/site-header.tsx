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
import { HeaderFrame } from "./header-frame";

export async function SiteHeader() {
  const viewer = await getViewer();
  const member = viewer?.profile ? { ...viewer, profile: viewer.profile } : null;
  // getViewer()가 자동 출석(GAME-04)을 먼저 끝내므로 코인·레벨은 출석 보상까지 반영된 값이다
  const [wallet, alerts] = member ? await Promise.all([getWallet(member.userId), getHeaderNotifications(member.userId)]) : [null, null];

  return (
    <HeaderFrame>
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 group-data-[town]:justify-center sm:gap-3 sm:px-4">
        <HomeLogo href={member ? "/town" : "/"} />

        <div className="flex min-w-0 flex-1 group-data-[town]:hidden">
          <ExitButton />
        </div>

        {member && wallet && alerts ? (
          <div className="flex shrink-0 items-center gap-1 group-data-[town]:contents sm:gap-2">
            {/* 마을에서는 숨긴다: 같은 기능이 ☰ 메뉴에 있다 (사용자 요청 2026-10-08) */}
            <div className="contents group-data-[town]:hidden">
            {/* 좁은 화면에서도 레벨이 보이게 글씨와 여백만 줄인다 (GAME-02, 이슈 #5) */}
            <span className="whitespace-nowrap rounded-full bg-white px-2 py-1 text-xs font-bold shadow-sm sm:px-2.5 sm:text-sm" title="레벨">
              Lv.{wallet.level}
            </span>
            {/* 누르는 영역은 44px, 보이는 알약은 그대로 (NF-06) */}
            <Link href="/wallet" title="코인" className="grid min-h-11 shrink-0 place-items-center rounded-full hover:text-leaf-dark focus-visible:outline-2 focus-visible:outline-sky">
              <span className="whitespace-nowrap rounded-full bg-white px-2 py-1 text-xs font-bold shadow-sm sm:px-2.5 sm:text-sm">🪙 {wallet.coins.toLocaleString()}</span>
            </Link>
            {/* 알림함 🔔 (GAME-08 / FR-042) */}
            <NotificationBell unread={alerts.unread} />
            {member.user.role === "admin" && (
              // 휴대폰에서는 👑만: 글자까지 두면 [← 나가기]가 레벨 배지에 가렸다
              <Link href="/admin" aria-label="관리자" title="관리자" className="grid min-h-11 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-sky">
                <span className="whitespace-nowrap rounded-full bg-ink px-2 py-1 text-xs font-bold text-cream sm:px-2.5">
                  👑<span className="max-sm:hidden"> 관리자</span>
                </span>
              </Link>
            )}
            {/* 캐릭터 배지 → 내 정보 (AUTH-05 / FR-036). 상태창(TOWN-10)이 생기면 입구를 town과 다시 정한다 */}
            <Link href="/settings/account" title="내 정보" aria-label="내 정보" className="-m-1.5 grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-sky">
              <CharacterBadge asset={member.profile.characterAsset} outfit={member.profile.outfit} size={32} />
            </Link>
            {/* 로그인 유지 세션만 7일 연장 (AUTH-09 / FR-021) */}
            {member.rememberMe && <SessionKeeper />}
            {/* 로그아웃 때 이 브라우저의 임시 글도 지운다 (POST-08 / FR-063) */}
            <SignOutButton userId={member.userId} />
            </div>
            {/* 안 본 레벨업 팝업 (GAME-06 / FR-038), 0시를 넘긴 화면의 자동 출석 (GAME-04). 마을에서도 눌러야 해서 pointer-events를 되살린다 */}
            <div className="contents group-data-[town]:pointer-events-auto">
            {alerts.pendingLevel !== null && alerts.pendingMinLevel !== null && (
              <LevelUpPopup userId={member.userId} minLevel={alerts.pendingMinLevel} maxLevel={alerts.pendingLevel} />
            )}
            <AttendanceDayWatcher today={member.attendance?.date ?? todayKST()} />
            </div>
          </div>
        ) : viewer ? (
          <div className="group-data-[town]:hidden">
            <SignOutButton />
          </div>
        ) : (
          // 첫 화면의 로그인 칸으로 (휴대폰에서는 로그인 칸이 화면 아래에 있다)
          <Link href="/#login" className="btn shrink-0 bg-leaf text-sm text-white group-data-[town]:hidden">
            시작하기
          </Link>
        )}
      </div>
    </HeaderFrame>
  );
}
