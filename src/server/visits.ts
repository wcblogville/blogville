// 방문자 기록 (BLOG-10, 2026-10-12 "방문자기록 볼 수 있으면 좋을듯"): 블로그 주인만 보는 날짜별 방문 그래프와 최근 방문 회원.
// 손님(로그인 안 함)은 누구인지 모르므로 날짜별 숫자로만 묶는다. 방문 줄은 blog_visits (같은 사람은 하루 1줄)
import "server-only";
import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { blogs, blogVisits, items, profiles } from "@/db/schema";
import { previousDay, todayKST } from "@/lib/game";
import { outfitOf } from "@/server/inventory";

/** 기간 고르기: 14일(기본) · 30일 */
export const VISIT_LOG_RANGES = [14, 30] as const;
export type VisitLogRange = (typeof VISIT_LOG_RANGES)[number];
/** 목록에 보여 줄 회원 방문 최대 줄 수 (30일이어도 화면이 너무 길지 않게) */
export const VISIT_LOG_MEMBER_LIMIT = 200;

const characterItem = alias(items, "character_item");
const visitorBlog = alias(blogs, "visitor_blog");

const timeFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export type VisitLogDay = {
  date: string;
  total: number;
  members: number;
  guests: number;
};
export type VisitLogMember = {
  date: string;
  time: string;
  nickname: string;
  blogSlug: string;
  characterAsset: string;
  outfit: string[];
};

/**
 * 최근 days일(오늘 포함)의 날짜별 방문(회원·손님)과 회원 방문 목록 (최신순). 방문이 없는 날도 0으로 채운다.
 * 블로그 주인 확인은 부르는 쪽(페이지)이 한다
 */
export async function getVisitLog(blogId: number, days: VisitLogRange) {
  const dates = [todayKST()];
  while (dates.length < days) dates.unshift(previousDay(dates[0]));
  const from = dates[0];

  const [daily, members] = await Promise.all([
    db
      .select({
        date: blogVisits.date,
        total: sql<number>`COUNT(*)::int`,
        members: sql<number>`COUNT(${blogVisits.userId})::int`,
      })
      .from(blogVisits)
      .where(and(eq(blogVisits.blogId, blogId), gte(blogVisits.date, from)))
      .groupBy(blogVisits.date),
    db
      .select({
        date: blogVisits.date,
        createdAt: blogVisits.createdAt,
        nickname: profiles.nickname,
        blogSlug: visitorBlog.slug,
        characterAsset: characterItem.assetKey,
        outfit: outfitOf(blogVisits.userId),
      })
      .from(blogVisits)
      .innerJoin(profiles, eq(profiles.userId, blogVisits.userId))
      .innerJoin(characterItem, eq(characterItem.id, profiles.characterItemId))
      .innerJoin(visitorBlog, eq(visitorBlog.ownerId, blogVisits.userId))
      .where(and(eq(blogVisits.blogId, blogId), gte(blogVisits.date, from), isNotNull(blogVisits.userId)))
      .orderBy(desc(blogVisits.date), desc(blogVisits.createdAt))
      .limit(VISIT_LOG_MEMBER_LIMIT),
  ]);

  const byDate = new Map(daily.map((d) => [String(d.date), d]));
  const chart: VisitLogDay[] = dates.map((date) => {
    const d = byDate.get(date);
    const total = d?.total ?? 0;
    const m = d?.members ?? 0;
    return { date, total, members: m, guests: total - m };
  });
  const list: VisitLogMember[] = members.map((m) => ({
    date: String(m.date),
    time: timeFormat.format(m.createdAt),
    nickname: m.nickname,
    blogSlug: m.blogSlug,
    characterAsset: m.characterAsset,
    outfit: m.outfit,
  }));
  return {
    chart,
    members: list,
    truncated: members.length >= VISIT_LOG_MEMBER_LIMIT,
  };
}
