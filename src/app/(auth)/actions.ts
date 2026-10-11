"use server";

import { APIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth, enabledProviders, REMEMBER_COOKIE } from "@/lib/auth";
import { checkBlogTitle, defaultBlogFor } from "@/lib/blog";
import { parseId } from "@/lib/ids";
import { LOGIN_LOCKED_MESSAGE } from "@/lib/login-limit";
import { isReservedName, normalizeName, USERNAME_RE } from "@/lib/names";
import { isSocialProvider } from "@/lib/social";
import { getSession } from "@/server/dal";
import { clearLoginAttempts, reserveLoginAttempt } from "@/server/login-attempts";
import { createMember, SIGNUP_ERRORS } from "@/server/signup";

export type AuthFormState = {
  error?: string;
  values?: { username: string; blogTitle?: string; characterId?: string; rememberMe?: boolean };
};

// 검사 순서와 문구: contracts/auth-entry.md 2장 (위에서 처음 걸린 것 하나만 보여준다)
const signUpSchema = z
  .object({
    username: z
      .string()
      .transform(normalizeName)
      .pipe(z.string().regex(USERNAME_RE, "아이디는 영문 소문자, 숫자, _ 로 4~20자예요")),
    password: z.string().min(8, "비밀번호는 8자 이상이에요").max(64, "비밀번호는 64자까지예요"),
    passwordConfirm: z.string(),
  })
  .refine((v) => v.password === v.passwordConfirm, { message: "비밀번호가 서로 달라요", path: ["passwordConfirm"] });

/**
 * 회원가입 (AUTH-01 / FR-002~FR-008, FR-010, FR-011).
 * 입력 검사 → createMember(한 트랜잭션) → 커밋 뒤 라이브러리로 로그인 → 내 블로그(집 안).
 * 블로그 이름은 블로그 관리와 같은 규칙(checkBlogTitle)으로, 폼 순서대로 비밀번호 확인 다음에 검사한다 (2026-10-11 사용자 요청).
 * FormData의 다른 칸(예: role)은 읽지 않는다 (FR-011).
 */
export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (await getSession()) redirect("/town");

  const raw = {
    username: String(formData.get("username") ?? ""),
    password: String(formData.get("password") ?? ""),
    passwordConfirm: String(formData.get("passwordConfirm") ?? ""),
    blogTitle: String(formData.get("blogTitle") ?? ""),
    characterId: String(formData.get("characterId") ?? ""),
  };
  // 오류가 나면 입력한 아이디·블로그 이름과 고른 캐릭터를 다시 채운다. 비밀번호 칸은 비운다 (FR-005)
  const fail = (error: string): AuthFormState => ({
    error,
    values: { username: raw.username, blogTitle: raw.blogTitle, characterId: raw.characterId },
  });

  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { username, password } = parsed.data;
  const blogTitle = checkBlogTitle(raw.blogTitle);
  if (!blogTitle.ok) return fail(blogTitle.error);
  if (isReservedName(username)) return fail(SIGNUP_ERRORS.reserved);
  const characterId = parseId(raw.characterId);
  if (characterId === null) return fail(SIGNUP_ERRORS.character);

  const result = await createMember({ username, password, characterId, blogTitle: blogTitle.title });
  if (!result.ok) return fail(result.error);

  // 커밋 뒤 로그인 상태를 만든다. 세션 행·쿠키 서명은 라이브러리에 맡긴다 (nextCookies()가 쿠키를 심는다, research R2).
  // 가입 화면에는 [로그인 상태 유지]가 없으므로 유지 안 함으로 로그인한다.
  // 여기서 예상 밖 오류가 나도 회원 데이터는 온전하므로 첫 화면에서 다시 로그인하면 된다 (반쪽 회원이 아니다).
  await auth.api.signInUsername({ body: { username, password, rememberMe: false }, headers: await headers() });

  revalidatePath("/", "layout"); // 헤더에 코인·캐릭터가 바로 보이도록
  // 첫 가입은 내 블로그(집 안)에서 시작한다. 우리 집의 🚪 문으로 나가며 마을을 처음 본다 (마을 개편 2차)
  redirect(`/@${defaultBlogFor(username).slug}?welcome=1`);
}

/**
 * 아이디 로그인 (AUTH-09 / FR-015~FR-019, contracts/auth-entry.md 3장).
 * 아이디는 앞뒤 공백·대문자를 무시한다. 없는 아이디와 틀린 비밀번호는 같은 문구다 (아이디 존재 여부를 알리지 않는다).
 *
 * 로그인 시도 제한 (FR-025~FR-028, research R8): 같은 아이디로 5번 연속 실패하면 5분 동안 막는다.
 * 1) 비밀번호 확인 전에 짧은 트랜잭션으로 이번 시도를 실패로 미리 센다(잠금 중이면 거부).
 * 2) 그 트랜잭션이 끝난 뒤에 라이브러리 로그인을 부른다 (트랜잭션 안에서 부르면 연결 풀 교착).
 * 3) 성공하면 기록을 지운다. 없는 아이디도 똑같이 세고 같은 문구를 보여 존재 여부가 드러나지 않는다 (FR-027).
 * 화면을 거치지 않고 Server Action을 직접 보내도 이 함수를 지나므로 같게 적용된다 (FR-028).
 * 소셜 로그인은 이 경로를 지나지 않아 잠금이 적용되지 않는다 (spec Edge Case).
 */
export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const rawUsername = String(formData.get("username") ?? "");
  const username = normalizeName(rawUsername);
  const password = String(formData.get("password") ?? "");
  const rememberMe = formData.get("rememberMe") === "on";
  const fail = (error: string): AuthFormState => ({ error, values: { username: rawUsername, rememberMe } });
  if (!username || !password) return fail("아이디와 비밀번호를 적어 주세요");
  // 64자를 넘는 아이디는 있을 수 없다. 기록하지 않는다 (login_attempts.username CHECK 1~64자, 행 크기 상한)
  if (username.length > 64) return fail("아이디 또는 비밀번호가 맞지 않아요");

  if (!(await reserveLoginAttempt(username))) return fail(LOGIN_LOCKED_MESSAGE);
  try {
    // rememberMe를 늘 true/false로 넘긴다. 빠지면 라이브러리는 "유지"로 보고 쿠키에 Max-Age 7일을 심는다
    await auth.api.signInUsername({ body: { username, password, rememberMe }, headers: await headers() });
  } catch (err) {
    if (err instanceof APIError) return fail("아이디 또는 비밀번호가 맞지 않아요");
    throw err;
  }
  await clearLoginAttempts(username);

  if (rememberMe) {
    // better-auth 1.7.7은 유지로 다시 로그인해도 예전 유지 안 함 로그인이 남긴 dont_remember 쿠키를 지우지 않는다.
    // 남아 있으면 get-session이 연장을 건너뛰어(SessionKeeper가 7일로 늘리지 못함) 여기서 지운다
    const { authCookies } = await auth.$context;
    (await cookies()).delete({ name: authCookies.dontRememberToken.name, path: "/" });
  }

  revalidatePath("/", "layout");
  redirect("/town");
}

/**
 * 로그아웃 (AUTH-04 / FR-029, contracts/auth-entry.md 5장). 확인 없이 세션 행·쿠키를 지우고 첫 화면으로.
 * 로그인하지 않았어도 오류 없이 첫 화면으로 간다 (라이브러리 sign-out은 쿠키가 없으면 지울 것이 없을 뿐이다).
 */
export async function signOut(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  revalidatePath("/", "layout");
  redirect("/");
}

export type SocialStartState = { error?: string };

/**
 * 소셜 로그인 시작 (AUTH-01 / FR-032, contracts/auth-entry.md 4장, research R7).
 * 키가 있는 서비스만 받는다. 같은 카드의 [로그인 상태 유지]는 httpOnly 쿠키 bv_remember로 콜백까지 전달한다
 * (라이브러리 콜백은 rememberMe를 받지 않는다. src/lib/auth.ts의 세션 훅·콜백 훅이 이 쿠키를 읽고 지운다).
 * 라이브러리가 만든 소셜 서비스 주소로 이동한다. 연동되지 않은 소셜 계정이면 `/?error=signup_disabled`로 돌아온다.
 * 라이브러리 HTTP /sign-in/social은 닫혀 있다 (route.ts 허용 목록).
 */
export async function startSocialSignIn(provider: string, remember: boolean): Promise<SocialStartState> {
  if (await getSession()) redirect("/town");
  if (!isSocialProvider(provider) || !enabledProviders[provider]) return { error: "아직 연결 준비 중이에요" };

  (await cookies()).set(REMEMBER_COOKIE, remember === true ? "1" : "0", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.BETTER_AUTH_URL?.startsWith("https://") ?? false,
    path: "/",
    maxAge: 600, // 소셜 로그인 state와 같은 10분
  });
  const { url } = await auth.api.signInSocial({
    body: { provider, callbackURL: "/town", errorCallbackURL: "/", disableRedirect: true },
    headers: await headers(),
  });
  if (!url) return { error: "아직 연결 준비 중이에요" };
  redirect(url);
}
