import { Pagination, parsePage } from "@/components/pagination";
import { PlaceHeader } from "@/components/place-banner";
import { NOTIFICATION_ICON, notificationText, notificationTime } from "@/lib/notifications";
import { requireMember } from "@/server/dal";
import { listNotifications } from "@/server/notifications";
import { markAllNotificationsRead, openNotification } from "./actions";
import { PixelIcon } from "@/components/pixel-icon";

export const metadata = { title: "알림함" };

// 알림함 (GAME-08 / FR-042~044): 본인 알림만 최신순 20개, 안 읽은 줄은 노란 배경
export default async function NotificationsPage(props: PageProps<"/notifications">) {
  const viewer = await requireMember();
  const page = parsePage((await props.searchParams).page);
  const list = await listNotifications(viewer.userId, page);
  const now = new Date();
  const hasUnread = list.rows.some((r) => !r.readAt);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <PlaceHeader
        place="notifications"
        icon="mail"
        title="알림함"
        aside={
          hasUnread && (
            <form action={markAllNotificationsRead}>
              <button className="pixel-btn pixel-btn-sm bg-white text-ink">모두 읽음</button>
            </form>
          )
        }
      />

      <section className="pixel-card mt-6 p-3 sm:p-4">
        {list.rows.length ? (
          <ul className="space-y-3">
            {list.rows.map((r) => (
              <li key={r.id}>
                <form action={openNotification}>
                  <input type="hidden" name="id" value={r.id} />
                  <button
                    data-unread={r.readAt ? undefined : "true"}
                    className={`flex min-h-11 w-full flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2.5 text-left hover:shadow-[inset_0_0_0_3px_#d99a36] focus-visible:outline-3 focus-visible:outline-sky ${
                      r.readAt ? "bg-[#fbf6ec] shadow-[inset_0_0_0_3px_#efe2c9]" : "bg-[#fff3d6] font-bold shadow-[inset_0_0_0_3px_#ffd36e,inset_6px_0_0_0_#d99a36]"
                    }`}
                  >
                    <PixelIcon name={NOTIFICATION_ICON[r.kind]} scale={2} />
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
