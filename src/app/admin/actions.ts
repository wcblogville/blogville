"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { requireAdmin } from "@/server/dal";

/** 관리자: 어느 블로그의 글이든 삭제 */
export async function adminDeletePost(postId: number) {
  await requireAdmin();
  await db.delete(posts).where(eq(posts.id, postId));
  revalidatePath("/", "layout");
}
