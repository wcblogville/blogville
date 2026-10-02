// 관리자 계정을 만들거나 비밀번호·권한을 갱신한다. 여러 번 실행해도 안전하다.
// 아이디·비밀번호는 .env.local의 ADMIN_USERNAME, ADMIN_PASSWORD에서 읽는다.
// 실행: npm run admin:create
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { config } from "dotenv";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { accounts, blogs, categories, items, profiles, userItems, users } from "../src/db/schema";

config({ path: ".env.local" });

const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

async function main() {
  if (!username || !password) throw new Error(".env.local에 ADMIN_USERNAME, ADMIN_PASSWORD를 적어 주세요");
  if (password.length < 8) throw new Error("관리자 비밀번호는 8자 이상이어야 해요");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  const hash = await hashPassword(password);

  try {
    await db.transaction(async (tx) => {
      // 1. 회원 (role = admin)
      let [user] = await tx.select({ id: users.id }).from(users).where(eq(users.username, username));
      if (user) {
        await tx.update(users).set({ role: "admin" }).where(eq(users.id, user.id));
      } else {
        [user] = await tx
          .insert(users)
          .values({
            id: randomUUID(),
            name: "관리자",
            email: `${username}@users.blogville.invalid`,
            emailVerified: true,
            username,
            displayUsername: username,
            role: "admin",
          })
          .returning({ id: users.id });
      }

      // 2. 아이디·비밀번호 로그인 정보 (Better Auth와 같은 형식: providerId = credential)
      const [account] = await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.userId, user.id), eq(accounts.providerId, "credential")));
      if (account) {
        await tx.update(accounts).set({ password: hash }).where(eq(accounts.id, account.id));
      } else {
        await tx.insert(accounts).values({ id: randomUUID(), userId: user.id, providerId: "credential", accountId: user.id, password: hash });
      }

      // 3. 온보딩: 공지사항 블로그 (이미 있으면 건너뜀)
      const [profile] = await tx.select({ userId: profiles.userId }).from(profiles).where(eq(profiles.userId, user.id));
      if (!profile) {
        const [character] = await tx.select({ id: items.id }).from(items).where(eq(items.code, "char_human"));
        const [background] = await tx.select({ id: items.id }).from(items).where(eq(items.code, "bg_meadow"));
        if (!character || !background) throw new Error("아이템이 없어요. 먼저 npm run db:seed 를 실행해 주세요");
        // 일반 회원과 똑같이 기본 캐릭터 3종 + 초원 (GAME-01)
        const starters = await tx
          .select({ id: items.id })
          .from(items)
          .where(and(eq(items.type, "character"), eq(items.isStarter, true)));
        await tx
          .insert(userItems)
          .values([...starters.map((s) => ({ userId: user.id, itemId: s.id })), { userId: user.id, itemId: background.id }])
          .onConflictDoNothing();
        await tx.insert(profiles).values({ userId: user.id, nickname: "관리자", characterItemId: character.id });
        const [blog] = await tx
          .insert(blogs)
          .values({ ownerId: user.id, slug: "notice", title: "Blogville 공지사항", description: "마을 소식과 업데이트를 알려드려요", backgroundItemId: background.id })
          .returning({ id: blogs.id });
        await tx.insert(categories).values({ blogId: blog.id, name: "공지", position: 0 });
      }
    });
    console.log(`✔ 관리자 계정 준비 완료: ${username}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
