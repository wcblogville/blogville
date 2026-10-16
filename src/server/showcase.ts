import "server-only";
import { and, eq, exists, sql } from "drizzle-orm";
import { db } from "@/db";
import { blogs, userAnimals } from "@/db/schema";

/**
 * 전시 동물(= 우리 집 방과 광장에서 나를 따라다니는 동물) 바꾸기. animalId가 null이면 빼기.
 * 내 다 자란 동물만 고를 수 있다. 바뀌었으면 true (블로그 도감 창·농장 카드가 같이 쓴다, 2026-10-16)
 */
export async function updateShowcase(userId: string, animalId: number | null): Promise<boolean> {
  if (animalId === null) {
    await db.update(blogs).set({ showcaseAnimalId: null }).where(eq(blogs.ownerId, userId));
    return true;
  }
  const rows = await db
    .update(blogs)
    .set({ showcaseAnimalId: animalId })
    .where(
      and(
        eq(blogs.ownerId, userId),
        exists(
          db
            .select({ x: sql`1` })
            .from(userAnimals)
            .where(and(eq(userAnimals.id, animalId), eq(userAnimals.userId, userId), eq(userAnimals.status, "grown"))),
        ),
      ),
    )
    .returning({ id: blogs.id });
  return rows.length > 0;
}

/** 지금 전시 동물 ID (없으면 null) */
export async function getShowcaseId(userId: string): Promise<number | null> {
  const [row] = await db.select({ id: blogs.showcaseAnimalId }).from(blogs).where(eq(blogs.ownerId, userId));
  return row?.id ?? null;
}
