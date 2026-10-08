// 회원가입 트랜잭션 (AUTH-01 / FR-003, FR-006, FR-010, FR-011, FR-012, research R1, data-model 2.6)
// 회원·로그인 수단·보유 아이템·프로필·블로그·카테고리·가입 축하 코인을 한 트랜잭션으로 만든다.
// 하나라도 실패하면 전부 롤백되어 "가입했지만 프로필이 없는 회원"이 생기지 않는다 (FR-007).
// Better Auth의 가입 API(signUpEmail)는 쓰지 않는다 (라이브러리 가입 경로는 auth.ts·route.ts에서 닫았다).
import "server-only";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, blogs, categories, items, loginAttempts, profiles, userItems, users } from "@/db/schema";
import { newAuthId } from "@/lib/auth-id";
import { isReservedName } from "@/lib/names";
import { uniqueViolation } from "@/server/db-errors";
import { findNameConflict, hasNameConflict, lockName } from "@/server/names";
import { grantReward, lockUser } from "@/server/points";

export const SIGNUP_ERRORS = {
  reserved: "이 아이디는 쓸 수 없어요",
  taken: "이미 있는 아이디예요",
  character: "고를 수 없는 캐릭터예요", // spec에 없음 — 제안 (예전 온보딩 문구)
} as const;

export type CreateMemberInput = {
  /** 정규화(앞뒤 공백 제거·소문자)와 형식 검사를 마친 아이디 */
  username: string;
  password: string;
  /** 고른 기본 캐릭터의 items.id (parseId를 통과한 값) */
  characterId: number;
};

export type CreateMemberResult = { ok: true; userId: string } | { ok: false; error: string };

/** 트랜잭션 안에서 "거부"로 끝낼 때 던진다 (롤백 + 문구) */
class SignupRejected extends Error {}

// 이 제약 위반은 "누군가 같은 이름을 먼저 차지했다"는 뜻이다
const NAME_CONSTRAINTS = new Set(["users_username_unique", "users_email_unique", "blogs_slug_unique", "profiles_nickname_unique"]);

export async function createMember(input: CreateMemberInput): Promise<CreateMemberResult> {
  const { username, password, characterId } = input;
  if (isReservedName(username)) return { ok: false, error: SIGNUP_ERRORS.reserved };

  // 해시는 느리므로(의도된 계산) 트랜잭션 밖에서 먼저 계산해 트랜잭션·잠금을 짧게 둔다
  const passwordHash = await hashPassword(password);
  const userId = newAuthId();

  try {
    await db.transaction(async (tx) => {
      // 0) 같은 이름의 가입·주소/닉네임 변경과 줄을 세운 뒤, 다른 회원의 아이디·주소·닉네임과 겹치는지 확인
      await lockName(tx, username);
      if (hasNameConflict(await findNameConflict(tx, username))) throw new SignupRejected(SIGNUP_ERRORS.taken);

      // 고른 캐릭터가 정말 "기본 캐릭터"인지 서버에서 다시 확인 (요청 조작 방지, FR-011)
      const [character] = await tx
        .select({ id: items.id })
        .from(items)
        .where(and(eq(items.id, characterId), eq(items.type, "character"), eq(items.isStarter, true)));
      if (!character) throw new SignupRejected(SIGNUP_ERRORS.character);
      const [background] = await tx.select({ id: items.id }).from(items).where(eq(items.code, "bg_meadow"));
      if (!background) throw new Error("기본 배경(bg_meadow)이 없어요. npm run db:seed 를 실행해 주세요");

      // 1) 회원. role은 넣지 않아 DB 기본값 user (관리자는 scripts/create-admin.ts만)
      await tx.insert(users).values({
        id: userId,
        name: username,
        // 라이브러리 필수 칸이라 실제로 쓰지 않는 주소를 넣는다 (메일을 보내지 않고 화면에 나오지 않는다)
        email: `${username}@users.blogville.invalid`,
        emailVerified: false,
        username,
        displayUsername: username,
      });
      // 2) 아이디·비밀번호 로그인 수단 (Better Auth와 같은 형식: providerId = credential, accountId = 회원 ID)
      await tx.insert(accounts).values({ id: newAuthId(), userId, providerId: "credential", accountId: userId, password: passwordHash });
      // 3) 그 아이디의 로그인 실패 기록을 지운다 (새 계정이 가입 전 실패·잠금을 물려받지 않게, research R8)
      await tx.delete(loginAttempts).where(eq(loginAttempts.username, username));
      // 4) 보유 아이템: 고른 캐릭터 하나 + 초원 (GAME-01)
      await tx.insert(userItems).values([
        { userId, itemId: character.id },
        { userId, itemId: background.id },
      ]);
      // 5) 프로필: 닉네임 = 아이디 (나중에 blog의 내 정보에서 바꾼다)
      await tx.insert(profiles).values({ userId, nickname: username, characterItemId: character.id });
      // 6) 블로그: 주소 = 아이디
      const [blog] = await tx
        .insert(blogs)
        .values({ ownerId: userId, slug: username, title: `${username}의 블로그`, description: "", backgroundItemId: background.id })
        .returning({ id: blogs.id });
      // 7) 대분류 "일상"
      await tx.insert(categories).values({ blogId: blog.id, name: "일상", position: 0 });
      // 8) 가입 축하 🪙 100 (보상 규칙: CLAUDE.md, src/lib/game.ts)
      await lockUser(tx, userId);
      await grantReward(tx, userId, "signup");
    });
  } catch (err) {
    if (err instanceof SignupRejected) return { ok: false, error: err.message };
    const constraint = uniqueViolation(err);
    if (constraint !== null && NAME_CONSTRAINTS.has(constraint)) return { ok: false, error: SIGNUP_ERRORS.taken };
    throw err;
  }

  return { ok: true, userId };
}
