import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { expireCookie, setSessionCookie } from "better-auth/cookies";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { SOCIAL_PROVIDERS, type SocialReady } from "@/lib/social";

// 소셜 로그인 (AUTH-01, AUTH-05 / FR-013, FR-030~FR-035, research R9)
// - 키가 설정된 서비스만 켠다. 키가 없으면 그 버튼은 비활성 (FR-031)
// - 소셜 계정으로는 회원을 만들지 않는다 (disableSignUp). 연동되지 않은 소셜 계정은 errorCallbackURL로
//   ?error=signup_disabled (better-auth 1.7.7 callback.mjs·link-account.mjs로 확인)
// - 이메일을 요청하지 않는다 (FR-035). 라이브러리는 사용자 정보에 이메일이 없으면 로그인을 거부하므로(email_not_found)
//   mapProfileToUser가 늘 대체 이메일을 넣는다. 소셜로 회원을 만들지 않으므로 이 값은 users에 저장되지 않는다.
//   서비스가 이메일을 주더라도 쓰지 않는다 (받은 개인정보를 쓰지 않는다)
function provider<T extends object>(id: string, extra?: T) {
  const clientId = process.env[`${id}_CLIENT_ID`];
  const clientSecret = process.env[`${id}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) return undefined;
  return { clientId, clientSecret, disableSignUp: true, ...extra };
}

// 대체 이메일 (실제로 메일을 보내지 않는다. 회원 이메일 {아이디}@users.blogville.invalid와 겹치지 않는다)
const fallbackEmail = (providerId: string, accountId: string | number) =>
  `${providerId}_${accountId}@${providerId}.blogville.invalid`;

const google = provider("GOOGLE", {
  // 이메일 범위를 빼고 계정 식별자·이름·사진만 (FR-035). 계정 식별자는 id token의 sub (google.mjs accountSubject)
  disableDefaultScope: true,
  scope: ["openid", "profile"],
  mapProfileToUser: (profile: { sub: string }) => ({ email: fallbackEmail("google", profile.sub), emailVerified: false }),
});
const kakao = provider("KAKAO", {
  // 닉네임과 프로필 사진만 요청한다
  disableDefaultScope: true,
  scope: ["profile_nickname", "profile_image"],
  mapProfileToUser: (profile: { id: number }) => ({ email: fallbackEmail("kakao", profile.id), emailVerified: false }),
});
const naver = provider("NAVER", {
  // 네이버는 제공 정보를 개발자 센터에서 고른다 (이메일을 고르지 않는다, quickstart 6장). 요청 범위에도 email을 넣지 않는다
  disableDefaultScope: true,
  scope: ["profile"],
  mapProfileToUser: (profile: { response: { id: string } }) => ({
    email: fallbackEmail("naver", profile.response.id),
    emailVerified: false,
  }),
});

/** 소셜 로그인의 [로그인 상태 유지]를 콜백까지 전달하는 쿠키 (값 "1"/"0", startSocialSignIn이 심는다, research R7) */
export const REMEMBER_COOKIE = "bv_remember";

/** 소셜 행에 남기지 않는 칸: 토큰·만료·scope (FR-035). 우리 서비스는 소셜 API를 부르지 않는다 */
const NO_TOKENS = {
  accessToken: null,
  refreshToken: null,
  idToken: null,
  accessTokenExpiresAt: null,
  refreshTokenExpiresAt: null,
  scope: null,
};

export const enabledProviders: SocialReady = {
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

/** 소셜 서비스에서 돌아오는 라이브러리 경로 (/callback/:id) */
const isSocialCallback = (path: string | undefined) => !!path?.startsWith("/callback/");

export const auth = betterAuth({
  appName: "Blogville",
  database: drizzleAdapter(db, { provider: "pg", schema, usePlural: true }),
  socialProviders: {
    ...(google && { google }),
    ...(kakao && { kakao }),
    ...(naver && { naver }),
  },
  account: {
    // 소셜 로그인 때 토큰을 다시 저장하지 않는다 (FR-035)
    updateAccountOnSignIn: false,
    accountLinking: {
      // 내 정보의 [연동하기]에 필요하다 (FR-037)
      enabled: true,
      // 이메일이 같다는 이유로 기존 회원에 붙이지 않는다 (FR-034). 회원 이메일은 모두 .invalid라 겹치지도 않는다
      disableImplicitLinking: true,
      // 회원 이메일과 소셜 대체 이메일은 늘 다르다
      allowDifferentEmails: true,
      // 소셜 이메일을 받지 않으므로(인증된 이메일이 없음) 연동을 허락하려면 서비스를 신뢰 목록에 둬야 한다.
      // 자동 연결은 위 disableImplicitLinking이 막는다 (link-account.mjs handleOAuthUserInfo)
      trustedProviders: [...SOCIAL_PROVIDERS],
      // 연동해도 회원 이름·사진을 소셜 값으로 바꾸지 않는다 (기본 false, 명시)
      updateUserInfoOnLink: false,
    },
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
        // 소셜 로그인 콜백은 startSocialSignIn이 심은 bv_remember 쿠키 (research R7). 그 밖은 유지 안 함
        before: async (session, ctx) => {
          const body = ctx?.body as { rememberMe?: unknown } | undefined;
          const rememberMe = isSocialCallback(ctx?.path) ? ctx?.getCookie(REMEMBER_COOKIE) === "1" : body?.rememberMe === true;
          // 라이브러리는 dont_remember 쿠키가 남아 있으면 1일로 잡는다. 여기서 7일/2시간으로 정한다
          const expiresAt = new Date(Date.now() + (rememberMe ? SESSION_REMEMBER_SECONDS : SESSION_SHORT_SECONDS) * 1000);
          return { data: { ...session, rememberMe, expiresAt } };
        },
      },
    },
    // 소셜 로그인 수단 행에 토큰·만료·scope를 남기지 않는다 (FR-035, research R9). 연동 때 만들고, 같은 계정을 다시 연동하면 고친다
    account: {
      create: {
        before: async (account) => ({ data: account.providerId === "credential" ? account : { ...account, ...NO_TOKENS } }),
      },
      update: {
        // 아이디 로그인 행의 고침은 비밀번호뿐이다. 그 밖의 고침(같은 소셜 계정 다시 연동)은 토큰 칸을 비운다
        before: async (account) => ({ data: account.password ? account : { ...account, ...NO_TOKENS } }),
      },
    },
  },
  hooks: {
    // 소셜 로그인 콜백의 [로그인 상태 유지] 쿠키 (research R7).
    // 라이브러리 콜백은 rememberMe를 받지 않고, 예전 dont_remember 쿠키가 있는지만 보고 세션 쿠키를 심는다.
    // 그래서 콜백이 끝난 뒤 bv_remember에 맞춰 세션 쿠키를 다시 심는다 (같은 이름의 Set-Cookie는 뒤의 것이 이긴다).
    // - 유지 안 함: 만료 없는 쿠키(브라우저 종료) + dont_remember. 서버 만료 2시간은 위 세션 훅과 getSession()이 맡는다
    // - 유지: 7일 쿠키 + 남아 있던 dont_remember 삭제 (남아 있으면 get-session이 7일 연장을 건너뛴다)
    // 연동 콜백·오류로 돌아갈 때는 새 세션이 없다. 어느 경우든 bv_remember는 지운다
    after: createAuthMiddleware(async (ctx) => {
      if (!isSocialCallback(ctx.path)) return;
      const remember = ctx.getCookie(REMEMBER_COOKIE) === "1";
      if (ctx.getCookie(REMEMBER_COOKIE) != null) ctx.setCookie(REMEMBER_COOKIE, "", { path: "/", maxAge: 0 });
      const newSession = ctx.context.newSession;
      if (!newSession) return;
      await setSessionCookie(ctx, newSession, !remember);
      if (remember) expireCookie(ctx, ctx.context.authCookies.dontRememberToken);
    }),
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
