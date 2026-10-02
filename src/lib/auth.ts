import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";

const isDev = process.env.NODE_ENV !== "production";

// 키가 설정된 소셜 로그인만 켠다
function provider<T extends object>(id: string, extra?: T) {
  const clientId = process.env[`${id}_CLIENT_ID`];
  const clientSecret = process.env[`${id}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) return undefined;
  return { clientId, clientSecret, ...extra };
}

// 이메일을 주지 않는 소셜 계정용 대체 주소 (실제로 메일을 보내지 않는다)
const fallbackEmail = (providerId: string, accountId: string | number) =>
  `${providerId}_${accountId}@${providerId}.blogville.invalid`;

const google = provider("GOOGLE");
const kakao = provider("KAKAO", {
  // 개인 개발자 앱은 이메일 동의항목을 쓰기 어려워서 닉네임과 프로필 사진만 요청한다
  disableDefaultScope: true,
  scope: ["profile_nickname", "profile_image"],
  mapProfileToUser: (profile: { id: number; kakao_account?: { email?: string } }) => ({
    email: profile.kakao_account?.email ?? fallbackEmail("kakao", profile.id),
  }),
});
const naver = provider("NAVER", {
  mapProfileToUser: (profile: { response: { id: string; email?: string } }) => ({
    email: profile.response.email ?? fallbackEmail("naver", profile.response.id),
  }),
});

export const enabledProviders = {
  google: Boolean(google),
  kakao: Boolean(kakao),
  naver: Boolean(naver),
};

export const auth = betterAuth({
  appName: "Blogville",
  database: drizzleAdapter(db, { provider: "pg", schema, usePlural: true }),
  socialProviders: {
    ...(google && { google }),
    ...(kakao && { kakao }),
    ...(naver && { naver }),
  },
  // 개발용 임시 계정 로그인: 소셜 로그인 키를 받기 전 테스트용, 배포 환경에서는 꺼진다
  emailAndPassword: { enabled: isDev },
  plugins: [nextCookies()], // Server Action에서 로그인 쿠키를 설정할 수 있게 한다 (마지막에 둔다)
});

export type Session = typeof auth.$Infer.Session;
