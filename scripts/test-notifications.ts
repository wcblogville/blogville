// 알림 순수 규칙 테스트 (GAME-06·GAME-08 / FR-038, FR-042, FR-043, FR-045, quickstart 2장)
// 실행: npm run test:notifications
import { withJosa } from "../src/lib/josa";
import { levelUpTitle, notificationHref, notificationText, notificationTime, unreadBadge, type NotificationRow } from "../src/lib/notifications";

let failed = 0;
function expect(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "✅" : "❌"} ${name}: ${JSON.stringify(got)}${ok ? "" : ` (기대: ${JSON.stringify(want)})`}`);
}

// 레벨업 팝업 제목
expect("Lv.3 제목", levelUpTitle(3), "Lv.3이 되었어요!");
expect("Lv.99 제목", levelUpTitle(99), "최고 레벨 Lv.99가 되었어요!");
// 조사는 숫자를 한국어로 읽은 소리로: 이(2)·사(4)·오(5)·구(9)는 '가', 십(10)·삼(3)은 '이'
expect("Lv.2 제목", levelUpTitle(2), "Lv.2가 되었어요!");
expect("Lv.4 제목", levelUpTitle(4), "Lv.4가 되었어요!");
expect("Lv.10 제목", levelUpTitle(10), "Lv.10이 되었어요!");
expect("받침 있는 이름 + 을", withJosa("왕관", "을/를"), "왕관을");
expect("받침 없는 이름 + 를", withJosa("먹이", "을/를"), "먹이를");
expect("괄호 앞 글자로 판단", withJosa("모자(빨강)", "을/를"), "모자(빨강)을");
expect("영어는 둘 다 적음", withJosa("Hat", "을/를"), "Hat을(를)");

// 🔔 배지
expect("0 → 없음", unreadBadge(0), null);
expect("3 → 3", unreadBadge(3), "3");
expect("9 → 9", unreadBadge(9), "9");
expect("10 → 9+", unreadBadge(10), "9+");
expect("25 → 9+", unreadBadge(25), "9+");

// 시간 표시
const now = new Date("2026-10-08T03:00:00Z"); // 한국 12:00
const ago = (ms: number) => new Date(now.getTime() - ms);
expect("30초 → 방금", notificationTime(ago(30_000), now), "방금");
expect("59분 → 59분 전", notificationTime(ago(59 * 60_000), now), "59분 전");
expect("60분 → 1시간 전", notificationTime(ago(60 * 60_000), now), "1시간 전");
expect("23시간 59분 → 23시간 전", notificationTime(ago((23 * 60 + 59) * 60_000), now), "23시간 전");
expect("24시간 → 날짜", notificationTime(ago(24 * 3_600_000), now), "2026.10.07");
expect("날짜는 한국 시간 (UTC 10/6 16:00 = 한국 10/7)", notificationTime(new Date("2026-10-06T16:00:00Z"), now), "2026.10.07");

// 문구·링크 (FR-045)
const base: NotificationRow = { kind: "like", level: null, actorNickname: "토끼", postId: 7, postTitle: "첫 글", blogSlug: "rabbit" };
const levelUp: NotificationRow = { kind: "level_up", level: 3, actorNickname: null, postId: null, postTitle: null, blogSlug: null };
expect("레벨업 문구", notificationText(levelUp), "🎉 Lv.3이 되었어요!");
expect("공감 문구", notificationText(base), "❤️ 토끼님이 「첫 글」에 공감했어요");
expect("댓글 문구", notificationText({ ...base, kind: "comment" }), "💬 토끼님이 「첫 글」에 댓글을 달았어요");
expect("답글 문구", notificationText({ ...base, kind: "reply" }), "💬 토끼님이 내 댓글에 답글을 달았어요");
expect("레벨업 링크", notificationHref(levelUp), "/shop");
expect("공감 링크", notificationHref(base), "/@rabbit/7");
expect("댓글 링크", notificationHref({ ...base, kind: "comment" }), "/@rabbit/7#comments");
expect("답글 링크", notificationHref({ ...base, kind: "reply" }), "/@rabbit/7#comments");

if (failed) process.exit(1);
