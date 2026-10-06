import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogHeader } from "@/components/blog/blog-header";
import { PostCard } from "@/components/blog/post-card";
import { Pagination, parsePage } from "@/components/pagination";
import { parseId } from "@/lib/ids";
import { getBlogBySlug, getBlogVisitStats, getCategories, isFollowing, listBlogPosts } from "@/server/blog";
import { getViewer } from "@/server/dal";

export async function generateMetadata(props: PageProps<"/blog/[slug]">) {
  const { slug } = await props.params;
  const blog = await getBlogBySlug(slug);
  return { title: blog ? blog.title : "블로그를 찾을 수 없어요" };
}

export default async function BlogHomePage(props: PageProps<"/blog/[slug]">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const blog = await getBlogBySlug(slug);
  if (!blog) notFound();

  const viewer = await getViewer();
  const viewerId = viewer?.profile ? viewer.userId : null;
  const isOwner = viewerId === blog.ownerId;
  const page = parsePage(sp.page);
  const categoryId = parseId(sp.category) ?? undefined; // 이상한 값이면 전체 글

  const [cats, list, following, visits] = await Promise.all([
    getCategories(blog.id, isOwner),
    listBlogPosts({ blogId: blog.id, isOwner, categoryId, page }),
    viewerId && !isOwner ? isFollowing(viewerId, blog.ownerId) : false,
    getBlogVisitStats(blog.id),
  ]);
  const currentCat = cats.find((c) => c.id === categoryId);
  const base = `/@${blog.slug}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <BlogHeader blog={blog} viewerId={viewerId} following={following} visits={visits} />

      <div className="mt-6 grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="md:sticky md:top-20 md:self-start">
          <nav className="card p-4" aria-label="카테고리">
            <h2 className="mb-2 font-display text-lg">카테고리</h2>
            <ul className="space-y-0.5 text-sm">
              <li>
                <Link href={base} className={`block rounded-lg px-2 py-1 ${!categoryId ? "bg-[#fff3d6] font-bold" : "hover:bg-cream"}`}>
                  전체 글 <span className="text-ink-soft">({blog.postCount})</span>
                </Link>
              </li>
              {cats.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`${base}?category=${c.id}`}
                    className={`block rounded-lg px-2 py-1 ${c.id === categoryId ? "bg-[#fff3d6] font-bold" : "hover:bg-cream"}`}
                  >
                    └ {c.name} <span className="text-ink-soft">({c.postCount})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <section>
          <h2 className="mb-3 font-display text-xl">
            {currentCat ? currentCat.name : "전체 글"} <span className="text-base text-ink-soft">{list.total}개</span>
          </h2>
          {list.items.length ? (
            <div className="grid gap-4">
              {list.items.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          ) : (
            <div className="card p-10 text-center text-ink-soft">
              <p className="text-4xl">🌱</p>
              <p className="mt-2">아직 글이 없어요.</p>
              {isOwner && (
                <Link href="/write" className="btn mt-4 bg-leaf text-white">
                  첫 글 쓰기
                </Link>
              )}
            </div>
          )}
          <Pagination
            page={list.page}
            pageCount={list.pageCount}
            hrefFor={(n) => `${base}?${new URLSearchParams({ ...(categoryId && { category: String(categoryId) }), page: String(n) })}`}
          />
        </section>
      </div>
    </div>
  );
}
