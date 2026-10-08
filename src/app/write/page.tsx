import { PostForm } from "@/components/editor/post-form";
import { requireMember } from "@/server/dal";
import { getCategoryOptions } from "@/server/posts";

export const metadata = { title: "글쓰기" };

export default async function WritePage() {
  const viewer = await requireMember();
  const categories = await getCategoryOptions(viewer.profile.blogId);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* 새 글 화면만 임시 저장한다 (POST-08 / FR-060, FR-064) */}
      <PostForm
        categories={categories}
        initial={{ title: "", contentHtml: "", categoryId: null, subcategoryId: null, tags: [], visibility: "public" }}
        draftOwnerId={viewer.userId}
      />
    </div>
  );
}
