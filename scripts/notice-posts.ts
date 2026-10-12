// 코드에 적어 둔 관리자 글을 공지사항 블로그에 넣는다 (사용자 요청 2026-10-12, SOC-05):
// ① 첫 공지 "사용법 안내"(src/lib/welcome-notice.ts, "공지" 분류) ② 릴리스 노트(src/content/release-notes.ts, "릴리스 노트" 분류, 버전마다 한 글)
// ③ 기술 소개 공지(src/content/tech-notice.ts, "공지" 분류, 맨 위 고정 공지는 그대로 두고 그 바로 아래).
// db:seed와 admin:create가 같이 부른다: 배포 순서가 표 → 시드 → 관리자라서 첫 배포에는 시드 때 관리자가 없고, 그때는 admin:create가 넣는다.
// 표시 태그(첫 공지 = WELCOME_NOTICE_TAG, 릴리스 노트 = 버전, 기술 소개 = TECH_NOTICE_TAG)가 붙은 관리자 글이 이미 있으면 그 글은 건너뛴다
// (관리자가 고친 글을 덮어쓰지 않는다). 글 쓰기 보상은 없다 (원장에 쓰지 않는다)
import { and, asc, desc, eq, max } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { blogs, categories, posts, postTags, tags, users } from "../src/db/schema";
import { TECH_NOTICE_HTML, TECH_NOTICE_TAG, TECH_NOTICE_TEXT, TECH_NOTICE_TITLE } from "../src/content/tech-notice";
import { RELEASE_NOTES, releaseNoteHtml, releaseNoteText, releaseNoteTitle } from "../src/content/release-notes";
import {
  NOTICE_CATEGORY,
  RELEASE_CATEGORY,
  WELCOME_NOTICE_HTML,
  WELCOME_NOTICE_TAG,
  WELCOME_NOTICE_TEXT,
  WELCOME_NOTICE_TITLE,
} from "../src/lib/welcome-notice";

type Tx = Parameters<Parameters<NodePgDatabase["transaction"]>[0]>[0];

export type NoticePostsResult = { admin: boolean; welcome: boolean; tech: boolean; releases: string[] };

/** 이 블로그에 tagName 태그가 붙은 글이 있는가 */
async function hasTagged(tx: Tx, blogId: number, tagName: string) {
  const [row] = await tx
    .select({ id: posts.id })
    .from(posts)
    .innerJoin(postTags, eq(postTags.postId, posts.id))
    .innerJoin(tags, eq(tags.id, postTags.tagId))
    .where(and(eq(posts.blogId, blogId), eq(tags.name, tagName)))
    .limit(1);
  return Boolean(row);
}

/** 분류 id. 없으면 맨 뒤에 만든다 (create는 릴리스 노트만: 공지 분류는 admin:create가 만든다) */
async function categoryId(tx: Tx, blogId: number, name: string, create: boolean) {
  const [found] = await tx.select({ id: categories.id }).from(categories).where(and(eq(categories.blogId, blogId), eq(categories.name, name)));
  if (found || !create) return found?.id ?? null;
  const [{ last }] = await tx.select({ last: max(categories.position) }).from(categories).where(eq(categories.blogId, blogId));
  const [made] = await tx
    .insert(categories)
    .values({ blogId, name, position: (last ?? -1) + 1 })
    .returning({ id: categories.id });
  return made.id;
}

async function insertPost(
  tx: Tx,
  v: { blogId: number; categoryId: number | null; title: string; html: string; text: string; tag: string; createdAt?: Date },
) {
  const [post] = await tx
    .insert(posts)
    .values({
      blogId: v.blogId,
      categoryId: v.categoryId,
      title: v.title,
      contentHtml: v.html,
      contentText: v.text,
      visibility: "public",
      ...(v.createdAt ? { createdAt: v.createdAt, updatedAt: v.createdAt } : {}),
    })
    .returning({ id: posts.id });
  // 태그 이름은 UNIQUE: 있으면 그 행을 쓴다 (savePost와 같은 방식)
  await tx.insert(tags).values({ name: v.tag }).onConflictDoNothing();
  const [tag] = await tx.select({ id: tags.id }).from(tags).where(eq(tags.name, v.tag));
  await tx.insert(postTags).values({ postId: post.id, tagId: tag.id });
}

/** 관리자(adminUsername, 없으면 가장 먼저 만든 관리자)의 공지 블로그에 없는 글만 넣는다 */
export async function ensureNoticePosts(db: NodePgDatabase, adminUsername?: string): Promise<NoticePostsResult> {
  return db.transaction(async (tx) => {
    const [blog] = await tx
      .select({ id: blogs.id })
      .from(blogs)
      .innerJoin(users, eq(users.id, blogs.ownerId))
      .where(and(eq(users.role, "admin"), adminUsername ? eq(users.username, adminUsername) : undefined))
      .orderBy(asc(users.createdAt))
      .limit(1)
      // 시드와 관리자 만들기가 겹쳐 돌아도 한 번만 넣게 블로그 행을 잠근다
      .for("update", { of: blogs });
    const result: NoticePostsResult = { admin: Boolean(blog), welcome: false, tech: false, releases: [] };
    if (!blog) return result;

    // 릴리스 노트: 오래된 버전부터 넣어 같은 날짜여도 순서가 맞게 한다. 작성 시각 = 그 날짜 한국 정오(지났으면)
    for (const note of RELEASE_NOTES) {
      if (await hasTagged(tx, blog.id, note.version)) continue;
      await insertPost(tx, {
        blogId: blog.id,
        categoryId: await categoryId(tx, blog.id, RELEASE_CATEGORY, true),
        title: releaseNoteTitle(note),
        html: releaseNoteHtml(note),
        text: releaseNoteText(note),
        tag: note.version,
        // 오늘 배포한 버전은 지금 시각 (작성 시각이 미래가 되지 않게)
        createdAt: new Date(Math.min(Date.parse(`${note.date}T12:00:00+09:00`), Date.now())),
      });
      result.releases.push(note.version);
    }

    // 첫 공지는 릴리스 노트보다 나중에 넣어 같은 날짜의 공지 중 맨 위가 되게 한다
    if (!(await hasTagged(tx, blog.id, WELCOME_NOTICE_TAG))) {
      await insertPost(tx, {
        blogId: blog.id,
        categoryId: await categoryId(tx, blog.id, NOTICE_CATEGORY, false),
        title: WELCOME_NOTICE_TITLE,
        html: WELCOME_NOTICE_HTML,
        text: WELCOME_NOTICE_TEXT,
        tag: WELCOME_NOTICE_TAG,
      });
      result.welcome = true;
    }

    // 기술 소개 공지: 마을 소식 맨 위 카드는 "공지" 분류의 가장 최근 공개 글 하나(getPinnedNotice)라서,
    // 지금 걸린 공지(보통 사용법 안내)보다 1분 앞 시각으로 넣어 그 카드를 밀어내지 않는다 (공지 분류 목록에서는 그 바로 아래)
    if (!(await hasTagged(tx, blog.id, TECH_NOTICE_TAG))) {
      const noticeCategoryId = await categoryId(tx, blog.id, NOTICE_CATEGORY, false);
      const [pinned] = noticeCategoryId
        ? await tx
            .select({ createdAt: posts.createdAt })
            .from(posts)
            .where(and(eq(posts.blogId, blog.id), eq(posts.categoryId, noticeCategoryId), eq(posts.visibility, "public")))
            .orderBy(desc(posts.createdAt), desc(posts.id))
            .limit(1)
        : [];
      await insertPost(tx, {
        blogId: blog.id,
        categoryId: noticeCategoryId,
        title: TECH_NOTICE_TITLE,
        html: TECH_NOTICE_HTML,
        text: TECH_NOTICE_TEXT,
        tag: TECH_NOTICE_TAG,
        createdAt: pinned ? new Date(pinned.createdAt.getTime() - 60_000) : undefined,
      });
      result.tech = true;
    }
    return result;
  });
}

export function noticePostsMessage(r: NoticePostsResult): string {
  if (!r.admin) return "· 관리자 계정이 아직 없어 공지·릴리스 노트는 admin:create 때 넣어요";
  const added = [r.welcome && "사용법 안내 공지", r.tech && "기술 소개 공지", r.releases.length > 0 && `릴리스 노트 ${r.releases.join(", ")}`].filter(Boolean);
  return added.length ? `✔ 공지사항 블로그에 넣었어요: ${added.join(", ")}` : "✔ 공지·릴리스 노트는 모두 이미 있어요 (건너뜀)";
}
