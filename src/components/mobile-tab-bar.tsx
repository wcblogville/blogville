"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PixelIcon } from "@/components/pixel-icon";
import type { IconName } from "@/lib/art/icons";
import { unreadBadge } from "@/lib/notifications";

/** 탭바를 숨기는 화면: 첫 화면(로그인), 글쓰기(편집기가 화면 아래까지 쓴다) */
const hiddenOn = (path: string) => path === "/" || path === "/write" || path.startsWith("/write/");

/**
 * 휴대폰 아래 탭 (사용자 결정 2026-10-09): 휴대폰에는 광장(게임)이 없고, 내 블로그가 첫 화면이다.
 * 탭으로 내 블로그·마을 소식·상점·알림·메뉴를 오간다. `phone:` 화면에서만 보인다 (PC는 광장이 메인 그대로).
 * 탭바가 내용을 가리지 않게 같은 높이의 빈칸을 페이지 끝에 둔다
 */
export function MobileTabBar({ blogSlug, unread }: { blogSlug: string; unread: number }) {
  const pathname = usePathname();
  if (hiddenOn(pathname)) return null;
  const badge = unreadBadge(unread);
  const myBlog = `/@${blogSlug}`;
  const tabs: { href: string; icon: IconName; label: string; active: boolean; badge?: string | null }[] = [
    { href: myBlog, icon: "house", label: "내 블로그", active: pathname === myBlog || pathname.startsWith(`${myBlog}/`) },
    { href: "/feed", icon: "board", label: "마을 소식", active: pathname.startsWith("/feed") },
    { href: "/shop", icon: "shop", label: "상점", active: pathname === "/shop" },
    { href: "/notifications", icon: "bell", label: "알림", active: pathname === "/notifications", badge },
    { href: "/town?menu=1", icon: "menu", label: "메뉴", active: pathname === "/town" },
  ];
  return (
    <>
      <div aria-hidden className="hidden h-16 phone:block" />
      <nav
        aria-label="휴대폰 메뉴"
        data-mobile-tabs
        className="fixed inset-x-0 bottom-0 z-40 hidden border-t-[3px] border-[#4a3426] bg-[#fff6e4] pb-[env(safe-area-inset-bottom)] shadow-[inset_0_3px_0_0_#fffdf6] phone:block"
      >
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {tabs.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={t.active ? "page" : undefined}
                aria-label={t.badge ? `${t.label} (안 읽은 알림 ${t.badge}개)` : t.label}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-bold ${t.active ? "bg-[#ffe7a3] text-ink shadow-[inset_0_-3px_0_0_#d99a36]" : "text-ink-soft"}`}
              >
                <PixelIcon name={t.icon} scale={2} className={t.active ? "" : "opacity-80"} />
                {t.label}
                {t.badge && (
                  <span data-badge aria-hidden className="absolute left-1/2 top-1 ml-2 min-w-4 bg-berry px-1 text-center text-[10px] leading-4 text-white shadow-[0_0_0_2px_#4a3426]">
                    {t.badge}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
