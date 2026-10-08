// 알림 문구·표시 규칙 (GAME-06·GAME-08 / FR-038·042·043·045). DB를 쓰지 않는 순수 함수만 둔다
import { MAX_LEVEL } from "@/lib/game";

export type NotificationKind = "level_up" | "like" | "comment" | "reply";

/** 화면에 보여 줄 알림 한 줄 (닉네임·제목·주소는 보여 줄 때 JOIN으로 읽는다) */
export type NotificationRow = {
  kind: NotificationKind;
  level: number | null;
  actorNickname: string | null;
  postId: number | null;
  postTitle: string | null;
  blogSlug: string | null;
};

/** 레벨업 팝업 제목 */
export function levelUpTitle(level: number): string {
  return level >= MAX_LEVEL ? `최고 레벨 Lv.${MAX_LEVEL}가 되었어요!` : `Lv.${level}이 되었어요!`;
}

/** 🔔 옆 숫자: 0이면 없음, 10개 이상은 9+ */
export function unreadBadge(n: number): string | null {
  if (n <= 0) return null;
  return n >= 10 ? "9+" : String(n);
}

/** 알림 시간: 방금 / N분 전 / N시간 전 / YYYY.MM.DD (한국 시간) */
export function notificationTime(createdAt: Date, now: Date = new Date()): string {
  const diff = Math.max(0, now.getTime() - createdAt.getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}시간 전`;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(createdAt).replaceAll("-", ".");
}

/** 알림 문구 (FR-045 그대로) */
export function notificationText(row: NotificationRow): string {
  switch (row.kind) {
    case "level_up":
      return `🎉 Lv.${row.level}이 되었어요!`;
    case "like":
      return `❤️ ${row.actorNickname}님이 「${row.postTitle}」에 공감했어요`;
    case "comment":
      return `💬 ${row.actorNickname}님이 「${row.postTitle}」에 댓글을 달았어요`;
    case "reply":
      return `💬 ${row.actorNickname}님이 내 댓글에 답글을 달았어요`;
  }
}

/** 알림을 누르면 가는 곳 */
export function notificationHref(row: Pick<NotificationRow, "kind" | "postId" | "blogSlug">): string {
  if (row.kind === "level_up" || !row.postId || !row.blogSlug) return "/shop";
  const post = `/@${row.blogSlug}/${row.postId}`;
  return row.kind === "like" ? post : `${post}#comments`;
}
