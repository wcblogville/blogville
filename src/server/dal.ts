// 데이터 접근 계층(DAL): "지금 보고 있는 사람이 누구인가"를 확인하는 유일한 곳
// Next.js 권장: 인증 확인은 레이아웃이 아니라 각 페이지와 Server Action에서 한다
import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { blogs, items, profiles } from "@/db/schema";
import { auth } from "@/lib/auth";

/** 로그인 세션 (한 요청 안에서는 한 번만 조회) */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/**
 * 로그인한 회원과 프로필·블로그. 로그인하지 않았으면 null.
 * 가입이 한 트랜잭션으로 회원·프로필·블로그를 함께 만들므로(AUTH-01, FR-007) 로그인한 회원은 늘 profile이 있다.
 * sessionId는 자동 출석(GAME-04)이 "그날 처음 만든 세션"을 알아보는 데 쓴다.
 */
export const getViewer = cache(async () => {
  const session = await getSession();
  if (!session) return null;

  const [profile] = await db
    .select({
      nickname: profiles.nickname,
      characterAsset: items.assetKey,
      blogId: blogs.id,
      blogSlug: blogs.slug,
      blogTitle: blogs.title,
    })
    .from(profiles)
    .innerJoin(items, eq(items.id, profiles.characterItemId))
    .innerJoin(blogs, eq(blogs.ownerId, profiles.userId))
    .where(eq(profiles.userId, session.user.id));

  // 마이그레이션이 프로필 없는 회원을 정리했고 가입은 한 트랜잭션이라 생기지 않는다. 생겼다면 데이터 오류다
  if (!profile) throw new Error(`프로필이나 블로그가 없는 회원이에요 (회원 ID ${session.user.id})`);

  return { userId: session.user.id, user: session.user, sessionId: session.session.id, profile };
});

export type Viewer = NonNullable<Awaited<ReturnType<typeof getViewer>>>;

/** 로그인한 회원만 통과. 아니면 첫 화면으로. 회원 전용 화면과 Server Action마다 부른다 */
export async function requireMember(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  return viewer;
}

/** 관리자만 통과. 로그인하지 않은 사람·일반 회원 모두 404처럼 보이게 한다 (관리자 화면이 있다는 것도 숨김, FR-043) */
export async function requireAdmin(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer || viewer.user.role !== "admin") notFound();
  return viewer;
}
