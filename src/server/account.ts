// 내 정보의 로그인 수단 (AUTH-05 / FR-036~FR-041, contracts/account.md 1장)
import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { enabledProviders } from "@/lib/auth";
import { SOCIAL_LABEL, SOCIAL_PROVIDERS, type SocialProvider } from "@/lib/social";

export type SocialLogin = {
  provider: SocialProvider;
  label: string;
  /** 키가 준비된 서비스인지 (없으면 [연동하기] 비활성, FR-031) */
  ready: boolean;
  /** 연동한 날짜 (accounts.created_at). 연동하지 않았으면 null */
  linkedAt: Date | null;
};

/** 회원의 소셜 로그인 수단: 카카오·네이버·Google 순서로 서비스마다 연동 여부와 연동한 날짜 (FR-036) */
export async function getSocialLogins(userId: string): Promise<SocialLogin[]> {
  const rows = await db
    .select({ providerId: accounts.providerId, createdAt: accounts.createdAt })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), ne(accounts.providerId, "credential")));
  return SOCIAL_PROVIDERS.map((provider) => ({
    provider,
    label: SOCIAL_LABEL[provider],
    ready: enabledProviders[provider],
    // UNIQUE (user_id, provider_id)라 서비스마다 많아야 1행 (FR-039)
    linkedAt: rows.find((r) => r.providerId === provider)?.createdAt ?? null,
  }));
}

/** 그 서비스를 이미 연동했는지 */
export async function hasSocialLogin(userId: string, provider: SocialProvider): Promise<boolean> {
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, provider)))
    .limit(1);
  return !!row;
}
