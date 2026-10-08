import { notFound } from "next/navigation";
import { PostForm } from "@/components/editor/post-form";
import { parseId } from "@/lib/ids";
import { getPost, getPostTags } from "@/server/blog";
import { requireMember } from "@/server/dal";
import { getCategoryOptions } from "@/server/posts";

export const metadata = { title: "글 고치기" };

export default async function EditPostPage(props: PageProps<"/write/[postId]">) {
  const viewer = await requireMember();
  const { postId } = await props.params;
  const id = parseId(postId);
  if (id === null) notFound();

  // 내 블로그의 글만 고칠 수 있다 (FR-017)
  const post = await getPost(viewer.profile.blogId, id);
  if (!post) notFound();

  const [categories, tagNames] = await Promise.all([getCategoryOptions(viewer.profile.blogId), getPostTags(post.id)]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* 수정 화면에는 임시 저장이 없다 (FR-064). 지워진 대분류·소분류는 비어 있다 (FR-031) */}
      <PostForm
        categories={categories}
        initial={{
          postId: post.id,
          title: post.title,
          contentHtml: post.contentHtml,
          categoryId: post.categoryId,
          subcategoryId: post.subcategoryId,
          tags: tagNames,
          visibility: post.visibility,
        }}
      />
    </div>
  );
}
