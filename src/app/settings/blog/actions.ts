"use server";

// 블로그 관리 Server Action (BLOG-03, BLOG-05 / contracts/blog-settings.md)
// 대상은 늘 로그인한 회원의 블로그다 (요청 값의 blogId·ownerId를 읽지 않는다, FR-021).
// 다른 사이트에서 보낸 요청은 Next.js Server Action의 Origin 확인이 막는다 (FR-060).
import { and, asc, eq, exists, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { blogs, categories, subcategories, userAnimals } from "@/db/schema";
import { BLOG_DESCRIPTION_MAX, BLOG_TITLE_MAX, charCount, SLUG_RE, swapPosition } from "@/lib/blog";
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

// ===== 카테고리 (BLOG-05 / FR-033~042, contracts/blog-settings.md 3·4절) =====

const CATEGORY_ERRORS = {
  empty: "카테고리 이름을 적어 주세요",
  long: "카테고리 이름은 20자까지예요",
  taken: "이미 있는 카테고리예요",
  bad: "잘못된 요청이에요",
} as const;

/** 카테고리 이름 규칙: 앞뒤 공백 제거 뒤 1~20자 (코드 포인트, FR-035). 대분류·소분류가 같다 */
function checkCategoryName(raw: unknown): { name: string } | { error: string } {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (charCount(name) === 0) return { error: CATEGORY_ERRORS.empty };
  if (charCount(name) > 20) return { error: CATEGORY_ERRORS.long };
  return { name };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * 내 블로그 행을 잠근다 (research R-12). 같은 블로그의 카테고리 추가·삭제·순서 바꾸기가 줄을 서서
 * position이 겹치거나 빈틈이 생기지 않는다 (FR-039). 다른 블로그와는 경쟁하지 않는다.
 */
async function lockBlog(tx: Tx, blogId: number) {
  await tx.select({ id: blogs.id }).from(blogs).where(eq(blogs.id, blogId)).for("update");
}

/** 순서를 0, 1, 2 ... 로 다시 매긴다 (바뀐 줄만 UPDATE) */
async function renumber(tx: Tx, table: typeof categories | typeof subcategories, rows: { id: number; position: number }[], current: Map<number, number>) {
  for (const r of rows) {
    if (current.get(r.id) !== r.position) await tx.update(table).set({ position: r.position }).where(eq(table.id, r.id));
  }
}

/** 방향 값은 -1, 1만 (FR-042) */
const isDirection = (d: unknown): d is -1 | 1 => d === -1 || d === 1;

/** 내 블로그의 대분류들 (position, id 순) */
function myCategories(tx: Tx, blogId: number) {
  return tx
    .select({ id: categories.id, position: categories.position })
    .from(categories)
    .where(eq(categories.blogId, blogId))
    .orderBy(asc(categories.position), asc(categories.id));
}

/** 한 대분류의 소분류들 (position, id 순) */
function siblingsOf(tx: Tx, categoryId: number) {
  return tx
    .select({ id: subcategories.id, position: subcategories.position })
    .from(subcategories)
    .where(eq(subcategories.categoryId, categoryId))
    .orderBy(asc(subcategories.position), asc(subcategories.id));
}

/** 맞바꾼 뒤 0부터 다시 매긴다 (순수 규칙 swapPosition) */
async function moveIn(tx: Tx, table: typeof categories | typeof subcategories, list: { id: number; position: number }[], id: number, direction: -1 | 1) {
  const next = swapPosition(
    list.map((r) => r.id),
    id,
    direction,
  );
  await renumber(tx, table, next, new Map(list.map((r) => [r.id, r.position])));
}

/** 대분류 추가: 맨 아래(MAX + 1). 오류면 보낸 이름을 칸에 남긴다 (US5-1·3·5) */
export async function addCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireMember();
  const sent = field(formData, "name");
  const name = checkCategoryName(sent);
  if ("error" in name) return { error: name.error, values: { name: sent } };
  const blogId = viewer.profile.blogId;
  try {
    await db.transaction(async (tx) => {
      await lockBlog(tx, blogId);
      await tx.insert(categories).values({
        blogId,
        name: name.name,
        position: sql`(SELECT COALESCE(MAX(${categories.position}), -1) + 1 FROM ${categories} WHERE ${categories.blogId} = ${blogId})`,
      });
    });
  } catch (err) {
    if (uniqueViolation(err) === "categories_blog_name_uq") return { error: CATEGORY_ERRORS.taken, values: { name: sent } };
    throw err;
  }
  revalidatePath("/", "layout");
  return { ok: Date.now() };
}

/** 대분류 이름 바꾸기. 다른 블로그의 ID·이상한 ID → `잘못된 요청이에요` (US5-10) */
export async function renameCategory(categoryId: number, name: string): Promise<FormState> {
  const viewer = await requireMember();
  const id = parseId(categoryId);
  if (id === null) return { error: CATEGORY_ERRORS.bad };
  const parsed = checkCategoryName(name);
  if ("error" in parsed) return parsed;
  try {
    const changed = await db
      .update(categories)
      .set({ name: parsed.name })
      .where(and(eq(categories.id, id), eq(categories.blogId, viewer.profile.blogId)))
      .returning({ id: categories.id });
    if (changed.length === 0) return { error: CATEGORY_ERRORS.bad };
  } catch (err) {
    if (uniqueViolation(err) === "categories_blog_name_uq") return { error: CATEGORY_ERRORS.taken };
    throw err;
  }
  revalidatePath("/", "layout");
  return { ok: Date.now() };
}

/**
 * 대분류 삭제 (FR-037, research R-11): 소분류는 CASCADE로 함께 지워지고, 글은 남아 "카테고리 없음"이 된다
 * (posts.category_id FK SET NULL). 남은 대분류는 0부터 다시 매긴다.
 */
export async function deleteCategory(categoryId: number) {
  const viewer = await requireMember();
  const id = parseId(categoryId);
  if (id === null) return;
  const blogId = viewer.profile.blogId;
  await db.transaction(async (tx) => {
    await lockBlog(tx, blogId);
    const list = await myCategories(tx, blogId);
    if (!list.some((c) => c.id === id)) return; // 내 블로그 대분류가 아니면 아무것도 안 함
    // TODO(post 단계 3, 003-post T041·T042): posts.subcategory_id가 생기면 여기서 그 대분류 글의 category_id·subcategory_id를
    // 함께 NULL로 비운다 (updatedAt: sql`updated_at`으로 수정 시각 유지). 지금은 FK SET NULL이 category_id만 비운다
    await tx.delete(categories).where(and(eq(categories.id, id), eq(categories.blogId, blogId)));
    const rest = list.filter((c) => c.id !== id);
    await renumber(
      tx,
      categories,
      rest.map((c, position) => ({ id: c.id, position })),
      new Map(rest.map((c) => [c.id, c.position])),
    );
  });
  revalidatePath("/", "layout");
}

/** 대분류 순서: 바로 위(-1)/아래(1)와 맞바꾼다. 끝이면 그대로 */
export async function moveCategory(categoryId: number, direction: -1 | 1) {
  const viewer = await requireMember();
  const id = parseId(categoryId);
  if (id === null || !isDirection(direction)) return;
  const blogId = viewer.profile.blogId;
  await db.transaction(async (tx) => {
    await lockBlog(tx, blogId);
    await moveIn(tx, categories, await myCategories(tx, blogId), id, direction);
  });
  revalidatePath("/", "layout");
}

/** 소분류가 내 블로그 대분류 소속이면 그 대분류 ID, 아니면 null */
async function ownerCategoryOf(tx: Tx, subcategoryId: number, blogId: number) {
  const [row] = await tx
    .select({ categoryId: subcategories.categoryId })
    .from(subcategories)
    .innerJoin(categories, eq(categories.id, subcategories.categoryId))
    .where(and(eq(subcategories.id, subcategoryId), eq(categories.blogId, blogId)));
  return row?.categoryId ?? null;
}

/** 내 블로그 대분류 ID들 (하위 쿼리) */
const myCategoryIds = (blogId: number) => db.select({ id: categories.id }).from(categories).where(eq(categories.blogId, blogId));

/**
 * 소분류 추가 (FR-034·036, contracts 4.1): 그 대분류 안 맨 끝. 이상한 ID·남의 대분류 → `{}` (문구 없음, FR-042).
 * `addSubcategory.bind(null, 대분류ID)`를 useActionState로 쓴다.
 */
export async function addSubcategory(categoryId: number, _prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireMember();
  const id = parseId(categoryId);
  if (id === null) return {};
  const sent = field(formData, "name");
  const name = checkCategoryName(sent);
  if ("error" in name) return { error: name.error, values: { name: sent } };
  const blogId = viewer.profile.blogId;
  let added = false;
  try {
    await db.transaction(async (tx) => {
      await lockBlog(tx, blogId);
      const [mine] = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.id, id), eq(categories.blogId, blogId)));
      if (!mine) return;
      await tx.insert(subcategories).values({
        categoryId: id,
        name: name.name,
        position: sql`(SELECT COALESCE(MAX(${subcategories.position}), -1) + 1 FROM ${subcategories} WHERE ${subcategories.categoryId} = ${id})`,
      });
      added = true;
    });
  } catch (err) {
    if (uniqueViolation(err) === "subcategories_category_name_uq") return { error: CATEGORY_ERRORS.taken, values: { name: sent } };
    throw err;
  }
  if (!added) return {};
  revalidatePath("/", "layout");
  return { ok: Date.now() };
}

/** 소분류 이름 바꾸기 (contracts 4.2). 내 블로그 소분류가 아니면 `잘못된 요청이에요` */
export async function renameSubcategory(subcategoryId: number, name: string): Promise<FormState> {
  const viewer = await requireMember();
  const id = parseId(subcategoryId);
  if (id === null) return { error: CATEGORY_ERRORS.bad };
  const parsed = checkCategoryName(name);
  if ("error" in parsed) return parsed;
  try {
    const changed = await db
      .update(subcategories)
      .set({ name: parsed.name })
      .where(and(eq(subcategories.id, id), inArray(subcategories.categoryId, myCategoryIds(viewer.profile.blogId))))
      .returning({ id: subcategories.id });
    if (changed.length === 0) return { error: CATEGORY_ERRORS.bad };
  } catch (err) {
    if (uniqueViolation(err) === "subcategories_category_name_uq") return { error: CATEGORY_ERRORS.taken };
    throw err;
  }
  revalidatePath("/", "layout");
  return { ok: Date.now() };
}

/**
 * 소분류 삭제 (FR-038, contracts 4.3): 그 글은 대분류에 남는다 (posts 복합 FK SET NULL (subcategory_id), post 단계 3).
 * 같은 대분류의 남은 소분류는 0부터 다시 매긴다.
 */
export async function deleteSubcategory(subcategoryId: number) {
  const viewer = await requireMember();
  const id = parseId(subcategoryId);
  if (id === null) return;
  const blogId = viewer.profile.blogId;
  await db.transaction(async (tx) => {
    await lockBlog(tx, blogId);
    const [gone] = await tx
      .delete(subcategories)
      .where(and(eq(subcategories.id, id), inArray(subcategories.categoryId, myCategoryIds(blogId))))
      .returning({ categoryId: subcategories.categoryId });
    if (!gone) return;
    const rest = await siblingsOf(tx, gone.categoryId);
    await renumber(
      tx,
      subcategories,
      rest.map((r, position) => ({ id: r.id, position })),
      new Map(rest.map((r) => [r.id, r.position])),
    );
  });
  revalidatePath("/", "layout");
}

/** 소분류 순서: 같은 대분류 안에서만 맞바꾼다 (US5-6) */
export async function moveSubcategory(subcategoryId: number, direction: -1 | 1) {
  const viewer = await requireMember();
  const id = parseId(subcategoryId);
  if (id === null || !isDirection(direction)) return;
  const blogId = viewer.profile.blogId;
  await db.transaction(async (tx) => {
    await lockBlog(tx, blogId);
    const categoryId = await ownerCategoryOf(tx, id, blogId);
    if (categoryId === null) return;
    await moveIn(tx, subcategories, await siblingsOf(tx, categoryId), id, direction);
  });
  revalidatePath("/", "layout");
}

// ===== 전시 동물 (BLOG-04 / FR-030·031, contracts/profile-showcase.md 2절, research R-19) =====

/**
 * 전시 동물 고르기·비우기. 값이 정확히 null이면 비우고, 그 밖의 값은 parseId를 거쳐 실패하면 아무것도 안 한다.
 * 고르기는 UPDATE 한 문장: 내 블로그이고 내 다 키운 동물일 때만. 복합 FK(blogs_showcase_owned_fk)가 "내 동물만"을 다시 확인한다.
 * 반환·문구 없음 (남의 동물·알·자라는 중·없는 ID → 바뀌지 않음, US4-9).
 */
export async function setShowcaseAnimal(animalId: number | null) {
  const viewer = await requireMember();
  if (animalId === null) {
    await db.update(blogs).set({ showcaseAnimalId: null }).where(eq(blogs.ownerId, viewer.userId));
  } else {
    const id = parseId(animalId);
    if (id === null) return;
    await db
      .update(blogs)
      .set({ showcaseAnimalId: id })
      .where(
        and(
          eq(blogs.ownerId, viewer.userId),
          exists(
            db
              .select({ x: sql`1` })
              .from(userAnimals)
              .where(and(eq(userAnimals.id, id), eq(userAnimals.userId, viewer.userId), eq(userAnimals.status, "grown"))),
          ),
        ),
      );
  }
  revalidatePath("/", "layout");
}
