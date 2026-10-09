import Link from "next/link";
import { unreadBadge } from "@/lib/notifications";

/** 헤더 🔔: 알림함 링크와 안 읽은 수 배지 (GAME-08 / FR-042) */
export function NotificationBell({ unread }: { unread: number }) {
  const badge = unreadBadge(unread);
  return (
    <Link
      href="/notifications"
      aria-label={badge ? `알림 ${badge}개 안 읽음` : "알림"}
      className="relative -mx-1 grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full text-lg hover:bg-white focus-visible:outline-2 focus-visible:outline-sky"
    >
      <span aria-hidden>🔔</span>
      {badge && (
        <span data-badge aria-hidden className="absolute right-0 top-1 min-w-4 rounded-full bg-berry px-1 text-center text-[10px] font-bold leading-4 text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}
