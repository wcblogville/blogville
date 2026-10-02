"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { blogs, categories, items, profiles, userItems } from "@/db/schema";
import { requireUser } from "@/server/dal";
import { uniqueViolation } from "@/server/db-errors";
import { grantReward, lockUser } from "@/server/points";

const schema = z.object({
  nickname: z.string().trim().min(2, "닉네임은 2자 이상이에요").max(12, "닉네임은 12자까지예요"),
  blogTitle: z.string().trim().min(1, "블로그 이름을 적어 주세요").max(40, "블로그 이름은 40자까지예요"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/, "주소는 영문 소문자, 숫자, _ 로 3~20자예요"),
  characterId: z.coerce.number().int().positive("캐릭터를 골라 주세요"),
});

export type OnboardingState = {
  errors?: Partial<Record<keyof z.infer<typeof schema>, string>>;
  message?: string;
  values?: Record<string, string>;
};

const RESERVED_SLUGS = new Set(["admin", "api", "town", "feed", "shop", "closet", "write", "settings", "blog", "onboarding"]);

export async function completeOnboarding(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const viewer = await requireUser();
  if (viewer.profile) redirect("/town");

  const raw = Object.fromEntries(["nickname", "blogTitle", "slug", "characterId"].map((k) => [k, String(formData.get(k) ?? "")]));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const errors: OnboardingState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof z.infer<typeof schema>;
      errors[key] ??= issue.message;
    }
    return { errors, values: raw };
  }
  const input = parsed.data;
  if (RESERVED_SLUGS.has(input.slug)) {
    return { errors: { slug: "이 주소는 쓸 수 없어요" }, values: raw };
  }

  try {
    await db.transaction(async (tx) => {
      await lockUser(tx, viewer.userId);

      // 고른 캐릭터가 정말 "기본 캐릭터"인지 서버에서 다시 확인
      const [character] = await tx
        .select({ id: items.id })
        .from(items)
        .where(and(eq(items.id, input.characterId), eq(items.type, "character"), eq(items.isStarter, true)));
      if (!character) throw new Error("INVALID_CHARACTER");

      const [background] = await tx.select({ id: items.id }).from(items).where(eq(items.code, "bg_meadow"));

      await tx.insert(userItems).values([
        { userId: viewer.userId, itemId: character.id },
        { userId: viewer.userId, itemId: background.id },
      ]);
      await tx.insert(profiles).values({
        userId: viewer.userId,
        nickname: input.nickname,
        characterItemId: character.id,
      });
      const [blog] = await tx
        .insert(blogs)
        .values({
          ownerId: viewer.userId,
          slug: input.slug,
          title: input.blogTitle,
          backgroundItemId: background.id,
        })
        .returning({ id: blogs.id });
      await tx.insert(categories).values({ blogId: blog.id, name: "일상", position: 0 });
      await grantReward(tx, viewer.userId, "signup");
    });
  } catch (err) {
    const constraint = uniqueViolation(err);
    if (constraint?.includes("nickname")) return { errors: { nickname: "이미 있는 닉네임이에요" }, values: raw };
    if (constraint?.includes("slug")) return { errors: { slug: "이미 있는 주소예요" }, values: raw };
    if (err instanceof Error && err.message === "INVALID_CHARACTER") {
      return { errors: { characterId: "고를 수 없는 캐릭터예요" }, values: raw };
    }
    throw err;
  }

  revalidatePath("/", "layout"); // 헤더에 코인·캐릭터가 바로 보이도록
  redirect("/town?welcome=1");
}
