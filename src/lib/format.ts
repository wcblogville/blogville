const dateFmt = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
const dateTimeFmt = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export const formatDate = (d: Date) => dateFmt.format(d);
export const formatDateTime = (d: Date) => dateTimeFmt.format(d);

/** 좁은 화면 헤더용 짧은 코인 수: 1만 미만은 그대로, 그 위는 `1.2만`·`1234만`·`3.5억` (내림). 테스트 지급(AUTH-10)으로 큰 수가 생겨 휴대폰 헤더가 넘쳤다 */
export function formatCoinsShort(n: number): string {
  if (n < 10_000) return n.toLocaleString("ko-KR");
  const [value, unit] = n < 100_000_000 ? [n / 10_000, "만"] : [n / 100_000_000, "억"];
  return `${value >= 100 ? Math.floor(value) : Math.floor(value * 10) / 10}${unit}`;
}
