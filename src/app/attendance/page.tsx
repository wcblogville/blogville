import { PlaceHeader } from "@/components/place-banner";
import { AttendanceCalendar, AttendanceRewards, AttendanceToday } from "@/components/game/attendance-board";
import { getAttendanceBoard } from "@/server/attendance";
import { requireMember } from "@/server/dal";

export const metadata = { title: "출석 체크" };

// 출석은 버튼 없이 자동으로 된다 (GAME-04 / FR-021). 이 화면은 결과와 보상표, 이번 달 달력만 보여 준다.
// 같은 조각을 마을 게시판의 출석 체크 창(/feed?board=1)도 쓴다
export default async function AttendancePage() {
  const viewer = await requireMember();
  // 헤더의 자동 출석이 실패했으면 한 번 더. 또 실패하면 오류 화면으로
  const data = await getAttendanceBoard(viewer);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:py-8">
      <PlaceHeader place="attendance" icon="post" title="출석 체크" />

      <section className="pixel-panel mt-6 p-8">
        <AttendanceToday data={data} />
      </section>

      <section className="pixel-card mt-8 p-4 sm:p-6" aria-label="일차별 출석 보상">
        <AttendanceRewards data={data} />
      </section>

      <section className="pixel-card mt-8 p-4 sm:p-6">
        <AttendanceCalendar data={data} />
      </section>
    </div>
  );
}
