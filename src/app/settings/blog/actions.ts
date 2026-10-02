"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { blogs, categories } from "@/db/schema";
import { requireMember } from "@/server/dal";
import { uniqueViolation } from "@/server/db-errors";

export type FormState = { error?: string; ok?: number };

const infoSchema = z.object({
  title: z.string().trim().min(1, "블로그 이름을 적어 주세요").max(40, "블로그 이름은 40자까지예요"),
  description: z.string().trim().max(160, "소개는 160자까지예요"),
});

export async function updateBlogInfo(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireMember();
  const parsed = infoSchema.safeParse({ title: formData.get("title") ?? "", description: formData.get("description") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.update(blogs).set(parsed.data).where(eq(blogs.ownerId, viewer.userId));
  revalidatePath("/", "layout");
  return { ok: Date.now() };
}

const nameSchema = z.string().trim().min(1, "카테고리 이름을 적어 주세요").max(20, "카테고리 이름은 20자까지예요");

export async function addCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireMember();
  const name = nameSchema.safeParse(formData.get("name") ?? "");
  if (!name.success) return { error: name.error.issues[0].message };
  try {
    await db.insert(categories).values({
      blogId: viewer.profile.blogId,
      name: name.data,
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
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await db
      .update(categories)
      .set({ name: parsed.data })
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
  await db.delete(categories).where(and(eq(categories.id, categoryId), eq(categories.blogId, viewer.profile.blogId)));
  revalidatePath("/", "layout");
}

/** 바로 위/아래 카테고리와 순서를 바꾼다 */
export async function moveCategory(categoryId: number, direction: -1 | 1) {
  const viewer = await requireMember();
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
