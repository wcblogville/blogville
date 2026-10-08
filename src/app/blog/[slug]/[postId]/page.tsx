import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentSection } from "@/components/blog/comment-section";
import { DeletePostButton } from "@/components/blog/delete-post-button";
import { LikeButton } from "@/components/blog/like-button";
import { PublishNotice } from "@/components/blog/publish-notice";
import { RecordVisit } from "@/components/blog/record-visit";
import { ViewCount } from "@/components/blog/view-count";
import { CharacterBadge } from "@/components/character";
import { formatDateTime } from "@/lib/format";
import { parseId } from "@/lib/ids";
import {
  getAdjacentPosts,
  getBlogBySlug,
  getLikeState,
  getPost,
  getPostTags,
} from "@/server/blog";
import { getViewer } from "@/server/dal";
import { getPublishNotice, hasViewedToday } from "@/server/posts";
import { getCommentThread } from "@/server/social";
import { readVisitorId } from "@/server/visitor";

async function load(props: PageProps<"/blog/[slug]/[postId]">) {
  const { slug, postId } = await props.params;
  const id = parseId(postId);
  if (id === null) return null;
  const blog = await getBlogBySlug(slug);
  if (!blog) return null;
  const post = await getPost(blog.id, id);
  if (!post) return null;
  return { blog, post };
}

export async function generateMetadata(props: PageProps<"/blog/[slug]/[postId]">) {
  const data = await load(props);
  if (!data || data.post.visibility === "private") return { title: "글" };
  return { title: data.post.title, description: data.post.contentText.slice(0, 120) };
}

export default async function PostPage(props: PageProps<"/blog/[slug]/[postId]">) {
  const data = await load(props);
  if (!data) notFound();
  const { blog, post } = data;
  const sp = await props.searchParams;

  const viewer = await getViewer();
  const viewerId = viewer?.profile ? viewer.userId : null;
  const isOwner = viewerId === blog.ownerId;
  if (post.visibility === "private" && !isOwner) notFound();

  // 서버 렌더는 조회수를 바꾸지 않는다. 오늘 이 브라우저로 처음 여는 것이면 +1을 미리 보여 주고, 기록은 ViewCount가 한다 (FR-046, R2)
  const [tagNames, like, thread, adjacent, viewed, notice] = await Promise.all([
    getPostTags(post.id),
    getLikeState(post.id, viewerId),
    getCommentThread(post.id, viewerId && viewer ? { userId: viewerId, isAdmin: viewer.user.role === "admin" } : null),
    getAdjacentPosts(blog.id, post, isOwner),
    isOwner ? true : readVisitorId().then((v) => hasViewedToday(post.id, v)),
    // 발행 안내는 ?new가 있을 때만, 주인에게만 (FR-013, R13)
    sp.new !== undefined ? getPublishNotice(viewerId, { id: post.id, ownerId: blog.ownerId, createdAt: post.createdAt }) : null,
  ]);
  const categoryHref = post.subcategoryId
    ? `/@${blog.slug}?category=${post.categoryId}&sub=${post.subcategoryId}`
    : `/@${blog.slug}?category=${post.categoryId}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* 글 상세를 연 사람도 이 블로그 방문자로 센다 (주인 제외, BLOG-06) */}
      {!isOwner && <RecordVisit blogId={blog.id} />}
      {notice && viewerId && <PublishNotice kind={notice} userId={viewerId} />}

      <Link href={`/@${blog.slug}`} className="mb-4 inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink">
        <CharacterBadge asset={blog.characterAsset} size={28} />
        <b className="text-ink">{blog.title}</b>
        <span>· {blog.nickname}</span>
      </Link>

      <article className="card p-6 sm:p-10">
        <header className="border-b-2 border-dashed border-line pb-5">
          <div className="mb-2 flex flex-wrap gap-2 text-xs font-bold">
            {/* 배지 `대분류 › 소분류`, 누르면 그 카테고리 글 목록 (FR-033, R16). 누르는 영역 44px (R21) */}
            {post.categoryName && (
              <Link href={categoryHref} className="inline-flex min-h-11 items-center">
                <span className="rounded-full bg-[#fff3d6] px-2 py-0.5 text-sun-dark">
                  {post.categoryName}
                  {post.subcategoryName && ` › ${post.subcategoryName}`}
                </span>
              </Link>
            )}
            {post.visibility === "private" && (
              <span className="inline-flex min-h-11 items-center">
                <span className="rounded-full bg-ink/10 px-2 py-0.5 text-ink-soft">🔒 비공개</span>
              </span>
            )}
          </div>
          <h1 className="font-display text-3xl leading-snug sm:text-4xl">{post.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
            <span>{formatDateTime(post.createdAt)}</span>
            <ViewCount postId={post.id} initial={post.viewCount + (viewed ? 0 : 1)} count={!isOwner} />
            {isOwner && (
              <span className="ml-auto flex gap-1">
                <Link href={`/write/${post.id}`} className="inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap hover:text-ink">
                  수정
                </Link>
                <DeletePostButton postId={post.id} />
              </span>
            )}
          </div>
        </header>

        {/* 저장할 때 sanitize-html로 정화한 HTML만 넣는다 */}
        <div className="prose-blog mt-6" dangerouslySetInnerHTML={{ __html: post.contentHtml }} />

        {tagNames.length > 0 && (
          <ul className="mt-8 flex flex-wrap gap-2">
            {tagNames.map((t) => (
              <li key={t}>
                <Link
                  href={`/tags/${encodeURIComponent(t)}`}
                  className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-cream px-3 text-sm text-ink-soft hover:text-ink"
                >
                  #{t}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-10 flex justify-center">
          <LikeButton postId={post.id} count={like.count} liked={like.liked} canLike={Boolean(viewerId)} />
        </div>

        <CommentSection postId={post.id} thread={thread} isMember={Boolean(viewerId)} />
      </article>

      <nav className="mt-6 grid gap-3 sm:grid-cols-2" aria-label="이전 글, 다음 글">
        {adjacent.prev ? (
          <Link href={`/@${blog.slug}/${adjacent.prev.id}`} className="card p-4 hover:-translate-y-0.5">
            <span className="text-xs text-ink-soft">← 이전 글</span>
            <span className="block truncate font-bold">{adjacent.prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {adjacent.next && (
          <Link href={`/@${blog.slug}/${adjacent.next.id}`} className="card p-4 text-right hover:-translate-y-0.5">
            <span className="text-xs text-ink-soft">다음 글 →</span>
            <span className="block truncate font-bold">{adjacent.next.title}</span>
          </Link>
        )}
      </nav>
    </div>
  );
}
