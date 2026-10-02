"use server";

import { APIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";

export type AuthFormState = { error?: string; values?: { username: string } };

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{4,20}$/, "아이디는 영문 소문자, 숫자, _ 로 4~20자예요");

const signUpSchema = z
  .object({
    username: usernameSchema,
    password: z.string().min(8, "비밀번호는 8자 이상이에요").max(64, "비밀번호는 64자까지예요"),
    passwordConfirm: z.string(),
  })
  .refine((v) => v.password === v.passwordConfirm, { message: "비밀번호가 서로 달라요", path: ["passwordConfirm"] });

function errorCode(err: unknown): string | undefined {
  return err instanceof APIError ? (err.body as { code?: string } | undefined)?.code : undefined;
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = {
    username: String(formData.get("username") ?? ""),
    password: String(formData.get("password") ?? ""),
    passwordConfirm: String(formData.get("passwordConfirm") ?? ""),
  };
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: { username: raw.username } };
  const { username, password } = parsed.data;

  try {
    await auth.api.signUpEmail({
      body: {
        // 아이디로만 가입하므로 실제로 쓰지 않는 대체 이메일을 넣는다 (로그인 라이브러리가 이메일을 필수로 요구)
        email: `${username}@users.blogville.invalid`,
        password,
        name: username,
        username,
      },
      headers: await headers(),
    });
  } catch (err) {
    const code = errorCode(err);
    if (code === "USERNAME_IS_ALREADY_TAKEN" || code?.startsWith("USER_ALREADY_EXISTS")) {
      return { error: "이미 있는 아이디예요", values: { username: raw.username } };
    }
    if (code === "INVALID_USERNAME" || code === "USERNAME_TOO_SHORT" || code === "USERNAME_TOO_LONG") {
      return { error: "아이디는 영문 소문자, 숫자, _ 로 4~20자예요", values: { username: raw.username } };
    }
    throw err;
  }

  revalidatePath("/", "layout");
  redirect("/onboarding");
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { error: "아이디와 비밀번호를 적어 주세요", values: { username } };

  try {
    await auth.api.signInUsername({ body: { username, password }, headers: await headers() });
  } catch (err) {
    if (err instanceof APIError) return { error: "아이디 또는 비밀번호가 맞지 않아요", values: { username } };
    throw err;
  }

  revalidatePath("/", "layout");
  redirect("/town"); // 온보딩 전이면 광장에서 온보딩으로 보낸다
}
