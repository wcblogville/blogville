"use server";

import { APIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { parseId } from "@/lib/ids";
import { isReservedName, normalizeName, USERNAME_RE } from "@/lib/names";
import { getSession } from "@/server/dal";
import { createMember, SIGNUP_ERRORS } from "@/server/signup";

export type AuthFormState = { error?: string; values?: { username: string; characterId?: string; rememberMe?: boolean } };

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
 * 입력 검사 → createMember(한 트랜잭션) → 커밋 뒤 라이브러리로 로그인 → 광장.
 * FormData의 다른 칸(예: role)은 읽지 않는다 (FR-011).
 */
export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (await getSession()) redirect("/town");

  const raw = {
    username: String(formData.get("username") ?? ""),
    password: String(formData.get("password") ?? ""),
    passwordConfirm: String(formData.get("passwordConfirm") ?? ""),
    characterId: String(formData.get("characterId") ?? ""),
  };
  // 오류가 나면 입력한 아이디와 고른 캐릭터를 다시 채운다. 비밀번호 칸은 비운다 (FR-005)
  const fail = (error: string): AuthFormState => ({ error, values: { username: raw.username, characterId: raw.characterId } });

  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { username, password } = parsed.data;
  if (isReservedName(username)) return fail(SIGNUP_ERRORS.reserved);
  const characterId = parseId(raw.characterId);
  if (characterId === null) return fail(SIGNUP_ERRORS.character);

  const result = await createMember({ username, password, characterId });
  if (!result.ok) return fail(result.error);

  // 커밋 뒤 로그인 상태를 만든다. 세션 행·쿠키 서명은 라이브러리에 맡긴다 (nextCookies()가 쿠키를 심는다, research R2).
  // 가입 화면에는 [로그인 상태 유지]가 없으므로 유지 안 함으로 로그인한다.
  // 여기서 예상 밖 오류가 나도 회원 데이터는 온전하므로 첫 화면에서 다시 로그인하면 된다 (반쪽 회원이 아니다).
  await auth.api.signInUsername({ body: { username, password, rememberMe: false }, headers: await headers() });

  revalidatePath("/", "layout"); // 헤더에 코인·캐릭터가 바로 보이도록
  redirect("/town?welcome=1");
}

/**
 * 아이디 로그인 (AUTH-09 / FR-015~FR-019, contracts/auth-entry.md 3장).
 * 아이디는 앞뒤 공백·대문자를 무시한다. 없는 아이디와 틀린 비밀번호는 같은 문구다 (아이디 존재 여부를 알리지 않는다).
 * 로그인 시도 제한(FR-025~)은 US6(T060)에서 이 함수에 더한다.
 */
export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const rawUsername = String(formData.get("username") ?? "");
  const username = normalizeName(rawUsername);
  const password = String(formData.get("password") ?? "");
  const rememberMe = formData.get("rememberMe") === "on";
  const fail = (error: string): AuthFormState => ({ error, values: { username: rawUsername, rememberMe } });
  if (!username || !password) return fail("아이디와 비밀번호를 적어 주세요");

  try {
    // rememberMe를 늘 true/false로 넘긴다. 빠지면 라이브러리는 "유지"로 보고 쿠키에 Max-Age 7일을 심는다
    await auth.api.signInUsername({ body: { username, password, rememberMe }, headers: await headers() });
  } catch (err) {
    if (err instanceof APIError) return fail("아이디 또는 비밀번호가 맞지 않아요");
    throw err;
  }

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
