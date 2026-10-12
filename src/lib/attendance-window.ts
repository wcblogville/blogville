// 마을 게시판 출석 체크 창을 저절로 여는 것은 회원마다 하루(한국 날짜) 한 번 (사용자 요청 2026-10-12).
// 브라우저(창을 열 때 쿠키를 남김)와 서버(마을 소식 페이지가 쿠키를 읽어 openAtStart를 정함)가 같이 쓴다

/** 쿠키 이름. 값은 boardSeenValue(회원ID, 오늘) */
export const BOARD_SEEN_COOKIE = "bv_board_seen";

/** 쿠키 값: 회원과 한국 날짜를 같이 담아, 다른 회원으로 로그인하거나 날짜가 바뀌면 다시 열린다 */
export const boardSeenValue = (userId: string, todayKst: string) => `${userId}:${todayKst}`;

/** 오늘 이 회원에게 저절로 열어야 하나: 게시판 입구(?board=1)로 왔고, 오늘 이미 열린 적이 없을 때 */
export function shouldAutoOpenBoard(board: boolean, cookieValue: string | undefined, userId: string, todayKst: string): boolean {
  return board && cookieValue !== boardSeenValue(userId, todayKst);
}
