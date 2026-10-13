import "server-only";
import type { BetterAuthPlugin } from "better-auth";
import { authorizationCodeRequest, getOAuth2Tokens } from "better-auth/oauth2";

// 소셜 서비스로 나가는 요청의 시간 제한 (AUTH-01 / NF-19, 2026-10-13)
// 콜백(/api/auth/callback/{서비스})은 서버가 소셜 서비스에 두 번 요청한다: ① 코드 → 토큰 교환 ② 사용자 정보.
// better-auth 1.7.7의 기본 구현은 시간 제한이 없어, 서비스가 응답하지 않으면 사용자는 빈 화면에서 오래 기다린다.
// 라이브러리가 열어 둔 고침 자리는 사용자 정보(getUserInfo 옵션)뿐이고 토큰 교환(validateAuthorizationCode)에는 옵션이 없다.
// 그래서 작은 플러그인이 시작할 때(init) 켜진 서비스의 두 함수를 같은 동작 + 3분 제한으로 바꿔 끼운다.
// - 토큰 교환: 요청 본문·인증은 라이브러리 함수(authorizationCodeRequest)로 똑같이 만들고, 보내기만 fetch + AbortSignal.timeout
// - 사용자 정보: 카카오·네이버는 같은 주소를 같은 방식으로 부른다. Google은 토큰에 든 id_token을 읽기만 해서(네트워크 없음) 그대로 둔다
// 3분가 지나면 요청을 끊고(abort) 라이브러리가 invalid_code / unable_to_get_user_info로 돌려보낸다 → 화면 문구는 src/lib/social-errors.ts

/** 소셜 서비스 요청 하나의 제한 시간 (ms) */
export const OAUTH_FETCH_TIMEOUT_MS = 180_000;

/** 서비스별 토큰 주소 (better-auth 1.7.7 @better-auth/core social-providers와 같은 값) */
const TOKEN_ENDPOINT: Record<string, string> = {
  google: "https://oauth2.googleapis.com/token",
  kakao: "https://kauth.kakao.com/oauth/token",
  naver: "https://nid.naver.com/oauth2.0/token",
};

/** 서비스별 사용자 정보 주소. 없으면(Google) 라이브러리 것을 그대로 쓴다 */
const USERINFO_ENDPOINT: Record<string, string> = {
  kakao: "https://kapi.kakao.com/v2/user/me",
  naver: "https://openapi.naver.com/v1/nid/me",
};

/**
 * 시간 제한이 있는 JSON 요청. 리다이렉트는 따라가지 않는다(라이브러리의 fetchRefusingRedirects와 같게).
 * 실패(시간 초과·2xx 아님·JSON 아님)는 던진다. timeoutMs는 테스트용
 */
export async function fetchJsonWithTimeout(url: string, init: RequestInit = {}, timeoutMs = OAUTH_FETCH_TIMEOUT_MS): Promise<unknown> {
  const res = await fetch(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`OAUTH_HTTP_${res.status} ${new URL(url).host}`);
  return res.json();
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});
const str = (v: unknown) => (typeof v === "string" ? v : undefined);

/** 라이브러리 기본 getUserInfo와 같은 모양으로 고친 사용자 정보 (kakao.mjs·naver.mjs) */
function userFromProfile(id: string, profile: Json) {
  if (id === "kakao") {
    const account = obj(profile.kakao_account);
    const p = obj(account.profile);
    return {
      name: str(p.nickname) ?? str(account.name) ?? "",
      email: str(account.email),
      image: str(p.profile_image_url) ?? str(p.thumbnail_image_url),
      emailVerified: !!account.is_email_valid && !!account.is_email_verified,
    };
  }
  const res = obj(profile.response);
  return { name: str(res.name) ?? str(res.nickname) ?? "", email: str(res.email), image: str(res.profile_image), emailVerified: false };
}

/** 소셜 서비스 요청에 3분 제한을 거는 플러그인 (src/lib/auth.ts plugins) */
export const oauthTimeout = () =>
  ({
    id: "blogville-oauth-timeout",
    init(ctx) {
      for (const provider of ctx.socialProviders) {
        const tokenEndpoint = TOKEN_ENDPOINT[provider.id];
        if (!tokenEndpoint) continue;
        const options = provider.options ?? {};

        // ① 코드 → 토큰. Google만 PKCE(codeVerifier)를 쓴다 (라이브러리 google.mjs. 카카오·네이버는 보내지 않는다)
        provider.validateAuthorizationCode = async ({ code, codeVerifier, redirectURI }) => {
          const { body, headers } = await authorizationCodeRequest({
            code,
            codeVerifier: provider.id === "google" ? codeVerifier : undefined,
            redirectURI,
            options,
            tokenEndpoint,
          });
          const data = obj(await fetchJsonWithTimeout(tokenEndpoint, { method: "POST", body, headers }));
          return getOAuth2Tokens(data);
        };

        // ② 사용자 정보 (카카오·네이버). 실패하면 null → 라이브러리가 unable_to_get_user_info로 돌려보낸다
        const userinfo = USERINFO_ENDPOINT[provider.id];
        if (!userinfo) continue;
        provider.getUserInfo = async (token) => {
          const profile = obj(
            await fetchJsonWithTimeout(userinfo, { headers: { Authorization: `Bearer ${token.accessToken}` } }).catch((e) => {
              ctx.logger.error(`[oauth-timeout] ${provider.id} 사용자 정보 실패`, e);
              return null;
            }),
          );
          if (provider.id === "kakao" ? profile.id == null : profile.resultcode !== "00") return null;
          // 우리 설정의 mapProfileToUser(대체 이메일)를 라이브러리처럼 덮어쓴다
          const userMap = await options.mapProfileToUser?.(profile as never);
          return { user: { ...userFromProfile(provider.id, profile), ...userMap }, data: profile };
        };
      }
    },
  }) satisfies BetterAuthPlugin;
