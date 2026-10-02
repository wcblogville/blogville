import Link from "next/link";
import { CharacterBadge } from "@/components/character";
import { ExitButton } from "@/components/exit-button";
import { SignOutButton } from "@/components/sign-out-button";
import { getViewer } from "@/server/dal";
import { getWallet } from "@/server/points";

export async function SiteHeader() {
  const viewer = await getViewer();
  const member = viewer?.profile ? { ...viewer, profile: viewer.profile } : null;
  const wallet = member ? await getWallet(member.userId) : null;

  return (
    <header className="sticky top-0 z-20 border-b-2 border-line bg-cream/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <Link href={member ? "/town" : "/"} className="font-display text-2xl text-leaf-dark">
          Blogville
        </Link>

        <div className="flex min-w-0 flex-1">
          <ExitButton />
        </div>

        {member && wallet ? (
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden rounded-full bg-white px-2.5 py-1 text-sm font-bold shadow-sm sm:inline" title="레벨">
              Lv.{wallet.level}
            </span>
            <Link href="/wallet" className="rounded-full bg-white px-2.5 py-1 text-sm font-bold shadow-sm hover:text-leaf-dark" title="코인">
              🪙 {wallet.coins.toLocaleString()}
            </Link>
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
