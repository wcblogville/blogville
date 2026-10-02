import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { PostForm } from "@/components/editor/post-form";
import { requireMember } from "@/server/dal";

export const metadata = { title: "글쓰기" };

export default async function WritePage() {
  const viewer = await requireMember();
  const cats = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.blogId, viewer.profile.blogId))
    .orderBy(asc(categories.position), asc(categories.id));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PostForm
        categories={cats}
        initial={{ title: "", contentHtml: "", categoryId: null, tags: [], visibility: "public" }}
      />
    </div>
  );
}
