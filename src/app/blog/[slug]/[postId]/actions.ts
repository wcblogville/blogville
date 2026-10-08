"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { blogs, posts } from "@/db/schema";
import { parseId } from "@/lib/ids";
import { getViewer } from "@/server/dal";
import { recordView } from "@/server/posts";
import { ensureVisitorId } from "@/server/visitor";

/**
 * 글 조회 기록 (POST-06 / FR-046, contracts/post-pages.md §2). 글 상세가 브라우저에 열리면 한 번 부른다.
 * 방문자도 불러야 해서 로그인이 필요 없다 (recordBlogVisit과 같음). 주인·비공개 글·없는 글은 세지 않는다.
 * 쿠키를 새로 만들 수 있어야 해서 서버 컴포넌트가 아니라 Server Action에서 센다. IP·회원 ID는 저장하지 않는다
 */
export async function recordPostView(postId: number): Promise<{ viewCount: number } | null> {
  const id = parseId(postId);
  if (id === null) return null;
  const [post] = await db
    .select({ visibility: posts.visibility, viewCount: posts.viewCount, ownerId: blogs.ownerId })
    .from(posts)
    .innerJoin(blogs, eq(blogs.id, posts.blogId))
    .where(eq(posts.id, id));
  if (!post || post.visibility === "private") return null;

  const viewer = await getViewer();
  if (viewer?.profile && viewer.userId === post.ownerId) return { viewCount: post.viewCount };

  return { viewCount: await recordView(id, await ensureVisitorId()) };
}
