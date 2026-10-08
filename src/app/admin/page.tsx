// 관리자 화면 (AUTH-08 / FR-043~FR-047, FR-054, contracts/admin.md 1장)
// 관리자가 아니면(로그인하지 않은 사람 포함) requireAdmin()이 404를 보여 화면이 있다는 것도 드러내지 않는다.
// 375px에서는 표 대신 행을 쌓은 목록을 보여 가로 스크롤이 없게 하고, 링크·[삭제]의 누르는 영역은 44px 이상으로 둔다.
import { desc, eq, gte, sql } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { attendances, blogs, comments, posts, profiles, users } from "@/db/schema";
import { formatDateTime } from "@/lib/format";
import { todayKST } from "@/lib/game";
import { requireAdmin } from "@/server/dal";
import { startOfTodayKST } from "@/server/points";
import { AdminDeletePostButton } from "./delete-button";

export const metadata = { title: "관리자" };

// 로그인 수단(accounts.provider_id) → 화면 이름 (contracts/admin.md 1장)
const PROVIDER_LABELS: Record<string, string> = { credential: "아이디", kakao: "카카오", naver: "네이버", google: "Google" };
const providerLabels = (providers: string[] | null) => (providers ?? []).map((p) => PROVIDER_LABELS[p] ?? p).join(", ") || "없음";

// 누르는 영역 44px (FR-054)
const linkTap = "inline-flex min-h-11 items-center";

export default async function AdminPage() {
  await requireAdmin();

  const [[stats], recentUsers, recentPosts] = await Promise.all([
    db
      .select({
        users: sql<number>`(SELECT COUNT(*)::int FROM ${users})`,
        posts: sql<number>`(SELECT COUNT(*)::int FROM ${posts})`,
        // 삭제되지 않은 댓글. social 5단계에서 replies 표가 생기면 그 표의 deleted_at IS NULL 행 수를 더한다
        comments: sql<number>`(SELECT COUNT(*)::int FROM ${comments} WHERE ${comments.deletedAt} IS NULL)`,
        postsToday: sql<number>`(SELECT COUNT(*)::int FROM ${posts} WHERE ${posts.createdAt} >= ${startOfTodayKST})`,
        attendToday: sql<number>`(SELECT COUNT(*)::int FROM ${attendances} WHERE ${attendances.date} = ${todayKST()})`,
      })
      .from(sql`(SELECT 1) AS one`),
    db
      .select({
        id: users.id,
        username: users.username,
        role: users.role,
        createdAt: users.createdAt,
        nickname: profiles.nickname,
        slug: blogs.slug,
        providers: sql<string[] | null>`(SELECT array_agg(provider_id ORDER BY created_at) FROM accounts WHERE accounts.user_id = ${users.id})`,
      })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .leftJoin(blogs, eq(blogs.ownerId, users.id))
      .orderBy(desc(users.createdAt))
      .limit(20),
    db
      .select({ id: posts.id, title: posts.title, visibility: posts.visibility, createdAt: posts.createdAt, slug: blogs.slug, nickname: profiles.nickname })
      .from(posts)
      .innerJoin(blogs, eq(blogs.id, posts.blogId))
      .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
      .where(gte(posts.createdAt, sql`now() - interval '30 days'`))
      .orderBy(desc(posts.createdAt))
      .limit(30),
  ]);

  const cards = [
    { label: "가입 계정", value: stats.users },
    { label: "전체 글", value: stats.posts },
    { label: "댓글", value: stats.comments },
    { label: "오늘 새 글", value: stats.postsToday },
    { label: "오늘 출석", value: stats.attendToday },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-3xl">👑 관리자</h1>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="통계">
        {cards.map((c) => (
          <div key={c.label} className="card p-4" data-stat-card>
            <p className="text-sm text-ink-soft">{c.label}</p>
            <p className="font-display text-3xl">{c.value.toLocaleString()}</p>
          </div>
        ))}
      </section>

      <section className="card mt-8 p-5">
        <h2 className="mb-3 font-display text-xl">최근 가입 (20명)</h2>
        {/* PC: 표 */}
        <table className="hidden w-full text-left text-sm md:table">
          <thead className="text-ink-soft">
            <tr><th className="py-2">아이디 (로그인 방식)</th><th>닉네임</th><th>블로그</th><th>권한</th><th>가입</th></tr>
          </thead>
          <tbody className="divide-y-2 divide-line/60">
            {recentUsers.map((u) => (
              <tr key={u.id}>
                <td className="py-2">{u.username ?? "-"} <span className="text-ink-soft">({providerLabels(u.providers)})</span></td>
                <td>{u.nickname ?? "-"}</td>
                <td>{u.slug ? <Link href={`/@${u.slug}`} className={`${linkTap} text-sky underline`}>@{u.slug}</Link> : "-"}</td>
                <td>{u.role === "admin" ? "👑 관리자" : "회원"}</td>
                <td className="whitespace-nowrap text-ink-soft">{formatDateTime(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* 휴대폰: 행을 쌓은 목록 */}
        <ul className="divide-y-2 divide-line/60 md:hidden">
          {recentUsers.map((u) => (
            <li key={u.id} className="py-2 text-sm">
              <p className="break-all font-bold">
                {u.username ?? "-"} <span className="font-normal text-ink-soft">({providerLabels(u.providers)})</span>
              </p>
              <p className="break-all">
                {u.nickname ?? "-"} · {u.role === "admin" ? "👑 관리자" : "회원"}
              </p>
              <div className="flex flex-wrap items-center gap-x-3">
                {u.slug ? <Link href={`/@${u.slug}`} className={`${linkTap} break-all text-sky underline`}>@{u.slug}</Link> : "-"}
                <span className="whitespace-nowrap text-ink-soft">{formatDateTime(u.createdAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card mt-8 p-5">
        <h2 className="mb-3 font-display text-xl">최근 30일 글</h2>
        {recentPosts.length ? (
          <>
            <table className="hidden w-full text-left text-sm md:table">
              <thead className="text-ink-soft">
                <tr><th className="py-2">제목</th><th>작성자</th><th>공개</th><th>작성</th><th /></tr>
              </thead>
              <tbody className="divide-y-2 divide-line/60">
                {recentPosts.map((p) => (
                  <tr key={p.id}>
                    <td className="py-1"><Link href={`/@${p.slug}/${p.id}`} className={`${linkTap} hover:underline`}>{p.title}</Link></td>
                    <td>{p.nickname}</td>
                    <td>{p.visibility === "public" ? "공개" : "🔒"}</td>
                    <td className="whitespace-nowrap text-ink-soft">{formatDateTime(p.createdAt)}</td>
                    <td className="text-right"><AdminDeletePostButton postId={p.id} title={p.title} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y-2 divide-line/60 md:hidden">
              {recentPosts.map((p) => (
                <li key={p.id} className="flex items-start gap-2 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <Link href={`/@${p.slug}/${p.id}`} className={`${linkTap} break-all font-bold hover:underline`}>{p.title}</Link>
                    <p className="text-ink-soft">
                      <span className="break-all">{p.nickname}</span> · {p.visibility === "public" ? "공개" : "🔒"} ·{" "}
                      <span className="whitespace-nowrap">{formatDateTime(p.createdAt)}</span>
                    </p>
                  </div>
                  <AdminDeletePostButton postId={p.id} title={p.title} />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-ink-soft">글이 없어요</p>
        )}
      </section>
    </div>
  );
}
