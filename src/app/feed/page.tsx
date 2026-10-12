import { FeedView } from "@/components/blog/feed-view";
import { AttendanceCalendar, AttendanceRewards, AttendanceToday, rewardOf } from "@/components/game/attendance-board";
import { AttendanceWindow } from "@/components/game/attendance-window";
import { parsePage } from "@/components/pagination";
import { getAttendanceBoard } from "@/server/attendance";
import { getAllTags, listFeed } from "@/server/blog";
import { getViewer } from "@/server/dal";

export const metadata = { title: "마을 소식" };

/**
 * 마을 소식 = 광장의 마을 게시판 (TOWN·GAME-04). 회원에게는 제목 아래 출석 체크 띠가 있고,
 * 게시판으로 들어오면(?board=1) 출석 체크 창이 먼저 열린다 (사용자 요청 2026-10-11). 방문자는 출석이 없어 글만 본다
 */
export default async function FeedPage(props: PageProps<"/feed">) {
  const sp = await props.searchParams;
  const page = parsePage(sp.page);
  const viewer = await getViewer();
  const [list, tags, board] = await Promise.all([
    listFeed({ page }),
    getAllTags(),
    // 출석 기록이 실패한 날에도 마을 소식은 보여 준다 (창만 빠진다)
    viewer ? getAttendanceBoard(viewer).catch(() => null) : null,
  ]);
  const got = board && rewardOf(board, board.cycleDay);
  return (
    <FeedView
      title="📋 마을 소식"
      tab="all"
      list={list}
      tags={tags}
      showFollowingTab={Boolean(viewer?.profile)}
      hrefFor={(n) => `/feed?page=${n}`}
      empty={<>아직 마을에 글이 없어요. 첫 글의 주인공이 되어 보세요! ✏️</>}
      top={
        board && (
          <AttendanceWindow
            openAtStart={sp.board === "1"}
            summary={
              <>
                <b>📮 오늘 출석 완료 ✅</b> {board.cycleDay}일차
                {got && (
                  <span className="text-ink-soft">
                    {" "}
                    · 받은 보상 ✨ {got.exp} · 🪙 {got.coins}
                  </span>
                )}
              </>
            }
          >
            <section className="pb-card p-4" aria-label="오늘 출석">
              <AttendanceToday data={board} compact />
            </section>
            <section aria-label="일차별 출석 보상">
              <AttendanceRewards data={board} />
            </section>
            <section className="pb-card p-4" aria-label="이번 달 출석">
              <AttendanceCalendar data={board} compact />
            </section>
          </AttendanceWindow>
        )
      }
    />
  );
}
