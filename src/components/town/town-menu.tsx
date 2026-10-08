import Link from "next/link";
import { CharacterBadge } from "@/components/character";
import { unreadBadge } from "@/lib/notifications";
import { AccountLinks, FriendsPanel, type TownHudMember } from "./town-hud";
import type { TownData } from "./types";

type Place = { emoji: string; label: string; sub?: string; href: string };

/**
 * 휴대폰용 간단 메뉴 (10/6 회의 결정). 휴대폰에서는 광장(게임) 대신
 * 블로그·출석·상점·농장 같은 주요 화면으로 가는 큰 버튼을 보여준다.
 * 어느 화면에서 보일지는 쓰는 쪽이 className(`hidden phone:block`)으로 정한다.
 */
export function TownMenu({
  data,
  member: hud,
  welcome,
  className = "",
}: {
  data: TownData;
  member: TownHudMember | null;
  welcome: boolean;
  className?: string;
}) {
  const member = data.player;
  const badge = hud ? unreadBadge(hud.unread) : null;
  const places: Place[] = member
    ? [
        ...(data.myHouse ? [{ emoji: "🏠", label: "내 블로그", sub: data.myHouse.title, href: `/@${data.myHouse.slug}` }] : []),
        { emoji: "✏️", label: "글쓰기", sub: "새 글 쓰기", href: "/write" },
        { emoji: "🔔", label: "알림", sub: badge ? `안 읽은 알림 ${badge}개` : "새 알림 없음", href: "/notifications" },
        { emoji: "📮", label: "출석 체크", sub: data.attendanceDay ? `오늘 ${data.attendanceDay}일차 ✅` : undefined, href: "/attendance" },
        { emoji: "📋", label: "마을 소식", sub: "새 글 · 이웃 새 글", href: "/feed" },
        { emoji: "🏪", label: "상점", sub: "아바타·가구·배경", href: "/shop" },
        { emoji: "🐮", label: "동물 농장", sub: "알 부화 · 동물 키우기", href: "/farm" },
        { emoji: "🎣", label: "낚시터", sub: "하루 한 번 낚시", href: "/fishing" },
      ]
    : [
        { emoji: "📋", label: "마을 소식", sub: "새 글 구경하기", href: "/feed" },
        { emoji: "🔑", label: "시작하기", sub: "로그인하고 내 집 만들기", href: "/" },
      ];

  return (
    <nav aria-label="마을 메뉴" data-town-menu className={`mx-auto w-full max-w-md px-4 py-5 ${className}`}>
      {welcome && member && (
        <div className="card mb-4 flex items-start gap-3 border-sun bg-[#fff3d6] p-4">
          <span className="text-2xl">🎉</span>
          <p className="flex-1 text-sm">
            <b>{member.nickname}</b>님, 마을에 처음 나왔어요! 아래 <b>내 블로그</b>에서 첫 글을 써 보세요. <b>출석 체크</b>로 보상을 받고, <b>동물 농장</b>에서 첫 알도 받아 보세요.
          </p>
          <Link href="/town" className="shrink-0 rounded-lg px-2 py-1 text-ink-soft hover:bg-white" aria-label="환영 문구 닫기">
            ✕
          </Link>
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        {member ? <CharacterBadge asset={member.characterAsset} outfit={member.outfit} size={44} /> : <span className="text-4xl" aria-hidden>🏘</span>}
        <div className="min-w-0">
          <h2 className="truncate font-display text-xl">{member ? `${member.nickname}님, 어디로 갈까요?` : "Blogville 마을 구경"}</h2>
          <p className="text-sm text-ink-soft">
            {hud ? (
              <>
                Lv.{hud.wallet.level} · 🪙 {hud.wallet.coins.toLocaleString()} · ✨{" "}
                {hud.wallet.isMax ? "최고 레벨" : `${hud.wallet.current.toLocaleString()} / ${hud.wallet.needed.toLocaleString()}`}
              </>
            ) : (
              "로그인하면 내 블로그 집이 생겨요."
            )}
          </p>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-3">
        {places.map((p) => (
          <li key={p.href}>
            <Link
              href={p.href}
              className="card flex h-full min-h-24 flex-col items-center justify-center gap-0.5 p-3 text-center active:translate-y-0.5"
            >
              <span className="text-3xl" aria-hidden>
                {p.emoji}
              </span>
              <span className="font-bold">{p.label}</span>
              {p.sub && <span className="line-clamp-1 text-xs text-ink-soft">{p.sub}</span>}
            </Link>
          </li>
        ))}
      </ul>

      {/* 이웃집: 광장 둘레의 집과 같은 블로그 (회원은 즐겨찾기 이웃, 방문자는 최근 글이 있는 블로그) */}
      {data.neighbors.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 font-display text-lg">
            🏘 {member ? "즐겨찾기 이웃집" : "이웃집"} <span className="text-sm text-ink-soft">{data.neighbors.length}</span>
          </h2>
          <ul className="card divide-y-2 divide-line overflow-hidden">
            {data.neighbors.map((h) => (
              <li key={h.slug}>
                <Link href={`/@${h.slug}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-cream">
                  <CharacterBadge asset={h.characterAsset} outfit={h.outfit} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{h.title}</span>
                    <span className="block truncate text-xs text-ink-soft">{h.nickname}</span>
                  </span>
                  <span className="text-ink-soft" aria-hidden>
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hud && (
        <div className="mt-6">
          <h2 className="mb-2 font-display text-lg">
            👫 친구 목록 <span className="text-sm text-ink-soft">{hud.friends.length}</span>
          </h2>
          <div className="card p-2">
            <FriendsPanel data={data} member={hud} />
          </div>
        </div>
      )}
      {hud && (
        <div className="mt-6">
          <AccountLinks member={hud} />
        </div>
      )}
    </nav>
  );
}
