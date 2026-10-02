// 데이터 접근 계층(DAL): "지금 보고 있는 사람이 누구인가"를 확인하는 유일한 곳
// Next.js 권장: 인증 확인은 레이아웃이 아니라 각 페이지와 Server Action에서 한다
import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { blogs, items, profiles } from "@/db/schema";
import { auth } from "@/lib/auth";

/** 로그인 세션 (한 요청 안에서는 한 번만 조회) */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/** 로그인한 회원의 프로필과 블로그. 온보딩 전이면 profile이 null */
export const getViewer = cache(async () => {
  const session = await getSession();
  if (!session) return null;

  const [row] = await db
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

  return { userId: session.user.id, user: session.user, profile: row ?? null };
});

/** 로그인만 확인 (온보딩 페이지용) */
export async function requireUser() {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  return viewer;
}

/** 로그인 + 온보딩 완료 확인. 대부분의 회원 전용 화면에서 사용 */
export async function requireMember() {
  const viewer = await requireUser();
  if (!viewer.profile) redirect("/onboarding");
  return { ...viewer, profile: viewer.profile };
}
