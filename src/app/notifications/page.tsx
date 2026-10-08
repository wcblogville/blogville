import { Pagination, parsePage } from "@/components/pagination";
import { notificationText, notificationTime } from "@/lib/notifications";
import { requireMember } from "@/server/dal";
import { listNotifications } from "@/server/notifications";
import { markAllNotificationsRead, openNotification } from "./actions";

export const metadata = { title: "알림함" };

// 알림함 (GAME-08 / FR-042~044): 본인 알림만 최신순 20개, 안 읽은 줄은 노란 배경
export default async function NotificationsPage(props: PageProps<"/notifications">) {
  const viewer = await requireMember();
  const page = parsePage((await props.searchParams).page);
  const list = await listNotifications(viewer.userId, page);
  const now = new Date();
  const hasUnread = list.rows.some((r) => !r.readAt);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-3xl">🔔 알림함</h1>
        {hasUnread && (
          <form action={markAllNotificationsRead}>
            <button className="btn min-h-11 border-2 border-line bg-white text-sm">모두 읽음</button>
          </form>
        )}
      </div>

      <section className="card mt-6 p-2 sm:p-3">
        {list.rows.length ? (
          <ul className="space-y-1.5">
            {list.rows.map((r) => (
              <li key={r.id}>
                <form action={openNotification}>
                  <input type="hidden" name="id" value={r.id} />
                  <button
                    data-unread={r.readAt ? undefined : "true"}
                    className={`flex min-h-11 w-full flex-wrap items-center gap-x-3 gap-y-0.5 rounded-xl px-3 py-2.5 text-left hover:ring-2 hover:ring-sun ${
                      r.readAt ? "bg-white" : "bg-[#fff3d6] font-bold"
                    }`}
                  >
                    <span className="min-w-0 flex-1 break-words">{notificationText(r)}</span>
                    <span className="shrink-0 text-xs font-normal text-ink-soft">{notificationTime(r.createdAt, now)}</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-10 text-center text-ink-soft">아직 알림이 없어요</p>
        )}
        <Pagination page={list.page} pageCount={list.pageCount} hrefFor={(n) => `/notifications?page=${n}`} />
      </section>
    </div>
  );
}
