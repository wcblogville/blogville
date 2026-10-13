// 소셜 로그인·연동에서 돌아온 오류 코드 → 화면 문구 (AUTH-01, AUTH-05 / NF-19). 문구는 여기 한 곳에서만 정한다.
// 코드는 better-auth 1.7.7이 errorCallbackURL(또는 onAPIError.errorURL)에 붙이는 ?error= 값
// (api/routes/callback.mjs, oauth2/state.mjs, oauth2/errors.mjs OAUTH_CALLBACK_ERROR_CODES)과
// 소셜 서비스가 그대로 넘겨주는 OAuth 표준 오류(access_denied 등)다.
// 어떤 코드든 주소의 글자를 화면에 그대로 옮기지 않는다 (문구는 늘 이 표에서 고른다).
import { isSocialProvider, SOCIAL_LABEL } from "./social";

/** 어디서 돌아왔는지: 첫 화면 로그인(/) 또는 회원정보 수정의 연동(/settings/account) */
export type SocialErrorPlace = "login" | "link";

/** 문구 종류. cancel은 부드러운 안내(내가 취소), 나머지는 다시 해 볼 일 */
export type SocialErrorKind = "cancel" | "expired" | "provider" | "notLinked" | "linkedElsewhere" | "linkFailed" | "unknown";

/** 취소·동의 안 함 (서비스 화면에서 [취소]·[동의 안 함]을 누름. OAuth 표준 오류 코드) */
const CANCEL = ["access_denied", "user_cancelled", "user_canceled", "consent_required", "login_required", "interaction_required"];
/** 로그인을 시작한 지 10분이 지났거나(state 만료), 다른 브라우저·탭에서 돌아와 시작 기록이 없음 */
const EXPIRED = ["state_not_found", "state_mismatch", "state_invalid", "invalid_callback_request", "no_code", "no_callback_url"];
/** 소셜 서비스와 주고받다 실패 (코드 교환 실패·10초 안에 응답 없음·사용자 정보 못 받음·서비스 장애) */
const PROVIDER = [
  "invalid_code",
  "unable_to_get_user_info",
  "server_error",
  "temporarily_unavailable",
  "oauth_provider_not_found",
  "issuer_mismatch",
  "issuer_missing",
  "nonce_binding_missing",
];
/** 어떤 회원에도 연동되지 않은 소셜 계정으로 로그인 (FR-033. disableSignUp → signup_disabled) */
const NOT_LINKED = ["signup_disabled", "account_not_linked", "email_not_found"];

const KIND_OF = new Map<string, SocialErrorKind>([
  ...CANCEL.map((c) => [c, "cancel"] as const),
  ...EXPIRED.map((c) => [c, "expired"] as const),
  ...PROVIDER.map((c) => [c, "provider"] as const),
  ...NOT_LINKED.map((c) => [c, "notLinked"] as const),
  ["account_already_linked_to_different_user", "linkedElsewhere"],
  ["unable_to_link_account", "linkFailed"],
  ["email_does_not_match", "linkFailed"],
  ["email_not_verified", "linkFailed"],
]);

/** 오류 코드의 문구 종류. 코드가 없으면 null, 모르는 코드는 unknown */
export function socialErrorKind(code: unknown): SocialErrorKind | null {
  if (typeof code !== "string" || !code) return null;
  return KIND_OF.get(code) ?? "unknown";
}

/** 첫 화면 연동 없음 문구 (FR-033, e2e/signup.mjs가 같은 글자로 확인) */
export const NOT_LINKED_MESSAGE = "연동된 계정이 없어요. 아이디로 로그인한 뒤 회원정보 수정에서 연동해 주세요";

export type SocialErrorNotice = { kind: SocialErrorKind; /** 취소는 안내(status), 나머지는 경고(alert) */ tone: "info" | "error"; text: string };

/**
 * 돌아온 오류 코드를 화면 문구로. 코드가 없으면 null.
 * provider는 주소의 ?provider= (연동은 늘 있고, 로그인은 startSocialSignIn이 붙인다). 모르는 값이면 "소셜 서비스"로 쓴다
 */
export function socialErrorMessage(code: unknown, opts: { place: SocialErrorPlace; provider?: unknown }): SocialErrorNotice | null {
  const kind = socialErrorKind(code);
  if (!kind) return null;
  const service = isSocialProvider(opts.provider) ? SOCIAL_LABEL[opts.provider] : "소셜 서비스";
  const login = opts.place === "login";
  const text = ((): string => {
    switch (kind) {
      case "cancel":
        return login ? "로그인을 취소했어요" : "연동을 취소했어요";
      case "expired":
        return login ? "로그인 시간이 지났어요. 다시 시도해 주세요" : "연동 시간이 지났어요. 다시 시도해 주세요";
      case "provider":
        return `${service}에서 정보를 못 받았어요. 잠시 뒤 다시 시도해 주세요`;
      case "notLinked":
        return login ? NOT_LINKED_MESSAGE : `${service} 계정을 연동하지 못했어요. 잠시 뒤 다시 시도해 주세요`;
      case "linkedElsewhere":
        return `이미 다른 Blogville 계정에 연동된 ${service} 계정이에요`;
      case "linkFailed":
        return `${service} 계정을 연동하지 못했어요. 잠시 뒤 다시 시도해 주세요`;
      case "unknown":
        return login ? "로그인하지 못했어요. 잠시 뒤 다시 시도해 주세요" : "연동하지 못했어요. 잠시 뒤 다시 시도해 주세요";
    }
  })();
  return { kind, tone: kind === "cancel" ? "info" : "error", text };
}
