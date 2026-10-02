import Link from "next/link";
import { getBlogByOwner, getCategories } from "@/server/blog";
import { requireMember } from "@/server/dal";
import { BlogInfoForm, CategoryManager } from "./settings-forms";

export const metadata = { title: "블로그 관리" };

export default async function BlogSettingsPage() {
  const viewer = await requireMember();
  const blog = await getBlogByOwner(viewer.userId);
  if (!blog) return null;
  const cats = await getCategories(blog.id, true);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-end justify-between">
        <h1 className="font-display text-3xl">⚙️ 블로그 관리</h1>
        <Link href={`/@${blog.slug}`} className="text-sm text-ink-soft hover:text-ink">내 블로그로 →</Link>
      </div>

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
