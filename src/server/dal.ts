// 데이터 접근 계층(DAL): "지금 보고 있는 사람이 누구인가"를 확인하는 유일한 곳
// Next.js 권장: 인증 확인은 레이아웃이 아니라 각 페이지와 Server Action에서 한다
import "server-only";
import { and, eq, gt, lt, or, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { blogs, items, profiles, sessions } from "@/db/schema";
import { auth, SESSION_SHORT_SECONDS } from "@/lib/auth";

/**
 * 로그인 세션 (한 요청 안에서는 한 번만 조회).
 *
 * 로그인 유지 규칙 (AUTH-09 / FR-020, FR-022, SC-005, research R6-4·5):
 * - 라이브러리의 세션 갱신은 끈다(disableRefresh). Server Component에서는 쿠키를 쓸 수 없어 nextCookies()가 쿠키 쓰기를
 *   조용히 건너뛰므로(better-auth 1.7.7 확인), DB 만료만 늘고 쿠키와 어긋나는 일을 막는다.
 *   유지 세션의 7일 연장은 SessionKeeper(GET /api/auth/get-session, Route Handler라 쿠키도 다시 심는다)가 맡는다.
 * - 유지 안 함 세션(remember_me = false)은 여기서 맡는다.
 *   1) 마지막 사용(updated_at)이 2시간보다 오래되면 expires_at과 상관없이 끝낸다: 세션 행을 지우고 null.
 *      (dont_remember 쿠키를 지우고 get-session을 부르면 라이브러리가 expires_at을 7일로 늘리므로 expires_at만으로는 못 지킨다)
 *   2) 아니면 expires_at = now() + 2시간, updated_at = now(). 조건부 UPDATE라 세션마다 5분에 한 번만 쓴다.
 *      (> 2시간 조건은 라이브러리가 만료를 1일·7일로 잡은 경우를 2시간으로 되돌리는 안전망)
 */
const SHORT = sql`make_interval(secs => ${SESSION_SHORT_SECONDS})`; // 2시간
const STEP = sql`interval '5 minutes'`; // 유지 안 함 세션의 연장 단위

export const getSession = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers(), query: { disableRefresh: true } });
  if (!session || session.session.rememberMe) return session;

  const id = session.session.id;
  if (new Date(session.session.updatedAt).getTime() < Date.now() - SESSION_SHORT_SECONDS * 1000) {
    await db.delete(sessions).where(and(eq(sessions.id, id), eq(sessions.rememberMe, false)));
    return null;
  }
  await db
    .update(sessions)
    .set({ expiresAt: sql`now() + ${SHORT}`, updatedAt: sql`now()` })
    .where(
      and(
        eq(sessions.id, id),
        eq(sessions.rememberMe, false),
        or(lt(sessions.expiresAt, sql`now() + ${SHORT} - ${STEP}`), gt(sessions.expiresAt, sql`now() + ${SHORT}`)),
      ),
    );
  return session;
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

  return { userId: session.user.id, user: session.user, sessionId: session.session.id, rememberMe: session.session.rememberMe, profile };
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
