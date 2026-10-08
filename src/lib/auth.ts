import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";

// 키가 설정된 소셜 로그인만 켠다
// 소셜 계정으로는 회원을 만들지 않는다 (AUTH-01 / FR-013, research R9).
// 연동되지 않은 소셜 계정은 errorCallbackURL로 ?error=signup_disabled (better-auth 1.7 소스로 확인)
function provider<T extends object>(id: string, extra?: T) {
  const clientId = process.env[`${id}_CLIENT_ID`];
  const clientSecret = process.env[`${id}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) return undefined;
  return { clientId, clientSecret, disableSignUp: true, ...extra };
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

// 로그인 유지 (AUTH-09 / FR-019~FR-023, research R6)
// - 유지(rememberMe): 7일. 라이브러리가 1시간 단위로 다시 7일로 늘린다 (SessionKeeper가 GET /api/auth/get-session을 부를 때)
// - 유지 안 함(기본): 쿠키 Max-Age 없음(브라우저를 닫으면 사라짐) + 서버 만료 2시간.
//   라이브러리는 이런 세션의 만료를 1일로 잡으므로(better-auth 1.7.7 internal-adapter createSession) 아래 세션 생성 훅이 2시간으로 고치고,
//   쓰는 동안의 2시간 연장과 "마지막 사용 2시간" 확인은 우리 getSession()(src/server/dal.ts)이 맡는다.
export const SESSION_REMEMBER_SECONDS = 7 * 24 * 60 * 60;
export const SESSION_SHORT_SECONDS = 2 * 60 * 60;

export const auth = betterAuth({
  appName: "Blogville",
  database: drizzleAdapter(db, { provider: "pg", schema, usePlural: true }),
  socialProviders: {
    ...(google && { google }),
    ...(kakao && { kakao }),
    ...(naver && { naver }),
  },
  // 아이디 + 비밀번호 로그인 (username 플러그인이 이메일·비밀번호 로그인 위에 아이디를 얹는다).
  // 가입은 우리 트랜잭션(src/server/signup.ts)만 한다. 라이브러리 가입(sign-up/email)은 끈다 (AUTH-01 / FR-007, FR-011)
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 8, maxPasswordLength: 64 },
  session: {
    expiresIn: SESSION_REMEMBER_SECONDS,
    updateAge: 60 * 60,
    additionalFields: {
      // sessions.remember_me. 서버는 쿠키(dont_remember)가 아니라 이 칸으로 2시간/7일을 정한다. 요청으로는 정할 수 없다 (input: false)
      rememberMe: { type: "boolean", required: false, defaultValue: false, input: false },
    },
  },
  databaseHooks: {
    session: {
      create: {
        // 세션을 만들 때 [로그인 상태 유지]와 만료를 정한다.
        // 아이디 로그인은 요청 본문의 rememberMe (우리 signIn/signUp Server Action이 auth.api.signInUsername에 넘긴다).
        // 그 밖의 경로(소셜 콜백 등)는 지금은 유지 안 함. 소셜의 [로그인 상태 유지](bv_remember 쿠키)는 US3(T038)에서 더한다
        before: async (session, ctx) => {
          const body = ctx?.body as { rememberMe?: unknown } | undefined;
          const rememberMe = body?.rememberMe === true;
          const expiresAt = rememberMe ? session.expiresAt : new Date(Date.now() + SESSION_SHORT_SECONDS * 1000);
          return { data: { ...session, rememberMe, expiresAt } };
        },
      },
    },
  },
  // 쿠키 속성은 라이브러리 기본값을 쓴다: HttpOnly, SameSite=Lax, Path=/,
  // BETTER_AUTH_URL이 https면 Secure + 이름에 __Secure- 접두 (better-auth 1.7.7 cookies/index.mjs로 확인, FR-023, research R14)
  user: {
    additionalFields: {
      // 관리자 여부. 가입 요청으로는 바꿀 수 없다 (input: false)
      role: { type: "string", required: false, defaultValue: "user", input: false },
    },
  },
  plugins: [
    username({
      minUsernameLength: 4,
      maxUsernameLength: 20,
      usernameValidator: (name) => /^[a-z0-9_]+$/.test(name), // 소문자로 정규화된 뒤 검사
      validationOrder: { username: "post-normalization" },
    }),
    nextCookies(), // Server Action에서 로그인 쿠키를 설정할 수 있게 한다 (마지막에 둔다)
  ],
});

export type Session = typeof auth.$Infer.Session;
