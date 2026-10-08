import Link from "next/link";
import { getBlogByOwner, getBlogVisitDays, getBlogVisitStats, getCategories } from "@/server/blog";
import { requireMember } from "@/server/dal";
import { BlogInfoForm, CategoryManager } from "./settings-forms";

export const metadata = { title: "블로그 관리" };

export default async function BlogSettingsPage() {
  const viewer = await requireMember();
  const blog = await getBlogByOwner(viewer.userId);
  if (!blog) return null;
  const [cats, visitDays, visits] = await Promise.all([
    getCategories(blog.id, true),
    getBlogVisitDays(blog.id),
    getBlogVisitStats(blog.id),
  ]);
  const peak = Math.max(1, ...visitDays.map((d) => d.count));

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-end justify-between">
        <h1 className="font-display text-3xl">⚙️ 블로그 관리</h1>
        <Link href={`/@${blog.slug}`} className="text-sm text-ink-soft hover:text-ink">내 블로그로 →</Link>
      </div>
      {/* 로그인 수단(소셜 연동)·닉네임은 내 정보에서 (AUTH-05 / FR-036) */}
      <p className="mt-2 text-sm text-ink-soft">
        로그인 수단과 소셜 연동은{" "}
        <Link href="/settings/account" className="inline-flex min-h-11 items-center font-bold text-leaf-dark underline-offset-2 hover:underline">
          내 정보
        </Link>
        에서 바꿀 수 있어요.
      </p>

      {/* 최근 7일 방문자 (BLOG-06): 방문이 없는 날도 0으로 7칸, 마지막 칸은 오늘 */}
      <section className="card mt-6 p-6" aria-labelledby="visits-title">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="visits-title" className="font-display text-xl">방문자</h2>
          <p className="text-sm text-ink-soft">
            오늘 {visits.today.toLocaleString("ko-KR")} · 어제 {visits.yesterday.toLocaleString("ko-KR")} · 전체 {visits.total.toLocaleString("ko-KR")}
          </p>
        </div>
        <ol className="flex h-40 items-end gap-2" aria-label="최근 7일 방문자 수">
          {visitDays.map((d, i) => {
            const label = i === visitDays.length - 1 ? "오늘" : `${Number(d.date.slice(5, 7))}/${Number(d.date.slice(8))}`;
            return (
              <li key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1" aria-label={`${label} ${d.count}명`}>
                <span className="text-xs font-bold text-ink">{d.count.toLocaleString("ko-KR")}</span>
                <span
                  className={`w-full rounded-t-lg ${i === visitDays.length - 1 ? "bg-sun" : "bg-leaf/70"}`}
                  style={{ height: `${Math.max(4, Math.round((d.count / peak) * 100))}%` }}
                />
                <span className={`text-xs ${i === visitDays.length - 1 ? "font-bold text-ink" : "text-ink-soft"}`}>{label}</span>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-xs text-ink-soft">같은 사람은 하루 1번만 셉니다. 블로그 홈이나 글을 연 사람이 방문자이고, 내 방문은 세지 않아요.</p>
      </section>

      <section className="card mt-6 p-6">
        <h2 className="mb-4 font-display text-xl">기본 정보</h2>
        <BlogInfoForm title={blog.title} description={blog.description} />
        <p className="mt-3 text-sm text-ink-soft">블로그 주소: /@{blog.slug} (주소는 바꿀 수 없어요)</p>
      </section>

      <section className="card mt-6 p-6">
        <h2 className="mb-2 font-display text-xl">카테고리</h2>
        <CategoryManager categories={cats} />
      </section>
    </div>
  );
}
