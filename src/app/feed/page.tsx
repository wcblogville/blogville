import { FeedView } from "@/components/blog/feed-view";
import { AttendanceCalendar, AttendanceRewards, AttendanceToday, rewardOf } from "@/components/game/attendance-board";
import { AttendanceWindow } from "@/components/game/attendance-window";
import { parsePage } from "@/components/pagination";
import { getAttendanceBoard } from "@/server/attendance";
import Link from "next/link";
import { cookies } from "next/headers";
import { BOARD_SEEN_COOKIE, boardSeenValue, shouldAutoOpenBoard } from "@/lib/attendance-window";
import { todayKST } from "@/lib/game";
import { emptyFeed, getAllTags, getPinnedNotice, listFeed } from "@/server/blog";
import { getViewer } from "@/server/dal";
import { PixelIcon } from "@/components/pixel-icon";
import { IconText } from "@/components/pixel-icon";

export const metadata = { title: "마을 소식" };

/**
 * 마을 소식 = 광장의 마을 게시판 (TOWN·GAME-04). [🏘 마을 전체]는 ⭐ 즐겨찾는 이웃의 글만, 모르는 사람 글은 없다 (사용자 요청 2026-10-12).
 * 맨 위에는 공지 블로그의 최근 공지 하나가 걸린다 (방문자도 본다). 방문자는 이웃이 없어 글 목록이 비어 있다. 회원에게는 제목 아래 출석 체크 띠가 있고,
 * 게시판으로 들어오면(?board=1) 출석 체크 창이 먼저 열린다 (사용자 요청 2026-10-11). 저절로 열리는 것은 하루 한 번 (쿠키, 2026-10-12). 방문자는 출석이 없어 글만 본다
 */
export default async function FeedPage(props: PageProps<"/feed">) {
  const sp = await props.searchParams;
  const page = parsePage(sp.page);
  const viewer = await getViewer();
  const [list, tags, notice, board] = await Promise.all([
    viewer ? listFeed({ page, followerId: viewer.userId, favoritesOnly: true }) : emptyFeed(page),
    getAllTags(),
    getPinnedNotice(),
    // 출석 기록이 실패한 날에도 마을 소식은 보여 준다 (창만 빠진다)
    viewer ? getAttendanceBoard(viewer).catch(() => null) : null,
  ]);
  const got = board && rewardOf(board, board.cycleDay);
  // 게시판 입구로 와도 출석 창은 하루 한 번만 저절로 연다 (쿠키 = 회원 + 한국 날짜, 사용자 요청 2026-10-12)
  const today = todayKST();
  const autoOpen = Boolean(viewer) && shouldAutoOpenBoard(sp.board === "1", (await cookies()).get(BOARD_SEEN_COOKIE)?.value, viewer?.userId ?? "", today);
  return (
    <FeedView
      title={
        <>
          <PixelIcon name="board" scale={2} />마을 소식
        </>
      }
      tab="all"
      list={list}
      tags={tags}
      showFollowingTab={Boolean(viewer?.profile)}
      hrefFor={(n) => `/feed?page=${n}`}
      notice={notice}
      empty={
        viewer ? (
          <>
            즐겨찾기한 이웃의 새 글이 아직 없어요.
            <br />
            블로그에서 [+ 이웃 추가]를 누르고, 광장 메뉴(휴대폰은 아래 메뉴 탭)의 친구 목록에서 별을 눌러 즐겨찾기해 보세요.
            <br />
            <Link href="/feed/following" className="inline-flex min-h-11 items-center font-bold text-leaf-dark underline">이웃 새 글</Link>에서는 모든 이웃의 글을,{" "}
            <Link href="/feed/all" className="inline-flex min-h-11 items-center font-bold text-leaf-dark underline">모든 글</Link>에서는 마을 모든 회원의 공개 글을 볼 수 있어요.
          </>
        ) : (
          <>
            로그인하면 즐겨찾기한 이웃의 새 글을 여기서 모아 볼 수 있어요.
            <br />
            <Link href="/feed/all" className="inline-flex min-h-11 items-center font-bold text-leaf-dark underline">모든 글</Link>에서는 로그인하지 않아도 마을의 공개 글을 구경할 수 있어요.
            <br />
            <Link href="/" className="inline-flex min-h-11 items-center font-bold text-leaf-dark underline">로그인하러 가기</Link>
          </>
        )
      }
      top={
        board && (
          <AttendanceWindow
            openAtStart={autoOpen}
            seenValue={viewer ? boardSeenValue(viewer.userId, today) : ""}
            summary={
              <>
                <b className="inline-flex items-center gap-1 align-middle">
                  <PixelIcon name="post" scale={1} />오늘 출석 완료 <PixelIcon name="check" scale={1} label="완료" />
                </b>{" "}
                {board.cycleDay}일차
                {got && (
                  <span className="text-ink-soft">
                    {" "}
                    · 받은 보상 <IconText icon="star" label="경험치">{got.exp}</IconText> · <IconText icon="coin" label="코인">{got.coins}</IconText>
                  </span>
                )}
              </>
            }
          >
            <section className="pixel-card p-4" aria-label="오늘 출석">
              <AttendanceToday data={board} compact />
            </section>
            <section aria-label="일차별 출석 보상">
              <AttendanceRewards data={board} />
            </section>
            <section className="pixel-card p-4" aria-label="이번 달 출석">
              <AttendanceCalendar data={board} compact />
            </section>
          </AttendanceWindow>
        )
      }
    />
  );
}
