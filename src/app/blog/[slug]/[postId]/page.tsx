import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentSection } from "@/components/blog/comment-section";
import { DeletePostButton } from "@/components/blog/delete-post-button";
import { LikeButton } from "@/components/blog/like-button";
import { RecordVisit } from "@/components/blog/record-visit";
import { CharacterBadge } from "@/components/character";
import { formatDateTime } from "@/lib/format";
import { REWARD_RULES } from "@/lib/game";
import { parseId } from "@/lib/ids";
import {
  getAdjacentPosts,
  getBlogBySlug,
  getComments,
  getLikeState,
  getPost,
  getPostTags,
  incrementViewCount,
} from "@/server/blog";
import { getViewer } from "@/server/dal";

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

  if (!isOwner) await incrementViewCount(post.id);

  const [tagNames, like, comments, adjacent] = await Promise.all([
    getPostTags(post.id),
    getLikeState(post.id, viewerId),
    getComments(post.id),
    getAdjacentPosts(blog.id, post, isOwner),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* 글 상세를 연 사람도 이 블로그 방문자로 센다 (주인 제외, BLOG-06) */}
      {!isOwner && <RecordVisit blogId={blog.id} />}
      {sp.new && (
        <div className="card mb-6 border-sun bg-[#fff3d6] p-4 text-center">
          🎉 글을 발행했어요!{" "}
          {sp.new === "reward" ? (
            <b>
              ✨ 경험치 {REWARD_RULES.post.exp} · 🪙 {REWARD_RULES.post.coins} 코인을 받았어요
            </b>
          ) : (
            <span className="text-ink-soft">(비공개 글, 짧은 글, 또는 오늘 글쓰기 보상 {REWARD_RULES.post.dailyLimit}번을 다 받아서 보상은 없어요)</span>
          )}
        </div>
      )}

      <Link href={`/@${blog.slug}`} className="mb-4 inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink">
        <CharacterBadge asset={blog.characterAsset} size={28} />
        <b className="text-ink">{blog.title}</b>
        <span>· {blog.nickname}</span>
      </Link>

      <article className="card p-6 sm:p-10">
        <header className="border-b-2 border-dashed border-line pb-5">
          <div className="mb-2 flex flex-wrap gap-2 text-xs font-bold">
            {post.categoryName && (
              <Link href={`/@${blog.slug}?category=${post.categoryId}`} className="rounded-full bg-[#fff3d6] px-2 py-0.5 text-sun-dark">
                {post.categoryName}
              </Link>
            )}
            {post.visibility === "private" && <span className="rounded-full bg-ink/10 px-2 py-0.5 text-ink-soft">🔒 비공개</span>}
          </div>
          <h1 className="font-display text-3xl leading-snug sm:text-4xl">{post.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
            <span>{formatDateTime(post.createdAt)}</span>
            <span>👀 {post.viewCount + (isOwner ? 0 : 1)}</span>
            {isOwner && (
              <span className="ml-auto flex gap-3">
                <Link href={`/write/${post.id}`} className="hover:text-ink">수정</Link>
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
                <Link href={`/tags/${encodeURIComponent(t)}`} className="rounded-full bg-cream px-3 py-1 text-sm text-ink-soft hover:text-ink">
                  #{t}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-10 flex justify-center">
          <LikeButton postId={post.id} count={like.count} liked={like.liked} canLike={Boolean(viewerId)} />
        </div>

        <CommentSection
          postId={post.id}
          viewerId={viewerId}
          comments={comments.map((c) => ({
            id: c.id,
            parentId: c.parentId,
            content: c.deletedAt ? "" : c.content,
            createdAtText: formatDateTime(c.createdAt),
            deleted: Boolean(c.deletedAt),
            authorId: c.authorId,
            nickname: c.nickname,
            characterAsset: c.characterAsset,
            blogSlug: c.blogSlug,
          }))}
        />
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
