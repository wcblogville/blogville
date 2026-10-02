import Link from "next/link";
import { CharacterBadge } from "@/components/character";
import { SignOutButton } from "@/components/sign-out-button";
import { getViewer } from "@/server/dal";
import { getWallet } from "@/server/points";

export async function SiteHeader() {
  const viewer = await getViewer();
  const member = viewer?.profile ? { ...viewer, profile: viewer.profile } : null;
  const wallet = member ? await getWallet(member.userId) : null;

  const nav = member
    ? [
        { href: "/town", label: "🏛 광장" },
        { href: "/feed", label: "📋 마을 소식" },
        { href: `/@${member.profile.blogSlug}`, label: "🏠 내 블로그" },
        { href: "/write", label: "✏️ 글쓰기" },
        { href: "/shop", label: "🏪 상점" },
        { href: "/closet", label: "🎨 꾸미기" },
      ]
    : [
        { href: "/town", label: "🏛 광장" },
        { href: "/feed", label: "📋 마을 소식" },
      ];

  return (
    <header className="sticky top-0 z-20 border-b-2 border-line bg-cream/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <Link href={member ? "/town" : "/"} className="font-display text-2xl text-leaf-dark">
          Blogville
        </Link>

        <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto text-sm font-bold [scrollbar-width:none]">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-lg px-2.5 py-1.5 text-ink-soft hover:bg-white hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {member && wallet ? (
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden rounded-full bg-white px-2.5 py-1 text-sm font-bold shadow-sm sm:inline" title="레벨">
              Lv.{wallet.level}
            </span>
            <span className="rounded-full bg-white px-2.5 py-1 text-sm font-bold shadow-sm" title="코인">
              🪙 {wallet.coins.toLocaleString()}
            </span>
            {member.user.role === "admin" && (
              <Link href="/admin" className="rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-cream">
                👑 관리자
              </Link>
            )}
            <CharacterBadge asset={member.profile.characterAsset} size={32} />
            <SignOutButton />
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
