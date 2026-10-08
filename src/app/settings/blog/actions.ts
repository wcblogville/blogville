"use server";

// 블로그 관리 Server Action (BLOG-03, BLOG-05 / contracts/blog-settings.md)
// 대상은 늘 로그인한 회원의 블로그다 (요청 값의 blogId·ownerId를 읽지 않는다, FR-021).
// 다른 사이트에서 보낸 요청은 Next.js Server Action의 Origin 확인이 막는다 (FR-060).
import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { blogs, categories } from "@/db/schema";
import { BLOG_DESCRIPTION_MAX, BLOG_TITLE_MAX, charCount, SLUG_RE } from "@/lib/blog";
import { parseId } from "@/lib/ids";
import { isReservedName, normalizeName } from "@/lib/names";
import { requireMember } from "@/server/dal";
import { uniqueViolation } from "@/server/db-errors";
import { findNameConflict, lockName } from "@/server/names";

/**
 * 폼 결과 (contracts/blog-settings.md 0절, research R-08).
 * error: 첫 번째 오류 하나, ok: 성공 시각(같은 값으로 다시 성공해도 문구가 다시 뜨게),
 * values: 오류일 때 보낸 값(칸에 남긴다) 또는 성공일 때 서버가 정규화한 값.
 */
export type FormState = { error?: string; ok?: number; values?: Record<string, string> };

/** 폼 칸 값 (파일·없음은 빈 문자열) */
function field(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

const INFO_ERRORS = {
  titleEmpty: "블로그 이름을 적어 주세요",
  titleLong: "블로그 이름은 40자까지예요",
  descriptionLong: "소개는 160자까지예요",
} as const;

/**
 * 블로그 이름·소개 (BLOG-03 / FR-016, FR-017, FR-021, contracts/blog-settings.md 1절).
 * title·description만 읽는다. 길이는 앞뒤 공백을 지운 뒤 코드 포인트로 세고, 오류는 이름 → 소개 순으로 첫 번째 하나만.
 */
export async function updateBlogInfo(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireMember();
  const sent = { title: field(formData, "title"), description: field(formData, "description") };
  const title = sent.title.trim();
  const description = sent.description.trim();
  const error =
    charCount(title) === 0
      ? INFO_ERRORS.titleEmpty
      : charCount(title) > BLOG_TITLE_MAX
        ? INFO_ERRORS.titleLong
        : charCount(description) > BLOG_DESCRIPTION_MAX
          ? INFO_ERRORS.descriptionLong
          : null;
  if (error) return { error, values: sent };

  await db.update(blogs).set({ title, description }).where(eq(blogs.ownerId, viewer.userId));
  revalidatePath("/", "layout");
  return { ok: Date.now() };
}

const SLUG_ERRORS = {
  format: "주소는 영문 소문자, 숫자, _ 로 3~20자예요",
  reserved: "이 주소는 쓸 수 없어요",
  taken: "이미 있는 주소예요",
} as const;

/** 트랜잭션 안에서 "거부"로 끝낼 때 던진다 (롤백 + 문구) */
class Rejected extends Error {}

/**
 * 블로그 주소 바꾸기 (BLOG-03 / FR-009, FR-010, FR-018, FR-021, contracts/blog-settings.md 2절, research R-03~R-06).
 * 정규화(앞뒤 공백 제거·소문자) → 형식 → 지금 주소와 같으면 저장 없이 성공 → 예약어(notice는 관리자만, R-05)
 * → 이름 잠금 → 다른 회원의 아이디·주소와 같은지 → UPDATE. 보호 기간·횟수 제한·예전 주소 자동 이동은 없다 (D3).
 */
export async function updateBlogSlug(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireMember();
  const sent = field(formData, "slug");
  const slug = normalizeName(sent);
  const fail = (error: string): FormState => ({ error, values: { slug: sent } });

  if (!SLUG_RE.test(slug)) return fail(SLUG_ERRORS.format);
  if (slug === viewer.profile.blogSlug) return { ok: Date.now(), values: { slug } };
  if (isReservedName(slug) && !(slug === "notice" && viewer.user.role === "admin")) return fail(SLUG_ERRORS.reserved);

  try {
    await db.transaction(async (tx) => {
      // 같은 이름의 가입·주소/닉네임 변경과 줄을 세운 뒤 확인한다 (research R-04)
      await lockName(tx, slug);
      const conflict = await findNameConflict(tx, slug, { exceptUserId: viewer.userId });
      // 닉네임과 같은 주소는 막지 않는다 (spec에 없는 규칙, research R-03)
      if (conflict.username || conflict.slug) throw new Rejected(SLUG_ERRORS.taken);
      await tx.update(blogs).set({ slug }).where(eq(blogs.ownerId, viewer.userId));
    });
  } catch (err) {
    if (err instanceof Rejected) return fail(err.message);
    if (uniqueViolation(err) === "blogs_slug_unique") return fail(SLUG_ERRORS.taken);
    throw err;
  }
  revalidatePath("/", "layout");
  return { ok: Date.now(), values: { slug } };
}

/** 카테고리 이름 규칙: 앞뒤 공백 제거 뒤 1~20자 (코드 포인트, FR-033) */
function checkCategoryName(raw: unknown): { name: string } | { error: string } {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (charCount(name) === 0) return { error: "카테고리 이름을 적어 주세요" };
  if (charCount(name) > 20) return { error: "카테고리 이름은 20자까지예요" };
  return { name };
}

export async function addCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireMember();
  const name = checkCategoryName(formData.get("name"));
  if ("error" in name) return name;
  try {
    await db.insert(categories).values({
      blogId: viewer.profile.blogId,
      name: name.name,
      position: sql`(SELECT COALESCE(MAX(${categories.position}), -1) + 1 FROM ${categories} WHERE ${categories.blogId} = ${viewer.profile.blogId})`,
    });
  } catch (err) {
    if (uniqueViolation(err) !== null) return { error: "이미 있는 카테고리예요" };
    throw err;
  }
  revalidatePath("/", "layout");
  return { ok: Date.now() };
}

export async function renameCategory(categoryId: number, name: string): Promise<FormState> {
  const viewer = await requireMember();
  if (parseId(categoryId) === null) return { error: "잘못된 요청이에요" };
  const parsed = checkCategoryName(name);
  if ("error" in parsed) return parsed;
  try {
    await db
      .update(categories)
      .set({ name: parsed.name })
      .where(and(eq(categories.id, categoryId), eq(categories.blogId, viewer.profile.blogId)));
  } catch (err) {
    if (uniqueViolation(err) !== null) return { error: "이미 있는 카테고리예요" };
    throw err;
  }
  revalidatePath("/", "layout");
  return { ok: Date.now() };
}

/** 글은 남기고 카테고리만 지운다 (posts.category_id → NULL) */
export async function deleteCategory(categoryId: number) {
  const viewer = await requireMember();
  if (parseId(categoryId) === null) return;
  await db.delete(categories).where(and(eq(categories.id, categoryId), eq(categories.blogId, viewer.profile.blogId)));
  revalidatePath("/", "layout");
}

/** 바로 위/아래 카테고리와 순서를 바꾼다 */
export async function moveCategory(categoryId: number, direction: -1 | 1) {
  const viewer = await requireMember();
  if (parseId(categoryId) === null || (direction !== -1 && direction !== 1)) return;
  await db.transaction(async (tx) => {
    const list = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.blogId, viewer.profile.blogId))
      .orderBy(asc(categories.position), asc(categories.id));
    const i = list.findIndex((c) => c.id === categoryId);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    // 순서를 0, 1, 2 ... 로 다시 매긴다
    for (const [position, c] of list.entries()) {
      await tx.update(categories).set({ position }).where(eq(categories.id, c.id));
    }
  });
  revalidatePath("/", "layout");
}
