"use server";

// 내 정보: 소셜 연동·해제 (AUTH-05 / FR-037~FR-042, contracts/account.md 2·3장, research R10)
// 대상은 늘 로그인한 나(requireMember)다. 다른 회원 ID를 입력으로 받지 않는다 (FR-042).
// 다른 사이트에서 보낸 요청은 Next.js Server Action의 Origin 확인이 막는다 (FR-024).
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { auth, enabledProviders } from "@/lib/auth";
import { isSocialProvider } from "@/lib/social";
import { hasSocialLogin } from "@/server/account";
import { requireMember } from "@/server/dal";

/**
 * 소셜 연동 시작. 소셜 서비스 로그인·동의 화면으로 이동한다.
 * 돌아오면 성공 `/settings/account?linked={서비스}`, 실패 `/settings/account?provider={서비스}&error={코드}`.
 * 아무것도 하지 않음: 목록 밖 서비스, 키가 없는 서비스, 이미 연동한 서비스 (FR-039 "요청을 조작해 보내도 거부").
 * 두 탭에서 동시에 연동해도 UNIQUE (user_id, provider_id)가 서비스마다 1개를 지킨다.
 * 라이브러리 HTTP /link-social은 닫혀 있고 서버에서 auth.api.linkSocialAccount를 부른다.
 */
export async function startLinkSocial(provider: string): Promise<void> {
  const viewer = await requireMember();
  if (!isSocialProvider(provider) || !enabledProviders[provider]) return;
  if (await hasSocialLogin(viewer.userId, provider)) return;

  const { url } = await auth.api.linkSocialAccount({
    body: {
      provider,
      callbackURL: `/settings/account?linked=${provider}`,
      errorCallbackURL: `/settings/account?provider=${provider}`,
      disableRedirect: true,
    },
    headers: await headers(),
  });
  if (url) redirect(url);
}

/**
 * 소셜 연동 해제: 그 서비스의 내 소셜 행만 지운다 (FR-040).
 * 아이디 로그인(credential)이나 목록 밖 값은 아무것도 지우지 않는다 (FR-041). 연동하지 않은 서비스면 0행.
 * 라이브러리 unlinkAccount는 쓰지 않는다 (credential을 막지 못한다, research R10).
 */
export async function unlinkSocial(provider: string): Promise<void> {
  const viewer = await requireMember();
  if (!isSocialProvider(provider)) return;
  await db.delete(accounts).where(and(eq(accounts.userId, viewer.userId), eq(accounts.providerId, provider)));
  revalidatePath("/settings/account");
}
