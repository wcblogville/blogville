import Link from "next/link";
import { CharacterBadge } from "@/components/character";
import { AccountLinks, FriendsPanel, ProfilePanel, type TownHudMember } from "./town-hud";
import type { TownData } from "./types";

type Place = { emoji: string; label: string; sub?: string; href: string };

/**
 * 휴대폰용 간단 메뉴. 휴대폰에는 광장(게임)이 없어서 회원에게는 아래 탭의 ☰ 메뉴(/town?menu=1)로,
 * 방문자에게는 /town에서 보여 준다 (10/6 회의, 2026-10-09 사용자 결정).
 * 내 블로그·마을 소식·상점·알림은 아래 탭에 있어 여기에는 내 프로필과 나머지 장소만 둔다.
 * 어느 화면에서 보일지는 쓰는 쪽이 className(`hidden phone:block`)으로 정한다.
 */
export function TownMenu({ data, member: hud, className = "" }: { data: TownData; member: TownHudMember | null; className?: string }) {
  const member = data.player;
  const places: Place[] = member
    ? [
        { emoji: "✏️", label: "글쓰기", sub: "새 글 쓰기", href: "/write" },
        { emoji: "📮", label: "출석 체크", sub: data.attendanceDay ? `오늘 ${data.attendanceDay}일차 ✅` : undefined, href: "/attendance" },
        { emoji: "🎨", label: "꾸미기", sub: "옷·배경·가구 바꾸기", href: "/closet" },
        { emoji: "📒", label: "지갑", sub: "코인·경험치 기록", href: "/wallet" },
        { emoji: "🐮", label: "동물 농장", sub: "알 부화 · 동물 키우기", href: "/farm" },
        { emoji: "🎣", label: "낚시터", sub: "하루 한 번 낚시", href: "/fishing" },
        { emoji: "💇", label: "미용실", sub: "머리 모양·머리 색", href: "/salon" },
        { emoji: "👗", label: "옷가게", sub: "옷·모자·소품 입어 보기", href: "/clothes" },
      ]
    : [
        { emoji: "📋", label: "마을 소식", sub: "새 글 구경하기", href: "/feed" },
        { emoji: "🔑", label: "시작하기", sub: "로그인하고 내 집 만들기", href: "/" },
      ];

  return (
    <nav aria-label="마을 메뉴" data-town-menu className={`mx-auto w-full max-w-md px-4 py-5 ${className}`}>
      {hud && member ? (
        <section className="card mb-4 p-4" aria-labelledby="menu-profile" data-menu-profile>
          <h2 id="menu-profile" className="mb-3 font-display text-lg">
            👤 내 프로필
          </h2>
          <ProfilePanel data={data} member={hud} links={false} />
        </section>
      ) : (
        <div className="mb-4 flex items-center gap-3">
          <span className="text-4xl" aria-hidden>
            🏘
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-display text-xl">Blogville 마을 구경</h2>
            <p className="text-sm text-ink-soft">로그인하면 내 블로그 집이 생겨요.</p>
          </div>
        </div>
      )}

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

      {/* 이웃집: 광장 둘레의 집과 같은 블로그 (회원은 즐겨찾기 이웃, 방문자는 인기 블로그 100곳 중 무작위 10곳) */}
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
