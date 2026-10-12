// 관리자 화면 (AUTH-08 / FR-043~FR-047, FR-054, contracts/admin.md 1장), 테스트 지급 (AUTH-10)
// 관리자가 아니면(로그인하지 않은 사람 포함) requireAdmin()이 404를 보여 화면이 있다는 것도 드러내지 않는다.
// 375px에서는 표 대신 행을 쌓은 목록을 보여 가로 스크롤이 없게 하고, 링크·[삭제]의 누르는 영역은 44px 이상으로 둔다.
import { desc, eq, gte, sql } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { attendances, blogs, posts, profiles, users } from "@/db/schema";
import { formatDateTime } from "@/lib/format";
import { todayKST } from "@/lib/game";
import { requireAdmin } from "@/server/dal";
import { startOfTodayKST } from "@/server/points";
import { countLiveComments } from "@/server/social";
import { PixelIcon } from "@/components/pixel-icon";
import { PlaceHeader } from "@/components/place-banner";
import type { IconName } from "@/lib/art/icons";
import { AdminDeletePostButton } from "./delete-button";
import { AdminGrantForm } from "./grant-form";

export const metadata = { title: "관리자" };

// 로그인 수단(accounts.provider_id) → 화면 이름 (contracts/admin.md 1장)
const PROVIDER_LABELS: Record<string, string> = { credential: "아이디", kakao: "카카오", naver: "네이버", google: "Google" };
const providerLabels = (providers: string[] | null) => (providers ?? []).map((p) => PROVIDER_LABELS[p] ?? p).join(", ") || "없음";

// 누르는 영역 44px (FR-054)
const linkTap = "inline-flex min-h-11 items-center";

export default async function AdminPage() {
  const admin = await requireAdmin();

  const [[stats], commentCount, recentUsers, recentPosts] = await Promise.all([
    db
      .select({
        users: sql<number>`(SELECT COUNT(*)::int FROM ${users})`,
        posts: sql<number>`(SELECT COUNT(*)::int FROM ${posts})`,
        postsToday: sql<number>`(SELECT COUNT(*)::int FROM ${posts} WHERE ${posts.createdAt} >= ${startOfTodayKST})`,
        attendToday: sql<number>`(SELECT COUNT(*)::int FROM ${attendances} WHERE ${attendances.date} = ${todayKST()})`,
      })
      .from(sql`(SELECT 1) AS one`),
    // 삭제되지 않은 댓글 + 답글 (SOC-01 / FR-016)
    countLiveComments(),
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

  const cards: { label: string; value: number; icon: IconName }[] = [
    { label: "가입 계정", value: stats.users, icon: "people" },
    { label: "전체 글", value: stats.posts, icon: "pencil" },
    { label: "댓글", value: commentCount, icon: "chat" },
    { label: "오늘 새 글", value: stats.postsToday, icon: "star" },
    { label: "오늘 출석", value: stats.attendToday, icon: "post" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <PlaceHeader place="admin" icon="crown" title="관리자" />

      <section className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-5" aria-label="통계">
        {cards.map((c) => (
          <div key={c.label} className="pixel-card flex items-center gap-3 p-4" data-stat-card>
            <span className="pixel-slot grid size-11 shrink-0 place-items-center">
              <PixelIcon name={c.icon} />
            </span>
            <div className="min-w-0">
              <p className="text-sm text-ink-soft">{c.label}</p>
              <p className="font-display text-3xl">{c.value.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="pixel-card mt-8 p-5" aria-labelledby="admin-grant-title">
        <h2 id="admin-grant-title" className="pixel-heading text-xl">
          <PixelIcon name="flask" />
          테스트 지급
        </h2>
        <p className="mb-4 mt-1 text-sm text-ink-soft">기능을 시험해 볼 때 쓰는 관리자 전용 도구예요. 회원에게 코인·경험치를 바로 넣어 줍니다 (AUTH-10).</p>
        <AdminGrantForm adminUsername={admin.user.username ?? "admin"} />
      </section>

      <section className="pixel-card mt-8 p-5">
        <h2 className="pixel-heading mb-3 text-xl">
          <PixelIcon name="people" />
          최근 가입 (20명)
        </h2>
        {/* PC: 표 */}
        <table className="hidden w-full text-left text-sm md:table">
          <thead className="text-ink-soft">
            <tr><th className="py-2">아이디 (로그인 방식)</th><th>닉네임</th><th>블로그</th><th>권한</th><th>가입</th></tr>
          </thead>
          <tbody className="pixel-rows">
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
        <ul className="pixel-rows md:hidden">
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

      <section className="pixel-card mt-8 p-5">
        <h2 className="pixel-heading mb-3 text-xl">
          <PixelIcon name="pencil" />
          최근 30일 글
        </h2>
        {recentPosts.length ? (
          <>
            <table className="hidden w-full text-left text-sm md:table">
              <thead className="text-ink-soft">
                <tr><th className="py-2">제목</th><th>작성자</th><th>공개</th><th>작성</th><th /></tr>
              </thead>
              <tbody className="pixel-rows">
                {recentPosts.map((p) => (
                  <tr key={p.id}>
                    <td className="py-1"><PostTitle post={p} className={`${linkTap} hover:underline`} /></td>
                    <td>{p.nickname}</td>
                    <td>{ADMIN_VIS[p.visibility]}</td>
                    <td className="whitespace-nowrap text-ink-soft">{formatDateTime(p.createdAt)}</td>
                    <td className="text-right"><AdminDeletePostButton postId={p.id} title={p.title} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="pixel-rows md:hidden">
              {recentPosts.map((p) => (
                <li key={p.id} className="flex items-start gap-2 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <PostTitle post={p} className={`${linkTap} break-all font-bold hover:underline`} />
                    <p className="text-ink-soft">
                      <span className="break-all">{p.nickname}</span> · {ADMIN_VIS[p.visibility]} ·{" "}
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

/** 글 제목. 비공개 글은 주인만 열 수 있어(관리자도 404) 링크 없이 글자만 둔다 */
/** "공개" 열: 공개 / 👥(이웃 공개) / 🔒(비공개) */
const ADMIN_VIS = { public: "공개", neighbors: "👥", private: "🔒" } as const;

function PostTitle({ post, className }: { post: { id: number; slug: string; title: string; visibility: string }; className: string }) {
  if (post.visibility !== "public") return <span title="비공개·이웃 공개 글은 관리자가 열 수 없어요" className="break-all">{post.title}</span>;
  return (
    <Link href={`/@${post.slug}/${post.id}`} className={className}>
      {post.title}
    </Link>
  );
}
