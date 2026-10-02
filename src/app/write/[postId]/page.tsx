import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { PostForm } from "@/components/editor/post-form";
import { parseId } from "@/lib/ids";
import { getPost, getPostTags } from "@/server/blog";
import { requireMember } from "@/server/dal";

export const metadata = { title: "글 고치기" };

export default async function EditPostPage(props: PageProps<"/write/[postId]">) {
  const viewer = await requireMember();
  const { postId } = await props.params;
  const id = parseId(postId);
  if (id === null) notFound();

  // 내 블로그의 글만 고칠 수 있다
  const post = await getPost(viewer.profile.blogId, id);
  if (!post) notFound();

  const [cats, tagNames] = await Promise.all([
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.blogId, viewer.profile.blogId))
      .orderBy(asc(categories.position), asc(categories.id)),
    getPostTags(post.id),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PostForm
        categories={cats}
        initial={{
          postId: post.id,
          title: post.title,
          contentHtml: post.contentHtml,
          categoryId: post.categoryId,
          tags: tagNames,
          visibility: post.visibility,
        }}
      />
    </div>
  );
}
